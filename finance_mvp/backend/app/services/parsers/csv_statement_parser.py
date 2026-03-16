from datetime import date
from decimal import Decimal

import pandas as pd
from dateutil import parser as date_parser

from app.services.parsers.types import ParsedTransaction


DATE_CANDIDATES = ["date", "transaction_date", "posted_date"]
DESC_CANDIDATES = ["description", "memo", "details", "merchant"]
AMOUNT_CANDIDATES = ["amount", "transaction_amount", "value"]


def _pick_column(columns: list[str], candidates: list[str]) -> str | None:
    lowered = {c.lower(): c for c in columns}
    for candidate in candidates:
        if candidate in lowered:
            return lowered[candidate]
    return None


def parse_csv_statement(file_path: str, source: str) -> list[ParsedTransaction]:
    df = pd.read_csv(file_path)
    columns = list(df.columns)

    date_col = _pick_column(columns, DATE_CANDIDATES)
    desc_col = _pick_column(columns, DESC_CANDIDATES)
    amount_col = _pick_column(columns, AMOUNT_CANDIDATES)

    if not date_col or not desc_col or not amount_col:
        # Can't map required columns — return empty rather than crashing the job.
        return []

    results: list[ParsedTransaction] = []
    for _, row in df.iterrows():
        amount = Decimal(str(row[amount_col])).quantize(Decimal("0.01"))
        direction = "debit" if amount > 0 else "credit"
        results.append(
            ParsedTransaction(
                transaction_date=date_parser.parse(str(row[date_col])).date(),
                posted_date=None,
                merchant_raw=str(row[desc_col]).strip(),
                description=str(row[desc_col]).strip(),
                amount=abs(amount),
                direction=direction,
                currency="USD",
                source=source,
            )
        )
    return results
