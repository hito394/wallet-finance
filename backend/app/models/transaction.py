import enum
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    String, Text, Date, DateTime, Enum, Numeric,
    Boolean, ForeignKey, func, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TransactionDirection(str, enum.Enum):
    DEBIT = "debit"    # 支出・引き落とし
    CREDIT = "credit"  # 収入・入金


class TransactionSource(str, enum.Enum):
    CSV_STATEMENT = "csv_statement"
    PDF_STATEMENT = "pdf_statement"
    MANUAL = "manual"


class Transaction(Base):
    """
    取引テーブル。家計簿の中核となるモデル。
    銀行明細・CSVから取り込まれた取引データを格納。
    """
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    import_record_id: Mapped[int] = mapped_column(
        ForeignKey("import_records.id"), nullable=True, index=True
    )

    # 取引基本情報
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    merchant_raw: Mapped[str] = mapped_column(String(500), nullable=False)         # 元の摘要
    merchant_normalized: Mapped[str] = mapped_column(String(255), nullable=True)   # 正規化後
    description: Mapped[str] = mapped_column(Text, nullable=True)                  # 追加説明

    # 金額情報（Decimal使用で精度保証）
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=True)  # 残高（あれば）
    direction: Mapped[TransactionDirection] = mapped_column(
        Enum(TransactionDirection), nullable=False
    )

    # カテゴリ（category_idまたは自由文字列、どちらでも動作）
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=True)  # カテゴリ名キャッシュ

    # メタデータ
    source_type: Mapped[TransactionSource] = mapped_column(Enum(TransactionSource), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    is_ignored: Mapped[bool] = mapped_column(Boolean, default=False)

    # Plaid連携情報
    plaid_account_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)  # どの口座の取引か

    # 重複検出用ハッシュ（date + amount + normalized_merchant でハッシュ）
    dedup_hash: Mapped[str] = mapped_column(String(64), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # リレーション
    user: Mapped["User"] = relationship("User", back_populates="transactions")  # type: ignore[name-defined]
    import_record: Mapped["ImportRecord"] = relationship(  # type: ignore[name-defined]
        "ImportRecord", back_populates="transactions"
    )
    category_obj: Mapped["Category"] = relationship("Category", back_populates="transactions")  # type: ignore[name-defined]
    receipt: Mapped["Receipt"] = relationship(  # type: ignore[name-defined]
        "Receipt", back_populates="transaction", uselist=False, foreign_keys="Receipt.transaction_id"
    )
    matches: Mapped[list["TransactionMatch"]] = relationship(  # type: ignore[name-defined]
        "TransactionMatch", back_populates="transaction", lazy="select"
    )

    __table_args__ = (
        Index("ix_transaction_date_amount", "transaction_date", "amount"),
        Index("ix_transaction_dedup", "user_id", "dedup_hash"),
    )

    def __repr__(self) -> str:
        return f"<Transaction id={self.id} date={self.transaction_date} amount={self.amount}>"
