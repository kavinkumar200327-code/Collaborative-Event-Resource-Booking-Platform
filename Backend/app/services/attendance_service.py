import csv
import io
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.attendance import Attendance
from app.models.registration import Registration
from app.models.user import User
from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.registration_repository import RegistrationRepository
from app.repositories.event_repository import EventRepository


class AttendanceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AttendanceRepository(db)
        self.reg_repo = RegistrationRepository(db)
        self.event_repo = EventRepository(db)

    def mark_attendance(
        self,
        event_id: str,
        user_id: int,
        status: str = "attended",
        marked_by: Optional[int] = None,
    ) -> Attendance:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        reg = self.reg_repo.get_by_event_and_user(event_id, user_id)
        if not reg:
            raise HTTPException(
                status_code=400,
                detail="User must be registered for the event before attendance can be marked",
            )

        existing = self.repo.get_by_event_and_user(event_id, user_id)
        now = datetime.now(timezone.utc)
        if existing:
            return self.repo.update_status(existing, status, marked_by=marked_by)

        check_in = now if status == "attended" else None
        return self.repo.create(
            event_id=event_id,
            registration_id=reg.id,
            user_id=user_id,
            status=status,
            check_in_time=check_in,
            marked_by=marked_by,
        )

    def check_in_by_qr(self, event_id: str, qr_data: str, marked_by: Optional[int] = None) -> Attendance:
        qr_data = (qr_data or "").strip()
        parts = qr_data.split(":")
        if len(parts) == 2:
            target_event, uid_str = parts
            if target_event != event_id:
                raise HTTPException(status_code=400, detail="QR code does not match this event")
            try:
                user_id = int(uid_str)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid user ID in QR code")
            return self.mark_attendance(event_id, user_id, "attended", marked_by)
        elif qr_data.isdigit():
            user_id = int(qr_data)
            return self.mark_attendance(event_id, user_id, "attended", marked_by)
        else:
            # Check registration ID
            reg = self.reg_repo.get_by_id(qr_data)
            if reg and reg.event_id == event_id:
                return self.mark_attendance(event_id, reg.user_id, "attended", marked_by)
            
            # Check email address
            user = self.db.query(User).filter(User.email == qr_data.lower()).first()
            if user:
                reg = self.reg_repo.get_by_event_and_user(event_id, user.id)
                if reg:
                    return self.mark_attendance(event_id, user.id, "attended", marked_by)
                raise HTTPException(status_code=400, detail="User is not registered for this event")

            raise HTTPException(status_code=400, detail="Invalid QR code or unregistered participant token")

    def update_attendance_record(
        self,
        record_id: str,
        status: str,
        marked_by: Optional[int] = None,
    ) -> Attendance:
        record = self.repo.get_by_id(record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        return self.repo.update_status(record, status, marked_by=marked_by)

    def list_event_attendance(
        self,
        event_id: str,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[list[Attendance], int]:
        # Ensure confirmed registrations have an attendance record so they appear in tracking
        confirmed_regs = (
            self.db.query(Registration)
            .filter(
                Registration.event_id == event_id,
                Registration.status == "confirmed",
            )
            .all()
        )
        for reg in confirmed_regs:
            existing = self.repo.get_by_event_and_user(event_id, reg.user_id)
            if not existing:
                self.repo.create(
                    event_id=event_id,
                    registration_id=reg.id,
                    user_id=reg.user_id,
                    status="registered",
                )

        return self.repo.list_by_event(event_id, status=status, page=page, page_size=page_size)

    def export_attendance_csv(self, event_id: str) -> str:
        records, _ = self.repo.list_by_event(event_id, page=1, page_size=1000)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Attendance ID", "Event ID", "User ID", "Status", "Participant Name", "Participant Email", "Check-in Time", "Marked By"])
        for r in records:
            writer.writerow([
                r.id,
                r.event_id,
                r.user_id,
                r.status,
                r.user.full_name if r.user else f"User #{r.user_id}",
                r.user.email if r.user else "",
                r.check_in_time.isoformat() if r.check_in_time else "",
                r.marked_by or "",
            ])
        return output.getvalue()
