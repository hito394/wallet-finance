import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.entity import EntityType
from app.models.entity_member import EntityRole


class EntityRead(BaseModel):
    id: uuid.UUID
    name: str
    entity_type: EntityType
    base_currency: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EntityCreate(BaseModel):
    name: str
    entity_type: EntityType
    base_currency: str = "USD"


class EntityMemberRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    user_id: uuid.UUID
    role: EntityRole

    model_config = {"from_attributes": True}
