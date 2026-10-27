from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import DomainException
from app.models.session import EventSession
from app.models.event import Event
from app.repositories.session_repository import SessionRepository
from app.repositories.event_repository import EventRepository
from app.repositories.resource_repository import ResourceRepository
from app.schemas.session import SessionCreate, SessionUpdate
from app.services.notification_service import NotificationService


def _normalize_dt(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class SessionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SessionRepository(db)
        self.event_repo = EventRepository(db)
        self.resource_repo = ResourceRepository(db)
        self.notification_service = NotificationService(db)

    def create_session(self, data: SessionCreate) -> EventSession:
        event = self.event_repo.get_by_id(data.event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        # Cancelled events cannot receive new sessions
        if event.status == "cancelled":
            raise DomainException.event_cancelled("Cancelled events cannot receive new sessions.")

        start_time = _normalize_dt(data.start_time)
        end_time = _normalize_dt(data.end_time)
        event_start = _normalize_dt(event.starts_at)
        event_end = _normalize_dt(event.ends_at)

        # Session cannot exist outside event time
        if start_time < event_start or end_time > event_end:
            raise DomainException.session_outside_event(
                f"Session timing ({start_time.isoformat()} - {end_time.isoformat()}) must be within event timing ({event_start.isoformat()} - {event_end.isoformat()})"
            )

        # Room checks
        if data.room_id:
            room = self.resource_repo.get_by_id(data.room_id)
            if not room:
                raise DomainException.resource_not_found("Selected room resource not found")

            # Session capacity cannot exceed room capacity
            if data.capacity > room.capacity:
                raise DomainException.session_capacity_exceeded(
                    f"Session capacity ({data.capacity}) exceeds room capacity ({room.capacity})"
                )

            # Session times cannot overlap in the same room
            room_conflict = self.repo.find_room_conflict(
                room_id=data.room_id,
                start_time=start_time,
                end_time=end_time,
            )
            if room_conflict:
                raise DomainException.session_time_conflict(
                    "Another session is already scheduled in this room during the specified time."
                )

        # Speaker checks
        if data.speaker_id:
            speaker_conflict = self.repo.find_speaker_conflict(
                speaker_id=data.speaker_id,
                start_time=start_time,
                end_time=end_time,
            )
            if speaker_conflict:
                raise DomainException.speaker_time_conflict(
                    "The selected speaker is already assigned to another session during this time."
                )

        session = self.repo.create(data)
        return session

    def get_session(self, session_id: str) -> EventSession:
        session = self.repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session

    def list_sessions(self, event_id: str, page: int = 1, page_size: int = 50) -> Tuple[list[EventSession], int]:
        return self.repo.list_by_event(event_id=event_id, page=page, page_size=page_size)

    def update_session(self, session_id: str, data: SessionUpdate) -> EventSession:
        session = self.get_session(session_id)
        event = self.event_repo.get_by_id(session.event_id)
        update_dict = data.model_dump(exclude_unset=True)

        new_start = _normalize_dt(update_dict.get("start_time", session.start_time))
        new_end = _normalize_dt(update_dict.get("end_time", session.end_time))
        new_room_id = update_dict.get("room_id", session.room_id)
        new_speaker_id = update_dict.get("speaker_id", session.speaker_id)
        new_capacity = update_dict.get("capacity", session.capacity)

        if event:
            event_start = _normalize_dt(event.starts_at)
            event_end = _normalize_dt(event.ends_at)
            if new_start < event_start or new_end > event_end:
                raise DomainException.session_outside_event(
                    "Session timing must be strictly within event boundaries."
                )

        if new_room_id:
            room = self.resource_repo.get_by_id(new_room_id)
            if room and new_capacity > room.capacity:
                raise DomainException.session_capacity_exceeded(
                    f"Session capacity ({new_capacity}) exceeds room capacity ({room.capacity})"
                )
            room_conflict = self.repo.find_room_conflict(
                room_id=new_room_id,
                start_time=new_start,
                end_time=new_end,
                exclude_session_id=session.id,
            )
            if room_conflict:
                raise DomainException.session_time_conflict(
                    "Another session is already scheduled in this room during the specified time."
                )

        if new_speaker_id:
            speaker_conflict = self.repo.find_speaker_conflict(
                speaker_id=new_speaker_id,
                start_time=new_start,
                end_time=new_end,
                exclude_session_id=session.id,
            )
            if speaker_conflict:
                raise DomainException.speaker_time_conflict(
                    "The selected speaker is already assigned to another session during this time."
                )

        updated = self.repo.update(session, data)

        # Notify attendees of session update
        # We can notify event creator or registered users
        if event:
            self.notification_service.create_notification(
                user_id=event.created_by,
                type="session_updated",
                title="Session Updated",
                message=f"Session '{session.title}' in event '{event.title}' was updated.",
                event_id=event.id,
                data={"session_id": session.id},
            )

        return updated

    def delete_session(self, session_id: str) -> None:
        session = self.get_session(session_id)
        self.repo.delete(session)
