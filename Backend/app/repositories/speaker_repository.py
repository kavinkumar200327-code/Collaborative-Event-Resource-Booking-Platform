from typing import Optional, Tuple
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.models.speaker import Speaker
from app.schemas.speaker import SpeakerCreate, SpeakerUpdate


class SpeakerRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, speaker_data: SpeakerCreate) -> Speaker:
        speaker = Speaker(**speaker_data.model_dump())
        self.db.add(speaker)
        self.db.commit()
        self.db.refresh(speaker)
        return speaker

    def get_by_id(self, speaker_id: str) -> Optional[Speaker]:
        return self.db.get(Speaker, speaker_id)

    def list(
        self,
        organization_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[list[Speaker], int]:
        filters = []
        if organization_id:
            filters.append(Speaker.organization_id == organization_id)
        if search:
            term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Speaker.name.ilike(term),
                    Speaker.email.ilike(term),
                    Speaker.organization_name.ilike(term),
                )
            )

        stmt = (
            select(Speaker)
            .where(*filters)
            .order_by(Speaker.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = select(func.count()).select_from(Speaker).where(*filters)

        items = list(self.db.scalars(stmt).all())
        total = self.db.scalar(count_stmt) or 0
        return items, total

    def update(self, speaker: Speaker, speaker_data: SpeakerUpdate) -> Speaker:
        for field, value in speaker_data.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(speaker, field, value)
        self.db.commit()
        self.db.refresh(speaker)
        return speaker

    def delete(self, speaker: Speaker) -> None:
        self.db.delete(speaker)
        self.db.commit()
