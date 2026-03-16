import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.document import FinancialDocumentType, PaymentStatus


class FinancialDocumentRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    source_name: str
    document_type: FinancialDocumentType
    document_type_confidence: float
    classification_explanation: str
    payment_status: PaymentStatus
    business_expense_candidate: bool
    reimbursable_candidate: bool
    tax_relevant_candidate: bool
    retention_recommended: bool
    review_required: bool
    review_reason: str | None
    merchant_name: str | None
    purchase_date: date | None
    invoice_date: date | None
    due_date: date | None
    total_amount: Decimal | None
    tax_amount: Decimal | None
    currency: str
    extraction_confidence: float
    match_confidence: float | None
    match_reason: str | None
    # enriched intelligence fields
    likely_issuer: str | None = None
    source_type_hint: str | None = None
    parsing_status: str = "pending"
    parsing_failure_reason: str | None = None
    raw_text_preview: str | None = None
    extracted_transaction_count: int = 0
    extracted_total_amount: Decimal | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
