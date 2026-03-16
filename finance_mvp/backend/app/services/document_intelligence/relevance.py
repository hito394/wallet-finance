from app.models.document import FinancialDocumentType


def infer_relevance(doc_type: FinancialDocumentType, merchant_name: str | None, raw_text: str) -> dict:
    text = f"{merchant_name or ''} {raw_text}".lower()

    business_expense_candidate = any(k in text for k in ["software", "saas", "office", "cloud", "hosting", "adobe", "notion"])
    reimbursable_candidate = any(k in text for k in ["reimbursement", "expense claim", "client", "project"])
    tax_relevant_candidate = doc_type in {
        FinancialDocumentType.tax_supporting_document,
        FinancialDocumentType.invoice,
        FinancialDocumentType.paid_invoice,
    } or any(k in text for k in ["tax", "vat", "gst", "1099"])

    retention_recommended = (
        tax_relevant_candidate
        or doc_type in {FinancialDocumentType.invoice, FinancialDocumentType.paid_invoice, FinancialDocumentType.refund_confirmation}
    )

    review_required = False
    review_reason = None
    if doc_type == FinancialDocumentType.unknown_financial_document:
        review_required = True
        review_reason = "Unknown financial document type"
    elif tax_relevant_candidate and not retention_recommended:
        review_required = True
        review_reason = "Potential tax relevance requires manual check"

    return {
        "business_expense_candidate": business_expense_candidate,
        "reimbursable_candidate": reimbursable_candidate,
        "tax_relevant_candidate": tax_relevant_candidate,
        "retention_recommended": retention_recommended,
        "review_required": review_required,
        "review_reason": review_reason,
    }
