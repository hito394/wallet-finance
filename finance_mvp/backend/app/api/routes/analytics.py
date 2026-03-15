from datetime import datetime

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.analytics import InsightItem, MonthlyOverview
from app.services.analytics.insight_engine import generate_insights, monthly_overview
from app.utils.user_context import resolve_actor_context

router = APIRouter()


@router.get("/monthly-overview", response_model=MonthlyOverview)
def get_monthly_overview(
    year: int = Query(default=datetime.utcnow().year),
    month: int = Query(default=datetime.utcnow().month),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> MonthlyOverview:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    return monthly_overview(db, entity.id, year, month)


@router.get("/insights", response_model=list[InsightItem])
def get_insights(
    year: int = Query(default=datetime.utcnow().year),
    month: int = Query(default=datetime.utcnow().month),
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[InsightItem]:
    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    overview = monthly_overview(db, entity.id, year, month)
    return generate_insights(overview)
