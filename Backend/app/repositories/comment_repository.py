from typing import Optional, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.comment import Comment, CommentMention


class CommentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        event_id: str,
        user_id: int,
        content: str,
        session_id: Optional[str] = None,
        parent_id: Optional[str] = None,
    ) -> Comment:
        comment = Comment(
            event_id=event_id,
            user_id=user_id,
            content=content,
            session_id=session_id,
            parent_id=parent_id,
        )
        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def add_mention(self, comment_id: str, user_id: int) -> CommentMention:
        mention = CommentMention(comment_id=comment_id, user_id=user_id)
        self.db.add(mention)
        self.db.commit()
        return mention

    def get_by_id(self, comment_id: str) -> Optional[Comment]:
        return self.db.get(Comment, comment_id)

    def list_by_event(
        self,
        event_id: str,
        session_id: Optional[str] = None,
    ) -> list[Comment]:
        filters = [Comment.event_id == event_id]
        if session_id:
            filters.append(Comment.session_id == session_id)

        stmt = select(Comment).where(*filters).order_by(Comment.created_at.asc())
        return list(self.db.scalars(stmt).all())

    def update(self, comment: Comment, content: str) -> Comment:
        comment.content = content
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def delete(self, comment: Comment) -> None:
        self.db.delete(comment)
        self.db.commit()
