from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.transaction import Transaction, TransactionDirection, TransactionSource


def find_duplicate_by_fingerprint(db: Session, entity_id, fingerprint: str) -> Transaction | None:
    return db.scalar(
        select(Transaction).where(
            Transaction.entity_id == entity_id,
            Transaction.fingerprint == fingerprint,
        )
    )


def find_duplicate_by_date_amount_direction(
    db: Session,
    entity_id,
    transaction_date: date,
    amount: Decimal,
    direction: TransactionDirection,
    current_import_id,
) -> Transaction | None:
    """
    Fallback dedup: same date + absolute amount + direction from a different import.

    Used when fingerprint doesn't match due to merchant name or description
    differences between two imports of the same underlying transaction.
    """
    return db.scalar(
        select(Transaction).where(
            Transaction.entity_id == entity_id,
            Transaction.transaction_date == transaction_date,
            func.abs(Transaction.amount) == abs(amount),
            Transaction.direction == direction,
            Transaction.import_id != current_import_id,
            Transaction.is_ignored.is_(False),
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
    # Keywords that typically indicate transfers/payments between accounts (EN + JA)
    payment_keywords = {
        "payment", "transfer", "online payment", "pay", "sent", "wire",
        "引き落とし", "支払", "お支払", "振込", "自動振替", "口座振替",
        "カード", "クレジット", "ご利用代金", "クレカ",
    }
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


def scan_cross_source_payments(db: Session, entity_id) -> int:
    """
    Retroactively find and mark cross-source credit card payment credits as ignored.

    When bank + credit card statements are both uploaded, the bank shows a single
    "CREDIT CARD PAYMENT $X" debit and the CC statement shows a "PAYMENT RECEIVED $X"
    credit for the same money movement.  The CC credit is redundant — the individual
    CC debit transactions already capture the spending — so mark it as is_ignored.

    Returns the count of transactions newly marked ignored.
    """
    payment_patterns = [
        "%payment%", "%pymt%", "%autopay%", "%auto pay%", "%thank you%",
        "%引き落とし%", "%支払%", "%お支払%", "%振込%", "%自動振替%", "%口座振替%",
        "%クレジット%", "%ご利用代金%", "%クレカ%",
    ]

    cc_credits = db.scalars(
        select(Transaction).where(
            Transaction.entity_id == entity_id,
            Transaction.source == TransactionSource.card,
            Transaction.direction == TransactionDirection.credit,
            Transaction.is_ignored.is_(False),
            or_(*(Transaction.description.ilike(p) for p in payment_patterns)),
        )
    ).all()

    marked = 0
    for cc_tx in cc_credits:
        candidate_dates = [
            cc_tx.transaction_date - timedelta(days=1),
            cc_tx.transaction_date,
            cc_tx.transaction_date + timedelta(days=1),
        ]
        bank_match = db.scalar(
            select(Transaction).where(
                Transaction.entity_id == entity_id,
                Transaction.source == TransactionSource.bank,
                Transaction.direction == TransactionDirection.debit,
                Transaction.transaction_date.in_(candidate_dates),
                func.abs(Transaction.amount) == func.abs(cc_tx.amount),
                Transaction.is_ignored.is_(False),
            )
        )
        if bank_match:
            cc_tx.is_ignored = True
            marked += 1

    if marked:
        db.commit()
    return marked


def count_fuzzy_duplicates(db: Session, entity_id) -> int:
    """
    Count transaction pairs that are likely cross-source duplicates:
    same absolute amount, same direction, transaction dates within 3 days,
    but different source or fingerprint (not already exact-matched).

    This catches cases where the same purchase appears in both a bank
    statement and a credit card statement with slightly different dates
    or merchant name formatting.
    """
    txs = db.scalars(
        select(Transaction).where(
            Transaction.entity_id == entity_id,
            Transaction.is_ignored.is_(False),
        )
    ).all()

    # Group by (amount, direction) — only groups with >1 transaction are candidates
    groups: dict[tuple, list[Transaction]] = defaultdict(list)
    for tx in txs:
        key = (tx.amount, tx.direction)
        groups[key].append(tx)

    seen_pairs: set[frozenset] = set()
    count = 0

    for candidates in groups.values():
        if len(candidates) < 2:
            continue
        # Sort by date for efficient scanning
        candidates.sort(key=lambda t: t.transaction_date)
        for i, t1 in enumerate(candidates):
            for t2 in candidates[i + 1:]:
                diff = (t2.transaction_date - t1.transaction_date).days
                if diff > 3:
                    break
                # Skip if same fingerprint (exact dedup already handled at import)
                if t1.fingerprint and t2.fingerprint and t1.fingerprint == t2.fingerprint:
                    continue
                # Skip if same import (same file → not a cross-source dupe)
                if t1.import_id and t2.import_id and t1.import_id == t2.import_id:
                    continue
                pair = frozenset([t1.id, t2.id])
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    count += 1

    return count
