"""
口座・カード管理ルーター

LinkedAccount (口座マスタ) の CRUD と口座別サマリーを提供する。
インポートファイルとの紐付けは parser_meta.account_id を使用する。
"""
import calendar
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.import_record import ImportRecord
from app.models.linked_account import LinkedAccount
from app.models.transaction import Transaction, TransactionDirection
from app.schemas.linked_account import (
    AccountSummary,
    LinkedAccountCreate,
    LinkedAccountOut,
    LinkedAccountUpdate,
)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])
CURRENT_USER_ID = settings.DEFAULT_USER_ID


# ─── 口座 CRUD ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[LinkedAccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(LinkedAccount)
        .where(LinkedAccount.user_id == CURRENT_USER_ID)
        .order_by(LinkedAccount.created_at)
    )
    return (await db.execute(stmt)).scalars().all()


@router.post("", response_model=LinkedAccountOut, status_code=201)
async def create_account(body: LinkedAccountCreate, db: AsyncSession = Depends(get_db)):
    account = LinkedAccount(user_id=CURRENT_USER_ID, **body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.patch("/{account_id}", response_model=LinkedAccountOut)
async def update_account(
    account_id: int,
    body: LinkedAccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_or_404(account_id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    account.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}")
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    account = await _get_account_or_404(account_id, db)
    await db.delete(account)
    await db.commit()
    return {"ok": True}


# ─── 口座別サマリー ────────────────────────────────────────────────────────────

@router.get("/{account_id}/summary", response_model=AccountSummary)
async def get_account_summary(
    account_id: int,
    month: Optional[str] = Query(None, description="YYYY-MM。省略時は今月"),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_or_404(account_id, db)

    target_month = month or datetime.now().strftime("%Y-%m")
    year, mon = map(int, target_month.split("-"))
    last_day = calendar.monthrange(year, mon)[1]
    start = date(year, mon, 1)
    end = date(year, mon, last_day)

    # この口座に紐付いた import_record IDs を取得
    import_ids = await _get_import_ids_for_account(account_id, db)

    if not import_ids:
        return AccountSummary(
            account=account,
            month_expense=Decimal(0),
            month_income=Decimal(0),
            month_net=Decimal(0),
            month_transaction_count=0,
            total_import_count=0,
            last_import_at=None,
        )

    # 月別収支集計
    stmt = select(
        Transaction.direction,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count"),
    ).where(
        Transaction.import_record_id.in_(import_ids),
        Transaction.transaction_date.between(start, end),
        Transaction.is_ignored == False,  # noqa: E712
    ).group_by(Transaction.direction)

    rows = (await db.execute(stmt)).all()
    expense = Decimal(0)
    income = Decimal(0)
    count = 0
    for r in rows:
        if r.direction == TransactionDirection.DEBIT:
            expense = r.total or Decimal(0)
        else:
            income = r.total or Decimal(0)
        count += r.count

    # インポート件数・最終インポート日
    import_stmt = select(
        func.count(ImportRecord.id).label("cnt"),
        func.max(ImportRecord.created_at).label("last_at"),
    ).where(ImportRecord.id.in_(import_ids))
    import_row = (await db.execute(import_stmt)).one()

    return AccountSummary(
        account=account,
        month_expense=expense,
        month_income=income,
        month_net=income - expense,
        month_transaction_count=count,
        total_import_count=import_row.cnt or 0,
        last_import_at=import_row.last_at,
    )


# ─── インポートと口座の紐付け ──────────────────────────────────────────────────

@router.post("/{account_id}/imports/{import_id}")
async def link_import(
    account_id: int,
    import_id: int,
    db: AsyncSession = Depends(get_db),
):
    """インポートレコードを口座に紐付ける（parser_meta.account_id を更新）"""
    await _get_account_or_404(account_id, db)

    import_rec = (
        await db.execute(
            select(ImportRecord).where(
                ImportRecord.id == import_id,
                ImportRecord.user_id == CURRENT_USER_ID,
            )
        )
    ).scalar_one_or_none()

    if not import_rec:
        raise HTTPException(status_code=404, detail="Import not found")

    meta = import_rec.parser_meta or {}
    meta["account_id"] = account_id
    import_rec.parser_meta = meta
    await db.commit()
    return {"ok": True, "account_id": account_id, "import_id": import_id}


@router.delete("/{account_id}/imports/{import_id}")
async def unlink_import(
    account_id: int,
    import_id: int,
    db: AsyncSession = Depends(get_db),
):
    """インポートレコードの口座紐付けを解除する"""
    import_rec = (
        await db.execute(
            select(ImportRecord).where(
                ImportRecord.id == import_id,
                ImportRecord.user_id == CURRENT_USER_ID,
            )
        )
    ).scalar_one_or_none()

    if not import_rec:
        raise HTTPException(status_code=404, detail="Import not found")

    meta = import_rec.parser_meta or {}
    meta.pop("account_id", None)
    import_rec.parser_meta = meta
    await db.commit()
    return {"ok": True}


@router.get("/{account_id}/imports")
async def list_account_imports(
    account_id: int,
    db: AsyncSession = Depends(get_db),
):
    """この口座に紐付いたインポート一覧を返す"""
    await _get_account_or_404(account_id, db)
    import_ids = await _get_import_ids_for_account(account_id, db)

    if not import_ids:
        return []

    stmt = (
        select(ImportRecord)
        .where(ImportRecord.id.in_(import_ids))
        .order_by(ImportRecord.created_at.desc())
    )
    records = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": r.id,
            "original_filename": r.original_filename,
            "import_type": r.import_type,
            "status": r.status,
            "success_rows": r.success_rows,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


# ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

async def _get_account_or_404(account_id: int, db: AsyncSession) -> LinkedAccount:
    account = (
        await db.execute(
            select(LinkedAccount).where(
                LinkedAccount.id == account_id,
                LinkedAccount.user_id == CURRENT_USER_ID,
            )
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def _get_import_ids_for_account(account_id: int, db: AsyncSession) -> list[int]:
    """parser_meta.account_id == account_id の ImportRecord ID 一覧を返す"""
    # PostgreSQL の JSON演算子で account_id を比較
    stmt = select(ImportRecord.id).where(
        ImportRecord.user_id == CURRENT_USER_ID,
        ImportRecord.parser_meta.op("->>")(cast("account_id", String)) == str(account_id),
    )
    result = await db.execute(stmt)
    return [row[0] for row in result.all()]
