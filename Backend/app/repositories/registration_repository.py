from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.models.registration import Registration, WaitlistEntry
from app.models.event import Event


class RegistrationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_event_and_user(
        self,
        event_id: str,
        user_id: int,
    ) -> Optional[Registration]:
        stmt = select(Registration).where(
            Registration.event_id == event_id,
            Registration.user_id == user_id,
        )
        return self.db.scalar(stmt)

    def count_active_registrations(self, event_id: str) -> int:
        stmt = (
            select(func.count())
            .select_from(Registration)
            .where(
                Registration.event_id == event_id,
                Registration.status.in_(["confirmed", "attended"]),
            )
        )
        return self.db.scalar(stmt) or 0

    def get_next_waitlist_priority(self, event_id: str) -> int:
        stmt = (
            select(func.coalesce(func.max(WaitlistEntry.priority), 0))
            .where(WaitlistEntry.event_id == event_id)
        )
        return (self.db.scalar(stmt) or 0) + 1

    def create_registration(
        self,
        event_id: str,
        user_id: int,
        status: str = "confirmed",
        notes: Optional[str] = None,
    ) -> Registration:
        reg = Registration(
            event_id=event_id,
            user_id=user_id,
            status=status,
            notes=notes,
        )
        self.db.add(reg)
        self.db.commit()
        self.db.refresh(reg)
        return reg

    def create_waitlist_entry(
        self,
        event_id: str,
        user_id: int,
        priority: int,
    ) -> WaitlistEntry:
        entry = WaitlistEntry(
            event_id=event_id,
            user_id=user_id,
            priority=priority,
            status="active",
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get_by_id(self, registration_id: str) -> Optional[Registration]:
        return self.db.get(Registration, registration_id)

    def get_first_waiting_entry(self, event_id: str) -> Optional[WaitlistEntry]:
        stmt = (
            select(WaitlistEntry)
            .where(
                WaitlistEntry.event_id == event_id,
                WaitlistEntry.status == "active",
            )
            .order_by(WaitlistEntry.priority.asc(), WaitlistEntry.created_at.asc())
            .with_for_update()
            .limit(1)
        )
        return self.db.scalar(stmt)

    def promote_waitlist_entry(self, entry: WaitlistEntry) -> Registration:
        entry.status = "promoted"
        entry.promoted_at = datetime.now(timezone.utc)

        # Check if user has an existing registration record (e.g. waitlisted)
        reg = self.get_by_event_and_user(entry.event_id, entry.user_id)
        if reg:
            reg.status = "confirmed"
        else:
            reg = Registration(
                event_id=entry.event_id,
                user_id=entry.user_id,
                status="confirmed",
            )
            self.db.add(reg)

        self.db.commit()
        self.db.refresh(reg)
        return reg

    def list(
        self,
        event_id: Optional[str] = None,
        user_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[list[Registration], int]:
        filters = []
        if event_id:
            filters.append(Registration.event_id == event_id)
        if user_id:
            filters.append(Registration.user_id == user_id)
        if status:
            filters.append(Registration.status == status)

        stmt = (
            select(Registration)
            .where(*filters)
            .order_by(Registration.registered_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = select(func.count()).select_from(Registration).where(*filters)

        items = list(self.db.scalars(stmt).all())
        total = self.db.scalar(count_stmt) or 0
        return items, total

    def update_status(self, registration: Registration, status: str) -> Registration:
        registration.status = status
        self.db.commit()
        self.db.refresh(registration)
        return registration
