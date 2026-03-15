import re
from datetime import date
from decimal import Decimal

from dateutil import parser as date_parser

TOTAL_PATTERN = re.compile(r"(?:total|amount)\s*[:\-]?\s*\$?([0-9]+[\.,][0-9]{2})", re.IGNORECASE)
SUBTOTAL_PATTERN = re.compile(r"subtotal\s*[:\-]?\s*\$?([0-9]+[\.,][0-9]{2})", re.IGNORECASE)
TAX_PATTERN = re.compile(r"(?:tax|vat|gst)\s*[:\-]?\s*\$?([0-9]+[\.,][0-9]{2})", re.IGNORECASE)
INVOICE_PATTERN = re.compile(r"(?:invoice\s*(?:#|no\.?|number)?\s*[:\-]?\s*)([a-z0-9\-]+)", re.IGNORECASE)
ORDER_PATTERN = re.compile(r"(?:order\s*(?:#|no\.?|number)?\s*[:\-]?\s*)([a-z0-9\-]+)", re.IGNORECASE)
DATE_PATTERN = re.compile(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})")


def _to_decimal(raw: str | None) -> Decimal | None:
    if not raw:
        return None
    try:
        return Decimal(raw.replace(",", ""))
    except Exception:  # noqa: BLE001
        return None


def _extract_first_date(text: str, near_keyword: str | None = None) -> date | None:
    search_text = text
    if near_keyword and near_keyword.lower() in text.lower():
        idx = text.lower().find(near_keyword.lower())
        search_text = text[max(0, idx - 80) : idx + 120]

    match = DATE_PATTERN.search(search_text)
    if not match:
        return None
    try:
        return date_parser.parse(match.group(1), dayfirst=False).date()
    except ValueError:
        return None


def extract_financial_fields(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    merchant_name = lines[0] if lines else None

    total_amount = _to_decimal((TOTAL_PATTERN.search(text) or [None, None])[1])
    subtotal_amount = _to_decimal((SUBTOTAL_PATTERN.search(text) or [None, None])[1])
    tax_amount = _to_decimal((TAX_PATTERN.search(text) or [None, None])[1])

    invoice_match = INVOICE_PATTERN.search(text)
    order_match = ORDER_PATTERN.search(text)

    invoice_date = _extract_first_date(text, "invoice")
    due_date = _extract_first_date(text, "due")
    purchase_date = _extract_first_date(text, "date")

    lower = text.lower()
    currency = "USD"
    if " eur" in lower or "€" in text:
        currency = "EUR"
    elif " gbp" in lower or "£" in text:
        currency = "GBP"
    elif " jpy" in lower or "¥" in text:
        currency = "JPY"

    payment_method = None
    if "visa" in lower:
        payment_method = "card_visa"
    elif "mastercard" in lower:
        payment_method = "card_mastercard"
    elif "apple pay" in lower:
        payment_method = "apple_pay"
    elif "google pay" in lower:
        payment_method = "google_pay"

    confidence_signals = [
        1.0 if merchant_name else 0.0,
        1.0 if total_amount else 0.0,
        1.0 if purchase_date or invoice_date else 0.0,
        1.0 if invoice_match or order_match else 0.0,
    ]
    extraction_confidence = round(sum(confidence_signals) / len(confidence_signals), 2)

    return {
        "merchant_name": merchant_name,
        "merchant_address": None,
        "purchase_date": purchase_date,
        "invoice_date": invoice_date,
        "due_date": due_date,
        "subtotal_amount": subtotal_amount,
        "total_amount": total_amount,
        "tax_amount": tax_amount,
        "currency": currency,
        "payment_method": payment_method,
        "invoice_number": invoice_match.group(1) if invoice_match else None,
        "order_number": order_match.group(1) if order_match else None,
        "line_items": [],
        "extraction_confidence": extraction_confidence,
    }
