import os
import uuid
from typing import Optional, Tuple
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import DomainException
from app.models.attachment import Attachment
from app.repositories.attachment_repository import AttachmentRepository

# Allowed extensions and matching magic byte prefixes
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "gif": [b"GIF87a", b"GIF89a"],
    "txt": [],  # plain text validated via decode
    "csv": [],  # plain text validated via decode
}

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "gif", "txt", "csv"}


class FileService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AttachmentRepository(db)

    async def save_upload(
        self,
        file: UploadFile,
        organization_id: str,
        uploaded_by: int,
        event_id: Optional[str] = None,
        session_id: Optional[str] = None,
        speaker_id: Optional[str] = None,
        registration_id: Optional[str] = None,
    ) -> Attachment:
        original_name = file.filename or "unknown"
        parts = original_name.rsplit(".", 1)
        if len(parts) < 2:
            raise DomainException.invalid_file_type("Files must have a valid extension.")

        ext = parts[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise DomainException.invalid_file_type(
                f"Extension '{ext}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )

        content = await file.read()
        file_size = len(content)

        # Check maximum file size (MB to bytes)
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise DomainException.file_too_large(
                f"File size ({file_size / (1024 * 1024):.1f}MB) exceeds limit of {settings.MAX_UPLOAD_SIZE_MB}MB."
            )

        # Validate content magic bytes (do not trust extension)
        expected_magics = MAGIC_SIGNATURES.get(ext, [])
        if expected_magics:
            matched = any(content.startswith(sig) for sig in expected_magics)
            if not matched:
                raise DomainException.invalid_file_type(
                    f"File content does not match expected {ext.upper()} format."
                )
        elif ext in ("txt", "csv"):
            try:
                content[:1024].decode("utf-8")
            except UnicodeDecodeError:
                raise DomainException.invalid_file_type("File content is not valid text encoding.")

        # Ensure upload directory exists
        upload_dir = os.path.abspath(settings.UPLOAD_DIR)
        os.makedirs(upload_dir, exist_ok=True)

        safe_filename = f"{uuid.uuid4().hex}_{original_name.replace(' ', '_')}"
        storage_path = os.path.join(upload_dir, safe_filename)

        with open(storage_path, "wb") as f:
            f.write(content)

        return self.repo.create(
            organization_id=organization_id,
            uploaded_by=uploaded_by,
            file_name=safe_filename,
            original_name=original_name,
            mime_type=file.content_type or "application/octet-stream",
            file_size=file_size,
            storage_path=storage_path,
            event_id=event_id,
            session_id=session_id,
            speaker_id=speaker_id,
            registration_id=registration_id,
        )

    def get_attachment(self, attachment_id: str) -> Attachment:
        att = self.repo.get_by_id(attachment_id)
        if not att:
            raise HTTPException(status_code=404, detail="File attachment not found")
        return att

    def list_attachments(
        self,
        organization_id: Optional[str] = None,
        event_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[list[Attachment], int]:
        return self.repo.list(
            organization_id=organization_id,
            event_id=event_id,
            page=page,
            page_size=page_size,
        )
