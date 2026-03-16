import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.import_record import ImportType
from app.schemas.import_record import ImportListResponse, ImportRecordOut, ImportResultResponse
from app.services.import_service import ImportService

router = APIRouter(prefix="/api/imports", tags=["imports"])

# MVP: 固定ユーザー（将来は JWT から取得）
CURRENT_USER_ID = settings.DEFAULT_USER_ID


def _validate_file_type(filename: str, allowed: list[str]) -> str:
    """ファイル拡張子チェック"""
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"対応ファイル形式: {', '.join(allowed)}。アップロードされたファイル: .{ext}",
        )
    return ext


async def _compute_file_hash(file: UploadFile) -> tuple[bytes, str]:
    """ファイル内容を読み込み、SHA256ハッシュを計算して返す"""
    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()
    return content, file_hash


@router.post("/statement", response_model=ImportResultResponse, status_code=status.HTTP_201_CREATED)
async def upload_bank_statement(
    file: Annotated[UploadFile, File(description="銀行明細ファイル（CSV or PDF）")],
    db: AsyncSession = Depends(get_db),
) -> ImportResultResponse:
    """
    銀行明細ファイルをアップロードして取引データをインポートする。
    - CSV: 自動的にカラムを検出しパース
    - PDF: pdfplumberでテキスト抽出後にパース
    重複取引は自動的にスキップされる。
    """
    ext = _validate_file_type(file.filename or "unknown", ["csv", "pdf"])
    content, file_hash = await _compute_file_hash(file)

    import_type = ImportType.CSV_STATEMENT if ext == "csv" else ImportType.PDF_STATEMENT
    service = ImportService(db)

    # 同一ファイルの重複インポートチェック
    existing = await service.find_by_hash(CURRENT_USER_ID, file_hash)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"このファイルは既にインポート済みです（import_id={existing.id}）",
        )

    # ファイルを保存
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    stored_name = f"{timestamp}_{file_hash[:8]}_{file.filename}"
    save_path = settings.STATEMENT_DIR / stored_name
    save_path.write_bytes(content)

    result = await service.import_statement(
        user_id=CURRENT_USER_ID,
        file_path=save_path,
        original_filename=file.filename or stored_name,
        stored_filename=stored_name,
        file_hash=file_hash,
        file_size=len(content),
        import_type=import_type,
    )
    return result


@router.post("/receipt", response_model=ImportResultResponse, status_code=status.HTTP_201_CREATED)
async def upload_receipt(
    file: Annotated[UploadFile, File(description="レシート画像またはPDF")],
    db: AsyncSession = Depends(get_db),
) -> ImportResultResponse:
    """
    レシートをアップロードしてOCRで内容を抽出する。
    - 対応形式: jpg, jpeg, png, webp, pdf
    - 抽出後、既存取引との自動マッチングを試みる
    """
    ext = _validate_file_type(
        file.filename or "unknown", ["jpg", "jpeg", "png", "webp", "pdf"]
    )
    content, file_hash = await _compute_file_hash(file)

    service = ImportService(db)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    stored_name = f"{timestamp}_{file_hash[:8]}_{file.filename}"
    save_path = settings.RECEIPT_DIR / stored_name
    save_path.write_bytes(content)

    result = await service.import_receipt(
        user_id=CURRENT_USER_ID,
        file_path=save_path,
        original_filename=file.filename or stored_name,
        stored_filename=stored_name,
        file_hash=file_hash,
        file_size=len(content),
        file_type=ext,
    )
    return result


@router.get("", response_model=ImportListResponse)
async def list_imports(
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
) -> ImportListResponse:
    """インポート履歴一覧を取得する"""
    service = ImportService(db)
    items, total = await service.list_imports(CURRENT_USER_ID, page, per_page)
    return ImportListResponse(items=items, total=total)


@router.get("/{import_id}", response_model=ImportRecordOut)
async def get_import(import_id: int, db: AsyncSession = Depends(get_db)) -> ImportRecordOut:
    """インポート詳細を取得する"""
    service = ImportService(db)
    record = await service.get_import(CURRENT_USER_ID, import_id)
    if not record:
        raise HTTPException(status_code=404, detail="インポートレコードが見つかりません")
    return record
