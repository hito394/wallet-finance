from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class PlaidItem(Base):
    """
    Plaid連携アイテム（銀行接続単位）。
    1つのアイテム = 1つの銀行機関。
    複数の口座（checking, savings, credit等）を含む場合がある。
    """
    __tablename__ = "plaid_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Plaid識別子
    item_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    access_token: Mapped[str] = mapped_column(String(200), nullable=False)

    # 機関情報
    institution_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    institution_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # 口座一覧（Plaidから取得したJSONをキャッシュ）
    accounts_cache: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
