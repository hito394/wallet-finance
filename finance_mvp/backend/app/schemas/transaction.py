import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.transaction import TransactionDirection, TransactionSource


class TransactionRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    document_id: uuid.UUID | None
    transaction_date: date
    merchant_raw: str
    merchant_normalized: str
    description: str
    amount: Decimal
    running_balance: Decimal | None
    direction: TransactionDirection
    currency: str
    source: TransactionSource
    category_id: uuid.UUID | None
    receipt_id: uuid.UUID | None
    notes: str | None
    is_ignored: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    receipt_id: uuid.UUID | None = None
    notes: str | None = None
    is_ignored: bool | None = None
    # Manual data correction fields
    transaction_date: date | None = None
    amount: Decimal | None = None
    merchant_raw: str | None = None
    description: str | None = None
    direction: str | None = None  # "debit" | "credit" | "transfer"


class ReclassifyTransactionsResponse(BaseModel):
    updated_categories: int
    newly_ignored_rows: int
    scanned_rows: int


class TransactionCategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}
