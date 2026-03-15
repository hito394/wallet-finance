import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TransactionDirection(str, enum.Enum):
    debit = "debit"
    credit = "credit"
    transfer = "transfer"


class TransactionSource(str, enum.Enum):
    bank = "bank"
    card = "card"
    wallet = "wallet"
    manual = "manual"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), index=True)
    import_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("imports.id"), nullable=True)
    external_txn_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, index=True)
    posted_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    merchant_raw: Mapped[str] = mapped_column(String(255))
    merchant_normalized: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str] = mapped_column(String(512))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), index=True)
    direction: Mapped[TransactionDirection] = mapped_column(Enum(TransactionDirection), index=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    source: Mapped[TransactionSource] = mapped_column(Enum(TransactionSource), index=True)
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("receipts.id"), nullable=True)
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True)
    is_ignored: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    fingerprint: Mapped[str] = mapped_column(String(80), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="transactions")
    entity = relationship("Entity", back_populates="transactions")
    category = relationship("Category")
    receipt = relationship("Receipt", back_populates="transactions")
