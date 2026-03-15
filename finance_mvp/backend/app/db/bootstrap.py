from sqlalchemy import select

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.category import Category
from app.utils.user_context import get_or_create_default_entity, get_or_create_default_user

DEFAULT_CATEGORIES = [
    ("Food", "food"),
    ("Groceries", "groceries"),
    ("Transportation", "transportation"),
    ("Shopping", "shopping"),
    ("Rent", "rent"),
    ("Utilities", "utilities"),
    ("Travel", "travel"),
    ("Entertainment", "entertainment"),
    ("Health", "health"),
    ("Subscriptions", "subscriptions"),
    ("Income", "income"),
    ("Transfers", "transfers"),
]


def bootstrap() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        user = get_or_create_default_user(db)
        entity = get_or_create_default_entity(db, user)
        for name, slug in DEFAULT_CATEGORIES:
            exists = db.scalar(select(Category).where(Category.entity_id == entity.id, Category.slug == slug))
            if not exists:
                db.add(Category(entity_id=entity.id, name=name, slug=slug))
        db.commit()


if __name__ == "__main__":
    bootstrap()
