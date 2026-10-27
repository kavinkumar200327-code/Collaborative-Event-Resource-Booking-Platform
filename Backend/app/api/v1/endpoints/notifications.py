from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


@router.get(
    "",
    response_model=NotificationListResponse,
)
@router.get(
    "/",
    response_model=NotificationListResponse,
    include_in_schema=False,
)
def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    items, total, unread_count = service.list_user_notifications(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )
    return NotificationListResponse(
        items=items,
        total=total,
        unread_count=unread_count,
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    return service.mark_read(notification_id=notification_id, user_id=current_user.id)


@router.patch(
    "/read-all",
)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    updated_count = service.mark_all_read(user_id=current_user.id)
    return {"message": "All notifications marked as read", "updated_count": updated_count}
