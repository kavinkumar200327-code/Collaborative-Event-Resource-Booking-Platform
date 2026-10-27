from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.registration import (
    RegistrationCreate,
    RegistrationResponse,
    RegistrationListResponse,
)
from app.services.registration_service import RegistrationService

router = APIRouter(
    tags=["Registrations"],
)


@router.post(
    "/events/{event_id}/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_for_event(
    event_id: str,
    data: Optional[RegistrationCreate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RegistrationService(db)
    notes = data.notes if data else None
    return service.register(event_id=event_id, user_id=current_user.id, notes=notes)


@router.get(
    "/events/{event_id}/registrations",
    response_model=RegistrationListResponse,
)
def list_event_registrations(
    event_id: str,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RegistrationService(db)
    items, total = service.list_registrations(
        event_id=event_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    return RegistrationListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/registrations",
    response_model=RegistrationListResponse,
)
def list_all_registrations(
    event_id: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RegistrationService(db)
    # If participant, restrict to own registrations unless admin/staff
    effective_user_id = user_id
    if current_user.role == "participant":
        effective_user_id = current_user.id

    items, total = service.list_registrations(
        event_id=event_id,
        user_id=effective_user_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    return RegistrationListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/registrations/{registration_id}",
    response_model=RegistrationResponse,
)
def get_registration(
    registration_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RegistrationService(db)
    return service.get_registration(registration_id)


@router.post(
    "/registrations/{registration_id}/cancel",
    response_model=RegistrationResponse,
)
def cancel_registration(
    registration_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RegistrationService(db)
    is_admin = current_user.role in ["super_admin", "admin", "event_manager"]
    return service.cancel_registration(
        registration_id=registration_id,
        user_id=current_user.id,
        is_admin=is_admin,
    )


@router.patch(
    "/registrations/{registration_id}/approve",
    response_model=RegistrationResponse,
)
def approve_registration(
    registration_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RegistrationService(db)
    return service.approve_registration(registration_id)


@router.patch(
    "/registrations/{registration_id}/reject",
    response_model=RegistrationResponse,
)
def reject_registration(
    registration_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RegistrationService(db)
    return service.reject_registration(registration_id, reason=reason)
