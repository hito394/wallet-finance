from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.receipt import ReceiptListResponse, ReceiptOut, ReceiptUpdate
from app.services.receipt_service import ReceiptService

router = APIRouter(prefix="/api/receipts", tags=["receipts"])
CURRENT_USER_ID = settings.DEFAULT_USER_ID


@router.get("", response_model=ReceiptListResponse)
async def list_receipts(
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ReceiptListResponse:
    """レシート一覧を取得する。statusでフィルタリング可能（pending/parsed/matched等）"""
    service = ReceiptService(db)
    items, total = await service.list_receipts(CURRENT_USER_ID, status, page, per_page)
    return ReceiptListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{receipt_id}", response_model=ReceiptOut)
async def get_receipt(receipt_id: int, db: AsyncSession = Depends(get_db)) -> ReceiptOut:
    """レシート詳細とOCR結果を取得する"""
    service = ReceiptService(db)
    receipt = await service.get_receipt(CURRENT_USER_ID, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="レシートが見つかりません")
    return receipt


@router.patch("/{receipt_id}", response_model=ReceiptOut)
async def update_receipt(
    receipt_id: int,
    update_data: ReceiptUpdate,
    db: AsyncSession = Depends(get_db),
) -> ReceiptOut:
    """
    レシート情報を更新する。
    OCR結果の修正や取引との手動紐付けに使用。
    """
    service = ReceiptService(db)
    receipt = await service.update_receipt(CURRENT_USER_ID, receipt_id, update_data)
    if not receipt:
        raise HTTPException(status_code=404, detail="レシートが見つかりません")
    return receipt


@router.post("/{receipt_id}/rematch", response_model=ReceiptOut)
async def rematch_receipt(
    receipt_id: int, db: AsyncSession = Depends(get_db)
) -> ReceiptOut:
    """レシートと取引の自動マッチングを再実行する"""
    service = ReceiptService(db)
    receipt = await service.rematch(CURRENT_USER_ID, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="レシートが見つかりません")
    return receipt


@router.delete("/{receipt_id}", status_code=204)
async def delete_receipt(receipt_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """レシートを削除する"""
    service = ReceiptService(db)
    deleted = await service.delete_receipt(CURRENT_USER_ID, receipt_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="レシートが見つかりません")
