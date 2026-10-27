
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
)


class OrganizationService:

    def __init__(self, db: Session):
        self.repository = OrganizationRepository(db)

    def create_organization(
        self,
        organization_data: OrganizationCreate,
    ) -> Organization:

        slug = organization_data.slug.strip().lower()

        if self.repository.exists_by_slug(slug):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An organization with this slug already exists.",
            )

        try:
            return self.repository.create(
                organization_data.model_copy(
                    update={"slug": slug}
                )
            )
        except IntegrityError as exc:
            self.repository.db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The organization could not be created because of a conflicting record.",
            ) from exc

    def get_organization(
        self,
        organization_id: str,
    ) -> Organization:

        organization = self.repository.get_by_id(organization_id)

        if organization is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found.",
            )

        return organization

    def get_organization_by_slug(
        self,
        slug: str,
    ) -> Organization:

        organization = self.repository.get_by_slug(
            slug.strip().lower()
        )

        if organization is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found.",
            )

        return organization

    def list_organizations(
        self,
        page: int = 1,
        page_size: int = 10,
        active_only: bool = True,
    ) -> tuple[list[Organization], int]:

        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Page must be greater than or equal to 1.",
            )

        if not 1 <= page_size <= 100:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Page size must be between 1 and 100.",
            )

        return self.repository.get_all(
            page=page,
            page_size=page_size,
            active_only=active_only,
        )

    def update_organization(
        self,
        organization_id: str,
        organization_data: OrganizationUpdate,
    ) -> Organization:

        organization = self.get_organization(organization_id)

        update_data = organization_data.model_dump(
            exclude_unset=True
        )

        if "slug" in update_data and update_data["slug"] is not None:
            new_slug = update_data["slug"].strip().lower()

            if self.repository.exists_by_slug(
                new_slug,
                exclude_id=organization_id,
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An organization with this slug already exists.",
                )

            update_data["slug"] = new_slug

        # Prevent an explicitly supplied null from replacing required fields.
        for field in ("name", "slug", "is_active"):
            if field in update_data and update_data[field] is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{field} cannot be null.",
                )

        try:
            update_schema = OrganizationUpdate(**update_data)

            return self.repository.update(
                organization,
                update_schema,
            )
        except IntegrityError as exc:
            self.repository.db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The organization update conflicts with an existing record.",
            ) from exc

    def delete_organization(
        self,
        organization_id: str,
    ) -> None:

        organization = self.get_organization(organization_id)

        try:
            self.repository.delete(organization)
        except IntegrityError as exc:
            self.repository.db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The organization cannot be deleted because "
                    "related records prevent deletion."
                ),
            ) from exc
