from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transaction import Transaction


def find_duplicate_by_fingerprint(db: Session, entity_id, fingerprint: str) -> Transaction | None:
    return db.scalar(
        select(Transaction).where(
            Transaction.entity_id == entity_id,
            Transaction.fingerprint == fingerprint,
        )
    )
