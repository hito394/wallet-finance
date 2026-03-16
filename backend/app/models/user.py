from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    """
    ユーザーテーブル。MVPでは1ユーザー固定（id=1）。
    将来的に認証（JWT/OAuth）と組み合わせてマルチユーザー対応可能。
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="管理者")
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # リレーション
    transactions: Mapped[list["Transaction"]] = relationship(  # type: ignore[name-defined]
        "Transaction", back_populates="user", lazy="select"
    )
    receipts: Mapped[list["Receipt"]] = relationship(  # type: ignore[name-defined]
        "Receipt", back_populates="user", lazy="select"
    )
    import_records: Mapped[list["ImportRecord"]] = relationship(  # type: ignore[name-defined]
        "ImportRecord", back_populates="user", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
