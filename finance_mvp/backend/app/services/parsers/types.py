from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass
class ParsedTransaction:
    transaction_date: date
    posted_date: date | None
    merchant_raw: str
    description: str
    amount: Decimal
    direction: str
    currency: str
    source: str
    running_balance: Decimal | None = None
    external_txn_id: str | None = None


@dataclass
class ParsedReceipt:
    merchant_raw: str | None
    total_amount: Decimal | None
    purchase_date: date | None
    tax_amount: Decimal | None
    line_items: list[dict]
    raw_text: str
    confidence: float
    currency: str = "USD"
