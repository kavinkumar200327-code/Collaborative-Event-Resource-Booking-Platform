from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    event_id: str
    session_id: Optional[str] = None
    content: str = Field(..., min_length=1, max_length=2000)
    parent_id: Optional[str] = None


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    session_id: Optional[str] = None
    user_id: int
    content: str
    parent_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CommentListResponse(BaseModel):
    items: list[CommentResponse]
    total: int
