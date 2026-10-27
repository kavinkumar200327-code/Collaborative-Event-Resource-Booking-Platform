
import uuid

from datetime import datetime, timedelta, timezone

import pytest

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.event import Event

BASE_URL = "/api/v1/organizations"

def create_test_user(
    db: Session,
) -> User:

    unique_id = uuid.uuid4().hex[:12]

    user = User(
        full_name=f"Event Test User {unique_id}",
        email=f"event-user-{unique_id}@example.com",
        hash_password="test-hash",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user

def create_test_organization(
    db: Session,
    owner: User,
    role: str = "admin",
) -> Organization:

    unique_id = uuid.uuid4().hex[:12]

    organization = Organization(
        name=f"Event Organization {unique_id}",
        slug=f"event-org-{unique_id}",
        description="Organization created for event testing",
        is_active=True,
    )

    db.add(organization)
    db.flush()

    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=owner.id,
        role=role,
        is_active=True,
    )

    db.add(membership)
    db.commit()
    db.refresh(organization)

    return organization

def create_test_membership(
    db: Session,
    organization: Organization,
    user: User,
    role: str = "staff",
) -> OrganizationMember:

    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=user.id,
        role=role,
        is_active=True,
    )

    db.add(membership)
    db.commit()
    db.refresh(membership)

    return membership

def event_payload(
    organization_id: str,
    title: str | None = None,
) -> dict:

    unique_id = uuid.uuid4().hex[:10]

    starts_at = datetime.now(
        timezone.utc
    ) + timedelta(days=7)

    ends_at = starts_at + timedelta(hours=3)

    return {
        "organization_id": organization_id,
        "title": title or f"Test Event {unique_id}",
        "description": "Event created for automated testing",
        "location": "Salem, Tamil Nadu",
        "starts_at": starts_at.isoformat(),
        "ends_at": ends_at.isoformat(),
        "capacity": 100,
    }

def event_url(
    organization_id: str,
) -> str:

    return f"{BASE_URL}/{organization_id}/events/"

def create_test_event(
    db: Session,
    organization: Organization,
    creator: User,
    event_status: str = "draft",
) -> Event:

    unique_id = uuid.uuid4().hex[:12]

    starts_at = datetime.now(
        timezone.utc
    ) + timedelta(days=7)

    ends_at = starts_at + timedelta(hours=3)

    event = Event(
        organization_id=organization.id,
        title=f"Database Event {unique_id}",
        description="Event created directly in the test database",
        location="Salem, Tamil Nadu",
        starts_at=starts_at,
        ends_at=ends_at,
        capacity=50,
        status=event_status,
        created_by=creator.id,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event

def test_create_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    payload = event_payload(
        organization.id
    )

    response = client.post(
        event_url(organization.id),
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 201

    data = response.json()

    assert data["organization_id"] == organization.id
    assert data["title"] == payload["title"]
    assert data["status"] == "draft"
    assert data["capacity"] == 100
    assert "id" in data

def test_event_manager_can_create_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
        role="event_manager",
    )

    response = client.post(
        event_url(organization.id),
        json=event_payload(organization.id),
        headers=auth_headers,
    )

    assert response.status_code == 201

def test_staff_cannot_create_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
        role="staff",
    )

    response = client.post(
        event_url(organization.id),
        json=event_payload(organization.id),
        headers=auth_headers,
    )

    assert response.status_code == 403

def test_create_duplicate_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    payload = event_payload(
        organization.id,
        title="Duplicate Event Title",
    )

    first_response = client.post(
        event_url(organization.id),
        json=payload,
        headers=auth_headers,
    )

    assert first_response.status_code == 201

    second_response = client.post(
        event_url(organization.id),
        json=payload,
        headers=auth_headers,
    )

    assert second_response.status_code == 409

