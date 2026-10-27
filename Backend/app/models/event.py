
import uuid

from datetime import datetime, timezone

from sqlalchemy import (
    String,
    Text,
    DateTime,
    Integer,
    ForeignKey,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"

    __table_args__ = (
        CheckConstraint(
            "capacity > 0",
            name="ck_event_capacity_positive",
        ),
        CheckConstraint(
            "ends_at > starts_at",
            name="ck_event_end_after_start",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    organization_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
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

    location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    capacity: Mapped[int] = mapped_column(
        Integer,
        default=100,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="draft",
        nullable=False,
        index=True,
    )

    created_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
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

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="events",
    )

    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
    )

    sessions = relationship("EventSession", back_populates="event", cascade="all, delete-orphan")
    registrations = relationship("Registration", back_populates="event", cascade="all, delete-orphan")
    waitlist_entries = relationship("WaitlistEntry", back_populates="event", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="event", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="event", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="event", cascade="all, delete-orphan")
    bookings = relationship("ResourceBooking", back_populates="event")

    def __repr__(self) -> str:
        return (
            f"<Event("
            f"id={self.id!r}, "
            f"title={self.title!r}, "
            f"organization_id={self.organization_id!r}, "
            f"status={self.status!r})>"
        )
