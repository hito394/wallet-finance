import csv
import io

from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.transaction import Transaction
from app.utils.user_context import resolve_actor_context

router = APIRouter()


@router.get("/accounting.csv")
def export_accounting_csv(
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    rows = db.scalars(
        select(Transaction)
        .where(Transaction.entity_id == entity.id)
        .order_by(Transaction.transaction_date.desc())
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "transaction_date",
        "merchant",
        "description",
        "amount",
        "currency",
        "direction",
        "category_id",
        "source",
        "notes",
    ])
    for row in rows:
        writer.writerow([
            row.transaction_date,
            row.merchant_normalized,
            row.description,
            row.amount,
            row.currency,
            row.direction.value,
            row.category_id,
            row.source.value,
            row.notes or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=accounting_export.csv"},
    )
