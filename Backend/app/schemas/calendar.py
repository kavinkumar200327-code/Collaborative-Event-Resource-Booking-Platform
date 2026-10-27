from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel

CalendarItemType = Literal["event", "session", "booking"]


class CalendarItem(BaseModel):
    id: str
    title: str
    type: CalendarItemType
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    status: Optional[str] = None
    resource_id: Optional[str] = None
    event_id: Optional[str] = None
    details: Optional[dict] = None


class CalendarFeedResponse(BaseModel):
    items: list[CalendarItem]
    total: int
