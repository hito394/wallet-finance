import enum
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    String, Text, Date, DateTime, Enum, Numeric,
    Boolean, ForeignKey, func, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ReceiptStatus(str, enum.Enum):
    PENDING = "pending"       # OCR処理待ち
    PROCESSING = "processing" # OCR処理中
    PARSED = "parsed"         # OCR完了
    MATCHED = "matched"       # 取引に紐付け済み
    UNMATCHED = "unmatched"   # 取引との紐付けなし
    FAILED = "failed"         # OCR失敗


class Receipt(Base):
    """
    レシートテーブル。
    アップロードされたレシート画像・PDFのOCR結果と
    取引とのマッチング情報を管理。
    """
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), nullable=True, index=True
    )

    # ファイル情報
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)  # jpg/png/pdf

    # OCR抽出結果
    status: Mapped[ReceiptStatus] = mapped_column(
        Enum(ReceiptStatus), default=ReceiptStatus.PENDING, nullable=False
    )
    merchant_name: Mapped[str] = mapped_column(String(255), nullable=True)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=True)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=True)
    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=True)

    # OCR生テキストと信頼度
    ocr_raw_text: Mapped[str] = mapped_column(Text, nullable=True)
    ocr_confidence: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)  # 0〜100
    line_items: Mapped[dict] = mapped_column(JSON, nullable=True)  # 明細行リスト

    notes: Mapped[str] = mapped_column(Text, nullable=True)
    is_manually_matched: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # リレーション
    user: Mapped["User"] = relationship("User", back_populates="receipts")  # type: ignore[name-defined]
    transaction: Mapped["Transaction"] = relationship(  # type: ignore[name-defined]
        "Transaction", back_populates="receipt", foreign_keys=[transaction_id]
    )
    matches: Mapped[list["TransactionMatch"]] = relationship(  # type: ignore[name-defined]
        "TransactionMatch", back_populates="receipt", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Receipt id={self.id} merchant={self.merchant_name} amount={self.total_amount}>"
