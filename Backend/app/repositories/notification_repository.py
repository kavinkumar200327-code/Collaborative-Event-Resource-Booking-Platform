import json
from typing import Optional, Tuple
from sqlalchemy import select, func, update
from sqlalchemy.orm import Session

from app.models.notification import Notification


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        user_id: int,
        type: str,
        title: str,
        message: str,
        organization_id: Optional[str] = None,
        event_id: Optional[str] = None,
        data: Optional[dict] = None,
    ) -> Notification:
        notif = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            organization_id=organization_id,
            event_id=event_id,
            data=json.dumps(data) if data else None,
        )
        self.db.add(notif)
        self.db.commit()
        self.db.refresh(notif)
        return notif

    def get_by_id(self, notification_id: str) -> Optional[Notification]:
        return self.db.get(Notification, notification_id)

    def list_by_user(
        self,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[list[Notification], int, int]:
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id)
        )
        unread_stmt = (
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
        )

        items = list(self.db.scalars(stmt).all())
        total = self.db.scalar(count_stmt) or 0
        unread_count = self.db.scalar(unread_stmt) or 0
        return items, total, unread_count

    def mark_as_read(self, notification: Notification) -> Notification:
        notification.is_read = True
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def mark_all_as_read(self, user_id: int) -> int:
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True)
        )
        result = self.db.execute(stmt)
        self.db.commit()
        return result.rowcount or 0
