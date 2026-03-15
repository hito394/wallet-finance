from datetime import timedelta

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.receipt import Receipt
from app.models.transaction import Transaction
from app.models.transaction_match import TransactionMatch


def _amount_score(tx_amount, receipt_amount) -> float:
    if tx_amount is None or receipt_amount is None:
        return 0.0
    return 1.0 if abs(float(tx_amount) - float(receipt_amount)) <= 0.01 else 0.0


def match_receipt_to_transactions(db: Session, receipt: Receipt, days_window: int = 4) -> TransactionMatch | None:
    if not receipt.purchase_date or not receipt.total_amount:
        return None

    min_date = receipt.purchase_date - timedelta(days=days_window)
    max_date = receipt.purchase_date + timedelta(days=days_window)

    candidates = db.scalars(
        select(Transaction).where(
            Transaction.entity_id == receipt.entity_id,
            Transaction.transaction_date >= min_date,
            Transaction.transaction_date <= max_date,
            Transaction.receipt_id.is_(None),
        )
    ).all()

    best = None
    best_score = 0.0
    for tx in candidates:
        amount = _amount_score(tx.amount, receipt.total_amount)
        merchant = fuzz.token_set_ratio(tx.merchant_normalized or "", receipt.merchant_normalized or "") / 100.0
        date = 1.0 - (abs((tx.transaction_date - receipt.purchase_date).days) / max(1, days_window))
        score = 0.5 * amount + 0.35 * merchant + 0.15 * date
        if score > best_score:
            best_score = score
            best = (tx, {"amount": amount, "merchant": merchant, "date": date})

    if not best or best_score < 0.75:
        return None

    tx, breakdown = best
    tx.receipt_id = receipt.id
    match = TransactionMatch(
        transaction_id=tx.id,
        receipt_id=receipt.id,
        confidence=best_score,
        signal_breakdown=breakdown,
        matcher_version="v1",
    )
    db.add(match)
    db.flush()
    return match
