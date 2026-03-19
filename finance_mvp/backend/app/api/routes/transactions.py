from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import extract, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.category import Category
from app.models.learning_feedback import FeedbackType, LearningFeedback
from app.models.transaction import Transaction
from app.schemas.transaction import (
    ReclassifyTransactionsResponse,
    TransactionCategoryRead,
    TransactionRead,
    TransactionUpdate,
)
from app.services.categorization.engine import categorize_transaction
from app.services.normalization.merchant_normalizer import normalize_merchant
from app.utils.user_context import resolve_actor_context

router = APIRouter()

_SUMMARY_NOISE_HINTS = (
    "minimum payment due",
    "new balance",
    "payment due date",
    "account summary",
    "beginning balance",
    "ending balance",
    "previous balance",
    "statement period",
)


def _get_or_create_category(db: Session, entity_id, category_name: str) -> Category:
    slug = category_name.lower().replace(" ", "-")
    category = db.scalar(select(Category).where(Category.entity_id == entity_id, Category.slug == slug))
    if category:
        return category
    category = Category(entity_id=entity_id, name=category_name, slug=slug)
    db.add(category)
    db.flush()
    return category


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


@router.get("/categories", response_model=list[TransactionCategoryRead])
def list_transaction_categories(
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[TransactionCategoryRead]:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    rows = db.scalars(
        select(Category)
        .where(Category.entity_id == entity.id)
        .order_by(Category.name.asc())
    ).all()
    return list(rows)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TransactionRead:
    import uuid as _uuid
    user, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        tx_uuid = _uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction_id")
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == tx_uuid,
            Transaction.entity_id == entity.id,
        )
    )
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


@router.post("/reclassify", response_model=ReclassifyTransactionsResponse)
def reclassify_transactions(
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ReclassifyTransactionsResponse:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)

    rows = list(
        db.scalars(
            select(Transaction).where(
                Transaction.entity_id == entity.id,
                Transaction.is_ignored.is_(False),
            )
        ).all()
    )

    updated_categories = 0
    newly_ignored_rows = 0

    for tx in rows:
        text = f"{tx.merchant_raw or ''} {tx.description or ''}".lower()
        if any(hint in text for hint in _SUMMARY_NOISE_HINTS):
            tx.is_ignored = True
            newly_ignored_rows += 1
            continue

        cat = categorize_transaction(
            merchant_raw=tx.merchant_raw or tx.merchant_normalized or "",
            description=tx.description or "",
            direction=tx.direction.value if hasattr(tx.direction, "value") else str(tx.direction),
            source=tx.source.value if hasattr(tx.source, "value") else str(tx.source),
        )

        # Automatically ignore noise artifacts detected by categorizer
        if cat.strategy == "noise_artifact":
            tx.is_ignored = True
            newly_ignored_rows += 1
            continue

        category = _get_or_create_category(db, entity.id, cat.category)

        if tx.category_id != category.id:
            tx.category_id = category.id
            tx.merchant_normalized = normalize_merchant(tx.merchant_raw or tx.merchant_normalized or "")
            updated_categories += 1

    db.commit()
    return ReclassifyTransactionsResponse(
        updated_categories=updated_categories,
        newly_ignored_rows=newly_ignored_rows,
        scanned_rows=len(rows),
    )
