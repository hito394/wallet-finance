import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
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


def _persist_upload_and_hash(file: UploadFile, destination: Path) -> str:
    digest = hashlib.sha256()
    with destination.open("wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            buffer.write(chunk)
    return digest.hexdigest()


def _run_import_job(import_id: str) -> None:
    with SessionLocal() as db:
        job = db.scalar(select(ImportJob).where(ImportJob.id == import_id))
        if not job:
            return
        process_import(db, job, job.storage_uri)


@router.post("/upload", response_model=ImportJobRead, status_code=status.HTTP_201_CREATED)
def upload_import(
    source_type: ImportSourceType,
    background_tasks: BackgroundTasks,
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
    file_hash = _persist_upload_and_hash(file, destination)

    # Idempotency guard: same entity + source_type + content hash within 10 min
    # reuses the existing import job to avoid duplicate document rows.
    duplicate_window = datetime.utcnow() - timedelta(minutes=10)
    existing = db.scalar(
        select(ImportJob)
        .where(
            ImportJob.entity_id == entity.id,
            ImportJob.source_type == source_type,
            ImportJob.file_hash == file_hash,
            ImportJob.created_at >= duplicate_window,
        )
        .order_by(ImportJob.created_at.desc())
    )
    if existing and existing.status in {ImportStatus.pending, ImportStatus.processing, ImportStatus.completed}:
        return existing

    job = ImportJob(
        user_id=user.id,
        entity_id=entity.id,
        source_type=source_type,
        status=ImportStatus.pending,
        file_name=safe_name,
        file_hash=file_hash,
        storage_uri=str(destination),
        metadata_json={},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_import_job, str(job.id))

    return job


@router.get("/{import_id}", response_model=ImportJobRead)
def get_import(
    import_id: str,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ImportJobRead:
    import uuid as _uuid

    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        import_uuid = _uuid.UUID(import_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid import_id")

    job = db.scalar(
        select(ImportJob).where(
            ImportJob.id == import_uuid,
            ImportJob.entity_id == entity.id,
        )
    )
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job
