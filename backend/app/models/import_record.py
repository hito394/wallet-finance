import enum
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Enum, Integer, ForeignKey, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ImportType(str, enum.Enum):
    CSV_STATEMENT = "csv_statement"
    PDF_STATEMENT = "pdf_statement"
    RECEIPT_IMAGE = "receipt_image"
    RECEIPT_PDF = "receipt_pdf"


class ImportStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"  # 一部成功


class ImportRecord(Base):
    """
    インポート履歴テーブル。
    各ファイルアップロードに対して1レコード作成。
    """
    __tablename__ = "import_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # ファイル情報
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=True)  # SHA256 重複防止用

    # インポート種別・状態
    import_type: Mapped[ImportType] = mapped_column(Enum(ImportType), nullable=False)
    status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus), default=ImportStatus.PENDING, nullable=False
    )

    # 解析結果サマリー
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    success_rows: Mapped[int] = mapped_column(Integer, default=0)
    skipped_rows: Mapped[int] = mapped_column(Integer, default=0)   # 重複スキップ
    error_rows: Mapped[int] = mapped_column(Integer, default=0)

    # エラー詳細・メタ情報
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    parser_meta: Mapped[dict] = mapped_column(JSON, nullable=True)  # バンク名等のメタ

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # リレーション
    user: Mapped["User"] = relationship("User", back_populates="import_records")  # type: ignore[name-defined]
    rows: Mapped[list["ImportRow"]] = relationship(
        "ImportRow", back_populates="import_record", lazy="select", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(  # type: ignore[name-defined]
        "Transaction", back_populates="import_record", lazy="select"
    )


class ImportRow(Base):
    """
    インポート行詳細テーブル。
    各行の解析結果（成功・失敗・スキップ）を記録。
    """
    __tablename__ = "import_rows"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    import_record_id: Mapped[int] = mapped_column(
        ForeignKey("import_records.id"), nullable=False, index=True
    )

    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_data: Mapped[str] = mapped_column(Text, nullable=True)   # 元の行テキスト
    status: Mapped[str] = mapped_column(String(20), default="success")  # success/skipped/error
    error_detail: Mapped[str] = mapped_column(Text, nullable=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), nullable=True
    )

    import_record: Mapped["ImportRecord"] = relationship("ImportRecord", back_populates="rows")
