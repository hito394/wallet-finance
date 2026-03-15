import re
from datetime import datetime
from decimal import Decimal

import pdfplumber

from app.services.parsers.types import ParsedTransaction

LINE_PATTERN = re.compile(r"(?P<date>\d{1,2}/\d{1,2}/\d{2,4})\s+(?P<desc>.+?)\s+(?P<amount>-?\d+[\.,]\d{2})$")


def parse_pdf_statement(file_path: str, source: str) -> list[ParsedTransaction]:
    parsed: list[ParsedTransaction] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw_line in text.splitlines():
                line = raw_line.strip()
                match = LINE_PATTERN.search(line)
                if not match:
                    continue

                amount = Decimal(match.group("amount").replace(",", ""))
                direction = "debit" if amount > 0 else "credit"
                parsed.append(
                    ParsedTransaction(
                        transaction_date=datetime.strptime(match.group("date"), "%m/%d/%Y").date(),
                        posted_date=None,
                        merchant_raw=match.group("desc").strip(),
                        description=match.group("desc").strip(),
                        amount=abs(amount),
                        direction=direction,
                        currency="USD",
                        source=source,
                    )
                )

    if not parsed:
        raise ValueError("PDF parser found no transaction lines; provide bank-specific parser template")
    return parsed
