from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.category import Category
from app.models.plaid_item import BankAccount
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
    # US – Streaming
    "netflix": "netflix.com", "hulu": "hulu.com", "disney": "disneyplus.com",
    "disney+": "disneyplus.com", "hbo": "hbomax.com", "max": "max.com",
    "peacock": "peacocktv.com", "paramount": "paramountplus.com",
    "apple tv": "apple.com", "espn": "espnplus.com",
    "crunchyroll": "crunchyroll.com", "funimation": "funimation.com",
    # US – Music
    "spotify": "spotify.com", "apple music": "apple.com", "tidal": "tidal.com",
    "pandora": "pandora.com", "audible": "audible.com", "sirius": "siriusxm.com",
    # US – EC / Retail
    "amazon prime": "amazon.com", "amazon": "amazon.com",
    "walmart": "walmart.com", "target": "target.com", "costco": "costco.com",
    "whole foods": "wholefoodsmarket.com", "best buy": "bestbuy.com",
    "etsy": "etsy.com", "ebay": "ebay.com", "shopify": "shopify.com",
    # US – Tech / SaaS
    "apple": "apple.com", "google": "google.com", "microsoft": "microsoft.com",
    "adobe": "adobe.com", "dropbox": "dropbox.com", "notion": "notion.so",
    "slack": "slack.com", "figma": "figma.com", "canva": "canva.com",
    "zoom": "zoom.us", "github": "github.com", "openai": "openai.com",
    "chatgpt": "openai.com", "claude": "anthropic.com", "anthropic": "anthropic.com",
    "grammarly": "grammarly.com", "duolingo": "duolingo.com",
    "nordvpn": "nordvpn.com", "expressvpn": "expressvpn.com",
    "lastpass": "lastpass.com", "1password": "1password.com",
    "evernote": "evernote.com", "trello": "trello.com", "asana": "asana.com",
    "monday": "monday.com", "airtable": "airtable.com", "webflow": "webflow.com",
    "squarespace": "squarespace.com", "wix": "wix.com",
    "hubspot": "hubspot.com", "salesforce": "salesforce.com",
    "mailchimp": "mailchimp.com", "stripe": "stripe.com",
    "heroku": "heroku.com", "digitalocean": "digitalocean.com",
    "cloudflare": "cloudflare.com", "datadog": "datadoghq.com",
    # US – Health / Fitness
    "peloton": "onepeloton.com", "calm": "calm.com", "headspace": "headspace.com",
    "noom": "noom.com", "weight watchers": "weightwatchers.com",
    "planet fitness": "planetfitness.com",
    # US – News / Media
    "new york times": "nytimes.com", "nytimes": "nytimes.com",
    "washington post": "washingtonpost.com", "wall street journal": "wsj.com",
    "economist": "economist.com", "bloomberg": "bloomberg.com",
    # US – Gaming
    "nintendo": "nintendo.com", "playstation": "playstation.com", "xbox": "xbox.com",
    "steam": "steampowered.com", "epic games": "epicgames.com", "twitch": "twitch.tv",
    "ea": "ea.com", "blizzard": "blizzard.com", "ubisoft": "ubisoft.com",
    # US – Transport / Travel
    "uber": "uber.com", "lyft": "lyft.com", "airbnb": "airbnb.com",
    "booking": "booking.com", "expedia": "expedia.com",
    "delta": "delta.com", "united": "united.com", "southwest": "southwest.com",
    # US – Finance
    "paypal": "paypal.com", "venmo": "venmo.com", "cashapp": "cash.app",
    "robinhood": "robinhood.com", "coinbase": "coinbase.com",
    # US – Social
    "youtube": "youtube.com", "twitter": "twitter.com", "linkedin": "linkedin.com",
    "discord": "discord.com", "reddit": "reddit.com", "tiktok": "tiktok.com",
    "instagram": "instagram.com", "facebook": "facebook.com",
    # Japan – Streaming
    "abema": "abema.tv", "u-next": "video.unext.jp", "unext": "video.unext.jp",
    "dazn": "dazn.com", "niconico": "nicovideo.jp", "dmm": "dmm.com",
    "nhk": "nhk.or.jp", "tver": "tver.jp",
    # Japan – EC / Retail
    "rakuten": "rakuten.co.jp", "yahoo japan": "yahoo.co.jp",
    "mercari": "mercari.com", "zozotown": "zozo.jp",
    "yodobashi": "yodobashi.com", "bic camera": "biccamera.com",
    "amazon.co.jp": "amazon.co.jp",
    # Japan – Telecom
    "docomo": "docomo.ne.jp", "softbank": "softbank.jp", "au": "au.com",
    "rakuten mobile": "network.mobile.rakuten.co.jp",
    # Japan – Tech / Finance
    "line": "line.me", "freee": "freee.co.jp", "money forward": "moneyforward.com",
    "paypay": "paypay.ne.jp",
    # Japan – Gaming
    "square enix": "square-enix.com", "bandai namco": "bandainamcoent.com",
    "konami": "konami.com", "capcom": "capcom.com", "sega": "sega.com",
    "koei tecmo": "koeitecmo.co.jp",
    # Japan – Education
    "benesse": "benesse.co.jp", "gakken": "gakken.co.jp",
    # Japan – Travel
    "ana": "ana.co.jp", "jal": "jal.co.jp", "jr": "jr-central.co.jp",
    "jalan": "jalan.net", "ikyu": "ikyu.com",
    # Cloud Storage
    "icloud": "apple.com", "onedrive": "microsoft.com",
    "google drive": "google.com", "google one": "one.google.com",
    "kindle": "amazon.com",
}


