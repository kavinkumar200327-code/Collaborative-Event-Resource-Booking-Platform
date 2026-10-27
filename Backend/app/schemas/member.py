from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

OrganizationRole = Literal["admin", "event_manager", "staff", "participant"]


class MemberUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str | None = None


class MemberBase(BaseModel):
    user_id: int | str | None = Field(
        default=None,
        description="ID of the user to add to the organization",
    )
    email: str | None = Field(
        default=None,
        description="Email of the user to add to the organization",
    )

    role: OrganizationRole = Field(
        default="staff",
        description="Role assigned to the organization member",
    )


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    role: OrganizationRole | None = Field(
        default=None,
        description="Updated organization role",
    )

    is_active: bool | None = Field(
        default=None,
        description="Whether the membership is active",
    )


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    user_id: int
    role: OrganizationRole
    is_active: bool
    joined_at: datetime
    updated_at: datetime
    user: MemberUserResponse | None = None


class MemberListResponse(BaseModel):
    items: list[MemberResponse]
    total: int = Field(ge=0)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1)
