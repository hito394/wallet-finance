from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.transaction import TransactionDirection, TransactionSource
from app.schemas.transaction import (
    TransactionFilter, TransactionListResponse, TransactionOut, TransactionUpdate,
)
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/api/transactions", tags=["transactions"])
CURRENT_USER_ID = settings.DEFAULT_USER_ID


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    month: Optional[str] = Query(None, description="YYYY-MM形式"),
    category: Optional[str] = None,
    direction: Optional[TransactionDirection] = None,
    is_ignored: Optional[bool] = None,
    search: Optional[str] = None,
    source_type: Optional[TransactionSource] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    """
    取引一覧を取得する。
    月・カテゴリ・方向（収支）・フリーワードでフィルタリング可能。
    """
    f = TransactionFilter(
        month=month,
        category=category,
        direction=direction,
        is_ignored=is_ignored,
        search=search,
        source_type=source_type,
        page=page,
        per_page=per_page,
    )
    service = TransactionService(db)
    return await service.list_transactions(CURRENT_USER_ID, f)


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: int, db: AsyncSession = Depends(get_db)
) -> TransactionOut:
    """取引詳細を取得する"""
    service = TransactionService(db)
    tx = await service.get_transaction(CURRENT_USER_ID, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="取引が見つかりません")
    return tx


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: int,
    update_data: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
) -> TransactionOut:
    """
    取引情報を更新する。
    カテゴリ・メモ・無視フラグ・レシート紐付けを変更可能。
    """
    service = TransactionService(db)
    tx = await service.update_transaction(CURRENT_USER_ID, transaction_id, update_data)
    if not tx:
        raise HTTPException(status_code=404, detail="取引が見つかりません")
    return tx


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """取引を削除する（通常はis_ignoredを使用することを推奨）"""
    service = TransactionService(db)
    deleted = await service.delete_transaction(CURRENT_USER_ID, transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="取引が見つかりません")


@router.get("/duplicates/list", response_model=list[list[TransactionOut]])
async def list_duplicates(db: AsyncSession = Depends(get_db)) -> list[list[TransactionOut]]:
    """重複候補の取引グループ一覧を返す"""
    service = TransactionService(db)
    return await service.find_duplicate_groups(CURRENT_USER_ID)
