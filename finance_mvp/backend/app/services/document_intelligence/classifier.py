from app.models.document import FinancialDocumentType, PaymentStatus


KEYWORDS_BY_DOC_TYPE: dict[FinancialDocumentType, list[str]] = {
    FinancialDocumentType.receipt: ["receipt", "subtotal", "tax", "total", "thank you"],
    FinancialDocumentType.invoice: ["invoice", "amount due", "due date", "bill to"],
    FinancialDocumentType.paid_invoice: ["invoice", "paid", "payment received", "balance: 0"],
    FinancialDocumentType.reimbursement_document: ["reimbursement", "expense claim", "approve"],
    FinancialDocumentType.order_confirmation: ["order confirmation", "order number", "shipping"],
    FinancialDocumentType.refund_confirmation: ["refund", "refunded", "returned"],
    FinancialDocumentType.subscription_charge: ["subscription", "monthly", "renewal", "next billing"],
    FinancialDocumentType.tax_supporting_document: ["tax", "vat", "gst", "1099", "withholding"],
    FinancialDocumentType.bank_statement: ["statement period", "account number", "debit", "credit"],
    FinancialDocumentType.credit_card_statement: ["card statement", "minimum payment", "credit limit"],
    FinancialDocumentType.transaction_screenshot: ["screenshot", "transaction", "completed"],
    FinancialDocumentType.digital_purchase_confirmation: ["purchase confirmation", "digital", "license key"],
}


def classify_document_type(text: str, filename: str) -> tuple[FinancialDocumentType, float, str]:
    lower = text.lower()

    best_type = FinancialDocumentType.unknown_financial_document
    best_hits = 0
    best_keywords: list[str] = []
    for doc_type, keywords in KEYWORDS_BY_DOC_TYPE.items():
        hits = [k for k in keywords if k in lower]
        if len(hits) > best_hits:
            best_hits = len(hits)
            best_type = doc_type
            best_keywords = hits

    extension_bonus = 0.0
    if filename.lower().endswith(".csv"):
        if "statement" in filename.lower():
            extension_bonus = 0.1
            if "card" in filename.lower():
                best_type = FinancialDocumentType.credit_card_statement
            else:
                best_type = FinancialDocumentType.bank_statement

    confidence = min(0.25 + (best_hits * 0.18) + extension_bonus, 0.98) if best_hits else 0.35
    explanation = (
        f"Classified as {best_type.value} based on keyword hits {best_keywords} and filename '{filename}'."
        if best_hits
        else "Low-signal document text; classified as unknown financial document for manual review."
    )
    return best_type, confidence, explanation


def infer_payment_status(text: str, doc_type: FinancialDocumentType) -> PaymentStatus:
    lower = text.lower()
    if any(token in lower for token in ["refunded", "refund issued", "refund completed"]):
        return PaymentStatus.refunded
    if any(token in lower for token in ["paid", "payment received", "balance: 0", "amount paid"]):
        return PaymentStatus.paid
    if any(token in lower for token in ["amount due", "due date", "pay now", "balance due"]):
        return PaymentStatus.unpaid
    if doc_type in {FinancialDocumentType.receipt, FinancialDocumentType.paid_invoice}:
        return PaymentStatus.paid
    return PaymentStatus.unknown
