import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.review_queue import ReviewStatus


class ReviewQueueItemRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    document_id: uuid.UUID | None
    transaction_id: uuid.UUID | None
    reason_code: str
    reason_text: str
    status: ReviewStatus
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class ReviewResolveRequest(BaseModel):
    status: ReviewStatus
