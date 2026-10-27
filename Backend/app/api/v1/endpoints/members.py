
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db

from app.api.deps import get_current_user

from app.models.user import User
from app.models.organization_member import OrganizationMember

from app.schemas.member import (
    MemberCreate,
    MemberUpdate,
    MemberResponse,
    MemberListResponse,
)

from app.services.member_service import MemberService
from app.services.organization_service import OrganizationService


router = APIRouter(
    prefix="/organizations/{organization_id}/members",
    tags=["Organization Members"],
)


def get_active_membership(
    organization_id: str,
    current_user: User,
    db: Session,
) -> OrganizationMember:

    statement = (
        select(OrganizationMember)
        .where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.is_active.is_(True),
        )
    )

    membership = db.scalar(statement)

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not an active member of this organization",
        )

    return membership

def require_organization_admin(
    organization_id: str,
    current_user: User,
    db: Session,
) -> OrganizationMember:

    membership = get_active_membership(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    if membership.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can perform this action",
        )

    return membership

def require_member_management_permission(
    organization_id: str,
    current_user: User,
    db: Session,
) -> OrganizationMember:

    membership = get_active_membership(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    allowed_roles = {
        "admin",
        "event_manager",
    }

    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage organization members",
        )

    return membership

@router.post(
    "/",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    organization_id: str,
    member_data: MemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_organization_admin(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    target_id = member_data.user_id or getattr(member_data, "email", None)
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="User ID or email is required",
        )

    if isinstance(target_id, int) or (isinstance(target_id, str) and target_id.isdigit()):
        user = db.get(User, int(target_id))
    else:
        user = db.query(User).filter(User.email == str(target_id).lower()).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    member_data.user_id = user.id

    service = MemberService(db)

    member = service.add_member(
        organization_id=organization_id,
        member_data=member_data,
    )

    return member

@router.get(
    "/",
    response_model=MemberListResponse,
)
def list_members(
    organization_id: str,
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    active_only: bool = Query(
        default=True,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    get_active_membership(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = MemberService(db)

    members, total = service.list_members(
        organization_id=organization_id,
        page=page,
        page_size=page_size,
        active_only=active_only,
    )

    return MemberListResponse(
        items=members,
        total=total,
        page=page,
        page_size=page_size,
    )

@router.get(
    "/roles/{role}",
    response_model=list[MemberResponse],
)
def list_members_by_role(
    organization_id: str,
    role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    get_active_membership(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    allowed_roles = {
        "admin",
        "event_manager",
        "staff",
    }

    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization role",
        )

    service = MemberService(db)

    members = service.list_members_by_role(
        organization_id=organization_id,
        role=role,
    )

    return members

@router.get(
    "/{member_id}",
    response_model=MemberResponse,
)
def get_member(
    organization_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    get_active_membership(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = MemberService(db)

    member = service.get_member(
        organization_id=organization_id,
        member_id=member_id,
    )

    return member

@router.patch(
    "/{member_id}",
    response_model=MemberResponse,
)
def update_member(
    organization_id: str,
    member_id: str,
    member_data: MemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_organization_admin(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = MemberService(db)

    updated_member = service.update_member(
        organization_id=organization_id,
        member_id=member_id,
        member_data=member_data,
    )

    return updated_member


@router.patch(
    "/{member_id}/activate",
    response_model=MemberResponse,
)
def activate_member(
    organization_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_organization_admin(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = MemberService(db)

    member_data = MemberUpdate(
        is_active=True,
    )

    updated_member = service.update_member(
        organization_id=organization_id,
        member_id=member_id,
        member_data=member_data,
    )

    return updated_member

@router.patch(
    "/{member_id}/deactivate",
    response_model=MemberResponse,
)
def deactivate_member(
    organization_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_organization_admin(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = MemberService(db)

    member_data = MemberUpdate(
        is_active=False,
    )

    updated_member = service.update_member(
        organization_id=organization_id,
        member_id=member_id,
        member_data=member_data,
    )

    return updated_member


@router.delete(
    "/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_member(
    organization_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_organization_admin(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = MemberService(db)

    service.remove_member(
        organization_id=organization_id,
        member_id=member_id,
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )
