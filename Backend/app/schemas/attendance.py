from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict

AttendanceStatus = Literal["registered", "attended", "noshow"]


class AttendanceUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str] = None


class AttendanceMark(BaseModel):
    user_id: int
    status: AttendanceStatus = "attended"


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    registration_id: str
    user_id: int
    status: AttendanceStatus
    check_in_time: Optional[datetime] = None
    marked_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    user: Optional[AttendanceUserResponse] = None


class AttendanceListResponse(BaseModel):
    items: list[AttendanceResponse]
    total: int
    page: int = 1
    page_size: int = 50
