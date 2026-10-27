
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


class OrganizationRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        organization_data: OrganizationCreate,
    ) -> Organization:

        organization = Organization(
            **organization_data.model_dump()
        )

        self.db.add(organization)
        self.db.commit()
        self.db.refresh(organization)

        return organization

    def get_by_id(
        self,
        organization_id: str,
    ) -> Organization | None:

        statement = select(Organization).where(
            Organization.id == organization_id
        )

        return self.db.scalar(statement)

    def get_by_slug(
        self,
        slug: str,
    ) -> Organization | None:

        statement = select(Organization).where(
            Organization.slug == slug.strip().lower()
        )

        return self.db.scalar(statement)

    def get_all(
        self,
        page: int = 1,
        page_size: int = 10,
        active_only: bool = True,
    ) -> tuple[list[Organization], int]:

        statement = select(Organization)

        count_statement = select(func.count()).select_from(
            Organization
        )

        if active_only:
            statement = statement.where(
                Organization.is_active.is_(True)
            )
            count_statement = count_statement.where(
                Organization.is_active.is_(True)
            )

        statement = (
            statement
            .order_by(Organization.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        organizations = list(self.db.scalars(statement).all())
        total = self.db.scalar(count_statement) or 0

        return organizations, total

    def update(
        self,
        organization: Organization,
        organization_data: OrganizationUpdate,
    ) -> Organization:

        update_data = organization_data.model_dump(
            exclude_unset=True
        )

        for field, value in update_data.items():
            setattr(organization, field, value)

        self.db.commit()
        self.db.refresh(organization)

        return organization

    def delete(
        self,
        organization: Organization,
    ) -> None:

        self.db.delete(organization)
        self.db.commit()

    def exists_by_slug(
        self,
        slug: str,
        exclude_id: str | None = None,
    ) -> bool:

        statement = select(Organization.id).where(
            Organization.slug == slug.strip().lower()
        )

        if exclude_id is not None:
            statement = statement.where(
                Organization.id != exclude_id
            )

        return self.db.scalar(statement) is not None
