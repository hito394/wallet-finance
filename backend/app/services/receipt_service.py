"""
レシートサービス層。
"""
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.receipt import Receipt, ReceiptStatus
from app.schemas.receipt import ReceiptOut, ReceiptUpdate
from app.services.matching_service import MatchingService


class ReceiptService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.matching = MatchingService()

    async def list_receipts(
        self, user_id: int, status: Optional[str], page: int, per_page: int
    ) -> tuple[list[ReceiptOut], int]:
        conditions = [Receipt.user_id == user_id]
        if status:
            conditions.append(Receipt.status == status)

        from sqlalchemy import and_
        count_stmt = select(func.count()).select_from(Receipt).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            select(Receipt)
            .where(and_(*conditions))
            .order_by(Receipt.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [ReceiptOut.model_validate(r) for r in rows], total

    async def get_receipt(self, user_id: int, receipt_id: int) -> Optional[ReceiptOut]:
        stmt = select(Receipt).where(
            Receipt.id == receipt_id, Receipt.user_id == user_id
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        return ReceiptOut.model_validate(row) if row else None

    async def update_receipt(
        self, user_id: int, receipt_id: int, data: ReceiptUpdate
    ) -> Optional[ReceiptOut]:
        stmt = select(Receipt).where(
            Receipt.id == receipt_id, Receipt.user_id == user_id
        )
        receipt = (await self.db.execute(stmt)).scalar_one_or_none()
        if not receipt:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(receipt, field, value)

        if data.transaction_id is not None:
            receipt.status = ReceiptStatus.MATCHED
            receipt.is_manually_matched = True

        await self.db.flush()
        await self.db.refresh(receipt)
        return ReceiptOut.model_validate(receipt)

    async def rematch(self, user_id: int, receipt_id: int) -> Optional[ReceiptOut]:
        """マッチングを再実行する"""
        stmt = select(Receipt).where(
            Receipt.id == receipt_id, Receipt.user_id == user_id
        )
        receipt = (await self.db.execute(stmt)).scalar_one_or_none()
        if not receipt:
            return None

        from app.services.import_service import ImportService
        service = ImportService(self.db)
        matched = await service._try_auto_match_receipt(receipt)
        receipt.status = ReceiptStatus.MATCHED if matched else ReceiptStatus.UNMATCHED
        await self.db.flush()
        await self.db.refresh(receipt)
        return ReceiptOut.model_validate(receipt)

    async def delete_receipt(self, user_id: int, receipt_id: int) -> bool:
        stmt = select(Receipt).where(
            Receipt.id == receipt_id, Receipt.user_id == user_id
        )
        receipt = (await self.db.execute(stmt)).scalar_one_or_none()
        if not receipt:
            return False
        await self.db.delete(receipt)
        return True
