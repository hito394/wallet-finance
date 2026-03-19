import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.review_queue import ReviewQueueItem, ReviewStatus
from app.schemas.review import ReviewQueueItemRead, ReviewResolveRequest
from app.utils.user_context import resolve_actor_context

router = APIRouter()


@router.get("", response_model=list[ReviewQueueItemRead])
def list_review_queue(
    include_resolved: bool = Query(default=False),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[ReviewQueueItemRead]:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    query = select(ReviewQueueItem).where(ReviewQueueItem.entity_id == entity.id)
    if not include_resolved:
        query = query.where(ReviewQueueItem.status == ReviewStatus.pending)
    return list(
        db.scalars(
            query.order_by(ReviewQueueItem.created_at.desc())
        ).all()
    )


@router.patch("/{review_id}", response_model=ReviewQueueItemRead)
def resolve_review_item(
    review_id: str,
    payload: ReviewResolveRequest,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ReviewQueueItemRead:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        review_uuid = uuid.UUID(review_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid review_id")
    item = db.scalar(
        select(ReviewQueueItem).where(
            ReviewQueueItem.id == review_uuid,
            ReviewQueueItem.entity_id == entity.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")

    item.status = payload.status
    item.resolved_at = datetime.utcnow() if payload.status != ReviewStatus.pending else None
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
