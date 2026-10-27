
from enum import Enum
from typing import Iterable

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember

class OrganizationRole(str, Enum):

    ADMIN = "admin"
    EVENT_MANAGER = "event_manager"
    STAFF = "staff"

class Permission(str, Enum):

    ORGANIZATION_VIEW = "organization:view"
    ORGANIZATION_UPDATE = "organization:update"
    ORGANIZATION_DELETE = "organization:delete"

    MEMBER_VIEW = "member:view"
    MEMBER_CREATE = "member:create"
    MEMBER_UPDATE = "member:update"
    MEMBER_DELETE = "member:delete"

    EVENT_VIEW = "event:view"
    EVENT_CREATE = "event:create"
    EVENT_UPDATE = "event:update"
    EVENT_DELETE = "event:delete"
    EVENT_PUBLISH = "event:publish"
    EVENT_CANCEL = "event:cancel"
    EVENT_COMPLETE = "event:complete"

    RESOURCE_VIEW = "resource:view"
    RESOURCE_CREATE = "resource:create"
    RESOURCE_UPDATE = "resource:update"
    RESOURCE_DELETE = "resource:delete"

    BOOKING_VIEW = "booking:view"
    BOOKING_CREATE = "booking:create"
    BOOKING_UPDATE = "booking:update"
    BOOKING_CANCEL = "booking:cancel"
    BOOKING_APPROVE = "booking:approve"

    DASHBOARD_VIEW = "dashboard:view"

    AUDIT_LOG_VIEW = "audit_log:view"

ROLE_PERMISSIONS: dict[
    OrganizationRole,
    set[Permission],
] = {

    OrganizationRole.ADMIN: set(Permission),

    OrganizationRole.EVENT_MANAGER: {

        Permission.ORGANIZATION_VIEW,

        Permission.MEMBER_VIEW,

        Permission.EVENT_VIEW,
        Permission.EVENT_CREATE,
        Permission.EVENT_UPDATE,
        Permission.EVENT_PUBLISH,
        Permission.EVENT_CANCEL,
        Permission.EVENT_COMPLETE,

        Permission.RESOURCE_VIEW,
        Permission.RESOURCE_CREATE,
        Permission.RESOURCE_UPDATE,

        Permission.BOOKING_VIEW,
        Permission.BOOKING_CREATE,
        Permission.BOOKING_UPDATE,
        Permission.BOOKING_CANCEL,
        Permission.BOOKING_APPROVE,

        Permission.DASHBOARD_VIEW,
    },

    OrganizationRole.STAFF: {

        Permission.ORGANIZATION_VIEW,

        Permission.MEMBER_VIEW,

        Permission.EVENT_VIEW,

        Permission.RESOURCE_VIEW,

        Permission.BOOKING_VIEW,
        Permission.BOOKING_CREATE,
        Permission.BOOKING_CANCEL,

        Permission.DASHBOARD_VIEW,
    },
}

def normalize_role(
    role: str | OrganizationRole,
) -> OrganizationRole:

    try:
        return OrganizationRole(role)

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid organization role",
        )

def has_permission(
    role: str | OrganizationRole,
    permission: Permission,
) -> bool:

    try:
        normalized_role = OrganizationRole(role)

    except ValueError:
        return False

    allowed_permissions = ROLE_PERMISSIONS.get(
        normalized_role,
        set(),
    )

    return permission in allowed_permissions

def has_all_permissions(
    role: str | OrganizationRole,
    permissions: Iterable[Permission],
) -> bool:

    return all(
        has_permission(role, permission)
        for permission in permissions
    )


def has_any_permission(
    role: str | OrganizationRole,
    permissions: Iterable[Permission],
) -> bool:

    return any(
        has_permission(role, permission)
        for permission in permissions
    )

def get_organization_membership(
    db: Session,
    organization_id: str,
    user_id: str,
) -> OrganizationMember | None:

    statement = (
        select(OrganizationMember)
        .where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active.is_(True),
        )
    )

    return db.scalar(statement)

def require_active_organization(
    db: Session,
    organization_id: str,
) -> Organization:

    organization = db.get(
        Organization,
        organization_id,
    )

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not organization.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization is inactive",
        )

    return organization

def require_organization_member(
    db: Session,
    organization_id: str,
    current_user: User,
) -> OrganizationMember:

    membership = get_organization_membership(
        db=db,
        organization_id=organization_id,
        user_id=current_user.id,
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not an active member of this organization",
        )

    require_active_organization(
        db=db,
        organization_id=organization_id,
    )

    return membership

def require_organization_role(
    db: Session,
    organization_id: str,
    current_user: User,
    allowed_roles: Iterable[
        str | OrganizationRole
    ],
) -> OrganizationMember:

    membership = require_organization_member(
        db=db,
        organization_id=organization_id,
        current_user=current_user,
    )

    normalized_role = normalize_role(
        membership.role
    )

    normalized_allowed_roles = {
        normalize_role(role)
        for role in allowed_roles
    }

    if normalized_role not in normalized_allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have the required organization role",
        )

    return membership

def require_permission(
    db: Session,
    organization_id: str,
    current_user: User,
    permission: Permission,
) -> OrganizationMember:

    membership = require_organization_member(
        db=db,
        organization_id=organization_id,
        current_user=current_user,
    )

    if not has_permission(
        membership.role,
        permission,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {permission.value}",
        )

    return membership

def require_all_permissions(
    db: Session,
    organization_id: str,
    current_user: User,
    permissions: Iterable[Permission],
) -> OrganizationMember:

    membership = require_organization_member(
        db=db,
        organization_id=organization_id,
        current_user=current_user,
    )

    if not has_all_permissions(
        membership.role,
        permissions,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have all required permissions",
        )

    return membership

def require_any_permission(
    db: Session,
    organization_id: str,
    current_user: User,
    permissions: Iterable[Permission],
) -> OrganizationMember:

    membership = require_organization_member(
        db=db,
        organization_id=organization_id,
        current_user=current_user,
    )

    if not has_any_permission(
        membership.role,
        permissions,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have any of the required permissions",
        )

    return membership

def permission_required(
    permission: Permission,
):

    def dependency(
        organization_id: str,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> OrganizationMember:

        return require_permission(
            db=db,
            organization_id=organization_id,
            current_user=current_user,
            permission=permission,
        )

    return dependency

def role_required(
    *allowed_roles: OrganizationRole,
):

    def dependency(
        organization_id: str,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> OrganizationMember:

        return require_organization_role(
            db=db,
            organization_id=organization_id,
            current_user=current_user,
            allowed_roles=allowed_roles,
        )

    return dependency

require_admin = role_required(
    OrganizationRole.ADMIN,
)

require_event_manager = role_required(
    OrganizationRole.ADMIN,
    OrganizationRole.EVENT_MANAGER,
)

require_staff = role_required(
    OrganizationRole.ADMIN,
    OrganizationRole.EVENT_MANAGER,
    OrganizationRole.STAFF,
)
