from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Integer,
)

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

class RefreshToken(Base):

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key = True,
        index = True,
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete = "CASCADE"),
        nullable = False,
        index = True,
    )

    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique = True,
        index = True,
        nullable = False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone = True),
        nullable = False,
    )

    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default = False,
        nullable = False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone = True),
        default = lambda: datetime.now(timezone.utc),
        nullable = False,
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone = True),
        nullable = True,
    )

    user = relationship(
        "User",
        back_populates = "refresh_tokens",
    )
