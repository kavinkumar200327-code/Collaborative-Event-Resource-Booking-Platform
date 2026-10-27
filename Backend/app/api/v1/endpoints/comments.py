from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentListResponse,
)
from app.services.comment_service import CommentService

router = APIRouter(
    prefix="/comments",
    tags=["Comments & Discussions"],
)


@router.post(
    "",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def add_comment(
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommentService(db)
    return service.add_comment(
        event_id=data.event_id,
        user_id=current_user.id,
        content=data.content,
        session_id=data.session_id,
        parent_id=data.parent_id,
    )


@router.get(
    "",
    response_model=CommentListResponse,
)
@router.get(
    "/",
    response_model=CommentListResponse,
    include_in_schema=False,
)
def list_comments(
    event_id: str = Query(...),
    session_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommentService(db)
    items = service.list_comments(event_id=event_id, session_id=session_id)
    return CommentListResponse(items=items, total=len(items))


@router.patch(
    "/{comment_id}",
    response_model=CommentResponse,
)
def update_comment(
    comment_id: str,
    data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommentService(db)
    return service.update_comment(comment_id=comment_id, content=data.content, user_id=current_user.id)


@router.delete(
    "/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommentService(db)
    is_admin = current_user.role in ["super_admin", "admin"]
    service.delete_comment(comment_id=comment_id, user_id=current_user.id, is_admin=is_admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
