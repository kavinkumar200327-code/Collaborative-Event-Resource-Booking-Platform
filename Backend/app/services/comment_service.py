import re
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.comment import Comment
from app.models.user import User
from app.repositories.comment_repository import CommentRepository
from app.services.notification_service import NotificationService


class CommentService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CommentRepository(db)
        self.notification_service = NotificationService(db)

    def add_comment(
        self,
        event_id: str,
        user_id: int,
        content: str,
        session_id: Optional[str] = None,
        parent_id: Optional[str] = None,
    ) -> Comment:
        comment = self.repo.create(
            event_id=event_id,
            user_id=user_id,
            content=content,
            session_id=session_id,
            parent_id=parent_id,
        )

        # Parse mentions (@username or @name)
        author = self.db.get(User, user_id)
        author_name = author.full_name if author else "Someone"

        mentioned_names = re.findall(r"@([a-zA-Z0-9_.-]+)", content)
        for name in mentioned_names:
            # Match by email username or full_name
            target = (
                self.db.query(User)
                .filter(
                    (User.email.ilike(f"{name}%")) | (User.full_name.ilike(f"%{name}%"))
                )
                .first()
            )
            if target and target.id != user_id:
                self.repo.add_mention(comment_id=comment.id, user_id=target.id)
                self.notification_service.create_notification(
                    user_id=target.id,
                    type="user_mentioned",
                    title="You were mentioned",
                    message=f"{author_name} mentioned you in a comment: \"{content[:100]}\"",
                    event_id=event_id,
                    data={"comment_id": comment.id, "event_id": event_id},
                )

        return comment

    def list_comments(self, event_id: str, session_id: Optional[str] = None) -> list[Comment]:
        return self.repo.list_by_event(event_id, session_id)

    def update_comment(self, comment_id: str, content: str, user_id: int) -> Comment:
        comment = self.repo.get_by_id(comment_id)
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        if comment.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's comment")
        return self.repo.update(comment, content)

    def delete_comment(self, comment_id: str, user_id: int, is_admin: bool = False) -> None:
        comment = self.repo.get_by_id(comment_id)
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        if not is_admin and comment.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's comment")
        self.repo.delete(comment)
