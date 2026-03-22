from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SpendingGoal(Base):
    """月別・カテゴリ別の支出目標"""
    __tablename__ = "spending_goals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # カテゴリ（Noneなら合計支出の目標）
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # 月（YYYY-MM）。Noneなら毎月の目標
    month: Mapped[str | None] = mapped_column(String(7), nullable=True)

    target_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    # 毎月繰り返す目標か（monthがNoneの場合に使用）
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
