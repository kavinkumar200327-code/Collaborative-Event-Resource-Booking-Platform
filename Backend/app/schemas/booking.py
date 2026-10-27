from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

BookingStatus = Literal["requested", "approved", "rejected", "cancelled", "completed"]


class BookingBase(BaseModel):
    resource_id: str
    event_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("Booking end_time must be after start_time")
        return self


class BookingCreate(BookingBase):
    pass


class BookingUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    purpose: Optional[str] = None
    status: Optional[BookingStatus] = None
    rejection_reason: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    rejection_reason: Optional[str] = None


class BookingResourceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    type: str


class BookingRequesterSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: Optional[str] = None


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resource_id: str
    event_id: Optional[str] = None
    requested_by: int
    start_time: datetime
    end_time: datetime
    status: BookingStatus
    purpose: Optional[str] = None
    rejection_reason: Optional[str] = None
    resource: Optional[BookingResourceSummary] = None
    requester: Optional[BookingRequesterSummary] = None
    created_at: datetime
    updated_at: datetime


class BookingListResponse(BaseModel):
    items: list[BookingResponse]
    total: int
    page: int = 1
    page_size: int = 10
