from app.models.document import FinancialDocument, FinancialDocumentType


def derive_review_reason(document: FinancialDocument) -> tuple[bool, str | None, str | None]:
    if document.extraction_confidence < 0.5:
        return True, "low_ocr_confidence", "Low OCR confidence; verify extracted values"
    if document.document_type == FinancialDocumentType.unknown_financial_document:
        return True, "unknown_document_type", "Unknown financial document type"
    if document.total_amount is None:
        return True, "missing_total_amount", "Missing total amount"
    if document.possible_duplicate_document:
        return True, "possible_duplicate", "Possible duplicate document"
    if document.business_expense_candidate:
        return True, "business_expense_candidate", "Potential business expense classification"
    if document.tax_relevant_candidate:
        return True, "tax_relevant_candidate", "Potential tax-supporting document"
    if document.match_confidence is None:
        return True, "unmatched_document", "No matching transaction found"
    return False, None, None
