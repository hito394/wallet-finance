"""
支出目標（SpendingGoal）とサブスクリプション分析のルーター
"""
import calendar
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.spending_goal import SpendingGoal
from app.models.transaction import Transaction, TransactionDirection
from app.schemas.goals import (
    GoalVsActualPoint,
    GoalVsActualResponse,
    SpendingGoalCreate,
    SpendingGoalOut,
    SpendingGoalUpdate,
    SubscriptionItem,
    SubscriptionsResponse,
)

router = APIRouter(prefix="/api/goals", tags=["goals"])
CURRENT_USER_ID = settings.DEFAULT_USER_ID

# ─── サービス名 → ドメイン マッピング ────────────────────────────────────────

MERCHANT_DOMAIN_MAP: dict[str, str] = {
    # 動画
    "netflix": "netflix.com",
    "ネットフリックス": "netflix.com",
    "spotify": "spotify.com",
    "スポティファイ": "spotify.com",
    "amazon prime": "amazon.co.jp",
    "amazonプライム": "amazon.co.jp",
    "amazon": "amazon.co.jp",
    "youtube": "youtube.com",
    "youtubeプレミアム": "youtube.com",
    "disney": "disneyplus.com",
    "disney+": "disneyplus.com",
    "ディズニープラス": "disneyplus.com",
    "hulu": "hulu.jp",
    "フールー": "hulu.jp",
    "u-next": "video.unext.jp",
    "unext": "video.unext.jp",
    "ユーネクスト": "video.unext.jp",
    "dazn": "dazn.com",
    "ダ・ゾーン": "dazn.com",
    "abema": "abema.tv",
    "アベマ": "abema.tv",
    "rakuten tv": "tv.rakuten.co.jp",
    "楽天tv": "tv.rakuten.co.jp",
    "dtv": "dtv.jp",
    "paravi": "paravi.jp",
    "パラビ": "paravi.jp",
    "nhkオンデマンド": "nhk.jp",
    "bs nhk": "nhk.jp",
    # 音楽
    "apple music": "apple.com",
    "applemusic": "apple.com",
    "line music": "line.me",
    "linemusic": "line.me",
    "ラインミュージック": "line.me",
    "amazon music": "amazon.co.jp",
    "youtube music": "youtube.com",
    "awa": "awa.fm",
    # クラウドストレージ
    "icloud": "apple.com",
    "google one": "google.com",
    "googleone": "google.com",
    "dropbox": "dropbox.com",
    "ドロップボックス": "dropbox.com",
    "onedrive": "microsoft.com",
    "box": "box.com",
    # ソフトウェア / 生産性
    "microsoft 365": "microsoft.com",
    "microsoft365": "microsoft.com",
    "adobe": "adobe.com",
    "アドビ": "adobe.com",
    "notion": "notion.so",
    "slack": "slack.com",
    "canva": "canva.com",
    "figma": "figma.com",
    "zoom": "zoom.us",
    "github": "github.com",
    "chatgpt": "openai.com",
    "openai": "openai.com",
    "claude": "anthropic.com",
    # ゲーム
    "nintendo": "nintendo.com",
    "任天堂": "nintendo.com",
    "nintendo switch online": "nintendo.com",
    "playstation": "playstation.com",
    "ps plus": "playstation.com",
    "xbox": "xbox.com",
    # 読書 / ポッドキャスト
    "kindle unlimited": "amazon.co.jp",
    "kindle": "amazon.co.jp",
    "audible": "audible.co.jp",
    "オーディブル": "audible.co.jp",
    "楽天マガジン": "magazine.rakuten.co.jp",
    "dマガジン": "magazine.dmkt-sp.jp",
    # 通信
    "docomo": "docomo.ne.jp",
    "ドコモ": "docomo.ne.jp",
    "softbank": "softbank.jp",
    "ソフトバンク": "softbank.jp",
    "au": "au.com",
    "エーユー": "au.com",
    "rakuten mobile": "network.mobile.rakuten.co.jp",
    "楽天モバイル": "network.mobile.rakuten.co.jp",
    # フィットネス
    "fitbit": "fitbit.com",
    "strava": "strava.com",
    "apple fitness": "apple.com",
    "peloton": "onepeloton.com",
    # VPN・セキュリティ
    "nordvpn": "nordvpn.com",
    "expressvpn": "expressvpn.com",
    "1password": "1password.com",
    "lastpass": "lastpass.com",
    "bitwarden": "bitwarden.com",
    # デザイン・開発ツール
    "gitlab": "gitlab.com",
    "vercel": "vercel.com",
    "heroku": "heroku.com",
    "netlify": "netlify.com",
    "digitalocean": "digitalocean.com",
    "linear": "linear.app",
    "grammarly": "grammarly.com",
    "midjourney": "midjourney.com",
    # 生産性
    "evernote": "evernote.com",
    "trello": "trello.com",
    "asana": "asana.com",
    "todoist": "todoist.com",
    "bear": "bear.app",
    "obsidian": "obsidian.md",
    "duolingo": "duolingo.com",
    "headspace": "headspace.com",
    "calm": "calm.com",
    # 動画（追加）
    "apple tv": "apple.com",
    "apple tv+": "apple.com",
    "apple one": "apple.com",
    "prime video": "primevideo.com",
    "peacock": "peacocktv.com",
    "paramount+": "paramountplus.com",
    "hbo max": "hbomax.com",
    "max": "max.com",
    "espn+": "espnplus.com",
    "starz": "starz.com",
    "showtime": "sho.com",
    "curiosity stream": "curiositystream.com",
    "crunchyroll": "crunchyroll.com",
    "funimation": "funimation.com",
    "niconico": "nicovideo.jp",
    "ニコニコ": "nicovideo.jp",
    # 音楽（追加）
    "tidal": "tidal.com",
    "deezer": "deezer.com",
    # ゲーム（追加）
    "steam": "steampowered.com",
    "epic games": "epicgames.com",
    "ea play": "ea.com",
    "ubisoft": "ubisoft.com",
    "xbox game pass": "xbox.com",
    "ps plus": "playstation.com",
    "nintendo online": "nintendo.com",
    # ニュース
    "new york times": "nytimes.com",
    "wall street journal": "wsj.com",
    "bloomberg": "bloomberg.com",
    "economist": "economist.com",
    # 読書（追加）
    "scribd": "scribd.com",
    "bookwalker": "bookwalker.jp",
    "コミックシーモア": "cmoa.jp",
    # ビジネス
    "hubspot": "hubspot.com",
    "salesforce": "salesforce.com",
    "zendesk": "zendesk.com",
}


