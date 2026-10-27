from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import DomainException
from app.models.booking import ResourceBooking
from app.repositories.booking_repository import BookingRepository
from app.repositories.resource_repository import ResourceRepository
from app.schemas.booking import BookingCreate, BookingUpdate
from app.services.notification_service import NotificationService


def _normalize_dt(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class BookingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = BookingRepository(db)
        self.resource_repo = ResourceRepository(db)
        self.notification_service = NotificationService(db)

    def create_booking(
        self,
        booking_data: BookingCreate,
        requested_by: int,
    ) -> ResourceBooking:
        resource = self.resource_repo.get_by_id(booking_data.resource_id)
        if not resource:
            raise DomainException.resource_not_found("Resource not found")

        if resource.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Resource is not active (current status: {resource.status})",
            )

        start_time = _normalize_dt(booking_data.start_time)
        end_time = _normalize_dt(booking_data.end_time)

        if end_time <= start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking end time must be after start time",
            )

        # Check for conflicting booking with row lock on resource
        conflict = self.repo.find_conflicting_booking(
            resource_id=resource.id,
            start_time=start_time,
            end_time=end_time,
            lock_resource=True,
        )

        if conflict:
            raise DomainException.resource_already_booked(
                "The selected resource is already booked for this time period."
            )

        booking = self.repo.create(
            resource_id=resource.id,
            requested_by=requested_by,
            start_time=start_time,
            end_time=end_time,
            event_id=booking_data.event_id,
            purpose=booking_data.purpose,
            status="requested",
        )

        # Notify organization admins of the new resource booking request
        try:
            from app.models.user import User
            from app.models.organization_member import OrganizationMember

            admin_ids = set()
            global_admins = self.db.query(User.id).filter(
                User.role.in_(["admin", "super_admin"]),
                User.is_active.is_(True),
            ).all()
            for row in global_admins:
                admin_ids.add(row[0])

            if resource.organization_id:
                org_admins = self.db.query(OrganizationMember.user_id).filter(
                    OrganizationMember.organization_id == resource.organization_id,
                    OrganizationMember.role.in_(["admin", "org_admin"]),
                    OrganizationMember.is_active.is_(True),
                ).all()
                for row in org_admins:
                    admin_ids.add(row[0])

            admin_ids.discard(requested_by)

            requester = self.db.get(User, requested_by)
            req_name = requester.full_name or requester.email if requester else "A team member"
            time_str = f"{start_time.strftime('%b %d, %H:%M')} - {end_time.strftime('%H:%M')}"

            for aid in admin_ids:
                self.notification_service.create_notification(
                    user_id=aid,
                    type="booking_requested",
                    title="New Resource Booking Request",
                    message=f"{req_name} requested '{resource.name}' for {time_str}. Awaiting your approval.",
                    organization_id=resource.organization_id,
                    data={
                        "booking_id": booking.id,
                        "resource_id": resource.id,
                        "resource_name": resource.name,
                        "url": "/bookings?status=requested",
                    },
                )
        except Exception:
            pass

        return booking

    def get_booking(self, booking_id: str) -> ResourceBooking:
        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        return booking

    def list_bookings(
        self,
        resource_id: Optional[str] = None,
        event_id: Optional[str] = None,
        requested_by: Optional[int] = None,
        status_filter: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[list[ResourceBooking], int]:
        st = _normalize_dt(start_time) if start_time else None
        et = _normalize_dt(end_time) if end_time else None

        return self.repo.list(
            resource_id=resource_id,
            event_id=event_id,
            requested_by=requested_by,
            status=status_filter,
            start_time=st,
            end_time=et,
            page=page,
            page_size=page_size,
        )

    def update_booking(
        self,
        booking_id: str,
        data: BookingUpdate,
        user_id: int,
        is_admin: bool = False,
    ) -> ResourceBooking:
        booking = self.get_booking(booking_id)

        if not is_admin and booking.requested_by != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify this booking",
            )

        update_dict = data.model_dump(exclude_unset=True)
        new_start = _normalize_dt(update_dict.get("start_time", booking.start_time))
        new_end = _normalize_dt(update_dict.get("end_time", booking.end_time))

        if "start_time" in update_dict or "end_time" in update_dict:
            if new_end <= new_start:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Booking end time must be after start time",
                )
            conflict = self.repo.find_conflicting_booking(
                resource_id=booking.resource_id,
                start_time=new_start,
                end_time=new_end,
                exclude_booking_id=booking.id,
                lock_resource=True,
            )
            if conflict:
                raise DomainException.resource_already_booked(
                    "The selected resource is already booked for this time period."
                )
            booking.start_time = new_start
            booking.end_time = new_end

        for field in ("purpose", "status", "rejection_reason"):
            if field in update_dict and update_dict[field] is not None:
                setattr(booking, field, update_dict[field])

        self.db.commit()
        self.db.refresh(booking)
        return booking

    def cancel_booking(self, booking_id: str, user_id: int, is_admin: bool = False) -> ResourceBooking:
        booking = self.get_booking(booking_id)
        if not is_admin and booking.requested_by != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this booking",
            )
        return self.repo.update_status(booking, "cancelled")

    def approve_booking(self, booking_id: str) -> ResourceBooking:
        booking = self.get_booking(booking_id)
        # Re-check conflict before approving
        conflict = self.repo.find_conflicting_booking(
            resource_id=booking.resource_id,
            start_time=booking.start_time,
            end_time=booking.end_time,
            exclude_booking_id=booking.id,
            lock_resource=True,
        )
        if conflict:
            raise DomainException.resource_already_booked(
                "Cannot approve booking: resource is already booked for this period."
            )

        updated = self.repo.update_status(booking, "approved")

        # Notify requester
        self.notification_service.create_notification(
            user_id=booking.requested_by,
            type="booking_approved",
            title="Booking Approved",
            message=f"Your booking for resource #{booking.resource_id[:8]} has been approved.",
            event_id=booking.event_id,
            data={"booking_id": booking.id},
        )
        return updated

    def reject_booking(self, booking_id: str, reason: Optional[str] = None) -> ResourceBooking:
        booking = self.get_booking(booking_id)
        updated = self.repo.update_status(booking, "rejected", rejection_reason=reason)

        # Notify requester
        self.notification_service.create_notification(
            user_id=booking.requested_by,
            type="booking_rejected",
            title="Booking Rejected",
            message=f"Your booking for resource #{booking.resource_id[:8]} was rejected. Reason: {reason or 'No reason provided'}",
            event_id=booking.event_id,
            data={"booking_id": booking.id, "reason": reason},
        )
        return updated
