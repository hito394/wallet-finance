from app.models.document import FinancialDocumentType
from app.services.document_intelligence.classifier import classify_document_type, infer_payment_status
from app.services.document_intelligence.extractor import extract_financial_fields
from app.services.document_intelligence.relevance import infer_relevance
from app.services.document_intelligence.types import DocumentIntelligenceResult


def analyze_financial_document(raw_text: str, filename: str) -> DocumentIntelligenceResult:
    doc_type, type_confidence, explanation = classify_document_type(raw_text, filename)
    extracted = extract_financial_fields(raw_text)
    payment_status = infer_payment_status(raw_text, doc_type)
    relevance = infer_relevance(doc_type, extracted.get("merchant_name"), raw_text)

    is_proof_of_purchase = doc_type in {FinancialDocumentType.receipt, FinancialDocumentType.paid_invoice}
    is_billing_request = doc_type in {FinancialDocumentType.invoice}
    is_refund_document = doc_type == FinancialDocumentType.refund_confirmation or payment_status.value == "refunded"

    review_required = relevance["review_required"] or extracted["extraction_confidence"] < 0.5
    review_reason = relevance["review_reason"]
    if extracted["extraction_confidence"] < 0.5:
        review_reason = "Low extraction confidence"

    return DocumentIntelligenceResult(
        document_type=doc_type,
        document_type_confidence=type_confidence,
        classification_explanation=explanation,
        payment_status=payment_status,
        is_proof_of_purchase=is_proof_of_purchase,
        is_billing_request=is_billing_request,
        is_refund_document=is_refund_document,
        business_expense_candidate=relevance["business_expense_candidate"],
        reimbursable_candidate=relevance["reimbursable_candidate"],
        tax_relevant_candidate=relevance["tax_relevant_candidate"],
        retention_recommended=relevance["retention_recommended"],
        review_required=review_required,
        review_reason=review_reason,
        merchant_name=extracted["merchant_name"],
        merchant_address=extracted["merchant_address"],
        purchase_date=extracted["purchase_date"],
        invoice_date=extracted["invoice_date"],
        due_date=extracted["due_date"],
        subtotal_amount=extracted["subtotal_amount"],
        total_amount=extracted["total_amount"],
        tax_amount=extracted["tax_amount"],
        currency=extracted["currency"],
        payment_method=extracted["payment_method"],
        invoice_number=extracted["invoice_number"],
        order_number=extracted["order_number"],
        line_items=extracted["line_items"],
        raw_text=raw_text,
        extraction_confidence=extracted["extraction_confidence"],
    )