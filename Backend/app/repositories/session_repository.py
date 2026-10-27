from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.models.session import EventSession


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, session_data) -> EventSession:
        data = session_data.model_dump() if hasattr(session_data, "model_dump") else session_data
        session = EventSession(**data)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_by_id(self, session_id: str) -> Optional[EventSession]:
        return self.db.get(EventSession, session_id)

    def find_room_conflict(
        self,
        room_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_session_id: Optional[str] = None,
    ) -> Optional[EventSession]:
        filters = [
            EventSession.room_id == room_id,
            EventSession.start_time < end_time,
            EventSession.end_time > start_time,
        ]
        if exclude_session_id:
            filters.append(EventSession.id != exclude_session_id)
        stmt = select(EventSession).where(and_(*filters)).limit(1)
        return self.db.scalar(stmt)

    def find_speaker_conflict(
        self,
        speaker_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_session_id: Optional[str] = None,
    ) -> Optional[EventSession]:
        filters = [
            EventSession.speaker_id == speaker_id,
            EventSession.start_time < end_time,
            EventSession.end_time > start_time,
        ]
        if exclude_session_id:
            filters.append(EventSession.id != exclude_session_id)
        stmt = select(EventSession).where(and_(*filters)).limit(1)
        return self.db.scalar(stmt)

    def list_by_event(
        self,
        event_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[list[EventSession], int]:
        stmt = (
            select(EventSession)
            .where(EventSession.event_id == event_id)
            .order_by(EventSession.start_time.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = (
            select(func.count())
            .select_from(EventSession)
            .where(EventSession.event_id == event_id)
        )
        items = list(self.db.scalars(stmt).all())
        total = self.db.scalar(count_stmt) or 0
        return items, total

    def update(self, session: EventSession, data) -> EventSession:
        update_data = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data
        for field, value in update_data.items():
            if value is not None:
                setattr(session, field, value)
        self.db.commit()
        self.db.refresh(session)
        return session

    def delete(self, session: EventSession) -> None:
        self.db.delete(session)
        self.db.commit()
