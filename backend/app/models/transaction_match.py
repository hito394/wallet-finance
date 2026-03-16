from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Numeric, Boolean, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TransactionMatch(Base):
    """
    取引とレシートのマッチング候補テーブル。
    自動マッチングの結果と信頼スコアを保存。
    手動確認・承認フローをサポート。
    """
    __tablename__ = "transaction_matches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), nullable=False, index=True
    )
    receipt_id: Mapped[int] = mapped_column(
        ForeignKey("receipts.id"), nullable=False, index=True
    )

    # マッチングスコア詳細（0.0〜1.0）
    score_total: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    score_amount: Mapped[float] = mapped_column(Numeric(4, 3), nullable=True)
    score_date: Mapped[float] = mapped_column(Numeric(4, 3), nullable=True)
    score_merchant: Mapped[float] = mapped_column(Numeric(4, 3), nullable=True)

    # マッチング状態
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)  # ユーザーが承認済み
    is_rejected: Mapped[bool] = mapped_column(Boolean, default=False)   # ユーザーが却下済み
    match_method: Mapped[str] = mapped_column(String(50), nullable=True)  # auto/manual

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # リレーション
    transaction: Mapped["Transaction"] = relationship(  # type: ignore[name-defined]
        "Transaction", back_populates="matches"
    )
    receipt: Mapped["Receipt"] = relationship(  # type: ignore[name-defined]
        "Receipt", back_populates="matches"
    )
