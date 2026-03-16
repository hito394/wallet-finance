"""
分析サービス層。ダッシュボード・月次トレンド・カテゴリ集計を担当。
"""
import calendar
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.import_record import ImportRecord
from app.models.receipt import Receipt, ReceiptStatus
from app.models.transaction import Transaction, TransactionDirection
from app.schemas.analytics import CategorySummary, DashboardSummary, MonthlyTrend
from app.services.categorization_service import CATEGORY_JA


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard_summary(
        self, user_id: int, month: Optional[str] = None
    ) -> DashboardSummary:
        target_month = month or datetime.now().strftime("%Y-%m")
        year, mon = map(int, target_month.split("-"))
        last_day = calendar.monthrange(year, mon)[1]
        start = date(year, mon, 1)
        end = date(year, mon, last_day)

        # 今月の収支集計
        month_expense, month_income, month_count = await self._get_month_totals(
            user_id, start, end
        )

        # カテゴリ別内訳
        category_breakdown = await self.get_category_breakdown(user_id, target_month)

        # 月次トレンド（直近6ヶ月）
        monthly_trends = await self.get_monthly_trends(user_id, 6)

        # ステータスカウント
        uncategorized = await self._count_uncategorized(user_id)
        unmatched_receipts = await self._count_unmatched_receipts(user_id)
        possible_dupes = await self._count_possible_duplicates(user_id)
        import_count = await self._count_imports(user_id)

        return DashboardSummary(
            current_month=target_month,
            month_total_expense=month_expense,
            month_total_income=month_income,
            month_net=month_income - month_expense,
            month_transaction_count=month_count,
            category_breakdown=category_breakdown,
            monthly_trends=monthly_trends,
            uncategorized_count=uncategorized,
            unmatched_receipt_count=unmatched_receipts,
            possible_duplicate_count=possible_dupes,
            total_import_count=import_count,
        )

    async def get_category_breakdown(
        self, user_id: int, month: Optional[str] = None
    ) -> list[CategorySummary]:
        """カテゴリ別支出集計を返す（支出のみ）"""
        conditions = [
            Transaction.user_id == user_id,
            Transaction.direction == TransactionDirection.DEBIT,
            Transaction.is_ignored == False,  # noqa: E712
        ]

        if month:
            year, mon = map(int, month.split("-"))
            last_day = calendar.monthrange(year, mon)[1]
            conditions.append(
                Transaction.transaction_date.between(
                    date(year, mon, 1), date(year, mon, last_day)
                )
            )

        stmt = (
            select(
                Transaction.category,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("count"),
            )
            .where(and_(*conditions))
            .group_by(Transaction.category)
            .order_by(func.sum(Transaction.amount).desc())
        )
        rows = (await self.db.execute(stmt)).all()

        grand_total = sum(r.total or Decimal(0) for r in rows) or Decimal(1)

        # カテゴリ情報マッピング（色・アイコンはカテゴリモデルから取得するが、簡略化のため固定値使用）
        from app.models.category import DEFAULT_CATEGORIES
        cat_meta = {c["name"]: c for c in DEFAULT_CATEGORIES}

        return [
            CategorySummary(
                category=r.category or "other",
                category_ja=CATEGORY_JA.get(r.category or "other", r.category or "その他"),
                icon=cat_meta.get(r.category or "other", {}).get("icon"),
                color=cat_meta.get(r.category or "other", {}).get("color"),
                total_amount=r.total or Decimal(0),
                transaction_count=r.count,
                percentage=round(float(r.total or 0) / float(grand_total) * 100, 1),
            )
            for r in rows
        ]

    async def get_monthly_trends(
        self, user_id: int, months: int = 6
    ) -> list[MonthlyTrend]:
        """直近N月の収支トレンドを返す"""
        today = date.today()
        trends = []

        for i in range(months - 1, -1, -1):
            # i月前の年月を計算
            month_offset = today.month - i
            year_offset = today.year + (month_offset - 1) // 12
            mon = ((month_offset - 1) % 12) + 1
            last_day = calendar.monthrange(year_offset, mon)[1]
            start = date(year_offset, mon, 1)
            end = date(year_offset, mon, last_day)

            expense, income, count = await self._get_month_totals(user_id, start, end)
            trends.append(
                MonthlyTrend(
                    month=f"{year_offset:04d}-{mon:02d}",
                    total_expense=expense,
                    total_income=income,
                    net=income - expense,
                    transaction_count=count,
                )
            )

        return trends

    # -------------------------------------------------------------------------
    # 内部ヘルパー
    # -------------------------------------------------------------------------

    async def _get_month_totals(
        self, user_id: int, start: date, end: date
    ) -> tuple[Decimal, Decimal, int]:
        """月間の支出・収入・件数を返す"""
        stmt = select(
            Transaction.direction,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        ).where(
            Transaction.user_id == user_id,
            Transaction.transaction_date.between(start, end),
            Transaction.is_ignored == False,  # noqa: E712
        ).group_by(Transaction.direction)

        rows = (await self.db.execute(stmt)).all()
        expense = Decimal(0)
        income = Decimal(0)
        count = 0
        for r in rows:
            if r.direction == TransactionDirection.DEBIT:
                expense = r.total or Decimal(0)
            else:
                income = r.total or Decimal(0)
            count += r.count
        return expense, income, count

    async def _count_uncategorized(self, user_id: int) -> int:
        stmt = select(func.count()).select_from(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.category == "other",
            Transaction.is_ignored == False,  # noqa: E712
        )
        return (await self.db.execute(stmt)).scalar_one()

    async def _count_unmatched_receipts(self, user_id: int) -> int:
        stmt = select(func.count()).select_from(Receipt).where(
            Receipt.user_id == user_id,
            Receipt.status == ReceiptStatus.UNMATCHED,
        )
        return (await self.db.execute(stmt)).scalar_one()

    async def _count_possible_duplicates(self, user_id: int) -> int:
        subq = (
            select(Transaction.dedup_hash)
            .where(
                Transaction.user_id == user_id,
                Transaction.dedup_hash.isnot(None),
            )
            .group_by(Transaction.dedup_hash)
            .having(func.count(Transaction.id) > 1)
        )
        result = await self.db.execute(subq)
        return len(result.all())

    async def _count_imports(self, user_id: int) -> int:
        stmt = select(func.count()).select_from(ImportRecord).where(
            ImportRecord.user_id == user_id
        )
        return (await self.db.execute(stmt)).scalar_one()
