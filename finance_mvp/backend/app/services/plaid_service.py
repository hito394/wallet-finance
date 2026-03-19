"""
Plaid integration service.

Handles:
  - Creating link tokens (to open Plaid Link in the browser)
  - Exchanging public tokens for access tokens
  - Fetching account information
  - Syncing transactions via the /transactions/sync endpoint (cursor-based)

The service is a no-op when PLAID_CLIENT_ID is empty, so the feature
degrades gracefully when credentials are not configured.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal

import plaid
from plaid.api import plaid_api
from plaid.api_client import ApiClient
from plaid.configuration import Configuration
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
from plaid.model.item_public_token_exchange_request import (
    ItemPublicTokenExchangeRequest,
)
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from sqlalchemy.orm import Session

from sqlalchemy import select

from app.core.config import settings
from app.models.category import Category
from app.models.plaid_item import BankAccount, PlaidItem
from app.models.transaction import Transaction, TransactionDirection, TransactionSource
from app.services.categorization.engine import categorize_transaction
from app.services.dedupe.duplicate_detector import find_duplicate_by_fingerprint
from app.services.normalization.merchant_normalizer import normalize_merchant
from app.utils.fingerprint import transaction_fingerprint

log = logging.getLogger(__name__)

_ENV_MAP = {
    "sandbox":     plaid.Environment.Sandbox,
    "development": plaid.Environment.Development,
    "production":  plaid.Environment.Production,
}


def _get_client() -> plaid_api.PlaidApi:
    if not settings.plaid_client_id or not settings.plaid_secret:
        raise RuntimeError(
            "Plaid credentials are not configured. "
            "Set PLAID_CLIENT_ID and PLAID_SECRET environment variables."
        )
    host = _ENV_MAP.get(settings.plaid_env, plaid.Environment.Sandbox)
    configuration = Configuration(
        host=host,
        api_key={"clientId": settings.plaid_client_id, "secret": settings.plaid_secret},
    )
    return plaid_api.PlaidApi(ApiClient(configuration))


# ──────────────────────────────────────────────────────────────────────────────
# Link token
# ──────────────────────────────────────────────────────────────────────────────

def create_link_token(user_id: str) -> str:
    """Return a short-lived link_token for Plaid Link."""
    client = _get_client()
    req = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Wallet Finance",
        country_codes=[CountryCode("US"), CountryCode("JP")],
        language="ja",
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
    )
    resp = client.link_token_create(req)
    return resp["link_token"]


# ──────────────────────────────────────────────────────────────────────────────
# Token exchange + account setup
# ──────────────────────────────────────────────────────────────────────────────

def exchange_public_token(
    db: Session,
    *,
    public_token: str,
    user_id,
    entity_id,
) -> PlaidItem:
    """
    Exchange a public_token for a permanent access_token, persist a PlaidItem,
    and upsert associated BankAccount rows.
    """
    client = _get_client()

    # 1. Exchange
    exchange_resp = client.item_public_token_exchange(
        ItemPublicTokenExchangeRequest(public_token=public_token)
    )
    access_token = exchange_resp["access_token"]
    plaid_item_id = exchange_resp["item_id"]

    # 2. Fetch institution name
    institution_id = None
    institution_name = None
    try:
        item_resp = client.item_get({"access_token": access_token})
        institution_id = item_resp["item"].get("institution_id")
        if institution_id:
            inst_resp = client.institutions_get_by_id(
                InstitutionsGetByIdRequest(
                    institution_id=institution_id,
                    country_codes=[CountryCode("US"), CountryCode("JP")],
                )
            )
            institution_name = inst_resp["institution"]["name"]
    except Exception:
        pass

    # 3. Upsert PlaidItem
    item = db.query(PlaidItem).filter_by(plaid_item_id=plaid_item_id).first()
    if item is None:
        item = PlaidItem(
            user_id=user_id,
            entity_id=entity_id,
            plaid_item_id=plaid_item_id,
            access_token=access_token,
            institution_id=institution_id,
            institution_name=institution_name,
        )
        db.add(item)
    else:
        item.access_token = access_token

    db.flush()

    # 4. Fetch accounts and upsert BankAccount rows
    accounts_resp = client.accounts_get(AccountsGetRequest(access_token=access_token))
    for acct in accounts_resp["accounts"]:
        ba = db.query(BankAccount).filter_by(plaid_account_id=acct["account_id"]).first()
        balances = acct.get("balances", {})
        if ba is None:
            ba = BankAccount(
                plaid_item_id=item.id,
                user_id=user_id,
                entity_id=entity_id,
                plaid_account_id=acct["account_id"],
                name=acct.get("name", ""),
                official_name=acct.get("official_name"),
                account_type=str(acct.get("type", "")),
                account_subtype=str(acct.get("subtype", "")),
                mask=acct.get("mask"),
                currency=(balances.get("iso_currency_code") or "USD"),
                current_balance=_decimal(balances.get("current")),
                available_balance=_decimal(balances.get("available")),
            )
            db.add(ba)
        else:
            ba.current_balance   = _decimal(balances.get("current"))
            ba.available_balance = _decimal(balances.get("available"))

    db.commit()
    db.refresh(item)
    return item


# ──────────────────────────────────────────────────────────────────────────────
# Transaction sync
# ──────────────────────────────────────────────────────────────────────────────

def sync_transactions(db: Session, item: PlaidItem, entity_id) -> dict:
    """
    Pull new / modified / removed transactions from Plaid using cursor-based sync.
    Returns a summary dict with added / modified / removed counts.
    """
    client = _get_client()
    cursor = item.sync_cursor  # None on first run

    added_count = 0
    modified_count = 0
    removed_count = 0

    has_more = True
    while has_more:
        req = TransactionsSyncRequest(
            access_token=item.access_token,
            **({"cursor": cursor} if cursor else {}),
        )
        resp = client.transactions_sync(req)

        for tx_data in resp["added"]:
            _upsert_plaid_transaction(db, tx_data, item, entity_id, is_new=True)
            added_count += 1

        for tx_data in resp["modified"]:
            _upsert_plaid_transaction(db, tx_data, item, entity_id, is_new=False)
            modified_count += 1

        for removed_tx in resp["removed"]:
            _remove_plaid_transaction(db, removed_tx["transaction_id"])
            removed_count += 1

        cursor = resp["next_cursor"]
        has_more = resp["has_more"]

    # Persist cursor and last_synced_at
    item.sync_cursor   = cursor
    item.last_synced_at = datetime.now(timezone.utc)

    # Refresh balances on all accounts
    try:
        accounts_resp = client.accounts_get(AccountsGetRequest(access_token=item.access_token))
        for acct in accounts_resp["accounts"]:
            ba = db.query(BankAccount).filter_by(plaid_account_id=acct["account_id"]).first()
            if ba:
                balances = acct.get("balances", {})
                ba.current_balance   = _decimal(balances.get("current"))
                ba.available_balance = _decimal(balances.get("available"))
                ba.last_synced_at    = datetime.now(timezone.utc)
    except Exception:
        pass

    db.commit()
    return {"added": added_count, "modified": modified_count, "removed": removed_count}


def _upsert_plaid_transaction(db: Session, tx_data: dict, item: PlaidItem, entity_id, *, is_new: bool):
    plaid_txn_id = tx_data["transaction_id"]
    amount_raw   = float(tx_data.get("amount", 0))

    # Plaid: positive amount = money leaving the account (debit), negative = credit
    direction = TransactionDirection.debit if amount_raw >= 0 else TransactionDirection.credit
    amount    = Decimal(str(abs(amount_raw)))

    date = tx_data.get("date")
    if isinstance(date, str):
        from datetime import date as dt
        date = dt.fromisoformat(date)

    merchant_raw = (
        tx_data.get("merchant_name")
        or tx_data.get("name")
        or tx_data.get("original_description")
        or "Unknown"
    )
    description = tx_data.get("original_description") or merchant_raw

    merchant_norm = normalize_merchant(merchant_raw)
    cat_result = categorize_transaction(
        merchant_raw=merchant_norm,
        description=description,
    )
    cat_slug = cat_result.category.lower().replace(" ", "-")
    db_category = db.scalar(select(Category).where(
        Category.entity_id == entity_id,
        Category.slug == cat_slug,
    ))

    fingerprint = transaction_fingerprint(
        transaction_date=date,
        amount=amount,
        merchant=merchant_norm,
        description=description,
        source="bank",
    )

    existing = (
        db.query(Transaction).filter_by(external_txn_id=plaid_txn_id).first()
        or find_duplicate_by_fingerprint(db, entity_id=entity_id, fingerprint=fingerprint)
    )

    if existing and is_new:
        return  # already imported

    if existing and not is_new:
        # Update mutable fields
        existing.amount    = amount
        existing.direction = direction
        existing.updated_at = datetime.now(timezone.utc)
        return

    tx = Transaction(
        user_id          = item.user_id,
        entity_id        = entity_id,
        external_txn_id  = plaid_txn_id,
        transaction_date = date,
        posted_date      = date,
        merchant_raw     = merchant_raw,
        merchant_normalized = merchant_norm,
        description      = description,
        amount           = amount,
        direction        = direction,
        currency         = tx_data.get("iso_currency_code") or "USD",
        source           = TransactionSource.bank,
        category_id      = db_category.id if db_category else None,
        fingerprint      = fingerprint,
    )
    db.add(tx)


def _remove_plaid_transaction(db: Session, plaid_txn_id: str):
    tx = db.query(Transaction).filter_by(external_txn_id=plaid_txn_id).first()
    if tx:
        tx.is_ignored = True


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _decimal(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))
