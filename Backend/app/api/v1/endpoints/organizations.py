
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.organization_member import OrganizationMember

from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListResponse,
)

from app.services.organization_service import OrganizationService

from app.api.deps import get_current_user


router = APIRouter(
    prefix="/organizations",
    tags=["Organizations"],
)


def require_organization_admin(
    organization_id: str,
    current_user: User,
    db: Session,
) -> OrganizationMember:

    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.is_active.is_(True),
        )
        .first()
    )

    if not membership or membership.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can perform this action",
        )

    return membership


@router.post(
    "/",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    organization_data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    service = OrganizationService(db)

    organization = service.create_organization(
        organization_data=organization_data,
    )

    # Add the creator as the organization admin.
    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=current_user.id,
        role="admin",
        is_active=True,
    )

    try:
        db.add(membership)
        db.commit()
        db.refresh(membership)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Organization created, but admin membership could not be assigned",
        )

    return organization


@router.get(
    "/",
    response_model=OrganizationListResponse,
)
def list_organizations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    service = OrganizationService(db)

    # Find organizations the current user belongs to.
    memberships = (
        db.query(OrganizationMember.organization_id)
        .filter(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.is_active.is_(True),
        )
        .all()
    )

    organization_ids = [
        membership.organization_id
        for membership in memberships
    ]

    if not organization_ids:
        return OrganizationListResponse(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
        )

    from app.models.organization import Organization

    query = (
        db.query(Organization)
        .filter(
            Organization.id.in_(organization_ids),
            Organization.is_active.is_(True),
        )
    )

    total = query.count()

    organizations = (
        query.order_by(Organization.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return OrganizationListResponse(
        items=organizations,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{organization_id}",
    response_model=OrganizationResponse,
)
def get_organization(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if current_user.role not in ("admin", "super_admin"):
        membership = (
            db.query(OrganizationMember)
            .filter(
                OrganizationMember.organization_id == organization_id,
                OrganizationMember.user_id == current_user.id,
                OrganizationMember.is_active.is_(True),
            )
            .first()
        )

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found",
            )

    service = OrganizationService(db)

    return service.get_organization(
        organization_id=organization_id,
    )


@router.patch(
    "/{organization_id}",
    response_model=OrganizationResponse,
)
def update_organization(
    organization_id: str,
    organization_data: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_organization_admin(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = OrganizationService(db)

    return service.update_organization(
        organization_id=organization_id,
        organization_data=organization_data,
    )


@router.delete(
    "/{organization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_organization(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_organization_admin(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = OrganizationService(db)

    service.delete_organization(
        organization_id=organization_id,
    )

    return None