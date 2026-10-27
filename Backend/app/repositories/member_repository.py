
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.organization_member import OrganizationMember
from app.schemas.member import MemberCreate, MemberUpdate


class MemberRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        organization_id: str,
        member_data: MemberCreate,
    ) -> OrganizationMember:

        member = OrganizationMember(
            organization_id=organization_id,
            user_id=member_data.user_id,
            role=member_data.role,
        )

        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)

        return member

    def get_by_id(
        self,
        member_id: str,
    ) -> OrganizationMember | None:

        statement = select(OrganizationMember).where(
            OrganizationMember.id == member_id
        )

        return self.db.scalar(statement)

    def get_by_user_and_organization(
        self,
        user_id: str,
        organization_id: str,
    ) -> OrganizationMember | None:

        statement = select(OrganizationMember).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id == organization_id,
        )

        return self.db.scalar(statement)

    def get_by_organization(
        self,
        organization_id: str,
        page: int = 1,
        page_size: int = 10,
        active_only: bool = True,
    ) -> tuple[list[OrganizationMember], int]:

        statement = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id
        )

        count_statement = select(func.count()).select_from(
            OrganizationMember
        ).where(
            OrganizationMember.organization_id == organization_id
        )

        if active_only:
            statement = statement.where(
                OrganizationMember.is_active.is_(True)
            )
            count_statement = count_statement.where(
                OrganizationMember.is_active.is_(True)
            )

        statement = (
            statement
            .order_by(OrganizationMember.joined_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        members = list(self.db.scalars(statement).all())
        total = self.db.scalar(count_statement) or 0

        return members, total

    def update(
        self,
        member: OrganizationMember,
        member_data: MemberUpdate,
    ) -> OrganizationMember:

        update_data = member_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if value is not None:
                setattr(member, field, value)

        self.db.commit()
        self.db.refresh(member)

        return member

    def delete(
        self,
        member: OrganizationMember,
    ) -> None:

        self.db.delete(member)
        self.db.commit()

    def exists(
        self,
        user_id: str,
        organization_id: str,
    ) -> bool:

        statement = select(OrganizationMember.id).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id == organization_id,
        )

        return self.db.scalar(statement) is not None

    def get_by_organization_and_role(
        self,
        organization_id: str,
        role: str,
        page: int = 1,
        page_size: int = 10,
        active_only: bool = True,
    ) -> tuple[list[OrganizationMember], int]:

        filters = [
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.role == role,
        ]

        if active_only:
            filters.append(OrganizationMember.is_active.is_(True))

        statement = (
            select(OrganizationMember)
            .where(*filters)
            .order_by(OrganizationMember.joined_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        count_statement = (
            select(func.count())
            .select_from(OrganizationMember)
            .where(*filters)
        )

        members = list(self.db.scalars(statement).all())
        total = self.db.scalar(count_statement) or 0

        return members, total
