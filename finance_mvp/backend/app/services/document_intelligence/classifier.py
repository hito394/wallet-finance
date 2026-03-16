"""Document type classifier with issuer detection and source-type hint boosting."""
from __future__ import annotations

import re

from app.models.document import FinancialDocumentType, PaymentStatus

# ---------------------------------------------------------------------------
# Keyword signals per document type (order matters — more specific first)
# ---------------------------------------------------------------------------
KEYWORDS_BY_DOC_TYPE: dict[FinancialDocumentType, list[str]] = {
    FinancialDocumentType.credit_card_statement: [
        "card statement", "credit card statement", "minimum payment due",
        "minimum payment", "credit limit", "available credit", "payment due",
        "new balance", "previous balance", "credit card",
    ],
    FinancialDocumentType.bank_statement: [
        "account statement", "statement period", "beginning balance",
        "ending balance", "account number", "routing number",
        "deposits", "withdrawals", "service charge",
    ],
    FinancialDocumentType.paid_invoice: [
        "invoice", "paid", "payment received", "balance: 0", "payment confirmed",
    ],
    FinancialDocumentType.invoice: [
        "invoice", "amount due", "due date", "bill to", "pay by",
        "payment terms", "due upon receipt",
    ],
    FinancialDocumentType.refund_confirmation: [
        "refund", "refunded", "returned", "credit issued", "money back",
    ],
    FinancialDocumentType.subscription_charge: [
        "subscription", "monthly plan", "renewal", "next billing",
        "recurring", "auto-renew", "billing cycle",
    ],
    FinancialDocumentType.order_confirmation: [
        "order confirmation", "order number", "order #", "shipping",
        "estimated delivery", "your order",
    ],
    FinancialDocumentType.receipt: [
        "receipt", "subtotal", "change due", "thank you for your purchase",
        "cash", "card ending", "register",
    ],
    FinancialDocumentType.reimbursement_document: [
        "reimbursement", "expense claim", "expense report",
    ],
    FinancialDocumentType.tax_supporting_document: [
        "1099", "w-2", "tax form", "withholding", "irs",
    ],
    FinancialDocumentType.transaction_screenshot: [
        "screenshot", "apple pay", "google pay", "tap to pay", "venmo",
        "zelle", "cashapp", "transaction approved",
    ],
    FinancialDocumentType.digital_purchase_confirmation: [
        "purchase confirmation", "license key", "serial number", "download",
    ],
}

# Source type string → FinancialDocumentType mapping
_SOURCE_TYPE_MAP: dict[str, FinancialDocumentType] = {
    "bank_statement":            FinancialDocumentType.bank_statement,
    "credit_card_statement":     FinancialDocumentType.credit_card_statement,
    "receipt":                   FinancialDocumentType.receipt,
    "invoice":                   FinancialDocumentType.invoice,
    "paid_invoice":              FinancialDocumentType.paid_invoice,
    "refund_confirmation":       FinancialDocumentType.refund_confirmation,
    "subscription_billing_record": FinancialDocumentType.subscription_charge,
    "financial_document":        FinancialDocumentType.unknown_financial_document,
    "wallet_screenshot":         FinancialDocumentType.transaction_screenshot,
    "email_receipt":             FinancialDocumentType.receipt,
}

# Known bank/card issuers and their keyword signals
ISSUER_SIGNALS: dict[str, list[str]] = {
    "Chase":           ["chase", "jpmorgan", "sapphire", "freedom"],
    "FNBO":            ["fnbo", "first national bank"],
    "American Express": ["american express", "amex", "membership rewards"],
    "Bank of America": ["bank of america", "bofa", "bankamerica"],
    "Capital One":     ["capital one", "quicksilver", "venture"],
    "Discover":        ["discover", "cashback bonus"],
    "Wells Fargo":     ["wells fargo", "wellsfargo"],
    "Citi":            ["citi", "citibank", "citcard"],
    "Apple":           ["apple", "apple pay", "app store"],
    "Amazon":          ["amazon", "aws", "fulfillment"],
}


def _detect_issuer(text: str) -> str | None:
    lower = text.lower()
    for issuer, signals in ISSUER_SIGNALS.items():
        for s in signals:
            # use word-boundary search to avoid "purchase" matching "chase"
            pattern = r"(?<!\w)" + re.escape(s) + r"(?!\w)"
            if re.search(pattern, lower):
                return issuer
    return None


def _has_transaction_table(text: str) -> bool:
    """Detect whether text likely contains a tabular transaction list."""
    date_col = re.compile(r"\d{1,2}[/\-]\d{1,2}")
    amount_col = re.compile(r"-?\$?\d+\.\d{2}")
    lines_with_date_and_amount = sum(
        1 for line in text.splitlines()
        if date_col.search(line) and amount_col.search(line)
    )
    return lines_with_date_and_amount >= 3


