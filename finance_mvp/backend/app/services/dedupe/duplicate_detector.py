from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.transaction import Transaction, TransactionSource


def find_duplicate_by_fingerprint(db: Session, entity_id, fingerprint: str) -> Transaction | None:
    return db.scalar(
        select(Transaction).where(
            Transaction.entity_id == entity_id,
            Transaction.fingerprint == fingerprint,
        )
    )


def find_duplicate_by_cross_source(
    db: Session,
    entity_id,
    transaction_date: date,
    amount: Decimal,
    source: TransactionSource,
    description: str,
) -> Transaction | None:
    """
    Detect cross-source duplicates: same transaction from different accounts.
    
    Example: A payment of $4499 from checking account (bank source) that appears
    as a payment on a credit card statement (card source) on the same date.
    
    Both transactions would have:
    - Same transaction_date
    - Same absolute amount
    - Different source (bank vs card)
    - Similar descriptions (both payment-related)
    
    Returns the existing transaction if a match is found, otherwise None.
    """
    # Keywords that typically indicate transfers/payments between accounts
    payment_keywords = {"payment", "transfer", "online payment", "pay", "sent", "wire"}
    desc_lower = description.lower()
    is_payment_like = any(kw in desc_lower for kw in payment_keywords)

    if not is_payment_like:
        return None

    # Restrict cross-source heuristic to bank/card imports only.
    if source not in {TransactionSource.bank, TransactionSource.card}:
        return None

    # Look for a payment-like transaction from the opposite source near same date,
    # with the same absolute amount (to tolerate debit/credit sign conventions).
    other_sources = [TransactionSource.bank, TransactionSource.card]
    other_sources = [s for s in other_sources if s != source]
    candidate_dates = [
        transaction_date - timedelta(days=1),
        transaction_date,
        transaction_date + timedelta(days=1),
    ]
    amount_abs = abs(amount)

    return db.scalar(
        select(Transaction)
        .where(
            and_(
                Transaction.entity_id == entity_id,
                Transaction.source.in_(other_sources),
                Transaction.transaction_date.in_(candidate_dates),
                func.abs(Transaction.amount) == amount_abs,
                or_(
                    Transaction.description.ilike("%payment%"),
                    Transaction.description.ilike("%transfer%"),
                    Transaction.description.ilike("%pay%"),
                    Transaction.description.ilike("%sent%"),
                    Transaction.description.ilike("%wire%"),
                ),
            )
        )
        .order_by(Transaction.created_at.asc())
    )
