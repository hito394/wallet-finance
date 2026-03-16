from decimal import Decimal

from pydantic import BaseModel


class MonthlyCategorySpend(BaseModel):
    category: str
    total: Decimal


class MonthlyOverview(BaseModel):
    month: str
    total_spend: Decimal
    income: Decimal
    net: Decimal
    category_breakdown: list[MonthlyCategorySpend]
    detected_subscriptions: list[str]
    alerts: list[str]


class InsightItem(BaseModel):
    title: str
    severity: str
    details: str


class MonthlyHistoryItem(BaseModel):
    month: str
    spend: Decimal
    income: Decimal
