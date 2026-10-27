from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.resource import (
    ResourceCreate,
    ResourceUpdate,
    ResourceResponse,
    ResourceListResponse,
)
from app.services.resource_service import ResourceService

router = APIRouter(
    prefix="/resources",
    tags=["Resources"],
)


@router.post(
    "",
    response_model=ResourceResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/",
    response_model=ResourceResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_resource(
    resource_data: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ResourceService(db)
    return service.create_resource(resource_data)


@router.get(
    "",
    response_model=ResourceListResponse,
)
@router.get(
    "/",
    response_model=ResourceListResponse,
    include_in_schema=False,
)
def list_resources(
    organization_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ResourceService(db)
    items, total = service.list_resources(
        organization_id=organization_id,
        resource_type=resource_type,
        status_filter=status,
        search=search,
        page=page,
        page_size=page_size,
    )
    return ResourceListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{resource_id}",
    response_model=ResourceResponse,
)
def get_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ResourceService(db)
    return service.get_resource(resource_id)


@router.patch(
    "/{resource_id}",
    response_model=ResourceResponse,
)
def update_resource(
    resource_id: str,
    data: ResourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ResourceService(db)
    return service.update_resource(resource_id, data)


@router.patch(
    "/{resource_id}/activate",
    response_model=ResourceResponse,
)
def activate_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ResourceService(db)
    return service.set_status(resource_id, "active")


@router.patch(
    "/{resource_id}/deactivate",
    response_model=ResourceResponse,
)
def deactivate_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ResourceService(db)
    return service.set_status(resource_id, "inactive")


@router.delete(
    "/{resource_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ResourceService(db)
    service.delete_resource(resource_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
