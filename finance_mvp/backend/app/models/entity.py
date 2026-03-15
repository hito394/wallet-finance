import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EntityType(str, enum.Enum):
    personal = "personal"
    freelancer = "freelancer"
    business = "business"
    organization = "organization"


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[EntityType] = mapped_column(Enum(EntityType), index=True)
    base_currency: Mapped[str] = mapped_column(String(3), default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="owned_entities")
    members = relationship("EntityMember", back_populates="entity")
    transactions = relationship("Transaction", back_populates="entity")
    receipts = relationship("Receipt", back_populates="entity")
    import_jobs = relationship("ImportJob", back_populates="entity")
    categories = relationship("Category", back_populates="entity")
    documents = relationship("FinancialDocument", back_populates="entity")