def guess_domain(merchant: str) -> Optional[str]:
    """商号からドメインを推定する"""
    m = merchant.lower().strip()
    # 完全一致
    if m in MERCHANT_DOMAIN_MAP:
        return MERCHANT_DOMAIN_MAP[m]
    # 部分一致
    for key, domain in MERCHANT_DOMAIN_MAP.items():
        if key in m or m in key:
            return domain
    return None


# ─── 目標 CRUD ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SpendingGoalOut])
async def list_goals(db: AsyncSession = Depends(get_db)):
    stmt = select(SpendingGoal).where(SpendingGoal.user_id == CURRENT_USER_ID)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=SpendingGoalOut)
async def create_goal(body: SpendingGoalCreate, db: AsyncSession = Depends(get_db)):
    # 同じカテゴリ・月の目標が既存なら上書き
    stmt = select(SpendingGoal).where(
        SpendingGoal.user_id == CURRENT_USER_ID,
        SpendingGoal.category == body.category,
        SpendingGoal.month == body.month,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()

    if existing:
        existing.target_amount = body.target_amount
        existing.is_recurring = body.is_recurring
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing

    goal = SpendingGoal(
        user_id=CURRENT_USER_ID,
        category=body.category,
        month=body.month,
        target_amount=body.target_amount,
        is_recurring=body.is_recurring,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=SpendingGoalOut)
async def update_goal(
    goal_id: int,
    body: SpendingGoalUpdate,
    db: AsyncSession = Depends(get_db),
):
    goal = (
        await db.execute(
            select(SpendingGoal).where(
                SpendingGoal.id == goal_id,
                SpendingGoal.user_id == CURRENT_USER_ID,
            )
        )
    ).scalar_one_or_none()

    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if body.target_amount is not None:
        goal.target_amount = body.target_amount
    if body.is_recurring is not None:
        goal.is_recurring = body.is_recurring
    goal.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete("/{goal_id}")
async def delete_goal(goal_id: int, db: AsyncSession = Depends(get_db)):
    goal = (
        await db.execute(
            select(SpendingGoal).where(
                SpendingGoal.id == goal_id,
                SpendingGoal.user_id == CURRENT_USER_ID,
            )
        )
    ).scalar_one_or_none()

    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    await db.delete(goal)
    await db.commit()
    return {"ok": True}


# ─── サブスクリプション一覧 ───────────────────────────────────────────────────

@router.get("/subscriptions", response_model=SubscriptionsResponse)
async def get_subscriptions(db: AsyncSession = Depends(get_db)):
    """
    category='subscriptions' の取引を商号でグルーピングし、
    月間コスト推定・アイコンドメインと一緒に返す。
    """
    stmt = select(Transaction).where(
        Transaction.user_id == CURRENT_USER_ID,
        Transaction.category == "subscriptions",
        Transaction.direction == TransactionDirection.DEBIT,
        Transaction.is_ignored == False,  # noqa: E712
    ).order_by(Transaction.transaction_date.desc())

    txs = (await db.execute(stmt)).scalars().all()

    # 商号ごとにグルーピング
    groups: dict[str, list[Transaction]] = {}
    for tx in txs:
        name = tx.merchant_normalized or tx.merchant_raw or "不明"
        groups.setdefault(name, []).append(tx)

    items: list[SubscriptionItem] = []
    for merchant, group in sorted(groups.items(), key=lambda x: -float(x[1][0].amount)):
        last_date = max(t.transaction_date for t in group)
        # 月あたりの平均コストを計算（直近12ヶ月以内のデータを使用）
        cutoff = date.today().replace(year=date.today().year - 1)
        recent = [t for t in group if t.transaction_date >= cutoff]
        if not recent:
            recent = group

        # 月数を算出
        dates = sorted(set(t.transaction_date for t in recent))
        if len(dates) > 1:
            months_span = max(
                (dates[-1].year - dates[0].year) * 12 + dates[-1].month - dates[0].month,
                1
            )
            total = sum(float(t.amount) for t in recent)
            monthly_avg = Decimal(str(round(total / months_span)))
        else:
            monthly_avg = recent[0].amount

        items.append(
            SubscriptionItem(
                merchant=merchant,
                merchant_domain=guess_domain(merchant),
                monthly_amount=monthly_avg,
                last_charge_date=last_date.isoformat(),
                charge_count=len(group),
                category="subscriptions",
            )
        )

    total_monthly = sum(i.monthly_amount for i in items)

    return SubscriptionsResponse(subscriptions=items, total_monthly=total_monthly)


# ─── 目標 vs 実績 ─────────────────────────────────────────────────────────────

@router.get("/vs-actual", response_model=GoalVsActualResponse)
async def get_goal_vs_actual(
    category: Optional[str] = Query(None, description="カテゴリ（省略=合計支出）"),
    months: int = Query(default=12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
):
    """
    直近N月の実績支出と目標を比較するデータを返す。
    """
    today = date.today()
    points: list[GoalVsActualPoint] = []

    # 目標を取得（月別 > 繰り返し の優先度）
    goals_stmt = select(SpendingGoal).where(
        SpendingGoal.user_id == CURRENT_USER_ID,
        SpendingGoal.category == category,
    )
    goals = (await db.execute(goals_stmt)).scalars().all()

    def find_goal(month_str: str) -> Optional[Decimal]:
        # 月固有の目標を優先
        for g in goals:
            if g.month == month_str:
                return g.target_amount
        # 繰り返し目標にフォールバック
        for g in goals:
            if g.month is None and g.is_recurring:
                return g.target_amount
        return None

    for i in range(months - 1, -1, -1):
        month_offset = today.month - i
        year = today.year + (month_offset - 1) // 12
        mon = ((month_offset - 1) % 12) + 1
        last_day = calendar.monthrange(year, mon)[1]
        start = date(year, mon, 1)
        end = date(year, mon, last_day)
        month_str = f"{year:04d}-{mon:02d}"

        # 実績集計
        conditions = [
            Transaction.user_id == CURRENT_USER_ID,
            Transaction.direction == TransactionDirection.DEBIT,
            Transaction.is_ignored == False,  # noqa: E712
            Transaction.transaction_date.between(start, end),
        ]
        if category:
            conditions.append(Transaction.category == category)

        stmt = select(func.sum(Transaction.amount)).where(and_(*conditions))
        actual = (await db.execute(stmt)).scalar_one() or Decimal(0)

        points.append(GoalVsActualPoint(
            month=month_str,
            actual=actual,
            goal=find_goal(month_str),
        ))

    # 最新の目標金額を返す
    latest_goal = find_goal(f"{today.year:04d}-{today.month:02d}")

    return GoalVsActualResponse(
        points=points,
        category=category,
        target_amount=latest_goal,
    )
