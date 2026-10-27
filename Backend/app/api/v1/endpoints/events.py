
from typing import Optional

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

from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventStatusUpdate,
    EventResponse,
    EventListResponse,
)

from app.services.event_service import EventService


router = APIRouter(
    prefix="/organizations/{organization_id}/events",
    tags=["Events"],
)


def get_active_event_membership(
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


def require_event_management_permission(
    organization_id: str,
    current_user: User,
    db: Session,
) -> OrganizationMember:

    membership = get_active_event_membership(
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
            detail="Only admins and event managers can manage events",
        )

    return membership


def require_event_admin_permission(
    organization_id: str,
    current_user: User,
    db: Session,
) -> OrganizationMember:

    membership = get_active_event_membership(
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


@router.post(
    "/",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    organization_id: str,
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_event_management_permission(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    # Prevent creating an event in another organization.
    if event_data.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization ID in request body does not match URL",
        )

    service = EventService(db)

    event = service.create_event(
        event_data=event_data,
        created_by=current_user.id,
    )

    return event


@router.get(
    "/",
    response_model=EventListResponse,
)
def list_events(
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
    status_filter: str | None = Query(
        default=None,
        description="Filter by draft, published, cancelled or completed",
    ),
    search: str | None = Query(
        default=None,
        max_length=200,
        description="Search events by title or description",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    get_active_event_membership(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = EventService(db)

    events, total = service.list_events(
        organization_id=organization_id,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
        search=search,
    )

    return EventListResponse(
        items=events,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{event_id}",
    response_model=EventResponse,
)
def get_event(
    organization_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    get_active_event_membership(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = EventService(db)

    event = service.get_event(
        event_id=event_id,
        organization_id=organization_id,
    )

    return event


@router.patch(
    "/{event_id}",
    response_model=EventResponse,
)
def update_event(
    organization_id: str,
    event_id: str,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_event_management_permission(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = EventService(db)

    updated_event = service.update_event(
        event_id=event_id,
        organization_id=organization_id,
        event_data=event_data,
    )

    return updated_event


@router.patch(
    "/{event_id}/status",
    response_model=EventResponse,
)
def update_event_status(
    organization_id: str,
    event_id: str,
    status_data: EventStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_event_management_permission(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = EventService(db)

    updated_event = service.update_event_status(
        event_id=event_id,
        organization_id=organization_id,
        status_data=status_data,
    )

    return updated_event


@router.patch(
    "/{event_id}/publish",
    response_model=EventResponse,
)
def publish_event(
    organization_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_event_management_permission(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = EventService(db)

    status_data = EventStatusUpdate(
        status="published",
    )

    updated_event = service.update_event_status(
        event_id=event_id,
        organization_id=organization_id,
        status_data=status_data,
    )

    return updated_event


@router.patch(
    "/{event_id}/cancel",
    response_model=EventResponse,
)
def cancel_event(
    organization_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_event_management_permission(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = EventService(db)

    status_data = EventStatusUpdate(
        status="cancelled",
    )

    updated_event = service.update_event_status(
        event_id=event_id,
        organization_id=organization_id,
        status_data=status_data,
    )

    return updated_event


@router.patch(
    "/{event_id}/complete",
    response_model=EventResponse,
)
def complete_event(
    organization_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_event_management_permission(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = EventService(db)

    status_data = EventStatusUpdate(
        status="completed",
    )

    updated_event = service.update_event_status(
        event_id=event_id,
        organization_id=organization_id,
        status_data=status_data,
    )

    return updated_event


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_event(
    organization_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    require_event_admin_permission(
        organization_id=organization_id,
        current_user=current_user,
        db=db,
    )

    service = EventService(db)

    service.delete_event(
        event_id=event_id,
        organization_id=organization_id,
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )


top_router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


@top_router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
@top_router.post(
    "/",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_top_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EventService(db)
    return service.create_event(event_data=event_data, created_by=current_user.id)


@top_router.get(
    "",
    response_model=EventListResponse,
)
@top_router.get(
    "/",
    response_model=EventListResponse,
    include_in_schema=False,
)
def list_top_events(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    organization_id: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EventService(db)
    if organization_id:
        items, total = service.list_events(
            organization_id=organization_id,
            page=page,
            page_size=page_size,
            status_filter=status,
            search=search,
        )
    else:
        items, total = service.list_all_events(
            page=page,
            page_size=page_size,
            status_filter=status,
            search=search,
        )
    return EventListResponse(items=items, total=total, page=page, page_size=page_size)


@top_router.get(
    "/{event_id}",
    response_model=EventResponse,
)
def get_top_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.event import Event
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@top_router.patch(
    "/{event_id}",
    response_model=EventResponse,
)
def update_top_event(
    event_id: str,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.event import Event
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    service = EventService(db)
    return service.update_event(event_id=event_id, organization_id=event.organization_id, event_data=event_data)


@top_router.patch(
    "/{event_id}/publish",
    response_model=EventResponse,
)
def publish_top_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.event import Event
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    service = EventService(db)
    return service.update_event_status(
        event_id=event_id,
        organization_id=event.organization_id,
        status_data=EventStatusUpdate(status="published"),
    )


@top_router.patch(
    "/{event_id}/cancel",
    response_model=EventResponse,
)
def cancel_top_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.event import Event
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    service = EventService(db)
    return service.update_event_status(
        event_id=event_id,
        organization_id=event.organization_id,
        status_data=EventStatusUpdate(status="cancelled"),
    )


@top_router.patch(
    "/{event_id}/archive",
    response_model=EventResponse,
)
def archive_top_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.event import Event
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    service = EventService(db)
    return service.update_event_status(
        event_id=event_id,
        organization_id=event.organization_id,
        status_data=EventStatusUpdate(status="archived"),
    )


@top_router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_top_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.event import Event
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    service = EventService(db)
    service.delete_event(event_id=event_id, organization_id=event.organization_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

