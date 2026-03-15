from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import extract, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.learning_feedback import FeedbackType, LearningFeedback
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionRead, TransactionUpdate
from app.utils.user_context import resolve_actor_context

router = APIRouter()


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[TransactionRead]:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)

    query = select(Transaction).where(Transaction.entity_id == entity.id)
    if year:
        query = query.where(extract("year", Transaction.transaction_date) == year)
    if month:
        query = query.where(extract("month", Transaction.transaction_date) == month)

    query = query.order_by(Transaction.transaction_date.desc())
    return list(db.scalars(query).all())


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TransactionRead:
    user, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    transaction = db.scalar(select(Transaction).where(Transaction.id == transaction_id))
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        old_value = getattr(transaction, key)
        setattr(transaction, key, value)

        if old_value != value:
            feedback_type = None
            if key == "category_id":
                feedback_type = FeedbackType.category_update
            elif key == "receipt_id":
                feedback_type = FeedbackType.receipt_link

            if feedback_type:
                db.add(
                    LearningFeedback(
                        user_id=user.id,
                        entity_id=entity.id,
                        feedback_type=feedback_type,
                        source_object="transaction",
                        source_id=transaction.id,
                        payload={"field": key, "old": str(old_value), "new": str(value)},
                    )
                )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction
