"""
OFX / QFX statement parser.

Most Japanese banks (三菱UFJ, 三井住友, ゆうちょ, 楽天銀行 …) and US banks
allow export of transaction history in OFX or QFX format. This parser converts
those files to ParsedTransaction objects so they can flow through the standard
ingestion pipeline.

Supported extensions: .ofx, .qfx
"""

from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from pathlib import Path

from app.services.parsers.types import ParsedTransaction

log = logging.getLogger(__name__)


def parse_ofx_statement(file_path: str) -> list[ParsedTransaction]:
    """
    Parse an OFX or QFX file and return a list of ParsedTransaction objects.

    Falls back gracefully to an empty list on any parse error.
    """
    try:
        import ofxparse  # type: ignore[import-untyped]
    except ImportError:
        log.error("ofxparse is not installed. Run: pip install ofxparse")
        return []

    path = Path(file_path)
    transactions: list[ParsedTransaction] = []

    try:
        # ofxparse needs text mode for some files and binary for others;
        # try binary first (handles both ASCII and UTF-8 OFX).
        with open(path, "rb") as fh:
            ofx = ofxparse.OfxParser.parse(fh)
    except Exception as exc:
        log.warning("OFX binary parse failed (%s), retrying as text: %s", path.name, exc)
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                ofx = ofxparse.OfxParser.parse(fh)
        except Exception as exc2:
            log.error("OFX parse failed for %s: %s", path.name, exc2)
            return []

    # ofxparse returns one account per file; some files have multiple.
    accounts = []
    if hasattr(ofx, "accounts"):
        accounts = ofx.accounts
    elif hasattr(ofx, "account") and ofx.account is not None:
        accounts = [ofx.account]

    for account in accounts:
        statement = getattr(account, "statement", None)
        if statement is None:
            continue
        for raw in getattr(statement, "transactions", []):
            tx = _parse_one(raw)
            if tx is not None:
                transactions.append(tx)

    log.info("OFX parser: extracted %d transactions from %s", len(transactions), path.name)
    return transactions


def _parse_one(raw) -> ParsedTransaction | None:
    """Convert a single ofxparse transaction object to ParsedTransaction."""
    try:
        # Amount: OFX convention – positive = credit (money in), negative = debit (money out)
        raw_amount = float(getattr(raw, "amount", 0) or 0)
        if raw_amount == 0:
            return None

        direction = "credit" if raw_amount > 0 else "debit"
        amount = Decimal(str(abs(raw_amount)))

        # Date
        tx_date = getattr(raw, "date", None)
        if tx_date is None:
            return None
        if hasattr(tx_date, "date"):
            tx_date = tx_date.date()

        # Merchant / description
        merchant_raw = (
            getattr(raw, "payee", None)
            or getattr(raw, "name", None)
            or getattr(raw, "memo", None)
            or ""
        ).strip()
        description = (getattr(raw, "memo", None) or "").strip()

        external_id = (getattr(raw, "id", None) or "").strip() or None

        return ParsedTransaction(
            transaction_date=tx_date,
            posted_date=tx_date,
            merchant_raw=merchant_raw or description or "Unknown",
            description=description,
            amount=amount,
            direction=direction,
            source="bank",
            external_txn_id=external_id,
        )
    except (InvalidOperation, TypeError, AttributeError) as exc:
        log.debug("Skipping OFX transaction: %s", exc)
        return None
