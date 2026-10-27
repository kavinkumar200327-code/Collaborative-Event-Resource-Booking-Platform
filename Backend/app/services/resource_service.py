from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import DomainException
from app.models.resource import Resource
from app.repositories.resource_repository import ResourceRepository
from app.schemas.resource import ResourceCreate, ResourceUpdate


class ResourceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ResourceRepository(db)

    def create_resource(self, resource_data: ResourceCreate) -> Resource:
        return self.repo.create(resource_data)

    def get_resource(self, resource_id: str) -> Resource:
        resource = self.repo.get_by_id(resource_id)
        if not resource:
            raise DomainException.resource_not_found("Resource not found")
        return resource

    def list_resources(
        self,
        organization_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[list[Resource], int]:
        return self.repo.list(
            organization_id=organization_id,
            resource_type=resource_type,
            status=status_filter,
            search=search,
            page=page,
            page_size=page_size,
        )

    def update_resource(self, resource_id: str, data: ResourceUpdate) -> Resource:
        resource = self.get_resource(resource_id)
        return self.repo.update(resource, data)

    def set_status(self, resource_id: str, new_status: str) -> Resource:
        resource = self.get_resource(resource_id)
        resource.status = new_status
        self.db.commit()
        self.db.refresh(resource)
        return resource

    def delete_resource(self, resource_id: str) -> None:
        resource = self.get_resource(resource_id)
        self.repo.delete(resource)
