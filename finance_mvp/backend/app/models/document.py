import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, JSON, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FinancialDocumentType(str, enum.Enum):
    receipt = "receipt"
    invoice = "invoice"
    paid_invoice = "paid_invoice"
    reimbursement_document = "reimbursement_document"
    order_confirmation = "order_confirmation"
    refund_confirmation = "refund_confirmation"
    subscription_charge = "subscription_charge"
    tax_supporting_document = "tax_supporting_document"
    bank_statement = "bank_statement"
    credit_card_statement = "credit_card_statement"
    transaction_screenshot = "transaction_screenshot"
    digital_purchase_confirmation = "digital_purchase_confirmation"
    unknown_financial_document = "unknown_financial_document"


class PaymentStatus(str, enum.Enum):
    paid = "paid"
    unpaid = "unpaid"
    partial = "partial"
    refunded = "refunded"
    unknown = "unknown"


class FinancialDocument(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), index=True)
    import_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("imports.id"), nullable=True)
    storage_uri: Mapped[str] = mapped_column(String(512))
    source_name: Mapped[str] = mapped_column(String(255))

    document_type: Mapped[FinancialDocumentType] = mapped_column(Enum(FinancialDocumentType), index=True)
    document_type_confidence: Mapped[float] = mapped_column(default=0.0)
    classification_explanation: Mapped[str] = mapped_column(Text, default="")

    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.unknown, index=True)
    is_proof_of_purchase: Mapped[bool] = mapped_column(Boolean, default=False)
    is_billing_request: Mapped[bool] = mapped_column(Boolean, default=False)
    is_refund_document: Mapped[bool] = mapped_column(Boolean, default=False)
    possible_duplicate_document: Mapped[bool] = mapped_column(Boolean, default=False)

    business_expense_candidate: Mapped[bool] = mapped_column(Boolean, default=False)
    reimbursable_candidate: Mapped[bool] = mapped_column(Boolean, default=False)
    tax_relevant_candidate: Mapped[bool] = mapped_column(Boolean, default=False)
    retention_recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    review_required: Mapped[bool] = mapped_column(Boolean, default=False)
    review_reason: Mapped[str | None] = mapped_column(String(400), nullable=True)

    merchant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    merchant_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    tax_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    payment_method: Mapped[str | None] = mapped_column(String(120), nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    order_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    line_items: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_text_preview: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    extraction_confidence: Mapped[float] = mapped_column(default=0.0)

    # Enhanced intelligence fields
    likely_issuer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_type_hint: Mapped[str | None] = mapped_column(String(80), nullable=True)  # user-selected type
    parsing_status: Mapped[str] = mapped_column(String(40), default="pending")  # pending|ok|partial|failed
    parsing_failure_reason: Mapped[str | None] = mapped_column(String(400), nullable=True)

    match_confidence: Mapped[float | None] = mapped_column(nullable=True)
    match_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    matched_by_amount: Mapped[bool] = mapped_column(Boolean, default=False)
    matched_by_merchant: Mapped[bool] = mapped_column(Boolean, default=False)
    matched_by_date: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="documents")
    entity = relationship("Entity", back_populates="documents")
