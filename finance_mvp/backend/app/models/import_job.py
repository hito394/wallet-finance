import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ImportSourceType(str, enum.Enum):
    bank_statement = "bank_statement"
    credit_card_statement = "credit_card_statement"
    receipt = "receipt"
    invoice = "invoice"
    paid_invoice = "paid_invoice"
    refund_confirmation = "refund_confirmation"
    subscription_billing_record = "subscription_billing_record"
    financial_document = "financial_document"
    wallet_screenshot = "wallet_screenshot"
    email_receipt = "email_receipt"


class ImportStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ImportJob(Base):
    __tablename__ = "imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), index=True)
    source_type: Mapped[ImportSourceType] = mapped_column(Enum(ImportSourceType))
    status: Mapped[ImportStatus] = mapped_column(Enum(ImportStatus), default=ImportStatus.pending, index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    storage_uri: Mapped[str] = mapped_column(String(512))
    parser_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="import_jobs")
    entity = relationship("Entity", back_populates="import_jobs")
