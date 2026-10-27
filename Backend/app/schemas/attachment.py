from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    event_id: Optional[str] = None
    session_id: Optional[str] = None
    speaker_id: Optional[str] = None
    registration_id: Optional[str] = None
    file_name: str
    original_name: str
    mime_type: str
    file_size: int
    storage_path: str
    uploaded_by: int
    created_at: datetime


class AttachmentListResponse(BaseModel):
    items: list[AttachmentResponse]
    total: int
