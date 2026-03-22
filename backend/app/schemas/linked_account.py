from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.linked_account import AccountType


class LinkedAccountCreate(BaseModel):
    name: str
    institution: str
    account_type: AccountType = AccountType.CHECKING
    last4: Optional[str] = None
    color: str = "#7C6FFF"
    notes: Optional[str] = None


class LinkedAccountUpdate(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    account_type: Optional[AccountType] = None
    last4: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class LinkedAccountOut(BaseModel):
    id: int
    user_id: int
    name: str
    institution: str
    account_type: AccountType
    last4: Optional[str]
    color: str
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountSummary(BaseModel):
    account: LinkedAccountOut
    month_expense: Decimal
    month_income: Decimal
    month_net: Decimal
    month_transaction_count: int
    total_import_count: int
    last_import_at: Optional[datetime]
