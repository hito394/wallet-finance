from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entity import Entity
from app.models.entity_member import EntityMember, EntityRole
from app.schemas.entity import EntityCreate, EntityMemberRead, EntityRead
from app.utils.user_context import resolve_actor_context

router = APIRouter()


@router.get("", response_model=list[EntityRead])
def list_entities(
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[EntityRead]:
    user, _ = resolve_actor_context(db, x_user_id, x_entity_id)
    memberships = db.scalars(select(EntityMember).where(EntityMember.user_id == user.id)).all()
    entity_ids = [m.entity_id for m in memberships]
    return list(db.scalars(select(Entity).where(Entity.id.in_(entity_ids))).all())


@router.post("", response_model=EntityRead)
def create_entity(
    payload: EntityCreate,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> EntityRead:
    user, _ = resolve_actor_context(db, x_user_id, x_entity_id)
    entity = Entity(
        owner_user_id=user.id,
        name=payload.name,
        entity_type=payload.entity_type,
        base_currency=payload.base_currency,
    )
    db.add(entity)
    db.flush()
    db.add(EntityMember(entity_id=entity.id, user_id=user.id, role=EntityRole.owner))
    db.commit()
    db.refresh(entity)
    return entity


@router.get("/{entity_id}/members", response_model=list[EntityMemberRead])
def list_entity_members(entity_id: str, db: Session = Depends(get_db)) -> list[EntityMemberRead]:
    return list(db.scalars(select(EntityMember).where(EntityMember.entity_id == entity_id)).all())
