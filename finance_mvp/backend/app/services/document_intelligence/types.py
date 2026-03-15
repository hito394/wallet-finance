from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.models.document import FinancialDocumentType, PaymentStatus


@dataclass
class DocumentIntelligenceResult:
    document_type: FinancialDocumentType
    document_type_confidence: float
    classification_explanation: str
    payment_status: PaymentStatus
    is_proof_of_purchase: bool
    is_billing_request: bool
    is_refund_document: bool
    business_expense_candidate: bool
    reimbursable_candidate: bool
    tax_relevant_candidate: bool
    retention_recommended: bool
    review_required: bool
    review_reason: str | None
    merchant_name: str | None
    merchant_address: str | None
    purchase_date: date | None
    invoice_date: date | None
    due_date: date | None
    subtotal_amount: Decimal | None
    total_amount: Decimal | None
    tax_amount: Decimal | None
    currency: str
    payment_method: str | None
    invoice_number: str | None
    order_number: str | None
    line_items: list[dict]
    raw_text: str
    extraction_confidence: float
