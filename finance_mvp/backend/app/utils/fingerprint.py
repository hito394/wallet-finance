import hashlib
from datetime import date
from decimal import Decimal


def transaction_fingerprint(transaction_date: date, amount: Decimal, merchant: str, description: str, source: str) -> str:
    raw = f"{transaction_date.isoformat()}|{amount}|{merchant.strip().lower()}|{description.strip().lower()}|{source}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
