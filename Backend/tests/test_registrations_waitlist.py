import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.event import Event
from app.models.registration import Registration, WaitlistEntry


def create_user(db: Session, email_prefix: str = "reg-user") -> User:
    uid = uuid.uuid4().hex[:8]
    user = User(
        full_name=f"User {uid}",
        email=f"{email_prefix}_{uid}@example.com",
        hash_password="hashed_pwd",
        role="participant",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_org_and_event(db: Session, capacity: int = 2) -> tuple[Organization, Event, User]:
    owner = create_user(db, "org-owner")
    org = Organization(
        name=f"Org {uuid.uuid4().hex[:6]}",
        slug=f"org-{uuid.uuid4().hex[:6]}",
        is_active=True,
    )
    db.add(org)
    db.flush()

    member = OrganizationMember(
        organization_id=org.id,
        user_id=owner.id,
        role="admin",
        is_active=True,
    )
    db.add(member)

    now = datetime.now(timezone.utc)
    event = Event(
        organization_id=org.id,
        title=f"Event {uuid.uuid4().hex[:6]}",
        starts_at=now + timedelta(days=2),
        ends_at=now + timedelta(days=2, hours=4),
        capacity=capacity,
        status="published",
        created_by=owner.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return org, event, owner


def user_headers(client: TestClient, user: User) -> dict:
    from app.core.security import create_access_token
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def test_registration_and_capacity_waitlist_promotion(client: TestClient, db: Session):
    # Event capacity = 2
    org, event, owner = create_org_and_event(db, capacity=2)

    user_a = create_user(db, "user-a")
    user_b = create_user(db, "user-b")
    user_c = create_user(db, "user-c")

    headers_a = user_headers(client, user_a)
    headers_b = user_headers(client, user_b)
    headers_c = user_headers(client, user_c)

    # 1. Participant A registers -> Confirmed
    resp_a = client.post(f"/api/v1/events/{event.id}/register", json={"notes": "Attending A"}, headers=headers_a)
    assert resp_a.status_code == 201
    data_a = resp_a.json()
    assert data_a["status"] == "confirmed"

    # 2. Participant B registers -> Confirmed (capacity 2 reached)
    resp_b = client.post(f"/api/v1/events/{event.id}/register", json={}, headers=headers_b)
    assert resp_b.status_code == 201
    data_b = resp_b.json()
    assert data_b["status"] == "confirmed"

    # 3. Participant C registers -> Waitlisted!
    resp_c = client.post(f"/api/v1/events/{event.id}/register", json={}, headers=headers_c)
    assert resp_c.status_code == 201
    data_c = resp_c.json()
    assert data_c["status"] == "waitlisted"

    # Verify waitlist entry created in DB
    wl_entry = db.query(WaitlistEntry).filter(WaitlistEntry.event_id == event.id, WaitlistEntry.user_id == user_c.id).first()
    assert wl_entry is not None
    assert wl_entry.status == "active"
    assert wl_entry.priority == 1

    # 4. Duplicate registration check: Participant A tries registering again -> 409
    resp_dup = client.post(f"/api/v1/events/{event.id}/register", json={}, headers=headers_a)
    assert resp_dup.status_code == 409
    assert resp_dup.json()["error"]["code"] == "DUPLICATE_REGISTRATION"

    # 5. Participant A cancels registration
    resp_cancel = client.post(f"/api/v1/registrations/{data_a['id']}/cancel", headers=headers_a)
    assert resp_cancel.status_code == 200
    assert resp_cancel.json()["status"] == "cancelled"

    # 6. Automatic Waitlist Promotion: Participant C should now be confirmed!
    db.expire_all()
    reg_c = db.query(Registration).filter(Registration.event_id == event.id, Registration.user_id == user_c.id).first()
    assert reg_c.status == "confirmed"

    wl_entry_c = db.query(WaitlistEntry).filter(WaitlistEntry.event_id == event.id, WaitlistEntry.user_id == user_c.id).first()
    assert wl_entry_c.status == "promoted"


def test_cannot_register_cancelled_event(client: TestClient, db: Session):
    org, event, owner = create_org_and_event(db, capacity=10)
    event.status = "cancelled"
    db.commit()

    user = create_user(db, "reg-cancel-test")
    headers = user_headers(client, user)

    resp = client.post(f"/api/v1/events/{event.id}/register", json={}, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "EVENT_CANCELLED"


def test_cannot_register_past_event(client: TestClient, db: Session):
    org, event, owner = create_org_and_event(db, capacity=10)
    event.starts_at = datetime.now(timezone.utc) - timedelta(hours=2)
    event.ends_at = datetime.now(timezone.utc) + timedelta(hours=2)
    db.commit()

    user = create_user(db, "past-event-user")
    headers = user_headers(client, user)

    resp = client.post(f"/api/v1/events/{event.id}/register", json={}, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "REGISTRATION_CLOSED"


def test_registration_listing_and_staff_approval(client: TestClient, db: Session):
    org, event, owner = create_org_and_event(db, capacity=10)
    user = create_user(db, "listing-user")
    headers = user_headers(client, user)

    reg_resp = client.post(f"/api/v1/events/{event.id}/register", json={}, headers=headers)
    reg_id = reg_resp.json()["id"]

    # Reject registration
    reject_resp = client.patch(f"/api/v1/registrations/{reg_id}/reject?reason=CapacityExceeded", headers=headers)
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "rejected"

    # Re-approve registration
    approve_resp = client.patch(f"/api/v1/registrations/{reg_id}/approve", headers=headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "confirmed"

    # List registrations
    list_resp = client.get(f"/api/v1/events/{event.id}/registrations", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1
