from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SessionBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    speaker_id: Optional[str] = None
    room_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    capacity: int = Field(default=50, gt=0)

    @model_validator(mode="after")
    def validate_session_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("Session end_time must be after start_time")
        return self


class SessionCreate(SessionBase):
    event_id: str


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    speaker_id: Optional[str] = None
    room_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    capacity: Optional[int] = Field(default=None, gt=0)


class SessionResponse(SessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    created_at: datetime
    updated_at: datetime


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    total: int
    page: int = 1
    page_size: int = 10
