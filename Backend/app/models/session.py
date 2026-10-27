import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EventSession(Base):
    __tablename__ = "event_sessions"

    __table_args__ = (
        CheckConstraint("end_time > start_time", name="ck_session_end_after_start"),
        CheckConstraint("capacity > 0", name="ck_session_capacity_positive"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    event_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    speaker_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("speakers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    room_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("resources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    capacity: Mapped[int] = mapped_column(
        Integer,
        default=50,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    event = relationship("Event", back_populates="sessions")
    speaker = relationship("Speaker", back_populates="sessions")
    room = relationship("Resource", back_populates="sessions")
    comments = relationship("Comment", back_populates="session", cascade="all, delete-orphan")
