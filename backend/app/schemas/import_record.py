from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.import_record import ImportType, ImportStatus


class ImportRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    original_filename: str
    import_type: ImportType
    status: ImportStatus
    total_rows: int
    success_rows: int
    skipped_rows: int
    error_rows: int
    error_message: Optional[str] = None
    parser_meta: Optional[dict] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class ImportListResponse(BaseModel):
    items: list[ImportRecordOut]
    total: int


class ImportResultResponse(BaseModel):
    """インポート処理完了後のレスポンス"""
    import_record: ImportRecordOut
    message: str
    transactions_created: int
    transactions_skipped: int
    errors: list[str] = []
