import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.learning_feedback import FeedbackType


class LearningFeedbackCreate(BaseModel):
    feedback_type: FeedbackType
    source_object: str
    source_id: uuid.UUID
    payload: dict


class LearningFeedbackRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    feedback_type: FeedbackType
    source_object: str
    source_id: uuid.UUID
    payload: dict
    created_at: datetime

    model_config = {"from_attributes": True}
