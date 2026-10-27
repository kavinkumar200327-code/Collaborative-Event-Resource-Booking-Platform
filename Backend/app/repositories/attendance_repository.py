from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.attendance import Attendance


class AttendanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_event_and_user(self, event_id: str, user_id: int) -> Optional[Attendance]:
        stmt = select(Attendance).where(
            Attendance.event_id == event_id,
            Attendance.user_id == user_id,
        )
        return self.db.scalar(stmt)

    def get_by_id(self, attendance_id: str) -> Optional[Attendance]:
        return self.db.get(Attendance, attendance_id)

    def create(
        self,
        event_id: str,
        registration_id: str,
        user_id: int,
        status: str = "registered",
        check_in_time: Optional[datetime] = None,
        marked_by: Optional[int] = None,
    ) -> Attendance:
        record = Attendance(
            event_id=event_id,
            registration_id=registration_id,
            user_id=user_id,
            status=status,
            check_in_time=check_in_time,
            marked_by=marked_by,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update_status(
        self,
        record: Attendance,
        status: str,
        marked_by: Optional[int] = None,
    ) -> Attendance:
        record.status = status
        if status == "attended" and not record.check_in_time:
            record.check_in_time = datetime.now(timezone.utc)
        if marked_by is not None:
            record.marked_by = marked_by
        self.db.commit()
        self.db.refresh(record)
        return record

    def list_by_event(
        self,
        event_id: str,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[list[Attendance], int]:
        filters = [Attendance.event_id == event_id]
        if status:
            filters.append(Attendance.status == status)

        stmt = (
            select(Attendance)
            .where(*filters)
            .order_by(Attendance.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = select(func.count()).select_from(Attendance).where(*filters)

        items = list(self.db.scalars(stmt).all())
        total = self.db.scalar(count_stmt) or 0
        return items, total
