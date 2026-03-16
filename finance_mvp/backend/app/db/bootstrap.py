from sqlalchemy import select, text

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.category import Category
from app.utils.user_context import (
    get_or_create_default_entity,
    get_or_create_default_user,
)

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
    # documents
    ("documents", "raw_text_preview", "VARCHAR(2000)"),
    ("documents", "likely_issuer", "VARCHAR(120)"),
    ("documents", "source_type_hint", "VARCHAR(80)"),
    ("documents", "parsing_status", "VARCHAR(40) DEFAULT 'pending'"),
    ("documents", "parsing_failure_reason", "VARCHAR(400)"),
    ("documents", "extracted_transaction_count", "INTEGER DEFAULT 0"),
    ("documents", "transactions_created_count", "INTEGER DEFAULT 0"),
    ("documents", "extracted_total_amount", "NUMERIC(12,2)"),
    ("documents", "match_confidence", "DOUBLE PRECISION"),
    ("documents", "match_reason", "VARCHAR(400)"),
    ("documents", "matched_by_amount", "BOOLEAN"),
    ("documents", "matched_by_merchant", "BOOLEAN"),
    ("documents", "matched_by_date", "BOOLEAN"),
    # imports
    ("imports", "file_hash", "VARCHAR(64)"),
    # transactions
    ("transactions", "document_id", "UUID"),
    ("transactions", "running_balance", "NUMERIC(12,2)"),
]


def _sqlite_column_exists(db, table: str, column: str) -> bool:
    existing = db.execute(text(f"PRAGMA table_info({table});")).fetchall()
    col_names = [row[1] for row in existing]
    return column in col_names


def _safe_add_columns(db) -> None:
    """
    Add new columns to existing tables.

    - PostgreSQL: uses ADD COLUMN IF NOT EXISTS
    - SQLite: checks PRAGMA table_info before ALTER TABLE
    - Fail-fast: collects failures and raises RuntimeError
    """
    db_url = str(engine.url)
    is_postgres = db_url.startswith("postgresql")
    is_sqlite = db_url.startswith("sqlite")

    failed: list[str] = []

    for table, column, col_def in _MIGRATE_COLUMNS:
        try:
            if is_postgres:
                db.execute(
                    text(
                        f"ALTER TABLE {table} "
                        f"ADD COLUMN IF NOT EXISTS {column} {col_def};"
                    )
                )
            elif is_sqlite:
                if not _sqlite_column_exists(db, table, column):
                    db.execute(
                        text(
                            f"ALTER TABLE {table} "
                            f"ADD COLUMN {column} {col_def};"
                        )
                    )
            else:
                failed.append(
                    f"{table}.{column}: unsupported database dialect for URL {db_url}"
                )
                continue

            db.commit()
        except Exception as e:  # noqa: BLE001
            db.rollback()
            failed.append(f"{table}.{column}: {e}")

    # Add FK separately for PostgreSQL if document_id exists but FK was missing
    if is_postgres:
        try:
            db.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = 'transactions_document_id_fkey'
                        ) THEN
                            ALTER TABLE transactions
                            ADD CONSTRAINT transactions_document_id_fkey
                            FOREIGN KEY (document_id) REFERENCES documents(id);
                        END IF;
                    END
                    $$;
                    """
                )
            )
            db.commit()
        except Exception as e:  # noqa: BLE001
            db.rollback()
            failed.append(f"transactions.document_id FK: {e}")

    if failed:
        raise RuntimeError(
            "Bootstrap column migration failed:\n" + "\n".join(failed)
        )


def bootstrap() -> None:
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        _safe_add_columns(db)

        user = get_or_create_default_user(db)
        entity = get_or_create_default_entity(db, user)

        for name, slug in DEFAULT_CATEGORIES:
            exists = db.scalar(
                select(Category).where(
                    Category.entity_id == entity.id,
                    Category.slug == slug,
                )
            )
            if not exists:
                db.add(Category(entity_id=entity.id, name=name, slug=slug))

        db.commit()


if __name__ == "__main__":
    bootstrap()
