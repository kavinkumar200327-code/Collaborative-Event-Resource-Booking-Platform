from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

RegistrationStatus = Literal[
    "pending",
    "confirmed",
    "waitlisted",
    "cancelled",
    "rejected",
    "attended",
    "noshow",
]


class RegistrationCreate(BaseModel):
    notes: Optional[str] = None


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    user_id: int
    status: RegistrationStatus
    notes: Optional[str] = None
    registered_at: datetime
    updated_at: datetime


class RegistrationListResponse(BaseModel):
    items: list[RegistrationResponse]
    total: int
    page: int = 1
    page_size: int = 10


class WaitlistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    user_id: int
    priority: int
    status: str
    created_at: datetime
    promoted_at: Optional[datetime] = None
