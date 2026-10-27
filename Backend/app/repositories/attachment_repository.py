from typing import Optional, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.attachment import Attachment


class AttachmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        organization_id: str,
        uploaded_by: int,
        file_name: str,
        original_name: str,
        mime_type: str,
        file_size: int,
        storage_path: str,
        event_id: Optional[str] = None,
        session_id: Optional[str] = None,
        speaker_id: Optional[str] = None,
        registration_id: Optional[str] = None,
    ) -> Attachment:
        attachment = Attachment(
            organization_id=organization_id,
            uploaded_by=uploaded_by,
            file_name=file_name,
            original_name=original_name,
            mime_type=mime_type,
            file_size=file_size,
            storage_path=storage_path,
            event_id=event_id,
            session_id=session_id,
            speaker_id=speaker_id,
            registration_id=registration_id,
        )
        self.db.add(attachment)
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def get_by_id(self, attachment_id: str) -> Optional[Attachment]:
        return self.db.get(Attachment, attachment_id)

    def list(
        self,
        organization_id: Optional[str] = None,
        event_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[list[Attachment], int]:
        filters = []
        if organization_id:
            filters.append(Attachment.organization_id == organization_id)
        if event_id:
            filters.append(Attachment.event_id == event_id)

        stmt = (
            select(Attachment)
            .where(*filters)
            .order_by(Attachment.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = select(func.count()).select_from(Attachment).where(*filters)

        items = list(self.db.scalars(stmt).all())
        total = self.db.scalar(count_stmt) or 0
        return items, total
