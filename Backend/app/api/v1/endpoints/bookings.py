from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingUpdate,
    BookingStatusUpdate,
    BookingResponse,
    BookingListResponse,
)
from app.services.booking_service import BookingService

router = APIRouter(
    prefix="/bookings",
    tags=["Resource Bookings"],
)


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_booking(
    booking_data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BookingService(db)
    return service.create_booking(booking_data, requested_by=current_user.id)


@router.get(
    "",
    response_model=BookingListResponse,
)
@router.get(
    "/",
    response_model=BookingListResponse,
    include_in_schema=False,
)
def list_bookings(
    resource_id: Optional[str] = Query(None),
    event_id: Optional[str] = Query(None),
    requested_by: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BookingService(db)
    items, total = service.list_bookings(
        resource_id=resource_id,
        event_id=event_id,
        requested_by=requested_by,
        status_filter=status,
        start_time=start_time,
        end_time=end_time,
        page=page,
        page_size=page_size,
    )
    return BookingListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{booking_id}",
    response_model=BookingResponse,
)
def get_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BookingService(db)
    return service.get_booking(booking_id)


@router.patch(
    "/{booking_id}",
    response_model=BookingResponse,
)
def update_booking(
    booking_id: str,
    data: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BookingService(db)
    is_admin = current_user.role in ["super_admin", "admin"]
    return service.update_booking(booking_id, data, user_id=current_user.id, is_admin=is_admin)


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingResponse,
)
def cancel_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BookingService(db)
    is_admin = current_user.role in ["super_admin", "admin"]
    return service.cancel_booking(booking_id, user_id=current_user.id, is_admin=is_admin)


@router.patch(
    "/{booking_id}/approve",
    response_model=BookingResponse,
)
def approve_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BookingService(db)
    return service.approve_booking(booking_id)


@router.patch(
    "/{booking_id}/reject",
    response_model=BookingResponse,
)
def reject_booking(
    booking_id: str,
    status_data: Optional[BookingStatusUpdate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BookingService(db)
    reason = status_data.rejection_reason if status_data else None
    return service.reject_booking(booking_id, reason=reason)
