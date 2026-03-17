"""
Plaid bank-linking endpoints.

POST /plaid/link-token          – create a link_token (client → Plaid Link)
POST /plaid/exchange            – exchange public_token for access_token
GET  /plaid/accounts            – list connected PlaidItems + BankAccounts
POST /plaid/sync/{item_id}      – pull new transactions from Plaid
DELETE /plaid/items/{item_id}   – disconnect (soft-delete) a bank
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.plaid_item import BankAccount, PlaidItem
from app.services import plaid_service
from app.utils.user_context import resolve_actor_context

log = logging.getLogger(__name__)
router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

def _require_plaid() -> None:
    if not settings.plaid_client_id or not settings.plaid_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "plaid_not_configured",
                "message": (
                    "Plaid credentials are not configured. "
                    "Set PLAID_CLIENT_ID and PLAID_SECRET in environment variables, "
                    "then restart the server."
                ),
            },
        )


def _get_item_or_404(db: Session, item_id: str, user_id) -> PlaidItem:
    item = db.scalar(
        select(PlaidItem).where(
            PlaidItem.id == uuid.UUID(item_id),
            PlaidItem.user_id == user_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Bank connection not found")
    return item


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ExchangeBody(BaseModel):
    public_token: str


class LinkTokenResponse(BaseModel):
    link_token: str
    plaid_env: str


class BankAccountOut(BaseModel):
    id: str
    plaid_account_id: str
    name: str
    official_name: str | None
    account_type: str | None
    account_subtype: str | None
    mask: str | None
    currency: str
    current_balance: float | None
    available_balance: float | None
    last_synced_at: str | None

    class Config:
        from_attributes = True


class PlaidItemOut(BaseModel):
    id: str
    institution_name: str | None
    institution_id: str | None
    last_synced_at: str | None
    accounts: list[BankAccountOut]

    class Config:
        from_attributes = True


class SyncResult(BaseModel):
    added: int
    modified: int
    removed: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/link-token", response_model=LinkTokenResponse)
def get_link_token(
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    """Create a Plaid Link token (valid ~30 min)."""
    _require_plaid()
    user, _ = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        token = plaid_service.create_link_token(str(user.id))
    except Exception as exc:
        log.exception("Plaid link_token creation failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"link_token": token, "plaid_env": settings.plaid_env}


@router.post("/exchange", status_code=status.HTTP_201_CREATED)
def exchange_token(
    body: ExchangeBody,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    """Exchange a public_token for a permanent access_token and persist accounts."""
    _require_plaid()
    user, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        item = plaid_service.exchange_public_token(
            db,
            public_token=body.public_token,
            user_id=user.id,
            entity_id=entity.id,
        )
    except Exception as exc:
        log.exception("Plaid token exchange failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "item_id": str(item.id),
        "institution_name": item.institution_name,
        "message": "Bank connected successfully",
    }


@router.get("/accounts")
def list_accounts(
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    """Return all connected PlaidItems with their BankAccounts."""
    user, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    items = db.scalars(
        select(PlaidItem).where(
            PlaidItem.user_id == user.id,
            PlaidItem.entity_id == entity.id,
        )
    ).all()

    result = []
    for item in items:
        accounts = db.scalars(
            select(BankAccount).where(
                BankAccount.plaid_item_id == item.id,
                BankAccount.is_active.is_(True),
            )
        ).all()
        result.append(
            {
                "id": str(item.id),
                "institution_name": item.institution_name or "Unknown Bank",
                "institution_id": item.institution_id,
                "last_synced_at": item.last_synced_at.isoformat() if item.last_synced_at else None,
                "accounts": [
                    {
                        "id": str(ba.id),
                        "plaid_account_id": ba.plaid_account_id,
                        "name": ba.name,
                        "official_name": ba.official_name,
                        "account_type": ba.account_type,
                        "account_subtype": ba.account_subtype,
                        "mask": ba.mask,
                        "currency": ba.currency,
                        "current_balance": float(ba.current_balance) if ba.current_balance is not None else None,
                        "available_balance": float(ba.available_balance) if ba.available_balance is not None else None,
                        "last_synced_at": ba.last_synced_at.isoformat() if ba.last_synced_at else None,
                    }
                    for ba in accounts
                ],
            }
        )
    return {"items": result}


@router.post("/sync/{item_id}", response_model=SyncResult)
def sync_item(
    item_id: str,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    """Pull new transactions from Plaid for a connected bank."""
    _require_plaid()
    user, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    item = _get_item_or_404(db, item_id, user.id)
    try:
        result = plaid_service.sync_transactions(db, item, entity_id=entity.id)
    except Exception as exc:
        log.exception("Plaid sync failed for item %s", item_id)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return result


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_bank(
    item_id: str,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> None:
    """Disconnect a bank (marks all its accounts inactive, removes access_token)."""
    user, _ = resolve_actor_context(db, x_user_id, x_entity_id)
    item = _get_item_or_404(db, item_id, user.id)

    # Revoke Plaid access (best-effort)
    try:
        plaid_service._get_client().item_remove({"access_token": item.access_token})
    except Exception:
        pass

    # Soft delete
    item.access_token = ""
    accounts = db.scalars(select(BankAccount).where(BankAccount.plaid_item_id == item.id)).all()
    for ba in accounts:
        ba.is_active = False

    db.commit()
