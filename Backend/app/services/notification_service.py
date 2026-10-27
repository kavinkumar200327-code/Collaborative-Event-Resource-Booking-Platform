import asyncio
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.core.websocket import manager
from app.models.notification import Notification
from app.repositories.notification_repository import NotificationRepository


class NotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = NotificationRepository(db)

    def create_notification(
        self,
        user_id: int,
        type: str,
        title: str,
        message: str,
        organization_id: Optional[str] = None,
        event_id: Optional[str] = None,
        data: Optional[dict] = None,
    ) -> Notification:
        notif = self.repo.create(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            organization_id=organization_id,
            event_id=event_id,
            data=data,
        )

        # Attempt to broadcast via WebSocket in background/event loop
        payload = {
            "type": "notification",
            "data": {
                "id": notif.id,
                "type": notif.type,
                "title": notif.title,
                "message": notif.message,
                "created_at": notif.created_at.isoformat(),
            },
        }
        try:
            manager.send_personal_sync(payload, user_id)
        except Exception:
            pass

        return notif

    def list_user_notifications(
        self,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[list[Notification], int, int]:
        return self.repo.list_by_user(user_id=user_id, page=page, page_size=page_size)

    def mark_read(self, notification_id: str, user_id: int) -> Notification:
        notif = self.repo.get_by_id(notification_id)
        if not notif or notif.user_id != user_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Notification not found")
        return self.repo.mark_as_read(notif)

    def mark_all_read(self, user_id: int) -> int:
        return self.repo.mark_all_as_read(user_id)
