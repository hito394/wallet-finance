"""
インポートオーケストレーターサービス。
ファイルアップロード → パーサー選択 → 取引保存 → カテゴリ分類の
一連の流れをここで制御する。
"""
import math
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.import_record import ImportRecord, ImportRow, ImportStatus, ImportType
from app.models.receipt import Receipt, ReceiptStatus
from app.models.transaction import Transaction, TransactionSource
from app.parsers.base import ParsedTransaction
from app.parsers.csv_parser import CSVStatementParser
from app.parsers.pdf_statement_parser import PDFStatementParser
from app.parsers.receipt_ocr_parser import ReceiptOCRParser
from app.schemas.import_record import ImportRecordOut, ImportListResponse, ImportResultResponse
from app.services.categorization_service import CategorizationService
from app.services.matching_service import MatchingService
from app.utils.duplicate_detector import compute_dedup_hash
from app.utils.merchant_normalizer import normalize_merchant


class ImportService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.categorization = CategorizationService()
        self.matching = MatchingService()

    # -------------------------------------------------------------------------
    # 重複チェック
    # -------------------------------------------------------------------------

    async def find_by_hash(self, user_id: int, file_hash: str) -> Optional[ImportRecord]:
        stmt = select(ImportRecord).where(
            ImportRecord.user_id == user_id,
            ImportRecord.file_hash == file_hash,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    # -------------------------------------------------------------------------
    # 銀行明細インポート
    # -------------------------------------------------------------------------

    async def import_statement(
        self,
        user_id: int,
        file_path: Path,
        original_filename: str,
        stored_filename: str,
        file_hash: str,
        file_size: int,
        import_type: ImportType,
    ) -> ImportResultResponse:
        """銀行明細（CSV/PDF）をインポートして取引を保存する"""
        # インポートレコードを作成（処理中ステータス）
        record = ImportRecord(
            user_id=user_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=str(file_path),
            file_size_bytes=file_size,
            file_hash=file_hash,
            import_type=import_type,
            status=ImportStatus.PROCESSING,
        )
        self.db.add(record)
        await self.db.flush()

        errors: list[str] = []
        created_count = 0
        skipped_count = 0

        try:
            # パーサーを選択して実行
            parser = CSVStatementParser() if import_type == ImportType.CSV_STATEMENT else PDFStatementParser()
            parse_result = parser.parse(file_path)

            record.parser_meta = parse_result.meta
            record.total_rows = parse_result.success_count + parse_result.skipped_rows + parse_result.error_count

            # 取引を1件ずつ保存
            for parsed_tx in parse_result.transactions:
                row_result = await self._save_parsed_transaction(
                    user_id=user_id,
                    import_record_id=record.id,
                    parsed=parsed_tx,
                    source_type=(
                        TransactionSource.CSV_STATEMENT
                        if import_type == ImportType.CSV_STATEMENT
                        else TransactionSource.PDF_STATEMENT
                    ),
                )
                if row_result == "created":
                    created_count += 1
                elif row_result == "skipped":
                    skipped_count += 1

            errors.extend(parse_result.errors)

            record.success_rows = created_count
            record.skipped_rows = skipped_count + parse_result.skipped_rows
            record.error_rows = len(errors)
            record.status = ImportStatus.COMPLETED if not errors else ImportStatus.PARTIAL
            record.completed_at = datetime.now()

        except Exception as e:
            record.status = ImportStatus.FAILED
            record.error_message = str(e)
            record.completed_at = datetime.now()
            errors.append(f"致命的エラー: {e}")

        await self.db.flush()

        return ImportResultResponse(
            import_record=ImportRecordOut.model_validate(record),
            message=f"インポート完了: {created_count}件作成, {skipped_count}件スキップ",
            transactions_created=created_count,
            transactions_skipped=skipped_count,
            errors=errors,
        )

    # -------------------------------------------------------------------------
    # レシートインポート
    # -------------------------------------------------------------------------

    async def import_receipt(
        self,
        user_id: int,
        file_path: Path,
        original_filename: str,
        stored_filename: str,
        file_hash: str,
        file_size: int,
        file_type: str,
    ) -> ImportResultResponse:
        """レシートをOCRしてDBに保存し、取引との自動マッチングを試みる"""
        is_pdf = file_type == "pdf"
        import_type = ImportType.RECEIPT_PDF if is_pdf else ImportType.RECEIPT_IMAGE

        record = ImportRecord(
            user_id=user_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=str(file_path),
            file_size_bytes=file_size,
            file_hash=file_hash,
            import_type=import_type,
            status=ImportStatus.PROCESSING,
        )
        self.db.add(record)
        await self.db.flush()

        errors: list[str] = []

        try:
            # OCR実行
            ocr_parser = ReceiptOCRParser()
            parsed = ocr_parser.parse_pdf(file_path) if is_pdf else ocr_parser.parse_image(file_path)

            receipt = Receipt(
                user_id=user_id,
                original_filename=original_filename,
                stored_filename=stored_filename,
                file_path=str(file_path),
                file_type=file_type,
                status=ReceiptStatus.PARSED,
                merchant_name=parsed.merchant_name,
                purchase_date=parsed.purchase_date,
                total_amount=parsed.total_amount,
                tax_amount=parsed.tax_amount,
                subtotal_amount=parsed.subtotal_amount,
                ocr_raw_text=parsed.raw_text,
                ocr_confidence=parsed.confidence,
                line_items=parsed.line_items or [],
            )
            self.db.add(receipt)
            await self.db.flush()

            # 取引との自動マッチング
            matched = await self._try_auto_match_receipt(receipt)
            if matched:
                receipt.status = ReceiptStatus.MATCHED
            else:
                receipt.status = ReceiptStatus.UNMATCHED

            record.success_rows = 1
            record.total_rows = 1
            record.status = ImportStatus.COMPLETED
            record.completed_at = datetime.now()
            errors.extend(parsed.parse_warnings)

        except Exception as e:
            record.status = ImportStatus.FAILED
            record.error_message = str(e)
            record.completed_at = datetime.now()
            errors.append(str(e))

        await self.db.flush()

        return ImportResultResponse(
            import_record=ImportRecordOut.model_validate(record),
            message="レシートのインポートが完了しました",
            transactions_created=0,
            transactions_skipped=0,
            errors=errors,
        )

    # -------------------------------------------------------------------------
    # 取引保存ヘルパー
    # -------------------------------------------------------------------------

    async def _save_parsed_transaction(
        self,
        user_id: int,
        import_record_id: int,
        parsed: ParsedTransaction,
        source_type: TransactionSource,
    ) -> str:
        """ParsedTransactionをDBに保存する。重複はスキップする。"""
        merchant_normalized = normalize_merchant(parsed.merchant_raw)
        dedup_hash = compute_dedup_hash(
            parsed.transaction_date,
            parsed.amount,
            merchant_normalized,
            parsed.direction,
        )

        # 重複チェック
        existing = await self.db.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.dedup_hash == dedup_hash,
            )
        )
        if existing.scalar_one_or_none():
            return "skipped"

        # カテゴリ自動分類
        category = self.categorization.classify(
            merchant_raw=parsed.merchant_raw,
            merchant_normalized=merchant_normalized,
            description=parsed.description,
            direction=parsed.direction,
        )

        tx = Transaction(
            user_id=user_id,
            import_record_id=import_record_id,
            transaction_date=parsed.transaction_date,
            merchant_raw=parsed.merchant_raw,
            merchant_normalized=merchant_normalized,
            description=parsed.description,
            amount=parsed.amount,
            balance=parsed.balance,
            direction=parsed.direction,
            category=category,
            source_type=source_type,
            dedup_hash=dedup_hash,
        )
        self.db.add(tx)
        await self.db.flush()
        return "created"

    async def _try_auto_match_receipt(self, receipt: Receipt) -> bool:
        """レシートに対応する取引を自動マッチングする。成功時にTrueを返す。"""
        if not receipt.total_amount:
            return False

        from datetime import timedelta

        # 日付前後3日・同ユーザーの取引を候補として取得
        date_from = (
            receipt.purchase_date - timedelta(days=3)
            if receipt.purchase_date else None
        )
        date_to = (
            receipt.purchase_date + timedelta(days=3)
            if receipt.purchase_date else None
        )

        stmt = select(Transaction).where(
            Transaction.user_id == receipt.user_id,
            Transaction.direction == "debit",
            Transaction.receipt == None,  # noqa: E711
        )
        if date_from and date_to:
            stmt = stmt.where(Transaction.transaction_date.between(date_from, date_to))

        candidates_raw = (await self.db.execute(stmt)).scalars().all()
        candidates = [
            {
                "id": tx.id,
                "amount": tx.amount,
                "date": tx.transaction_date,
                "merchant": tx.merchant_normalized or tx.merchant_raw,
                "tx_obj": tx,
            }
            for tx in candidates_raw
        ]

        best = self.matching.find_best_match(
            receipt_amount=receipt.total_amount,
            receipt_date=receipt.purchase_date,
            receipt_merchant=receipt.merchant_name,
            candidates=candidates,
        )

        if best:
            tx_obj: Transaction = best["tx_obj"]
            tx_obj.receipt = receipt
            receipt.transaction_id = tx_obj.id
            await self.db.flush()
            return True

        return False

    # -------------------------------------------------------------------------
    # 履歴取得
    # -------------------------------------------------------------------------

    async def list_imports(
        self, user_id: int, page: int, per_page: int
    ) -> tuple[list[ImportRecordOut], int]:
        count_stmt = select(func.count()).select_from(ImportRecord).where(
            ImportRecord.user_id == user_id
        )
        from sqlalchemy import func
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            select(ImportRecord)
            .where(ImportRecord.user_id == user_id)
            .order_by(ImportRecord.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return [ImportRecordOut.model_validate(r) for r in rows], total

    async def get_import(
        self, user_id: int, import_id: int
    ) -> Optional[ImportRecordOut]:
        stmt = select(ImportRecord).where(
            ImportRecord.id == import_id,
            ImportRecord.user_id == user_id,
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        return ImportRecordOut.model_validate(row) if row else None
