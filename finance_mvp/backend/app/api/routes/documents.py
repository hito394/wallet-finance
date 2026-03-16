from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.session import get_db
from app.models.document import FinancialDocument
from app.models.import_job import ImportJob, ImportStatus
from app.schemas.document import DocumentTypeHintUpdate, FinancialDocumentRead, ReparseDocumentResponse
from app.services.ingestion.pipeline import process_import
from app.utils.user_context import resolve_actor_context

router = APIRouter()


def _run_reparse(import_id: str) -> None:
    with SessionLocal() as db:
        job = db.scalar(select(ImportJob).where(ImportJob.id == import_id))
        if not job:
            return
        process_import(db, job, job.storage_uri, force_reprocess=True)


@router.get("", response_model=list[FinancialDocumentRead])
def list_documents(
    import_id: str | None = None,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[FinancialDocumentRead]:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    query = (
        select(FinancialDocument)
        .where(FinancialDocument.entity_id == entity.id)
        .order_by(FinancialDocument.created_at.desc())
    )
    if import_id:
        import uuid as _uuid
        try:
            import_uuid = _uuid.UUID(import_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid import_id")
        query = query.where(FinancialDocument.import_id == import_uuid)
    return list(db.scalars(query).all())


@router.get("/{document_id}", response_model=FinancialDocumentRead)
def get_document(
    document_id: str,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> FinancialDocumentRead:
    import uuid as _uuid
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        doc_uuid = _uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document_id")
    doc = db.scalar(
        select(FinancialDocument).where(
            FinancialDocument.id == doc_uuid,
            FinancialDocument.entity_id == entity.id,
        )
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/{document_id}/reparse", response_model=ReparseDocumentResponse)
def reparse_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ReparseDocumentResponse:
    import uuid as _uuid

    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        doc_uuid = _uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document_id")

    doc = db.scalar(
        select(FinancialDocument).where(
            FinancialDocument.id == doc_uuid,
            FinancialDocument.entity_id == entity.id,
        )
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.import_id:
        raise HTTPException(status_code=400, detail="Document is not linked to an import job")

    job = db.scalar(
        select(ImportJob).where(
            ImportJob.id == doc.import_id,
            ImportJob.entity_id == entity.id,
        )
    )
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")

    job.status = ImportStatus.pending
    job.error_message = None
    job.processed_at = None
    doc.parsing_status = "pending"
    doc.parsing_failure_reason = None
    db.commit()

    background_tasks.add_task(_run_reparse, str(job.id))
    return ReparseDocumentResponse(import_id=job.id, status="queued")


@router.patch("/{document_id}/type-hint", response_model=FinancialDocumentRead)
def update_type_hint(
    document_id: str,
    payload: DocumentTypeHintUpdate,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> FinancialDocumentRead:
    import uuid as _uuid

    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        doc_uuid = _uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document_id")

    doc = db.scalar(
        select(FinancialDocument).where(
            FinancialDocument.id == doc_uuid,
            FinancialDocument.entity_id == entity.id,
        )
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.source_type_hint = payload.source_type_hint.value
    db.add(doc)

    if doc.import_id:
        job = db.scalar(
            select(ImportJob).where(
                ImportJob.id == doc.import_id,
                ImportJob.entity_id == entity.id,
            )
        )
        if job:
            job.source_type = payload.source_type_hint
            db.add(job)

    db.commit()
    db.refresh(doc)
    return doc

