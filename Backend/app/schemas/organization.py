
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class OrganizationBase(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Name of the organization",
    )

    slug: str = Field(
        ...,
        min_length=2,
        max_length=180,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="Unique URL-friendly organization identifier",
    )

    description: str | None = Field(
        default=None,
        max_length=2000,
        description="Description of the organization",
    )

    email: EmailStr | None = Field(
        default=None,
        description="Organization contact email",
    )

    phone: str | None = Field(
        default=None,
        min_length=7,
        max_length=20,
        description="Organization contact phone number",
    )

    address: str | None = Field(
        default=None,
        max_length=1000,
        description="Organization address",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if len(value) < 2:
            raise ValueError("Organization name must contain at least 2 characters.")

        return value

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        return value.strip().lower()


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    slug: str | None = Field(
        default=None,
        min_length=2,
        max_length=180,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )

    description: str | None = Field(
        default=None,
        max_length=2000,
    )

    email: EmailStr | None = None

    phone: str | None = Field(
        default=None,
        min_length=7,
        max_length=20,
    )

    address: str | None = Field(
        default=None,
        max_length=1000,
    )

    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value

        value = value.strip()

        if len(value) < 2:
            raise ValueError("Organization name must contain at least 2 characters.")

        return value

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        if value is None:
            return value

        return value.strip().lower()


class OrganizationResponse(OrganizationBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class OrganizationListResponse(BaseModel):
    items: list[OrganizationResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
