from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.receipt import ReceiptStatus


class ReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    transaction_id: Optional[int] = None
    original_filename: str
    file_type: str
    status: ReceiptStatus
    merchant_name: Optional[str] = None
    purchase_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    subtotal_amount: Optional[Decimal] = None
    ocr_confidence: Optional[float] = None
    line_items: Optional[list] = None
    notes: Optional[str] = None
    is_manually_matched: bool
    created_at: datetime
    updated_at: datetime


class ReceiptUpdate(BaseModel):
    merchant_name: Optional[str] = None
    purchase_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    transaction_id: Optional[int] = None
    notes: Optional[str] = None
    is_manually_matched: Optional[bool] = None


class ReceiptListResponse(BaseModel):
    items: list[ReceiptOut]
    total: int
    page: int
    per_page: int
