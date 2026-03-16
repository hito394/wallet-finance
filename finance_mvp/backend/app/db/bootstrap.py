from sqlalchemy import select, text

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

# Columns that may have been added after initial schema creation.
# Each entry: (table, column, column_definition_sql)
_MIGRATE_COLUMNS = [
    ("documents", "raw_text_preview",     "VARCHAR(2000)"),
    ("documents", "likely_issuer",        "VARCHAR(120)"),
    ("documents", "source_type_hint",     "VARCHAR(80)"),
    ("documents", "parsing_status",       "VARCHAR(40) DEFAULT 'pending'"),
    ("documents", "parsing_failure_reason", "VARCHAR(400)"),
]


def _safe_add_columns(db) -> None:
    """Add new columns to existing tables without failing if they already exist."""
    db_url = str(engine.url)
    is_postgres = db_url.startswith("postgresql")
    is_sqlite = db_url.startswith("sqlite")

    for table, column, col_def in _MIGRATE_COLUMNS:
        try:
            if is_postgres:
                db.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_def};"
                ))
            elif is_sqlite:
                # SQLite doesn't support IF NOT EXISTS for ADD COLUMN
                existing = db.execute(text(f"PRAGMA table_info({table});")).fetchall()
                col_names = [row[1] for row in existing]
                if column not in col_names:
                    db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def};"))
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()


def bootstrap() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        _safe_add_columns(db)
        user = get_or_create_default_user(db)
        entity = get_or_create_default_entity(db, user)
        for name, slug in DEFAULT_CATEGORIES:
            exists = db.scalar(select(Category).where(Category.entity_id == entity.id, Category.slug == slug))
            if not exists:
                db.add(Category(entity_id=entity.id, name=name, slug=slug))
        db.commit()


if __name__ == "__main__":
    bootstrap()
