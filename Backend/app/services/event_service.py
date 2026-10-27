
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.event import Event
from app.repositories.event_repository import EventRepository
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventStatusUpdate,
)


class EventService:

    ALLOWED_STATUSES = {
        "draft",
        "published",
        "cancelled",
        "completed",
    }

    STATUS_TRANSITIONS = {
        "draft": {"published", "cancelled"},
        "published": {"cancelled", "completed"},
        "cancelled": set(),
        "completed": set(),
    }

    def __init__(self, db: Session):
        self.db = db

        self.event_repository = EventRepository(db)
        self.organization_repository = OrganizationRepository(db)

    def create_event(
        self,
        event_data: EventCreate,
        created_by: str,
    ) -> Event:

        self._ensure_organization_exists(
            event_data.organization_id
        )

        self._validate_event_dates(
            event_data.starts_at,
            event_data.ends_at,
        )

        self._validate_capacity(
            event_data.capacity
        )

        existing_event = (
            self.event_repository.exists_by_title(
                organization_id=event_data.organization_id,
                title=event_data.title,
            )
        )

        if existing_event:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An event with this title already exists in the organization",
            )

        try:
            event = self.event_repository.create(
                event_data=event_data,
                created_by=created_by,
            )

            # Notify organization admins if event is in draft state requiring review
            try:
                if event.status == "draft":
                    from app.models.user import User
                    from app.models.organization_member import OrganizationMember
                    from app.services.notification_service import NotificationService

                    notif_service = NotificationService(self.db)
                    admin_ids = set()
                    global_admins = self.db.query(User.id).filter(
                        User.role.in_(["admin", "super_admin"]),
                        User.is_active.is_(True),
                    ).all()
                    for row in global_admins:
                        admin_ids.add(row[0])

                    if event.organization_id:
                        org_admins = self.db.query(OrganizationMember.user_id).filter(
                            OrganizationMember.organization_id == event.organization_id,
                            OrganizationMember.role.in_(["admin", "org_admin"]),
                            OrganizationMember.is_active.is_(True),
                        ).all()
                        for row in org_admins:
                            admin_ids.add(row[0])

                    if isinstance(created_by, str) and created_by.isdigit():
                        admin_ids.discard(int(created_by))

                    creator_name = "An event manager"
                    if isinstance(created_by, str) and created_by.isdigit():
                        u = self.db.get(User, int(created_by))
                        if u:
                            creator_name = u.full_name or u.email

                    starts_str = event.starts_at.strftime('%b %d, %Y') if event.starts_at else "Upcoming"
                    for aid in admin_ids:
                        notif_service.create_notification(
                            user_id=aid,
                            type="event_approval_requested",
                            title="New Event Pending Approval",
                            message=f"{creator_name} created '{event.title}' scheduled for {starts_str}. Awaiting review & publishing.",
                            organization_id=event.organization_id,
                            event_id=event.id,
                            data={
                                "event_id": event.id,
                                "title": event.title,
                                "url": f"/organizations/{event.organization_id}",
                            },
                        )
            except Exception:
                pass

            return event

        except IntegrityError:
            self.db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to create event due to a database conflict",
            )

    def get_event(
        self,
        event_id: str,
        organization_id: str,
    ) -> Event:

        event = self.event_repository.get_by_id(
            event_id=event_id,
            organization_id=organization_id,
        )

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )

        return event

    def list_events(
        self,
        organization_id: str,
        page: int = 1,
        page_size: int = 10,
        status_filter: str | None = None,
        search: str | None = None,
    ) -> tuple[list[Event], int]:

        self._ensure_organization_exists(
            organization_id
        )

        self._validate_pagination(
            page,
            page_size,
        )

        if status_filter is not None:
            self._validate_status(
                status_filter
            )

        skip = (page - 1) * page_size

        events, total = (
            self.event_repository.get_by_organization(
                organization_id=organization_id,
                skip=skip,
                limit=page_size,
                status_filter=status_filter,
                search=search,
            )
        )

        return events, total

    def list_all_events(
        self,
        page: int = 1,
        page_size: int = 10,
        status_filter: str | None = None,
        search: str | None = None,
    ) -> tuple[list[Event], int]:

        self._validate_pagination(
            page,
            page_size,
        )

        if status_filter is not None:
            self._validate_status(
                status_filter
            )

        skip = (page - 1) * page_size

        events, total = (
            self.event_repository.get_all(
                skip=skip,
                limit=page_size,
                status_filter=status_filter,
                search=search,
            )
        )

        return events, total

    def update_event(
        self,
        event_id: str,
        organization_id: str,
        event_data: EventUpdate,
    ) -> Event:

        event = self.get_event(
            event_id=event_id,
            organization_id=organization_id,
        )

        self._ensure_organization_exists(
            organization_id
        )

        if event.status in {"cancelled", "completed"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancelled or completed events cannot be updated",
            )

        update_data = event_data.model_dump(
            exclude_unset=True
        )

        if not update_data:
            return event

        if "starts_at" in update_data or "ends_at" in update_data:
            starts_at = update_data.get(
                "starts_at",
                event.starts_at,
            )

            ends_at = update_data.get(
                "ends_at",
                event.ends_at,
            )

            self._validate_event_dates(
                starts_at,
                ends_at,
            )

        if "capacity" in update_data:
            self._validate_capacity(
                update_data["capacity"]
            )

        if "title" in update_data:

            existing_event = (
                self.event_repository.exists_by_title(
                    organization_id=organization_id,
                    title=update_data["title"],
                )
            )

            if (
                existing_event
                and update_data["title"] != event.title
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An event with this title already exists",
                )

        try:
            updated_event = (
                self.event_repository.update(
                    event=event,
                    event_data=event_data,
                )
            )

            return updated_event

        except IntegrityError:
            self.db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update event due to a database conflict",
            )

    def update_event_status(
        self,
        event_id: str,
        organization_id: str,
        status_data: EventStatusUpdate,
    ) -> Event:

        event = self.get_event(
            event_id=event_id,
            organization_id=organization_id,
        )

        new_status = status_data.status

        self._validate_status(
            new_status
        )

        if event.status == new_status:
            return event

        allowed_transitions = (
            self.STATUS_TRANSITIONS.get(
                event.status,
                set(),
            )
        )

        if new_status not in allowed_transitions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot change event status "
                    f"from '{event.status}' "
                    f"to '{new_status}'"
                ),
            )

        if new_status == "published":

            self._validate_event_dates(
                event.starts_at,
                event.ends_at,
            )

            self._validate_future_start(
                event.starts_at
            )

        if new_status == "completed":

            self._validate_event_end(
                event.ends_at
            )

        try:
            updated_event = (
                self.event_repository.update_status(
                    event=event,
                    new_status=new_status,
                )
            )

            return updated_event

        except IntegrityError:
            self.db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to update event status",
            )

    def delete_event(
        self,
        event_id: str,
        organization_id: str,
    ) -> None:

        event = self.get_event(
            event_id=event_id,
            organization_id=organization_id,
        )

        if event.status == "published":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Published events must be cancelled before deletion",
            )

        try:
            self.event_repository.delete(
                event
            )

        except IntegrityError:
            self.db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot delete event because related records exist",
            )

    def _ensure_organization_exists(
        self,
        organization_id: str,
    ) -> None:

        organization = (
            self.organization_repository.get_by_id(
                organization_id
            )
        )

        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found",
            )

        if not organization.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization is inactive",
            )

    @staticmethod
    def _validate_event_dates(
        starts_at: datetime,
        ends_at: datetime,
    ) -> None:

        if starts_at is None or ends_at is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event start and end dates are required",
            )

        s_at = starts_at if starts_at.tzinfo is not None else starts_at.replace(tzinfo=timezone.utc)
        e_at = ends_at if ends_at.tzinfo is not None else ends_at.replace(tzinfo=timezone.utc)

        if e_at <= s_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event end date must be after start date",
            )

    @staticmethod
    def _validate_future_start(
        starts_at: datetime,
    ) -> None:

        current_time = datetime.now(
            timezone.utc
        )

        s_at = starts_at if starts_at.tzinfo is not None else starts_at.replace(tzinfo=timezone.utc)
        if s_at <= current_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot publish an event that has already started",
            )

    @staticmethod
    def _validate_event_end(
        ends_at: datetime,
    ) -> None:

        current_time = datetime.now(
            timezone.utc
        )

        e_at = ends_at if ends_at.tzinfo is not None else ends_at.replace(tzinfo=timezone.utc)
        if e_at > current_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot complete an event before its end time",
            )

    @staticmethod
    def _validate_capacity(
        capacity: int | None,
    ) -> None:

        if capacity is not None and capacity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event capacity must be greater than zero",
            )

    def _validate_status(
        self,
        event_status: str,
    ) -> None:

        if event_status not in self.ALLOWED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid event status",
            )

    @staticmethod
    def _validate_pagination(
        page: int,
        page_size: int,
    ) -> None:

        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Page number must be greater than zero",
            )

        if page_size < 1 or page_size > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Page size must be between 1 and 100",
            )
