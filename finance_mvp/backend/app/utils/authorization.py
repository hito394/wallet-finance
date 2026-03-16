from app.models.entity_member import EntityRole

ROLE_PRIORITY = {
    EntityRole.employee: 1,
    EntityRole.accountant: 2,
    EntityRole.manager: 3,
    EntityRole.admin: 4,
    EntityRole.owner: 5,
}


def role_allows(current: EntityRole, required: EntityRole) -> bool:
    return ROLE_PRIORITY[current] >= ROLE_PRIORITY[required]
