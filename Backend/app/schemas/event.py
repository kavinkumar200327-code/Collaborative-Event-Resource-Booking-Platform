
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


EventStatus = Literal["draft", "published", "cancelled", "completed", "ongoing", "archived"]


class EventBase(BaseModel):
    title: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Title of the event",
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
        description="Description of the event",
    )

    location: str | None = Field(
        default=None,
        max_length=255,
        description="Physical venue or location of the event",
    )

    starts_at: datetime = Field(
        ...,
        description="Event start date and time",
    )

    ends_at: datetime = Field(
        ...,
        description="Event end date and time",
    )

    capacity: int = Field(
        default=100,
        gt=0,
        description="Maximum number of attendees",
    )

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()

        if len(value) < 2:
            raise ValueError("Event title must contain at least 2 characters.")

        return value

    @model_validator(mode="after")
    def validate_event_dates(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("Event end time must be after its start time.")

        return self


class EventCreate(EventBase):
    organization_id: str = Field(
        ...,
        min_length=1,
        max_length=36,
        description="ID of the organization that owns the event",
    )


class EventUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=2,
        max_length=200,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    location: str | None = Field(
        default=None,
        max_length=255,
    )

    starts_at: datetime | None = None

    ends_at: datetime | None = None

    capacity: int | None = Field(
        default=None,
        gt=0,
    )

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return value

        value = value.strip()

        if len(value) < 2:
            raise ValueError("Event title must contain at least 2 characters.")

        return value

    @model_validator(mode="after")
    def validate_event_dates(self):

        if (
            self.starts_at is not None
            and self.ends_at is not None
            and self.ends_at <= self.starts_at
        ):
            raise ValueError("Event end time must be after its start time.")

        return self


class EventStatusUpdate(BaseModel):
    status: EventStatus = Field(
        ...,
        description="New status of the event",
    )


class EventResponse(EventBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    status: EventStatus
    created_by: int | str
    created_at: datetime
    updated_at: datetime


class EventListResponse(BaseModel):
    items: list[EventResponse]
    total: int = Field(ge=0)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1)


class EventSearchParams(BaseModel):
    search: str | None = Field(
        default=None,
        max_length=200,
        description="Search events by title",
    )

    status: EventStatus | None = None

    page: int = Field(
        default=1,
        ge=1,
    )

    page_size: int = Field(
        default=10,
        ge=1,
        le=100,
    )
