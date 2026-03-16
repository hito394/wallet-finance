from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class CategorySummary(BaseModel):
    category: str
    category_ja: str
    icon: Optional[str] = None
    color: Optional[str] = None
    total_amount: Decimal
    transaction_count: int
    percentage: float  # 全支出に占める割合


class MonthlyTrend(BaseModel):
    month: str  # "YYYY-MM"
    total_expense: Decimal
    total_income: Decimal
    net: Decimal
    transaction_count: int


class DashboardSummary(BaseModel):
    """ダッシュボード用サマリーデータ"""
    # 今月の集計
    current_month: str
    month_total_expense: Decimal
    month_total_income: Decimal
    month_net: Decimal
    month_transaction_count: int

    # カテゴリ別内訳
    category_breakdown: list[CategorySummary]

    # 月次トレンド（直近6ヶ月）
    monthly_trends: list[MonthlyTrend]

    # ステータス
    uncategorized_count: int
    unmatched_receipt_count: int
    possible_duplicate_count: int
    total_import_count: int
