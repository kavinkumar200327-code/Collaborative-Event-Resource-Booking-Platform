from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.repositories.member_repository import MemberRepository
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.member import MemberCreate, MemberUpdate


class MemberService:
    ALLOWED_ROLES = {"admin", "event_manager", "staff", "participant"}

    def __init__(self, db: Session):
        self.db = db
        self.member_repository = MemberRepository(db)
        self.organization_repository = OrganizationRepository(db)

    def add_member(
        self,
        organization_id: str,
        member_data: MemberCreate,
    ) -> OrganizationMember:
        organization = self.organization_repository.get_by_id(organization_id)
        if organization is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found.",
            )

        if not organization.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot add members to an inactive organization.",
            )

        if member_data.role not in self.ALLOWED_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid organization member role",
            )

        # Resolve target user
        target_user = None
        raw_uid = member_data.user_id
        if isinstance(raw_uid, int):
            target_user = self.db.get(User, raw_uid)
        elif isinstance(raw_uid, str) and raw_uid.isdigit():
            target_user = self.db.get(User, int(raw_uid))
        else:
            target_user = (
                self.db.query(User)
                .filter(User.email == str(raw_uid).lower())
                .first()
            )

        if target_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        existing_member = self.member_repository.get_by_user_and_organization(
            user_id=target_user.id,
            organization_id=organization_id,
        )

        if existing_member is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This user is already a member of the organization.",
            )

        try:
            member = OrganizationMember(
                organization_id=organization_id,
                user_id=target_user.id,
                role=member_data.role,
                is_active=True,
            )
            self.db.add(member)
            self.db.commit()
            self.db.refresh(member)
            return member
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The membership could not be created. Verify the user exists and is not already a member.",
            ) from exc

    def get_member(
        self,
        member_id: str,
        organization_id: Optional[str] = None,
    ) -> OrganizationMember:
        member = self.member_repository.get_by_id(member_id)

        if member is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization membership not found.",
            )

        if organization_id is not None and member.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization membership not found.",
            )

        return member

    def get_member_by_user(
        self,
        organization_id: str,
        user_id: int | str,
    ) -> OrganizationMember:
        uid = int(user_id) if str(user_id).isdigit() else user_id
        member = self.member_repository.get_by_user_and_organization(
            user_id=uid,
            organization_id=organization_id,
        )

        if member is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership not found in this organization.",
            )

        return member

    def list_members(
        self,
        organization_id: str,
        page: int = 1,
        page_size: int = 10,
        active_only: bool = True,
    ) -> tuple[list[OrganizationMember], int]:
        self._validate_pagination(page, page_size)
        self._ensure_organization_exists(organization_id)

        return self.member_repository.get_by_organization(
            organization_id=organization_id,
            page=page,
            page_size=page_size,
            active_only=active_only,
        )

    def list_members_by_role(
        self,
        organization_id: str,
        role: str,
        page: int = 1,
        page_size: int = 10,
        active_only: bool = True,
    ) -> list[OrganizationMember]:
        self._validate_pagination(page, page_size)

        if role not in self.ALLOWED_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid organization member role.",
            )

        self._ensure_organization_exists(organization_id)

        members, _ = self.member_repository.get_by_organization_and_role(
            organization_id=organization_id,
            role=role,
            page=page,
            page_size=page_size,
            active_only=active_only,
        )
        return members

    def update_member(
        self,
        member_id: str,
        member_data: MemberUpdate,
        organization_id: Optional[str] = None,
    ) -> OrganizationMember:
        member = self.get_member(member_id=member_id, organization_id=organization_id)

        update_data = member_data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update fields were provided.",
            )

        if (
            "role" in update_data
            and update_data["role"] is not None
            and update_data["role"] not in self.ALLOWED_ROLES
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid organization member role.",
            )

        for field in ("role", "is_active"):
            if field in update_data and update_data[field] is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{field} cannot be null.",
                )

        self._protect_last_active_admin(member, update_data)

        try:
            return self.member_repository.update(
                member=member,
                member_data=MemberUpdate(**update_data),
            )
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The membership update conflicts with existing records.",
            ) from exc

    def remove_member(
        self,
        member_id: str,
        organization_id: Optional[str] = None,
    ) -> None:
        member = self.get_member(member_id=member_id, organization_id=organization_id)

        self._protect_last_active_admin(
            member,
            {"is_active": False},
        )

        try:
            self.member_repository.delete(member)
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The membership cannot be removed because related records depend on it.",
            ) from exc

    def _ensure_organization_exists(
        self,
        organization_id: str,
    ) -> None:
        organization = self.organization_repository.get_by_id(organization_id)
        if organization is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found.",
            )

    def _validate_pagination(
        self,
        page: int,
        page_size: int,
    ) -> None:
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

    def _protect_last_active_admin(
        self,
        member: OrganizationMember,
        update_data: dict,
    ) -> None:
        removes_admin_access = (
            member.role == "admin"
            and member.is_active
            and (
                update_data.get("role", member.role) != "admin"
                or update_data.get("is_active", member.is_active) is False
            )
        )

        if not removes_admin_access:
            return

        statement = (
            select(OrganizationMember.id)
            .where(
                OrganizationMember.organization_id == member.organization_id,
                OrganizationMember.role == "admin",
                OrganizationMember.is_active.is_(True),
                OrganizationMember.id != member.id,
            )
            .limit(1)
        )

        another_admin_exists = self.db.scalar(statement) is not None

        if not another_admin_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove or deactivate the last active organization admin.",
            )
