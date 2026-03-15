import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EntityRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    manager = "manager"
    accountant = "accountant"
    employee = "employee"


class EntityMember(Base):
    __tablename__ = "entity_members"
    __table_args__ = (UniqueConstraint("entity_id", "user_id", name="uq_entity_member"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    role: Mapped[EntityRole] = mapped_column(Enum(EntityRole), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    entity = relationship("Entity", back_populates="members")
    user = relationship("User", back_populates="entity_memberships")
