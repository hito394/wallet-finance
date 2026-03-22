from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class SpendingGoalCreate(BaseModel):
    category: Optional[str] = None  # Noneなら合計支出目標
    month: Optional[str] = None      # YYYY-MM。Noneなら毎月
    target_amount: Decimal
    is_recurring: bool = True


class SpendingGoalUpdate(BaseModel):
    target_amount: Optional[Decimal] = None
    is_recurring: Optional[bool] = None


class SpendingGoalOut(BaseModel):
    id: int
    user_id: int
    category: Optional[str]
    month: Optional[str]
    target_amount: Decimal
    is_recurring: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionItem(BaseModel):
    merchant: str
    merchant_domain: Optional[str]
    monthly_amount: Decimal
    last_charge_date: str
    charge_count: int
    category: str


class SubscriptionsResponse(BaseModel):
    subscriptions: list[SubscriptionItem]
    total_monthly: Decimal


class GoalVsActualPoint(BaseModel):
    month: str
    actual: Decimal
    goal: Optional[Decimal]


class GoalVsActualResponse(BaseModel):
    points: list[GoalVsActualPoint]
    category: Optional[str]
    target_amount: Optional[Decimal]
