from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.attendance import (
    AttendanceMark,
    AttendanceUpdate,
    AttendanceResponse,
    AttendanceListResponse,
)
from app.services.attendance_service import AttendanceService

router = APIRouter(
    tags=["Attendance"],
)


@router.post(
    "/events/{event_id}/attendance",
    response_model=AttendanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def mark_attendance(
    event_id: str,
    data: AttendanceMark,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AttendanceService(db)
    return service.mark_attendance(
        event_id=event_id,
        user_id=data.user_id,
        status=data.status,
        marked_by=current_user.id,
    )


@router.get(
    "/events/{event_id}/attendance",
    response_model=AttendanceListResponse,
)
def get_event_attendance(
    event_id: str,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AttendanceService(db)
    items, total = service.list_event_attendance(
        event_id=event_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    return AttendanceListResponse(items=items, total=total, page=page, page_size=page_size)


@router.patch(
    "/attendance/{attendance_id}",
    response_model=AttendanceResponse,
)
def update_attendance(
    attendance_id: str,
    data: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AttendanceService(db)
    return service.update_attendance_record(
        record_id=attendance_id,
        status=data.status,
        marked_by=current_user.id,
    )


from pydantic import BaseModel

class AttendanceCheckInRequest(BaseModel):
    check_in_code: Optional[str] = None
    qr_data: Optional[str] = None


@router.post(
    "/events/{event_id}/attendance/check-in",
    response_model=AttendanceResponse,
)
def check_in_by_code(
    event_id: str,
    payload: AttendanceCheckInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = (payload.check_in_code or payload.qr_data or "").strip()
    if not code:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Check-in code or QR data is required")
    service = AttendanceService(db)
    return service.check_in_by_qr(event_id=event_id, qr_data=code, marked_by=current_user.id)


@router.post(
    "/events/{event_id}/attendance/qr-checkin",
    response_model=AttendanceResponse,
)
def qr_checkin(
    event_id: str,
    qr_data: str = Query(..., description="Encoded QR code payload"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AttendanceService(db)
    return service.check_in_by_qr(event_id=event_id, qr_data=qr_data, marked_by=current_user.id)


@router.get(
    "/events/{event_id}/attendance/export",
)
def export_attendance_csv(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AttendanceService(db)
    csv_data = service.export_attendance_csv(event_id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_event_{event_id[:8]}.csv"},
    )
