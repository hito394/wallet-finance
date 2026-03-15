from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.learning_feedback import LearningFeedback
from app.schemas.learning import LearningFeedbackCreate, LearningFeedbackRead
from app.utils.user_context import resolve_actor_context

router = APIRouter()


@router.post("", response_model=LearningFeedbackRead)
def add_learning_feedback(
    payload: LearningFeedbackCreate,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LearningFeedbackRead:
    user, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    feedback = LearningFeedback(
        user_id=user.id,
        entity_id=entity.id,
        feedback_type=payload.feedback_type,
        source_object=payload.source_object,
        source_id=payload.source_id,
        payload=payload.payload,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("", response_model=list[LearningFeedbackRead])
def list_learning_feedback(
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[LearningFeedbackRead]:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    return list(
        db.scalars(
            select(LearningFeedback)
            .where(LearningFeedback.entity_id == entity.id)
            .order_by(LearningFeedback.created_at.desc())
        ).all()
    )
