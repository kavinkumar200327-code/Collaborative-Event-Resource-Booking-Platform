from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.session import EventSession
from app.models.booking import ResourceBooking
from app.schemas.calendar import CalendarItem


class CalendarService:
    def __init__(self, db: Session):
        self.db = db

    def get_calendar_feed(
        self,
        organization_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CalendarItem]:
        items: List[CalendarItem] = []

        # 1. Events
        q_events = self.db.query(Event).filter(Event.status != "cancelled")
        if organization_id:
            q_events = q_events.filter(Event.organization_id == organization_id)
        if start_time:
            q_events = q_events.filter(Event.ends_at >= start_time)
        if end_time:
            q_events = q_events.filter(Event.starts_at <= end_time)

        for e in q_events.all():
            items.append(
                CalendarItem(
                    id=e.id,
                    title=f"[Event] {e.title}",
                    type="event",
                    start_time=e.starts_at,
                    end_time=e.ends_at,
                    location=e.location,
                    status=e.status,
                    event_id=e.id,
                    details={"capacity": e.capacity},
                )
            )

        # 2. Sessions
        q_sessions = self.db.query(EventSession)
        if start_time:
            q_sessions = q_sessions.filter(EventSession.end_time >= start_time)
        if end_time:
            q_sessions = q_sessions.filter(EventSession.start_time <= end_time)

        for s in q_sessions.all():
            items.append(
                CalendarItem(
                    id=s.id,
                    title=f"[Session] {s.title}",
                    type="session",
                    start_time=s.start_time,
                    end_time=s.end_time,
                    status="scheduled",
                    event_id=s.event_id,
                    resource_id=s.room_id,
                    details={"capacity": s.capacity, "speaker_id": s.speaker_id},
                )
            )

        # 3. Resource Bookings (Approved or Requested)
        q_bookings = self.db.query(ResourceBooking).filter(
            ResourceBooking.status.in_(["approved", "requested"])
        )
        if start_time:
            q_bookings = q_bookings.filter(ResourceBooking.end_time >= start_time)
        if end_time:
            q_bookings = q_bookings.filter(ResourceBooking.start_time <= end_time)

        for b in q_bookings.all():
            items.append(
                CalendarItem(
                    id=b.id,
                    title=f"[Booking] {b.purpose or 'Resource Booking'}",
                    type="booking",
                    start_time=b.start_time,
                    end_time=b.end_time,
                    status=b.status,
                    resource_id=b.resource_id,
                    event_id=b.event_id,
                    details={"requested_by": b.requested_by},
                )
            )

        items.sort(key=lambda x: x.start_time)
        return items
