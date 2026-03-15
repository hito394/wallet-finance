import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entity import Entity, EntityType
from app.models.entity_member import EntityMember, EntityRole
from app.models.user import User


def get_or_create_default_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == "demo@wallet.local"))
    if user:
        return user

    user = User(email="demo@wallet.local", full_name="Demo User", timezone="UTC", default_currency="USD")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_default_entity(db: Session, user: User) -> Entity:
    entity = db.scalar(
        select(Entity).where(
            Entity.owner_user_id == user.id,
            Entity.entity_type == EntityType.personal,
        )
    )
    if entity:
        return entity

    entity = Entity(
        owner_user_id=user.id,
        name="Personal",
        entity_type=EntityType.personal,
        base_currency=user.default_currency,
    )
    db.add(entity)
    db.flush()
    db.add(EntityMember(entity_id=entity.id, user_id=user.id, role=EntityRole.owner))
    db.commit()
    db.refresh(entity)
    return entity


def parse_user_id(raw_user_id: str | None) -> uuid.UUID | None:
    if not raw_user_id:
        return None
    try:
        return uuid.UUID(raw_user_id)
    except ValueError:
        return None


def parse_entity_id(raw_entity_id: str | None) -> uuid.UUID | None:
    if not raw_entity_id:
        return None
    try:
        return uuid.UUID(raw_entity_id)
    except ValueError:
        return None


def resolve_actor_context(db: Session, x_user_id: str | None, x_entity_id: str | None) -> tuple[User, Entity]:
    parsed_user_id = parse_user_id(x_user_id)
    user = db.scalar(select(User).where(User.id == parsed_user_id)) if parsed_user_id else None
    if not user:
        user = get_or_create_default_user(db)

    parsed_entity_id = parse_entity_id(x_entity_id)
    entity = db.scalar(select(Entity).where(Entity.id == parsed_entity_id)) if parsed_entity_id else None
    if not entity:
        entity = get_or_create_default_entity(db, user)

    membership = db.scalar(
        select(EntityMember).where(EntityMember.entity_id == entity.id, EntityMember.user_id == user.id)
    )
    if not membership:
        db.add(EntityMember(entity_id=entity.id, user_id=user.id, role=EntityRole.employee))
        db.commit()

    return user, entity