def guess_domain(merchant: str) -> str | None:
    m = merchant.lower()
    for key, domain in MERCHANT_DOMAIN_MAP.items():
        if key in m:
            return domain
    return None


class SubscriptionServiceItem(BaseModel):
    merchant: str
    monthly_amount: float
    charge_count: int
    last_charge_date: str
    merchant_domain: str | None


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

    # Subscriptionsカテゴリのidを取得 (entity単位でフィルタ)
    cat_row = db.execute(
        select(Category.id).where(
            Category.entity_id == entity.id,
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
        ))

    # 月額降順
    items.sort(key=lambda x: x.monthly_amount, reverse=True)
    total = sum(i.monthly_amount for i in items)

    return SubscriptionsDetailResponse(subscriptions=items, total_monthly=round(total, 2))


# ─── Net Worth ────────────────────────────────────────────────────────────────

class NetWorthAccount(BaseModel):
    id: str
    name: str
    mask: str | None
    account_type: str | None
    account_subtype: str | None
    current_balance: float
    institution_name: str | None


class NetWorthResponse(BaseModel):
    total_assets: float      # depository + investment balances
    total_liabilities: float  # credit card / loan balances (positive number)
    net_worth: float
    accounts: list[NetWorthAccount]


@router.get("/net-worth", response_model=NetWorthResponse)
def get_net_worth(
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> NetWorthResponse:
    """Return net worth based on connected Plaid bank account balances."""
    from app.models.plaid_item import PlaidItem

    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)

    rows = db.execute(
        select(
            BankAccount.id,
            BankAccount.name,
            BankAccount.mask,
            BankAccount.account_type,
            BankAccount.account_subtype,
            BankAccount.current_balance,
            PlaidItem.institution_name,
        )
        .join(PlaidItem, PlaidItem.id == BankAccount.plaid_item_id)
        .where(
            BankAccount.entity_id == entity.id,
            BankAccount.is_active.is_(True),
        )
        .order_by(BankAccount.account_type, BankAccount.name)
    ).all()

    assets = 0.0
    liabilities = 0.0
    accounts: list[NetWorthAccount] = []

    for row in rows:
        bal = float(row.current_balance or 0)
        acct_type = (row.account_type or "").lower()
        accounts.append(NetWorthAccount(
            id=str(row.id),
            name=row.name,
            mask=row.mask,
            account_type=row.account_type,
            account_subtype=row.account_subtype,
            current_balance=bal,
            institution_name=row.institution_name,
        ))
        if acct_type in {"credit", "loan"}:
            liabilities += bal
        else:
            assets += bal

    return NetWorthResponse(
        total_assets=round(assets, 2),
        total_liabilities=round(liabilities, 2),
        net_worth=round(assets - liabilities, 2),
        accounts=accounts,
    )

