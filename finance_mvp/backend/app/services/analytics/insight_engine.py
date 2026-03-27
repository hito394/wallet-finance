from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction, TransactionDirection
from app.schemas.analytics import InsightItem, MonthlyHistoryItem, MonthlyCategorySpend, MonthlyOverview
from app.services.dedupe.duplicate_detector import count_fuzzy_duplicates


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
        normalized_category = (category_name or "Uncategorized").strip().lower()
        is_transfer_like = normalized_category in {"transfers", "transfer"}
        if direction == TransactionDirection.debit:
            if is_transfer_like:
                continue
            spend += total
            by_category[category_name or "Uncategorized"] += total
        elif direction == TransactionDirection.credit:
            if is_transfer_like:
                continue
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

    duplicate_count = count_fuzzy_duplicates(db, entity_id)

    return MonthlyOverview(
        month=f"{year:04d}-{month:02d}",
        total_spend=spend,
        income=income,
        net=income - spend,
        category_breakdown=category_breakdown,
        detected_subscriptions=detected_subscriptions,
        alerts=alerts,
        duplicate_transaction_count=duplicate_count,
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


def monthly_history(db: Session, entity_id, months: int) -> list[MonthlyHistoryItem]:
    """Return aggregated spend/income for the last `months` calendar months."""
    today = date.today()
    rows = db.execute(
        select(
            extract("year", Transaction.transaction_date).label("yr"),
            extract("month", Transaction.transaction_date).label("mo"),
            Category.name,
            Transaction.direction,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Category.id == Transaction.category_id, isouter=True)
        .where(
            Transaction.entity_id == entity_id,
            Transaction.is_ignored.is_(False),
            Transaction.transaction_date <= today,
        )
        .group_by("yr", "mo", Category.name, Transaction.direction)
        .order_by("yr", "mo")
    ).all()

    # Bucket into {(yr, mo): {spend, income}}
    buckets: dict[tuple[int, int], dict[str, Decimal]] = defaultdict(lambda: {"spend": Decimal("0"), "income": Decimal("0")})
    for yr, mo, category_name, direction, total in rows:
        normalized_category = (category_name or "Uncategorized").strip().lower()
        if normalized_category in {"transfers", "transfer"}:
            continue
        key = (int(yr), int(mo))
        if direction == TransactionDirection.debit:
            buckets[key]["spend"] += total or Decimal("0")
        elif direction == TransactionDirection.credit:
            buckets[key]["income"] += total or Decimal("0")

    # Take the last `months` distinct months that have data
    sorted_keys = sorted(buckets.keys())[-months:]
    return [
        MonthlyHistoryItem(
            month=f"{yr:04d}-{mo:02d}",
            spend=buckets[(yr, mo)]["spend"],
            income=buckets[(yr, mo)]["income"],
        )
        for yr, mo in sorted_keys
    ]
