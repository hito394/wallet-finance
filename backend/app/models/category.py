from sqlalchemy import String, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Category(Base):
    """
    カテゴリマスタテーブル。
    システムデフォルトカテゴリとユーザーカスタムカテゴリを管理。
    """
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name_ja: Mapped[str] = mapped_column(String(100), nullable=False)  # 日本語名
    icon: Mapped[str] = mapped_column(String(50), nullable=True)       # 絵文字アイコン
    color: Mapped[str] = mapped_column(String(7), nullable=True)       # HEXカラー
    is_income: Mapped[bool] = mapped_column(Boolean, default=False)    # 収入カテゴリか
    is_system: Mapped[bool] = mapped_column(Boolean, default=True)     # システム固定か
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # リレーション
    transactions: Mapped[list["Transaction"]] = relationship(  # type: ignore[name-defined]
        "Transaction", back_populates="category_obj", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Category {self.name}>"


# システムデフォルトカテゴリ定義（DB初期化時に挿入）
DEFAULT_CATEGORIES = [
    {"name": "food_dining",     "name_ja": "飲食・外食",     "icon": "🍽️",  "color": "#FF6B6B", "is_income": False, "sort_order": 1},
    {"name": "grocery",         "name_ja": "食料品・スーパー", "icon": "🛒",  "color": "#FF8C42", "is_income": False, "sort_order": 2},
    {"name": "transportation",  "name_ja": "交通・移動",     "icon": "🚃",  "color": "#4ECDC4", "is_income": False, "sort_order": 3},
    {"name": "shopping",        "name_ja": "ショッピング",   "icon": "🛍️",  "color": "#A29BFE", "is_income": False, "sort_order": 4},
    {"name": "housing",         "name_ja": "家賃・住居",     "icon": "🏠",  "color": "#6C5CE7", "is_income": False, "sort_order": 5},
    {"name": "utilities",       "name_ja": "光熱費・公共料金", "icon": "💡",  "color": "#FDCB6E", "is_income": False, "sort_order": 6},
    {"name": "entertainment",   "name_ja": "エンタメ・趣味",  "icon": "🎮",  "color": "#E17055", "is_income": False, "sort_order": 7},
    {"name": "travel",          "name_ja": "旅行",           "icon": "✈️",  "color": "#00B894", "is_income": False, "sort_order": 8},
    {"name": "health",          "name_ja": "医療・健康",     "icon": "🏥",  "color": "#55EFC4", "is_income": False, "sort_order": 9},
    {"name": "education",       "name_ja": "教育・学習",     "icon": "📚",  "color": "#0984E3", "is_income": False, "sort_order": 10},
    {"name": "subscriptions",   "name_ja": "サブスクリプション", "icon": "📱", "color": "#74B9FF", "is_income": False, "sort_order": 11},
    {"name": "income",          "name_ja": "収入",           "icon": "💰",  "color": "#00CEC9", "is_income": True,  "sort_order": 12},
    {"name": "transfer",        "name_ja": "振替・移動",     "icon": "🔄",  "color": "#B2BEC3", "is_income": False, "sort_order": 13},
    {"name": "other",           "name_ja": "その他",         "icon": "📦",  "color": "#DFE6E9", "is_income": False, "sort_order": 99},
]
