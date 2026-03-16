from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.transaction import TransactionDirection, TransactionSource


class TransactionBase(BaseModel):
    transaction_date: date
    merchant_raw: str
    merchant_normalized: Optional[str] = None
    description: Optional[str] = None
    amount: Decimal = Field(gt=0)
    balance: Optional[Decimal] = None
    direction: TransactionDirection
    category_id: Optional[int] = None
    category: Optional[str] = None
    source_type: TransactionSource
    notes: Optional[str] = None
    is_ignored: bool = False


class TransactionCreate(TransactionBase):
    user_id: int
    import_record_id: Optional[int] = None
    dedup_hash: Optional[str] = None


class TransactionUpdate(BaseModel):
    """ユーザーが編集可能なフィールドのみ"""
    merchant_normalized: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    is_ignored: Optional[bool] = None
    receipt_id: Optional[int] = None  # レシート手動紐付け


class TransactionOut(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    import_record_id: Optional[int] = None
    dedup_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # 紐付けレシート情報（JOINして返す場合）
    receipt_id: Optional[int] = None


class TransactionListResponse(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    per_page: int
    total_pages: int


class TransactionFilter(BaseModel):
    """フィルタリング条件"""
    month: Optional[str] = None        # "YYYY-MM"形式
    category: Optional[str] = None
    direction: Optional[TransactionDirection] = None
    is_ignored: Optional[bool] = None
    search: Optional[str] = None       # 摘要・店名フリーワード検索
    source_type: Optional[TransactionSource] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)
