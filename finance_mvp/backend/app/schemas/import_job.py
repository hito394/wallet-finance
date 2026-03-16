import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.import_job import ImportSourceType, ImportStatus


class ImportJobRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    entity_id: uuid.UUID
    source_type: ImportSourceType
    status: ImportStatus
    file_name: str
    file_hash: str | None
    storage_uri: str
    parser_name: str | None
    metadata_json: dict
    error_message: str | None
    created_at: datetime
    processed_at: datetime | None

    model_config = {"from_attributes": True}
