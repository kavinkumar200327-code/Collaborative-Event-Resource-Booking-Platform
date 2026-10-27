from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import DomainException
from app.models.registration import Registration, WaitlistEntry
from app.models.event import Event
from app.repositories.registration_repository import RegistrationRepository
from app.repositories.event_repository import EventRepository
from app.services.notification_service import NotificationService


def _normalize_dt(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class RegistrationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = RegistrationRepository(db)
        self.event_repo = EventRepository(db)
        self.notification_service = NotificationService(db)

    def register(
        self,
        event_id: str,
        user_id: int,
        notes: Optional[str] = None,
    ) -> Registration:
        # Lock the event row for concurrent registration safety
        event = (
            self.db.query(Event)
            .filter(Event.id == event_id)
            .with_for_update()
            .first()
        )
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        if event.status == "cancelled":
            raise DomainException.event_cancelled("Cannot register for a cancelled event.")

        if event.status != "published":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot register for an event in '{event.status}' status. Only published events accept registrations.",
            )

        # Check if event has already started
        now = datetime.now(timezone.utc)
        event_start = _normalize_dt(event.starts_at)
        if event_start <= now:
            raise DomainException.registration_closed(
                "Cannot register: this event has already started or registration is closed."
            )

        # Check duplicate registration
        existing = self.repo.get_by_event_and_user(event_id=event_id, user_id=user_id)
        if existing and existing.status in ["confirmed", "waitlisted", "pending"]:
            raise DomainException.duplicate_registration(
                "You are already registered or waitlisted for this event."
            )

        # Check active capacity
        active_count = self.repo.count_active_registrations(event_id)

        if active_count >= event.capacity:
            # Event is FULL -> Place on Waitlist!
            priority = self.repo.get_next_waitlist_priority(event_id)
            self.repo.create_waitlist_entry(
                event_id=event_id,
                user_id=user_id,
                priority=priority,
            )
            # Create or update registration as waitlisted
            if existing:
                existing.status = "waitlisted"
                existing.notes = notes
                self.db.commit()
                self.db.refresh(existing)
                reg = existing
            else:
                reg = self.repo.create_registration(
                    event_id=event_id,
                    user_id=user_id,
                    status="waitlisted",
                    notes=notes,
                )

            # Notify waitlisted user
            self.notification_service.create_notification(
                user_id=user_id,
                type="registration_waitlisted",
                title="Added to Waitlist",
                message=f"Event '{event.title}' is at capacity. You are #{priority} on the waitlist.",
                event_id=event.id,
                data={"event_id": event.id, "priority": priority},
            )
            return reg

        # Capacity available -> Confirm registration
        if existing:
            existing.status = "confirmed"
            existing.notes = notes
            self.db.commit()
            self.db.refresh(existing)
            reg = existing
        else:
            reg = self.repo.create_registration(
                event_id=event_id,
                user_id=user_id,
                status="confirmed",
                notes=notes,
            )

        # Notify confirmed user
        self.notification_service.create_notification(
            user_id=user_id,
            type="registration_confirmed",
            title="Registration Confirmed",
            message=f"Your registration for '{event.title}' is confirmed!",
            event_id=event.id,
            data={"registration_id": reg.id, "event_id": event.id},
        )
        return reg

    def cancel_registration(
        self,
        registration_id: str,
        user_id: int,
        is_admin: bool = False,
    ) -> Registration:
        reg = self.repo.get_by_id(registration_id)
        if not reg:
            raise HTTPException(status_code=404, detail="Registration not found")

        if not is_admin and reg.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this registration",
            )

        was_confirmed = reg.status == "confirmed"
        reg.status = "cancelled"
        self.db.commit()
        self.db.refresh(reg)

        # Notify user
        self.notification_service.create_notification(
            user_id=reg.user_id,
            type="registration_cancelled",
            title="Registration Cancelled",
            message="Your registration has been cancelled.",
            event_id=reg.event_id,
            data={"registration_id": reg.id},
        )

        # If it was confirmed, trigger automatic waitlist promotion!
        if was_confirmed:
            self._promote_next_waitlist_participant(reg.event_id)

        return reg

    def _promote_next_waitlist_participant(self, event_id: str):
        # Lock event row to guarantee concurrency safety
        event = (
            self.db.query(Event)
            .filter(Event.id == event_id)
            .with_for_update()
            .first()
        )
        if not event:
            return

        active_count = self.repo.count_active_registrations(event_id)
        if active_count < event.capacity:
            next_entry = self.repo.get_first_waiting_entry(event_id)
            if next_entry:
                promoted_reg = self.repo.promote_waitlist_entry(next_entry)

                # Send notification to promoted user
                self.notification_service.create_notification(
                    user_id=promoted_reg.user_id,
                    type="registration_confirmed",
                    title="Promoted from Waitlist!",
                    message=f"A spot opened up! Your registration for '{event.title}' is now confirmed.",
                    event_id=event.id,
                    data={"registration_id": promoted_reg.id, "event_id": event.id},
                )

    def get_registration(self, registration_id: str) -> Registration:
        reg = self.repo.get_by_id(registration_id)
        if not reg:
            raise HTTPException(status_code=404, detail="Registration not found")
        return reg

    def list_registrations(
        self,
        event_id: Optional[str] = None,
        user_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[list[Registration], int]:
        return self.repo.list(
            event_id=event_id,
            user_id=user_id,
            status=status,
            page=page,
            page_size=page_size,
        )

    def approve_registration(self, registration_id: str) -> Registration:
        reg = self.get_registration(registration_id)
        reg.status = "confirmed"
        self.db.commit()
        self.db.refresh(reg)

        self.notification_service.create_notification(
            user_id=reg.user_id,
            type="registration_confirmed",
            title="Registration Approved",
            message=f"Your registration has been approved by staff.",
            event_id=reg.event_id,
            data={"registration_id": reg.id},
        )
        return reg

    def reject_registration(self, registration_id: str, reason: Optional[str] = None) -> Registration:
        reg = self.get_registration(registration_id)
        reg.status = "rejected"
        self.db.commit()
        self.db.refresh(reg)

        self.notification_service.create_notification(
            user_id=reg.user_id,
            type="registration_rejected",
            title="Registration Rejected",
            message=f"Your registration was rejected. {reason or ''}",
            event_id=reg.event_id,
            data={"registration_id": reg.id, "reason": reason},
        )
        return reg
