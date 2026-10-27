from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.calendar import CalendarFeedResponse
from app.services.calendar_service import CalendarService

router = APIRouter(
    prefix="/calendar",
    tags=["Calendar Feed"],
)


@router.get(
    "/events",
    response_model=CalendarFeedResponse,
)
def get_calendar_events(
    organization_id: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CalendarService(db)
    items = service.get_calendar_feed(
        organization_id=organization_id,
        start_time=start_time,
        end_time=end_time,
    )
    return CalendarFeedResponse(items=items, total=len(items))
