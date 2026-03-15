from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction, TransactionDirection
from app.schemas.analytics import InsightItem, MonthlyCategorySpend, MonthlyOverview


def monthly_overview(db: Session, entity_id, year: int, month: int) -> MonthlyOverview:
    rows = db.execute(
        select(
            Category.name,
            func.sum(Transaction.amount).label("total"),
            Transaction.direction,
        )
        .join(Category, Category.id == Transaction.category_id, isouter=True)
        .where(
            Transaction.entity_id == entity_id,
            extract("year", Transaction.transaction_date) == year,
            extract("month", Transaction.transaction_date) == month,
            Transaction.is_ignored.is_(False),
        )
        .group_by(Category.name, Transaction.direction)
    ).all()

    spend = Decimal("0")
    income = Decimal("0")
    by_category: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for category_name, total, direction in rows:
        if not total:
            continue
        if direction == TransactionDirection.debit:
            spend += total
            by_category[category_name or "Uncategorized"] += total
        elif direction == TransactionDirection.credit:
            income += total

    category_breakdown = [
        MonthlyCategorySpend(category=name, total=amount)
        for name, amount in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
    ]

    detected_subscriptions = [c.category for c in category_breakdown if c.category == "Subscriptions"]
    alerts = []
    if spend > Decimal("3000"):
        alerts.append("Monthly spend exceeded baseline threshold of 3000.")
    if any(c.total > Decimal("1000") for c in category_breakdown):
        alerts.append("One category exceeded 1000 this month.")

    return MonthlyOverview(
        month=f"{year:04d}-{month:02d}",
        total_spend=spend,
        income=income,
        net=income - spend,
        category_breakdown=category_breakdown,
        detected_subscriptions=detected_subscriptions,
        alerts=alerts,
    )


def generate_insights(overview: MonthlyOverview) -> list[InsightItem]:
    insights: list[InsightItem] = []

    if overview.detected_subscriptions:
        insights.append(
            InsightItem(
                title="Subscription spend detected",
                severity="medium",
                details="Recurring merchants found in subscription category. Review for unused services.",
            )
        )

    top_category = overview.category_breakdown[0] if overview.category_breakdown else None
    if top_category:
        insights.append(
            InsightItem(
                title="Largest spending category",
                severity="info",
                details=f"{top_category.category} is currently your largest category at {top_category.total}.",
            )
        )

    for alert in overview.alerts:
        insights.append(InsightItem(title="Budget warning", severity="high", details=alert))

    return insights
