from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.analytics import DashboardSummary
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
CURRENT_USER_ID = settings.DEFAULT_USER_ID


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(
    month: Optional[str] = Query(
        None, description="対象月（YYYY-MM）。省略時は今月"
    ),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    """
    ダッシュボード用サマリーデータを取得する。
    - 今月の収支合計
    - カテゴリ別支出内訳
    - 直近6ヶ月の月次トレンド
    - 未分類件数・未マッチレシート件数等のステータス
    """
    service = AnalyticsService(db)
    return await service.get_dashboard_summary(CURRENT_USER_ID, month)


@router.get("/monthly-trends")
async def get_monthly_trends(
    months: int = Query(default=6, ge=1, le=24, description="取得する月数"),
    db: AsyncSession = Depends(get_db),
):
    """月次トレンドデータを取得する（チャート用）"""
    service = AnalyticsService(db)
    return await service.get_monthly_trends(CURRENT_USER_ID, months)


@router.get("/category-breakdown")
async def get_category_breakdown(
    month: Optional[str] = Query(None, description="YYYY-MM形式。省略時は今月"),
    db: AsyncSession = Depends(get_db),
):
    """カテゴリ別支出内訳を取得する（円グラフ用）"""
    service = AnalyticsService(db)
    return await service.get_category_breakdown(CURRENT_USER_ID, month)