def classify_document_type(
    text: str,
    filename: str,
    source_type_hint: str | None = None,
) -> tuple[FinancialDocumentType, float, str, str | None]:
    """
    Returns (doc_type, confidence, explanation, review_reason).

    Strategy:
    1. Score every type by keyword hits (weighted).
    2. Apply source_type_hint as a score boost + minimum floor.
    3. Apply filename heuristics.
    4. Apply layout heuristics (transaction table presence).
    5. Choose winner; if winner contradicts hint strongly → flag for review.
    """
    lower = text.lower()
    scores: dict[FinancialDocumentType, float] = {}

    for doc_type, keywords in KEYWORDS_BY_DOC_TYPE.items():
        hit_weight = sum(1.5 if len(k.split()) > 2 else 1.0 for k in keywords if k in lower)
        scores[doc_type] = hit_weight

    # Filename heuristics
    fname = filename.lower()
    if "statement" in fname:
        if "card" in fname or "credit" in fname:
            scores[FinancialDocumentType.credit_card_statement] = max(
                scores.get(FinancialDocumentType.credit_card_statement, 0), 3.0
            )
        else:
            scores[FinancialDocumentType.bank_statement] = max(
                scores.get(FinancialDocumentType.bank_statement, 0), 3.0
            )
    if "receipt" in fname:
        scores[FinancialDocumentType.receipt] = max(scores.get(FinancialDocumentType.receipt, 0), 2.0)
    if "invoice" in fname:
        scores[FinancialDocumentType.invoice] = max(scores.get(FinancialDocumentType.invoice, 0), 2.0)
    if fname.endswith(".csv"):
        if "card" in fname or "credit" in fname:
            scores[FinancialDocumentType.credit_card_statement] = max(
                scores.get(FinancialDocumentType.credit_card_statement, 0), 2.5
            )
        else:
            scores[FinancialDocumentType.bank_statement] = max(
                scores.get(FinancialDocumentType.bank_statement, 0), 2.5
            )

    # Layout heuristics: presence of many date+amount rows → strongly statement-like
    if _has_transaction_table(text):
        for t in [FinancialDocumentType.bank_statement, FinancialDocumentType.credit_card_statement]:
            scores[t] = scores.get(t, 0) + 3.0

    # Source type hint boost — strong signal from user selection
    hint_type: FinancialDocumentType | None = None
    if source_type_hint and source_type_hint in _SOURCE_TYPE_MAP:
        hint_type = _SOURCE_TYPE_MAP[source_type_hint]
        scores[hint_type] = scores.get(hint_type, 0) + 4.0

    # Winner
    if scores:
        best_type = max(scores, key=lambda k: scores[k])
        best_score = scores[best_type]
    else:
        best_type = FinancialDocumentType.unknown_financial_document
        best_score = 0.0

    total_score = sum(scores.values()) or 1.0
    confidence = min(0.3 + (best_score / total_score) * 0.7, 0.98)

    # Minimum confidence floor when user hint exactly matches detected
    if hint_type and best_type == hint_type:
        confidence = max(confidence, 0.65)

    # Review reason
    review_reason: str | None = None
    if best_type == FinancialDocumentType.unknown_financial_document or confidence < 0.45:
        review_reason = "ambiguous_document_type"
    elif hint_type and best_type != hint_type and confidence < 0.7:
        review_reason = f"type_mismatch: selected={source_type_hint}, detected={best_type.value}"
    elif best_type in {FinancialDocumentType.bank_statement, FinancialDocumentType.credit_card_statement} and not _has_transaction_table(text):
        review_reason = "summary_detected_without_detail_rows"
    elif not text.strip():
        review_reason = "low_text_quality"

    explanation = (
        f"Classified as '{best_type.value}' (score={best_score:.1f}/{total_score:.1f}, "
        f"confidence={confidence:.2f}). "
        + (f"Source hint='{source_type_hint}'. " if source_type_hint else "")
        + (f"Review: {review_reason}." if review_reason else "")
    )

    return best_type, confidence, explanation, review_reason


def infer_payment_status(text: str, doc_type: FinancialDocumentType) -> PaymentStatus:
    lower = text.lower()
    if any(token in lower for token in ["refunded", "refund issued", "refund completed"]):
        return PaymentStatus.refunded
    if any(token in lower for token in ["paid", "payment received", "balance: 0", "amount paid", "payment confirmed"]):
        return PaymentStatus.paid
    if any(token in lower for token in ["amount due", "due date", "pay now", "balance due", "minimum payment"]):
        return PaymentStatus.unpaid
    if doc_type in {FinancialDocumentType.receipt, FinancialDocumentType.paid_invoice}:
        return PaymentStatus.paid
    return PaymentStatus.unknown
