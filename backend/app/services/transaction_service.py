"""
取引サービス層。
取引に関するビジネスロジックを集約。ルーターは薄く保つ。
"""
import math
from typing import Optional

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction, TransactionDirection
from app.schemas.transaction import (
    TransactionCreate, TransactionFilter, TransactionListResponse,
    TransactionOut, TransactionUpdate,
)


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_transactions(
        self, user_id: int, f: TransactionFilter
    ) -> TransactionListResponse:
        """フィルタリング・ページングを適用して取引一覧を返す"""
        conditions = [Transaction.user_id == user_id]

        if f.month:
            year, month = map(int, f.month.split("-"))
            from datetime import date
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            conditions.append(
                Transaction.transaction_date.between(
                    date(year, month, 1), date(year, month, last_day)
                )
            )

        if f.category:
            conditions.append(Transaction.category == f.category)

        if f.direction:
            conditions.append(Transaction.direction == f.direction)

        if f.is_ignored is not None:
            conditions.append(Transaction.is_ignored == f.is_ignored)

        if f.source_type:
            conditions.append(Transaction.source_type == f.source_type)

        if f.search:
            q = f"%{f.search}%"
            conditions.append(
                or_(
                    Transaction.merchant_raw.ilike(q),
                    Transaction.merchant_normalized.ilike(q),
                    Transaction.description.ilike(q),
                    Transaction.notes.ilike(q),
                )
            )

        # 件数取得
        count_stmt = select(func.count()).select_from(Transaction).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar_one()

        # データ取得
        offset = (f.page - 1) * f.per_page
        stmt = (
            select(Transaction)
            .where(and_(*conditions))
            .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
            .offset(offset)
            .limit(f.per_page)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        total_pages = math.ceil(total / f.per_page) if total else 1

        return TransactionListResponse(
            items=[TransactionOut.model_validate(r) for r in rows],
            total=total,
            page=f.page,
            per_page=f.per_page,
            total_pages=total_pages,
        )

    async def get_transaction(
        self, user_id: int, transaction_id: int
    ) -> Optional[TransactionOut]:
        stmt = select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user_id
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        return TransactionOut.model_validate(row) if row else None

    async def update_transaction(
        self, user_id: int, transaction_id: int, data: TransactionUpdate
    ) -> Optional[TransactionOut]:
        stmt = select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user_id
        )
        tx = (await self.db.execute(stmt)).scalar_one_or_none()
        if not tx:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(tx, field, value)

        await self.db.flush()
        await self.db.refresh(tx)
        return TransactionOut.model_validate(tx)

    async def delete_transaction(self, user_id: int, transaction_id: int) -> bool:
        stmt = select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user_id
        )
        tx = (await self.db.execute(stmt)).scalar_one_or_none()
        if not tx:
            return False
        await self.db.delete(tx)
        return True

    async def find_duplicate_groups(
        self, user_id: int
    ) -> list[list[TransactionOut]]:
        """重複候補グループを返す: ハッシュ完全一致 + ファジー検出（同金額・方向・±3日）"""
        # ── 1. ハッシュ完全一致 ──
        subq = (
            select(Transaction.dedup_hash)
            .where(
                Transaction.user_id == user_id,
                Transaction.dedup_hash.isnot(None),
            )
            .group_by(Transaction.dedup_hash)
            .having(func.count(Transaction.id) > 1)
        )
        dup_hashes = (await self.db.execute(subq)).scalars().all()

        groups: list[list[TransactionOut]] = []
        exact_ids: set[int] = set()

        for dh in dup_hashes:
            stmt = select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.dedup_hash == dh,
            ).order_by(Transaction.created_at)
            rows = (await self.db.execute(stmt)).scalars().all()
            groups.append([TransactionOut.model_validate(r) for r in rows])
            for r in rows:
                exact_ids.add(r.id)

        # ── 2. ファジー検出: 同金額・同方向・±3日・異なるハッシュ ──
        all_stmt = (
            select(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.is_ignored == False,  # noqa: E712
            )
            .order_by(Transaction.amount, Transaction.direction, Transaction.transaction_date)
        )
        all_txs = (await self.db.execute(all_stmt)).scalars().all()

        seen_pairs: set[frozenset] = set()
        for i, tx1 in enumerate(all_txs):
            if tx1.id in exact_ids:
                continue
            for j in range(i + 1, len(all_txs)):
                tx2 = all_txs[j]
                if tx2.amount != tx1.amount or tx2.direction != tx1.direction:
                    break
                date_diff = (tx2.transaction_date - tx1.transaction_date).days
                if date_diff > 3:
                    break
                if tx2.id in exact_ids:
                    continue
                pair = frozenset([tx1.id, tx2.id])
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    groups.append([
                        TransactionOut.model_validate(tx1),
                        TransactionOut.model_validate(tx2),
                    ])

        return groups

    async def create_transaction(self, data: TransactionCreate) -> Transaction:
        """トランザクションを作成してDBに保存する（ImportService経由で使用）"""
        tx = Transaction(**data.model_dump())
        self.db.add(tx)
        await self.db.flush()
        await self.db.refresh(tx)
        return tx
