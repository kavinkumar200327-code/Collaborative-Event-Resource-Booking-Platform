from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

ResourceType = Literal["meeting_room", "conference_hall", "projector", "camera", "vehicle", "equipment"]
ResourceStatus = Literal["active", "maintenance", "inactive"]


class ResourceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    type: ResourceType = Field(default="meeting_room")
    description: Optional[str] = None
    location: Optional[str] = None
    capacity: int = Field(default=1, gt=0)
    status: ResourceStatus = Field(default="active")


class ResourceCreate(ResourceBase):
    organization_id: str


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ResourceType] = None
    description: Optional[str] = None
    location: Optional[str] = None
    capacity: Optional[int] = Field(default=None, gt=0)
    status: Optional[ResourceStatus] = None
    is_active: Optional[bool] = None


class ResourceResponse(ResourceBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class ResourceListResponse(BaseModel):
    items: list[ResourceResponse]
    total: int
    page: int = 1
    page_size: int = 10
