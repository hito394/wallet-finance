from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI依存性注入用DBセッションジェネレーター"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """起動時にテーブルを作成（Alembic使用の場合はコメントアウト）"""
    async with engine.begin() as conn:
        from app.models import Base as ModelsBase  # noqa: F401
        await conn.run_sync(ModelsBase.metadata.create_all)
        # 既存DBへの列追加（SQLiteはALTER TABLE ADD COLUMNのみサポート）
        await _migrate_add_columns(conn)


async def _migrate_add_columns(conn) -> None:
    """新規追加列をALTER TABLEで追加する（既存DBとの互換性維持）"""
    from sqlalchemy import text
    migrations = [
        ("transactions", "plaid_account_id", "VARCHAR(64)"),
        ("plaid_items", "transactions_cursor", "VARCHAR(500)"),
    ]
    for table, column, col_type in migrations:
        try:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        except Exception:
            pass  # 既に存在する場合はスキップ
