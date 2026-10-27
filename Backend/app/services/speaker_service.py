from typing import Optional, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.speaker import Speaker
from app.repositories.speaker_repository import SpeakerRepository
from app.schemas.speaker import SpeakerCreate, SpeakerUpdate


class SpeakerService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SpeakerRepository(db)

    def create_speaker(self, data: SpeakerCreate) -> Speaker:
        return self.repo.create(data)

    def get_speaker(self, speaker_id: str) -> Speaker:
        speaker = self.repo.get_by_id(speaker_id)
        if not speaker:
            raise HTTPException(status_code=404, detail="Speaker not found")
        return speaker

    def list_speakers(
        self,
        organization_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[list[Speaker], int]:
        return self.repo.list(
            organization_id=organization_id,
            search=search,
            page=page,
            page_size=page_size,
        )

    def update_speaker(self, speaker_id: str, data: SpeakerUpdate) -> Speaker:
        speaker = self.get_speaker(speaker_id)
        return self.repo.update(speaker, data)

    def delete_speaker(self, speaker_id: str) -> None:
        speaker = self.get_speaker(speaker_id)
        self.repo.delete(speaker)
