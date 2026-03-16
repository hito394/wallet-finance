import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    default_currency: Mapped[str] = mapped_column(String(3), default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="user")
    receipts = relationship("Receipt", back_populates="user")
    import_jobs = relationship("ImportJob", back_populates="user")
    owned_entities = relationship("Entity", back_populates="owner")
    entity_memberships = relationship("EntityMember", back_populates="user")
    documents = relationship("FinancialDocument", back_populates="user")
