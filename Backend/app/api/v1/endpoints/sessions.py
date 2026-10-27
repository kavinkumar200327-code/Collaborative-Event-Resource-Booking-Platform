from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.session import (
    SessionCreate,
    SessionUpdate,
    SessionResponse,
    SessionListResponse,
)
from app.services.session_service import SessionService

router = APIRouter(
    prefix="/sessions",
    tags=["Event Sessions"],
)


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SessionService(db)
    return service.create_session(session_data)


@router.get(
    "",
    response_model=SessionListResponse,
)
@router.get(
    "/",
    response_model=SessionListResponse,
    include_in_schema=False,
)
def list_sessions(
    event_id: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SessionService(db)
    items, total = service.list_sessions(event_id=event_id, page=page, page_size=page_size)
    return SessionListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{session_id}",
    response_model=SessionResponse,
)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SessionService(db)
    return service.get_session(session_id)


@router.patch(
    "/{session_id}",
    response_model=SessionResponse,
)
def update_session(
    session_id: str,
    data: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SessionService(db)
    return service.update_session(session_id, data)


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SessionService(db)
    service.delete_session(session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
