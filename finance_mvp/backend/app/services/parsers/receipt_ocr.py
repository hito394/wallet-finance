import re
from datetime import datetime
from decimal import Decimal

from dateutil import parser as date_parser
import pdfplumber
import pytesseract
from PIL import Image

from app.services.parsers.types import ParsedReceipt

TOTAL_PATTERN = re.compile(r"(total|amount)\s*[:\-]?\s*\$?([0-9]+[\.,][0-9]{2})", re.IGNORECASE)
TAX_PATTERN = re.compile(r"tax\s*[:\-]?\s*\$?([0-9]+[\.,][0-9]{2})", re.IGNORECASE)
DATE_PATTERN = re.compile(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})")


def extract_text(file_path: str) -> str:
    if file_path.lower().endswith(".pdf"):
        pages = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                pages.append(page.extract_text() or "")
        return "\n".join(pages)

    image = Image.open(file_path)
    return pytesseract.image_to_string(image)


def parse_receipt(file_path: str) -> ParsedReceipt:
    text = extract_text(file_path)
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    merchant = lines[0] if lines else None
    total_match = TOTAL_PATTERN.search(text)
    tax_match = TAX_PATTERN.search(text)
    date_match = DATE_PATTERN.search(text)

    total_amount = Decimal(total_match.group(2).replace(",", "")) if total_match else None
    tax_amount = Decimal(tax_match.group(1).replace(",", "")) if tax_match else None
    purchase_date = None
    if date_match:
        try:
            purchase_date = date_parser.parse(date_match.group(1), dayfirst=False).date()
        except ValueError:
            purchase_date = None

    confidence = 0.9 if total_amount and merchant else 0.5
    return ParsedReceipt(
        merchant_raw=merchant,
        total_amount=total_amount,
        purchase_date=purchase_date,
        tax_amount=tax_amount,
        line_items=[],
        raw_text=text,
        confidence=confidence,
    )
