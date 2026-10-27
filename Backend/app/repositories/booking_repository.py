from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from app.models.booking import ResourceBooking
from app.models.resource import Resource


class BookingRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_conflicting_booking(
        self,
        resource_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_booking_id: Optional[str] = None,
        lock_resource: bool = True,
    ) -> Optional[ResourceBooking]:
        # If lock_resource is True, lock the resource row to serialize concurrent booking checks
        if lock_resource:
            self.db.query(Resource).filter(Resource.id == resource_id).with_for_update().first()

        filters = [
            ResourceBooking.resource_id == resource_id,
            ResourceBooking.status.in_(["approved", "requested"]),
            ResourceBooking.start_time < end_time,
            ResourceBooking.end_time > start_time,
        ]

        if exclude_booking_id:
            filters.append(ResourceBooking.id != exclude_booking_id)

        stmt = select(ResourceBooking).where(and_(*filters)).limit(1)
        return self.db.scalar(stmt)

    def create(
        self,
        resource_id: str,
        requested_by: int,
        start_time: datetime,
        end_time: datetime,
        event_id: Optional[str] = None,
        purpose: Optional[str] = None,
        status: str = "requested",
    ) -> ResourceBooking:
        booking = ResourceBooking(
            resource_id=resource_id,
            requested_by=requested_by,
            start_time=start_time,
            end_time=end_time,
            event_id=event_id,
            purpose=purpose,
            status=status,
        )
        self.db.add(booking)
        self.db.commit()
        self.db.refresh(booking)
        return booking

    def get_by_id(self, booking_id: str) -> Optional[ResourceBooking]:
        return self.db.get(ResourceBooking, booking_id)

    def list(
        self,
        resource_id: Optional[str] = None,
        event_id: Optional[str] = None,
        requested_by: Optional[int] = None,
        status: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[list[ResourceBooking], int]:
        filters = []
        if resource_id:
            filters.append(ResourceBooking.resource_id == resource_id)
        if event_id:
            filters.append(ResourceBooking.event_id == event_id)
        if requested_by:
            filters.append(ResourceBooking.requested_by == requested_by)
        if status:
            filters.append(ResourceBooking.status == status)
        if start_time:
            filters.append(ResourceBooking.end_time >= start_time)
        if end_time:
            filters.append(ResourceBooking.start_time <= end_time)

        stmt = (
            select(ResourceBooking)
            .where(*filters)
            .order_by(ResourceBooking.start_time.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = select(func.count()).select_from(ResourceBooking).where(*filters)

        items = list(self.db.scalars(stmt).all())
        total = self.db.scalar(count_stmt) or 0
        return items, total

    def update_status(
        self,
        booking: ResourceBooking,
        status: str,
        rejection_reason: Optional[str] = None,
    ) -> ResourceBooking:
        booking.status = status
        if rejection_reason is not None:
            booking.rejection_reason = rejection_reason
        self.db.commit()
        self.db.refresh(booking)
        return booking
