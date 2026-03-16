from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.document import FinancialDocument
from app.schemas.document import FinancialDocumentRead
from app.utils.user_context import resolve_actor_context

router = APIRouter()


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

