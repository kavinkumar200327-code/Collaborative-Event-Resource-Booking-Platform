from typing import Optional, Tuple
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.models.resource import Resource
from app.schemas.resource import ResourceCreate, ResourceUpdate


class ResourceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, resource_data: ResourceCreate) -> Resource:
        resource = Resource(**resource_data.model_dump())
        self.db.add(resource)
        self.db.commit()
        self.db.refresh(resource)
        return resource

    def get_by_id(self, resource_id: str) -> Optional[Resource]:
        return self.db.get(Resource, resource_id)

    def list(
        self,
        organization_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[list[Resource], int]:
        filters = []
        if organization_id:
            filters.append(Resource.organization_id == organization_id)
        if resource_type:
            filters.append(Resource.type == resource_type)
        if status:
            filters.append(Resource.status == status)
        if search:
            term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Resource.name.ilike(term),
                    Resource.description.ilike(term),
                    Resource.location.ilike(term),
                )
            )

        stmt = (
            select(Resource)
            .where(*filters)
            .order_by(Resource.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = select(func.count()).select_from(Resource).where(*filters)

        items = list(self.db.scalars(stmt).all())
        total = self.db.scalar(count_stmt) or 0
        return items, total

    def update(self, resource: Resource, data: ResourceUpdate) -> Resource:
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                if field == "is_active":
                    resource.status = "active" if value else "inactive"
                else:
                    setattr(resource, field, value)
        self.db.commit()
        self.db.refresh(resource)
        return resource

    def delete(self, resource: Resource) -> None:
        self.db.delete(resource)
        self.db.commit()
