from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.category import Category
from app.models.transaction import Transaction, TransactionDirection
from app.schemas.analytics import InsightItem, MonthlyHistoryItem, MonthlyOverview
from app.services.analytics.insight_engine import generate_insights, monthly_history, monthly_overview
from app.utils.user_context import resolve_actor_context

router = APIRouter()


@router.get("/monthly-overview", response_model=MonthlyOverview)
def get_monthly_overview(
    year: int = Query(default=datetime.utcnow().year),
    month: int = Query(default=datetime.utcnow().month),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> MonthlyOverview:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    return monthly_overview(db, entity.id, year, month)


@router.get("/monthly-history", response_model=list[MonthlyHistoryItem])
def get_monthly_history(
    months: int = Query(default=6, ge=1, le=24),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[MonthlyHistoryItem]:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    return monthly_history(db, entity.id, months)


@router.get("/insights", response_model=list[InsightItem])
def get_insights(
    year: int = Query(default=datetime.utcnow().year),
    month: int = Query(default=datetime.utcnow().month),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[InsightItem]:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    overview = monthly_overview(db, entity.id, year, month)
    return generate_insights(overview)


# ─── サブスクリプション詳細 ────────────────────────────────────────────────────

MERCHANT_DOMAIN_MAP: dict[str, str] = {
    "netflix": "netflix.com", "spotify": "spotify.com", "hulu": "hulu.jp",
    "disney": "disneyplus.com", "disney+": "disneyplus.com",
    "amazon prime": "amazon.co.jp", "amazon": "amazon.co.jp",
    "youtube": "youtube.com", "apple": "apple.com", "dazn": "dazn.com",
    "abema": "abema.tv", "u-next": "video.unext.jp", "unext": "video.unext.jp",
    "adobe": "adobe.com", "microsoft": "microsoft.com", "dropbox": "dropbox.com",
    "notion": "notion.so", "slack": "slack.com", "figma": "figma.com",
    "canva": "canva.com", "zoom": "zoom.us", "github": "github.com",
    "openai": "openai.com", "chatgpt": "openai.com", "claude": "anthropic.com",
    "nintendo": "nintendo.com", "playstation": "playstation.com", "xbox": "xbox.com",
    "peloton": "onepeloton.com", "nordvpn": "nordvpn.com",
    "grammarly": "grammarly.com", "duolingo": "duolingo.com",
    "audible": "audible.co.jp", "kindle": "amazon.co.jp",
    "docomo": "docomo.ne.jp", "softbank": "softbank.jp", "au": "au.com",
    "rakuten": "rakuten.co.jp", "icloud": "apple.com",
}

SERVICE_EMOJI: dict[str, str] = {
    "netflix": "🎬", "spotify": "🎵", "hulu": "📺", "disney": "🏰",
    "amazon": "📦", "youtube": "▶️", "apple": "🍎", "dazn": "⚽",
    "adobe": "🅰️", "microsoft": "💼", "notion": "📝", "slack": "💬",
    "figma": "🎨", "canva": "🎨", "zoom": "🎥", "github": "💻",
    "openai": "🤖", "chatgpt": "🤖", "nintendo": "🎮", "playstation": "🕹️",
    "xbox": "🎮", "dropbox": "📦", "peloton": "🚴", "grammarly": "✍️",
    "duolingo": "🦜", "audible": "🎧", "kindle": "📚", "docomo": "📱",
    "softbank": "📱", "rakuten": "🛒",
}


def guess_domain(merchant: str) -> str | None:
    m = merchant.lower()
    for key, domain in MERCHANT_DOMAIN_MAP.items():
        if key in m:
            return domain
    return None


def guess_emoji(merchant: str) -> str | None:
    m = merchant.lower()
    for key, emoji in SERVICE_EMOJI.items():
        if key in m:
            return emoji
    return None


class SubscriptionServiceItem(BaseModel):
    merchant: str
    monthly_amount: float
    charge_count: int
    last_charge_date: str
    merchant_domain: str | None
    emoji: str | None


class SubscriptionsDetailResponse(BaseModel):
    subscriptions: list[SubscriptionServiceItem]
    total_monthly: float


@router.get("/subscriptions", response_model=SubscriptionsDetailResponse)
def get_subscriptions(
    months: int = Query(default=12, ge=1, le=24),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> SubscriptionsDetailResponse:
    """Subscriptionカテゴリの取引を集計してサービス一覧を返す"""
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)

    # Subscriptionsカテゴリのidを取得
    cat_row = db.execute(
        select(Category.id).where(
            func.lower(Category.name).in_(["subscriptions", "subscription", "サブスクリプション"])
        )
    ).first()

    if not cat_row:
        return SubscriptionsDetailResponse(subscriptions=[], total_monthly=0)

    cat_id = cat_row[0]

    # 直近Nヶ月のサブスク取引を取得
    rows = db.execute(
        select(
            Transaction.merchant_normalized,
            Transaction.amount,
            Transaction.transaction_date,
        )
        .where(
            Transaction.entity_id == entity.id,
            Transaction.category_id == cat_id,
            Transaction.direction == TransactionDirection.debit,
            Transaction.is_ignored.is_(False),
        )
        .order_by(Transaction.transaction_date.desc())
    ).all()

    # 商号でグループ化
    by_merchant: dict[str, dict] = defaultdict(lambda: {"amounts": [], "dates": []})
    for merchant, amount, tx_date in rows:
        key = (merchant or "Unknown").strip()
        by_merchant[key]["amounts"].append(float(amount))
        by_merchant[key]["dates"].append(str(tx_date))

    items: list[SubscriptionServiceItem] = []
    for merchant, data in by_merchant.items():
        amounts = data["amounts"]
        charge_count = len(amounts)
        # 月額 = 全チャージの平均（最大12ヶ月で割る）
        monthly_avg = sum(amounts) / min(months, max(1, charge_count))
        last_date = data["dates"][0] if data["dates"] else ""
        items.append(SubscriptionServiceItem(
            merchant=merchant,
            monthly_amount=round(monthly_avg, 2),
            charge_count=charge_count,
            last_charge_date=last_date,
            merchant_domain=guess_domain(merchant),
            emoji=guess_emoji(merchant),
        ))

    # 月額降順
    items.sort(key=lambda x: x.monthly_amount, reverse=True)
    total = sum(i.monthly_amount for i in items)

    return SubscriptionsDetailResponse(subscriptions=items, total_monthly=round(total, 2))

