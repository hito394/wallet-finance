from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.database import init_db
from app.models.category import DEFAULT_CATEGORIES
from app.routers import (
    imports_router,
    transactions_router,
    receipts_router,
    analytics_router,
    goals_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """起動時: DBテーブル作成 & カテゴリマスタ初期化"""
    await init_db()
    await _seed_initial_data()
    yield


async def _seed_initial_data() -> None:
    """カテゴリマスタとデフォルトユーザーを初期化する（冪等）"""
    from app.database import AsyncSessionLocal
    from app.models.category import Category
    from app.models.user import User
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        # デフォルトユーザー作成
        existing_user = (
            await db.execute(select(User).where(User.id == 1))
        ).scalar_one_or_none()

        if not existing_user:
            user = User(id=1, name="管理者", email="admin@finance.local")
            db.add(user)

        # カテゴリマスタ初期化
        for cat_data in DEFAULT_CATEGORIES:
            existing = (
                await db.execute(
                    select(Category).where(Category.name == cat_data["name"])
                )
            ).scalar_one_or_none()
            if not existing:
                db.add(Category(**cat_data))

        await db.commit()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.TRUSTED_HOSTS,
)

# CORS設定（本番では公開フロントエンドURLを環境変数で指定）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
app.include_router(imports_router)
app.include_router(transactions_router)
app.include_router(receipts_router)
app.include_router(analytics_router)
app.include_router(goals_router)


@app.get("/api/health")
async def health_check() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
