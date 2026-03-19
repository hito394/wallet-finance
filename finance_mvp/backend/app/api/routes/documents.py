from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.session import get_db
from app.models.document import FinancialDocument
from app.models.import_job import ImportJob, ImportStatus
from app.models.receipt import Receipt
from app.models.review_queue import ReviewQueueItem
from app.models.transaction import Transaction
from app.schemas.document import (
    BulkDeleteDocumentsRequest,
    BulkDeleteDocumentsResponse,
    DocumentTypeHintUpdate,
    FinancialDocumentRead,
    ReparseDocumentResponse,
)
from app.services.ingestion.pipeline import process_import
from app.utils.user_context import resolve_actor_context

router = APIRouter()


def _cleanup_upload_files(paths: set[str]) -> None:
    root = settings.file_storage_root.resolve()
    for raw_path in paths:
        if not raw_path:
            continue
        try:
            candidate = Path(raw_path)
            if not candidate.is_absolute():
                candidate = root / candidate
            resolved = candidate.resolve()
            if root == resolved or root in resolved.parents:
                resolved.unlink(missing_ok=True)
        except Exception:
            # Cleanup is best-effort and should not break API flow.
            continue


def _delete_document_and_related(db: Session, *, entity_id, doc: FinancialDocument) -> set[str]:
    import_id = doc.import_id
    paths_to_cleanup: set[str] = {doc.storage_uri}

    tx_conditions = [Transaction.document_id == doc.id]
    if import_id:
        tx_conditions.append(Transaction.import_id == import_id)

    transaction_ids_subquery = select(Transaction.id).where(
        Transaction.entity_id == entity_id,
        or_(*tx_conditions),
    )

    db.execute(
        delete(ReviewQueueItem).where(
            ReviewQueueItem.entity_id == entity_id,
            or_(
                ReviewQueueItem.document_id == doc.id,
                ReviewQueueItem.transaction_id.in_(transaction_ids_subquery),
            ),
        )
    )

    db.execute(
        delete(Transaction).where(
            Transaction.entity_id == entity_id,
            or_(*tx_conditions),
        )
    )

    if import_id:
        db.execute(
            delete(Receipt).where(
                Receipt.entity_id == entity_id,
                Receipt.import_id == import_id,
            )
        )

    db.execute(
        delete(FinancialDocument).where(
            FinancialDocument.id == doc.id,
            FinancialDocument.entity_id == entity_id,
        )
    )

    if import_id:
        job = db.scalar(
            select(ImportJob).where(
                ImportJob.id == import_id,
                ImportJob.entity_id == entity_id,
            )
        )
        if job:
            paths_to_cleanup.add(job.storage_uri)
            db.execute(
                delete(ImportJob).where(
                    ImportJob.id == job.id,
                    ImportJob.entity_id == entity_id,
                )
            )

    return paths_to_cleanup


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


@router.post("/bulk-delete", response_model=BulkDeleteDocumentsResponse)
def bulk_delete_documents(
    payload: BulkDeleteDocumentsRequest,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> BulkDeleteDocumentsResponse:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)

    docs = list(
        db.scalars(
            select(FinancialDocument).where(
                FinancialDocument.entity_id == entity.id,
                FinancialDocument.id.in_(payload.document_ids),
            )
        ).all()
    )

    if not docs:
        return BulkDeleteDocumentsResponse(deleted_count=0)

    paths_to_cleanup: set[str] = set()
    for doc in docs:
        paths_to_cleanup.update(_delete_document_and_related(db, entity_id=entity.id, doc=doc))

    db.commit()
    _cleanup_upload_files(paths_to_cleanup)
    return BulkDeleteDocumentsResponse(deleted_count=len(docs))


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def delete_document(
    document_id: str,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Response:
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

    paths_to_cleanup = _delete_document_and_related(db, entity_id=entity.id, doc=doc)

    db.commit()
    _cleanup_upload_files(paths_to_cleanup)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

