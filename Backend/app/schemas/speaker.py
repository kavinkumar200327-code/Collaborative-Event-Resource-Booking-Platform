from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, EmailStr


class SpeakerBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    organization_name: Optional[str] = None
    photo_url: Optional[str] = None


class SpeakerCreate(SpeakerBase):
    organization_id: str


class SpeakerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    organization_name: Optional[str] = None
    photo_url: Optional[str] = None


class SpeakerResponse(SpeakerBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime


class SpeakerListResponse(BaseModel):
    items: list[SpeakerResponse]
    total: int
    page: int = 1
    page_size: int = 10
