import re
from decimal import Decimal

from dateutil import parser as date_parser

from app.services.parsers.types import ParsedTransaction

# Matches lines that contain a date-like prefix followed by a description and an amount.
# Supports common formats: MM/DD/YYYY, YYYY/MM/DD, YYYY-MM-DD, M/D/YY, etc.
DATE_PATTERN = r"(?P<date>\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})"
AMOUNT_PATTERN = r"(?P<amount>-?[\d,]+\.\d{2})"
LINE_PATTERN = re.compile(rf"^{DATE_PATTERN}\s+(?P<desc>.+?)\s+{AMOUNT_PATTERN}\s*$")


def _try_parse_date(raw: str):
    try:
        return date_parser.parse(raw, dayfirst=False).date()
    except Exception:
        return None


def parse_pdf_statement(file_path: str, source: str) -> list[ParsedTransaction]:
    parsed: list[ParsedTransaction] = []
    with __import__("pdfplumber").open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw_line in text.splitlines():
                line = raw_line.strip()
                match = LINE_PATTERN.search(line)
                if not match:
                    continue

                tx_date = _try_parse_date(match.group("date"))
                if tx_date is None:
                    continue

                amount = Decimal(match.group("amount").replace(",", ""))
                direction = "debit" if amount > 0 else "credit"
                parsed.append(
                    ParsedTransaction(
                        transaction_date=tx_date,
                        posted_date=None,
                        merchant_raw=match.group("desc").strip(),
                        description=match.group("desc").strip(),
                        amount=abs(amount),
                        direction=direction,
                        currency="USD",
                        source=source,
                    )
                )

    # Return empty list when no transactions matched — let the pipeline decide
    # whether to mark the job as failed based on business rules.
    return parsed

