from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.speaker import (
    SpeakerCreate,
    SpeakerUpdate,
    SpeakerResponse,
    SpeakerListResponse,
)
from app.services.speaker_service import SpeakerService

router = APIRouter(
    prefix="/speakers",
    tags=["Speakers"],
)


@router.post(
    "",
    response_model=SpeakerResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/",
    response_model=SpeakerResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_speaker(
    speaker_data: SpeakerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SpeakerService(db)
    return service.create_speaker(speaker_data)


@router.get(
    "",
    response_model=SpeakerListResponse,
)
@router.get(
    "/",
    response_model=SpeakerListResponse,
    include_in_schema=False,
)
def list_speakers(
    organization_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SpeakerService(db)
    items, total = service.list_speakers(
        organization_id=organization_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    return SpeakerListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{speaker_id}",
    response_model=SpeakerResponse,
)
def get_speaker(
    speaker_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SpeakerService(db)
    return service.get_speaker(speaker_id)


@router.patch(
    "/{speaker_id}",
    response_model=SpeakerResponse,
)
def update_speaker(
    speaker_id: str,
    data: SpeakerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SpeakerService(db)
    return service.update_speaker(speaker_id, data)


@router.delete(
    "/{speaker_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_speaker(
    speaker_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SpeakerService(db)
    service.delete_speaker(speaker_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
