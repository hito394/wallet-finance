import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AccountType(str, enum.Enum):
    CHECKING = "checking"      # 普通預金
    SAVINGS = "savings"        # 定期預金
    CREDIT = "credit"          # クレジットカード
    DEBIT = "debit"            # デビットカード
    PREPAID = "prepaid"        # プリペイド（Suica等）
    INVESTMENT = "investment"  # 証券口座
    OTHER = "other"


class LinkedAccount(Base):
    """
    ユーザーが登録した口座・カードのマスタテーブル。
    インポートファイルと紐付けることで口座別に取引を管理できる。
    """
    __tablename__ = "linked_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # 表示名（ユーザーが設定するニックネーム）
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # 金融機関名
    institution: Mapped[str] = mapped_column(String(100), nullable=False)

    # 口座種別
    account_type: Mapped[AccountType] = mapped_column(
        Enum(AccountType), nullable=False, default=AccountType.CHECKING
    )

    # 下4桁（任意）
    last4: Mapped[str | None] = mapped_column(String(4), nullable=True)

    # 表示色（HEX）
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#7C6FFF")

    # メモ
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
