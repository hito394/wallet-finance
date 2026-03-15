import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.import_job import ImportJob, ImportSourceType, ImportStatus
from app.schemas.import_job import ImportJobRead
from app.services.ingestion.pipeline import process_import
from app.utils.user_context import resolve_actor_context

router = APIRouter()


def _upload_size(file: UploadFile) -> int:
    if file.size is not None:
        return file.size

    # Fallback for servers that don't provide UploadFile.size.
    position = file.file.tell()
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(position)
    return size


@router.post("/upload", response_model=ImportJobRead, status_code=status.HTTP_201_CREATED)
def upload_import(
    source_type: ImportSourceType,
    file: UploadFile = File(...),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ImportJobRead:
    user, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    upload_size = _upload_size(file)
    max_upload_bytes = settings.max_upload_mb * 1024 * 1024
    if upload_size > max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.max_upload_mb}MB limit",
        )

    settings.file_storage_root.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename or "upload.bin").name
    destination = settings.file_storage_root / f"{uuid4()}_{safe_name}"
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    job = ImportJob(
        user_id=user.id,
        entity_id=entity.id,
        source_type=source_type,
        status=ImportStatus.pending,
        file_name=safe_name,
        storage_uri=str(destination),
        metadata_json={},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    process_import(db, job, str(destination))
    db.refresh(job)
    return job


@router.get("/{import_id}", response_model=ImportJobRead)
def get_import(import_id: str, db: Session = Depends(get_db)) -> ImportJobRead:
    job = db.scalar(select(ImportJob).where(ImportJob.id == import_id))
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job
