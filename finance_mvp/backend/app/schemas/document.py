import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, model_validator

from app.models.document import FinancialDocumentType, PaymentStatus
from app.models.import_job import ImportSourceType


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
    selected_source_type: str | None = None
    detected_document_type: str | None = None
    detected_document_type_confidence: float = 0.0
    parsing_status: str = "pending"
    parsing_failure_reason: str | None = None
    raw_text_preview: str | None = None
    extracted_transaction_count: int = 0
    transactions_created_count: int = 0
    extracted_total_amount: Decimal | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def _populate_alias_fields(self):
        self.selected_source_type = self.source_type_hint
        self.detected_document_type = self.document_type.value
        self.detected_document_type_confidence = self.document_type_confidence
        return self


class DocumentTypeHintUpdate(BaseModel):
    source_type_hint: ImportSourceType


class ReparseDocumentResponse(BaseModel):
    import_id: uuid.UUID
    status: str