def test_create_event_invalid_dates(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    payload = event_payload(
        organization.id
    )

    payload["ends_at"] = payload["starts_at"]

    response = client.post(
        event_url(organization.id),
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422

@pytest.mark.parametrize(
    "invalid_capacity",
    [
        0,
        -1,
        -100,
    ],
)
def test_create_event_invalid_capacity(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
    invalid_capacity: int,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    payload = event_payload(
        organization.id
    )

    payload["capacity"] = invalid_capacity

    response = client.post(
        event_url(organization.id),
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422

def test_create_event_organization_mismatch(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    payload = event_payload(
        str(uuid.uuid4())
    )

    response = client.post(
        event_url(organization.id),
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 400

def test_list_events(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
    )

    response = client.get(
        event_url(organization.id),
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data

    assert data["total"] >= 1

def test_list_events_pagination(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    response = client.get(
        event_url(organization.id),
        params={
            "page": 1,
            "page_size": 5,
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["page"] == 1
    assert data["page_size"] == 5
    assert len(data["items"]) <= 5

def test_list_events_invalid_pagination(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    response = client.get(
        event_url(organization.id),
        params={
            "page": 0,
            "page_size": 10,
        },
        headers=auth_headers,
    )

    assert response.status_code == 422

def test_search_events(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
    )

    response = client.get(
        event_url(organization.id),
        params={
            "search": event.title,
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert any(
        item["id"] == event.id
        for item in data["items"]
    )

def test_filter_events_by_status(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
        event_status="published",
    )

    response = client.get(
        event_url(organization.id),
        params={
            "status_filter": "published",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert all(
        item["status"] == "published"
        for item in data["items"]
    )

def test_get_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
    )

    response = client.get(
        f"{event_url(organization.id)}{event.id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == event.id

def test_get_event_not_found(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    response = client.get(
        f"{event_url(organization.id)}{uuid.uuid4()}",
        headers=auth_headers,
    )

    assert response.status_code == 404

def test_update_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
    )

    response = client.patch(
        f"{event_url(organization.id)}{event.id}",
        json={
            "title": "Updated Event Title",
            "description": "Updated event description",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["title"] == "Updated Event Title"
    assert data["description"] == "Updated event description"

def test_publish_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
    )

    response = client.patch(
        f"{event_url(organization.id)}{event.id}/publish",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "published"


def test_cancel_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
        event_status="published",
    )

    response = client.patch(
        f"{event_url(organization.id)}{event.id}/cancel",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_complete_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
        event_status="published",
    )
    event.starts_at = datetime.now(
        timezone.utc
    ) - timedelta(days=2)

    event.ends_at = datetime.now(
        timezone.utc
    ) - timedelta(days=1)

    db.commit()

    response = client.patch(
        f"{event_url(organization.id)}{event.id}/complete",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"

def test_invalid_event_status_transition(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
        event_status="cancelled",
    )

    response = client.patch(
        f"{event_url(organization.id)}{event.id}/publish",
        headers=auth_headers,
    )

    assert response.status_code == 400

def test_delete_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
    )

    response = client.delete(
        f"{event_url(organization.id)}{event.id}",
        headers=auth_headers,
    )

    assert response.status_code == 204

    assert db.get(
        Event,
        event.id,
    ) is None

def test_cannot_delete_published_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
        event_status="published",
    )

    response = client.delete(
        f"{event_url(organization.id)}{event.id}",
        headers=auth_headers,
    )

    assert response.status_code == 400

def test_staff_cannot_update_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
        role="staff",
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
    )

    response = client.patch(
        f"{event_url(organization.id)}{event.id}",
        json={
            "title": "Unauthorized Update",
        },
        headers=auth_headers,
    )

    assert response.status_code == 403

def test_event_manager_cannot_delete_event(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
        role="event_manager",
    )

    event = create_test_event(
        db=db,
        organization=organization,
        creator=test_user,
    )

    response = client.delete(
        f"{event_url(organization.id)}{event.id}",
        headers=auth_headers,
    )

    assert response.status_code == 403

def test_events_unauthorized(
    client: TestClient,
):

    response = client.get(
        event_url(str(uuid.uuid4()))
    )

    assert response.status_code == 401

def test_cross_organization_access_denied(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    other_user = create_test_user(db)

    other_organization = create_test_organization(
        db=db,
        owner=other_user,
    )

    response = client.get(
        event_url(other_organization.id),
        headers=auth_headers,
    )

    assert response.status_code == 403

def test_event_organization_isolation(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    other_user = create_test_user(db)

    other_organization = create_test_organization(
        db=db,
        owner=other_user,
    )

    other_event = create_test_event(
        db=db,
        organization=other_organization,
        creator=other_user,
    )

    response = client.get(
        f"{event_url(organization.id)}{other_event.id}",
        headers=auth_headers,
    )

    assert response.status_code == 404

def test_event_list_isolation(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    other_user = create_test_user(db)

    other_organization = create_test_organization(
        db=db,
        owner=other_user,
    )

    other_event = create_test_event(
        db=db,
        organization=other_organization,
        creator=other_user,
    )

    response = client.get(
        event_url(organization.id),
        headers=auth_headers,
    )

    assert response.status_code == 200

    event_ids = [
        item["id"]
        for item in response.json()["items"]
    ]

    assert other_event.id not in event_ids
