from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.document import FinancialDocument
from app.schemas.document import FinancialDocumentRead
from app.utils.user_context import resolve_actor_context

router = APIRouter()


@router.get("", response_model=list[FinancialDocumentRead])
def list_documents(
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
    return list(db.scalars(query).all())
