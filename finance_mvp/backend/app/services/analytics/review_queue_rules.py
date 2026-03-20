from app.models.document import FinancialDocument, FinancialDocumentType

# These types generate transactions from rows — they are not matched against existing ones.
_STATEMENT_TYPES = {
    FinancialDocumentType.bank_statement,
    FinancialDocumentType.credit_card_statement,
}


def derive_review_reason(document: FinancialDocument) -> tuple[bool, str | None, str | None]:
    if document.document_type == FinancialDocumentType.unknown_financial_document:
        return True, "unknown_document_type", "Unknown financial document type"

    # Statements are judged by transaction-row extraction outcome, not by total amount.
    # Skip the document-level duplicate check for statements — dedup is done row by row.
    if document.document_type in _STATEMENT_TYPES:
        failure_reason = (document.parsing_failure_reason or "").lower()
        extracted_count = document.extracted_transaction_count or 0

        if "statement_summary_detected_without_detail_rows" in failure_reason:
            return (
                True,
                "statement_summary_detected_without_detail_rows",
                "Statement summary section detected, but no transaction detail rows were extracted",
            )
        if "account_number_misread_as_merchant" in failure_reason:
            return (
                True,
                "account_number_misread_as_merchant",
                "Parser likely read account-number text as merchant data",
            )
        if "low_confidence_statement_extraction" in failure_reason or (
            document.match_confidence is not None and document.match_confidence < 0.65
        ):
            return (
                True,
                "low_confidence_statement_extraction",
                "Transactions were extracted but confidence is low; verify statement rows",
            )
        if "partial_statement_parse" in failure_reason or (
            document.parsing_status == "needs_review" and extracted_count > 0
        ):
            return (
                True,
                "partial_statement_parse",
                "Only part of the statement appears to be extracted",
            )
        if extracted_count == 0 or "missing_transaction_rows" in failure_reason:
            return (
                True,
                "missing_transaction_rows",
                "No transaction rows were extracted from this statement",
            )
        return False, None, None

    if document.extraction_confidence < 0.5:
        return True, "low_ocr_confidence", "Low OCR confidence; verify extracted values"

    if document.possible_duplicate_document:
        return True, "possible_duplicate", "Possible duplicate document"

    # Non-statement docs: flag for missing total amount
    if document.total_amount is None:
        return True, "missing_total_amount", "Missing total amount"
    if document.business_expense_candidate:
        return True, "business_expense_candidate", "Potential business expense classification"
    if document.tax_relevant_candidate:
        return True, "tax_relevant_candidate", "Potential tax-supporting document"
    if document.match_confidence is None:
        return True, "unmatched_document", "No matching transaction found"
    return False, None, None
