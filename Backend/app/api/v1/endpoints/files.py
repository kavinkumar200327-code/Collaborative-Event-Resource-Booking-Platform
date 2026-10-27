import os
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.attachment import (
    AttachmentResponse,
    AttachmentListResponse,
)
from app.services.file_service import FileService

router = APIRouter(
    prefix="/files",
    tags=["File Management"],
)


@router.post(
    "/upload",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    file: UploadFile = File(...),
    organization_id: str = Form(...),
    event_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    speaker_id: Optional[str] = Form(None),
    registration_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FileService(db)
    return await service.save_upload(
        file=file,
        organization_id=organization_id,
        uploaded_by=current_user.id,
        event_id=event_id,
        session_id=session_id,
        speaker_id=speaker_id,
        registration_id=registration_id,
    )


@router.get(
    "/{file_id}",
    response_model=AttachmentResponse,
)
def get_file_info(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FileService(db)
    return service.get_attachment(file_id)


@router.get(
    "/{file_id}/download",
)
def download_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FileService(db)
    att = service.get_attachment(file_id)
    if not os.path.exists(att.storage_path):
        raise HTTPException(status_code=404, detail="File on disk was not found")

    return FileResponse(
        path=att.storage_path,
        filename=att.original_name,
        media_type=att.mime_type,
    )


@router.get(
    "",
    response_model=AttachmentListResponse,
)
@router.get(
    "/",
    response_model=AttachmentListResponse,
    include_in_schema=False,
)
def list_files(
    organization_id: Optional[str] = Query(None),
    event_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FileService(db)
    items, total = service.list_attachments(
        organization_id=organization_id,
        event_id=event_id,
        page=page,
        page_size=page_size,
    )
    return AttachmentListResponse(items=items, total=total)
