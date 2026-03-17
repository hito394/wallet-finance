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
    document_type_confidence: float = 0.0
    classification_explanation: str = ""
    payment_status: PaymentStatus = PaymentStatus.unknown
    business_expense_candidate: bool = False
    reimbursable_candidate: bool = False
    tax_relevant_candidate: bool = False
    retention_recommended: bool = False
    review_required: bool = False
    review_reason: str | None = None
    merchant_name: str | None = None
    purchase_date: date | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    total_amount: Decimal | None = None
    tax_amount: Decimal | None = None
    currency: str = "USD"
    extraction_confidence: float = 0.0
    match_confidence: float | None = None
    match_reason: str | None = None
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
