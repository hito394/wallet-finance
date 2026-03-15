from datetime import timedelta

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import FinancialDocument
from app.models.transaction import Transaction


def cross_validate_document_with_transactions(db: Session, document: FinancialDocument) -> dict:
    if not document.purchase_date or not document.total_amount:
        return {
            "match_confidence": None,
            "match_reason": "Missing purchase date or total amount for cross-validation",
            "matched_by_amount": False,
            "matched_by_merchant": False,
            "matched_by_date": False,
            "matched_transaction_id": None,
        }

    min_date = document.purchase_date - timedelta(days=5)
    max_date = document.purchase_date + timedelta(days=5)
    candidates = db.scalars(
        select(Transaction).where(
            Transaction.entity_id == document.entity_id,
            Transaction.transaction_date >= min_date,
            Transaction.transaction_date <= max_date,
            Transaction.is_ignored.is_(False),
        )
    ).all()

    best_tx = None
    best_score = 0.0
    best_breakdown = (False, False, False)
    for tx in candidates:
        amount_match = abs(float(tx.amount) - float(document.total_amount or 0)) <= 0.01
        merchant_ratio = fuzz.token_set_ratio(tx.merchant_normalized or "", document.merchant_name or "") / 100.0
        merchant_match = merchant_ratio >= 0.78
        date_match = abs((tx.transaction_date - document.purchase_date).days) <= 2

        score = (0.5 if amount_match else 0.0) + (0.35 * merchant_ratio) + (0.15 if date_match else 0.0)
        if score > best_score:
            best_tx = tx
            best_score = score
            best_breakdown = (amount_match, merchant_match, date_match)

    if not best_tx or best_score < 0.70:
        return {
            "match_confidence": best_score if best_tx else None,
            "match_reason": "No strong transaction match",
            "matched_by_amount": False,
            "matched_by_merchant": False,
            "matched_by_date": False,
            "matched_transaction_id": None,
        }

    return {
        "match_confidence": round(best_score, 2),
        "match_reason": f"Matched transaction {best_tx.id} by weighted amount/merchant/date signals",
        "matched_by_amount": best_breakdown[0],
        "matched_by_merchant": best_breakdown[1],
        "matched_by_date": best_breakdown[2],
        "matched_transaction_id": str(best_tx.id),
    }
