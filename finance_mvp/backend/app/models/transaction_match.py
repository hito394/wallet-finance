import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TransactionMatch(Base):
    __tablename__ = "transaction_matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("transactions.id"), index=True)
    receipt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("receipts.id"), index=True)
    confidence: Mapped[float] = mapped_column(index=True)
    signal_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    matcher_version: Mapped[str] = mapped_column(String(50), default="v1")
    matched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
