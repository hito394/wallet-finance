from datetime import date
from decimal import Decimal

import pandas as pd
from dateutil import parser as date_parser

from app.services.parsers.types import ParsedTransaction


DATE_CANDIDATES = ["date", "transaction_date", "posted_date"]
DESC_CANDIDATES = ["description", "memo", "details", "merchant"]
AMOUNT_CANDIDATES = ["amount", "transaction_amount", "value"]
DEBIT_CANDIDATES = ["debit", "withdrawal", "payment", "charges"]
CREDIT_CANDIDATES = ["credit", "deposit", "addition", "refund"]
BALANCE_CANDIDATES = ["balance", "running_balance", "account_balance"]


def _pick_column(columns: list[str], candidates: list[str]) -> str | None:
    lowered = {c.lower(): c for c in columns}
    for candidate in candidates:
        if candidate in lowered:
            return lowered[candidate]
    return None


def _to_decimal(value) -> Decimal | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return None
    text = text.replace("$", "").replace(",", "")
    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1].strip()
    amount = Decimal(text)
    return -abs(amount) if negative else amount


def parse_csv_statement(file_path: str, source: str) -> list[ParsedTransaction]:
    df = pd.read_csv(file_path)
    columns = list(df.columns)

    date_col = _pick_column(columns, DATE_CANDIDATES)
    desc_col = _pick_column(columns, DESC_CANDIDATES)
    amount_col = _pick_column(columns, AMOUNT_CANDIDATES)
    debit_col = _pick_column(columns, DEBIT_CANDIDATES)
    credit_col = _pick_column(columns, CREDIT_CANDIDATES)
    balance_col = _pick_column(columns, BALANCE_CANDIDATES)

    if not date_col or not desc_col:
        # Can't map required columns — return empty rather than crashing the job.
        return []

    if not amount_col and not (debit_col or credit_col):
        return []

    results: list[ParsedTransaction] = []
    for _, row in df.iterrows():
        amount_value: Decimal | None = None
        direction = "debit"

        if amount_col:
            amount_value = _to_decimal(row[amount_col])
            if amount_value is None:
                continue
            direction = "debit" if amount_value > 0 else "credit"
        else:
            debit_value = _to_decimal(row[debit_col]) if debit_col else None
            credit_value = _to_decimal(row[credit_col]) if credit_col else None
            if debit_value and abs(debit_value) > 0:
                amount_value = abs(debit_value)
                direction = "debit"
            elif credit_value and abs(credit_value) > 0:
                amount_value = abs(credit_value)
                direction = "credit"
            else:
                continue

        amount = abs(amount_value).quantize(Decimal("0.01"))
        running_balance = None
        if balance_col:
            running_balance_raw = _to_decimal(row[balance_col])
            running_balance = running_balance_raw.quantize(Decimal("0.01")) if running_balance_raw is not None else None

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
                running_balance=running_balance,
            )
        )
    return results
