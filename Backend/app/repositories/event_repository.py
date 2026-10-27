
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.models.event import Event
from app.schemas.event import EventCreate, EventUpdate


class EventRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        event_data: EventCreate,
        created_by: str,
    ) -> Event:

        event = Event(
            **event_data.model_dump(exclude={"organization_id"}),
            organization_id=event_data.organization_id,
            created_by=created_by,
        )

        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        return event

    def get_by_id(
        self,
        event_id: str,
        organization_id: str | None = None,
    ) -> Event | None:

        statement = select(Event).where(
            Event.id == event_id
        )

        if organization_id is not None:
            statement = statement.where(
                Event.organization_id == organization_id
            )

        return self.db.scalar(statement)

    def get_by_organization(
        self,
        organization_id: str,
        page: int = 1,
        page_size: int = 10,
        status: str | None = None,
        search: str | None = None,
        skip: int | None = None,
        limit: int | None = None,
        status_filter: str | None = None,
    ) -> tuple[list[Event], int]:

        filters = [
            Event.organization_id == organization_id
        ]

        effective_status = status_filter if status_filter is not None else status
        if effective_status is not None:
            filters.append(Event.status == effective_status)

        if search:
            search_term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Event.title.ilike(search_term),
                    Event.description.ilike(search_term),
                    Event.location.ilike(search_term),
                )
            )

        offset_val = skip if skip is not None else (page - 1) * page_size
        limit_val = limit if limit is not None else page_size

        statement = (
            select(Event)
            .where(*filters)
            .order_by(Event.starts_at.asc())
            .offset(offset_val)
            .limit(limit_val)
        )

        count_statement = (
            select(func.count())
            .select_from(Event)
            .where(*filters)
        )

        events = list(self.db.scalars(statement).all())
        total = self.db.scalar(count_statement) or 0

        return events, total

    def get_all(
        self,
        page: int = 1,
        page_size: int = 10,
        status: str | None = None,
        search: str | None = None,
        skip: int | None = None,
        limit: int | None = None,
        status_filter: str | None = None,
    ) -> tuple[list[Event], int]:

        filters = []

        effective_status = status_filter if status_filter is not None else status
        if effective_status is not None:
            filters.append(Event.status == effective_status)

        if search:
            search_term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Event.title.ilike(search_term),
                    Event.description.ilike(search_term),
                    Event.location.ilike(search_term),
                )
            )

        statement = select(Event).where(*filters)
        count_statement = select(func.count()).select_from(Event)

        if filters:
            count_statement = count_statement.where(*filters)

        offset_val = skip if skip is not None else (page - 1) * page_size
        limit_val = limit if limit is not None else page_size

        statement = (
            statement
            .order_by(Event.starts_at.asc())
            .offset(offset_val)
            .limit(limit_val)
        )

        events = list(self.db.scalars(statement).all())
        total = self.db.scalar(count_statement) or 0

        return events, total

    def update(
        self,
        event: Event,
        event_data: EventUpdate,
    ) -> Event:

        update_data = event_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(event, field, value)

        self.db.commit()
        self.db.refresh(event)

        return event

    def update_status(
        self,
        event: Event,
        status: str | None = None,
        new_status: str | None = None,
    ) -> Event:

        event.status = new_status if new_status is not None else status

        self.db.commit()
        self.db.refresh(event)

        return event

    def delete(
        self,
        event: Event,
    ) -> None:

        self.db.delete(event)
        self.db.commit()

    def exists_by_title(
        self,
        organization_id: str,
        title: str,
        exclude_id: str | None = None,
    ) -> bool:

        statement = select(Event.id).where(
            Event.organization_id == organization_id,
            func.lower(Event.title) == title.strip().lower(),
        )

        if exclude_id is not None:
            statement = statement.where(Event.id != exclude_id)

        return self.db.scalar(statement) is not None
