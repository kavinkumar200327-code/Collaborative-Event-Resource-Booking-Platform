import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.resource import Resource


def create_user(db: Session, email_prefix: str = "book-user") -> User:
    uid = uuid.uuid4().hex[:8]
    user = User(
        full_name=f"User {uid}",
        email=f"{email_prefix}_{uid}@example.com",
        hash_password="hashed_pwd",
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def user_headers(client: TestClient, user: User) -> dict:
    from app.core.security import create_access_token
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def test_resource_crud(client: TestClient, db: Session):
    user = create_user(db, "res-owner")
    headers = user_headers(client, user)

    org = Organization(name="Test Org", slug=f"test-res-org-{uuid.uuid4().hex[:6]}", is_active=True)
    db.add(org)
    db.commit()

    # Create resource
    create_payload = {
        "organization_id": org.id,
        "name": "Conference Hall Alpha",
        "type": "conference_hall",
        "capacity": 200,
        "location": "Building 1, Floor 2",
    }
    resp = client.post("/api/v1/resources", json=create_payload, headers=headers)
    assert resp.status_code == 201
    res_id = resp.json()["id"]
    assert resp.json()["name"] == "Conference Hall Alpha"

    # List resources
    list_resp = client.get(f"/api/v1/resources?organization_id={org.id}", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Update resource
    patch_resp = client.patch(f"/api/v1/resources/{res_id}", json={"capacity": 250}, headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["capacity"] == 250

    # Deactivate & Activate
    deact_resp = client.patch(f"/api/v1/resources/{res_id}/deactivate", headers=headers)
    assert deact_resp.status_code == 200
    assert deact_resp.json()["status"] == "inactive"

    act_resp = client.patch(f"/api/v1/resources/{res_id}/activate", headers=headers)
    assert act_resp.status_code == 200
    assert act_resp.json()["status"] == "active"


def test_overlapping_booking_prevention(client: TestClient, db: Session):
    user = create_user(db, "book-tester")
    headers = user_headers(client, user)

    org = Organization(name="Book Org", slug=f"book-org-{uuid.uuid4().hex[:6]}", is_active=True)
    db.add(org)
    db.flush()

    res = Resource(
        organization_id=org.id,
        name="Room A",
        type="meeting_room",
        capacity=20,
        status="active",
    )
    db.add(res)
    db.commit()

    base_time = datetime.now(timezone.utc) + timedelta(days=3)
    # Existing booking: 10:00 -> 11:00
    t_10_00 = base_time.replace(hour=10, minute=0, second=0, microsecond=0)
    t_11_00 = base_time.replace(hour=11, minute=0, second=0, microsecond=0)

    booking_1 = {
        "resource_id": res.id,
        "start_time": t_10_00.isoformat(),
        "end_time": t_11_00.isoformat(),
        "purpose": "Morning Team Standup",
    }
    resp1 = client.post("/api/v1/bookings", json=booking_1, headers=headers)
    assert resp1.status_code == 201
    booking1_id = resp1.json()["id"]

    # Approve booking 1
    appr_resp = client.patch(f"/api/v1/bookings/{booking1_id}/approve", headers=headers)
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "approved"

    # Conflicting booking: 10:30 -> 11:30 (overlaps with 10:00 - 11:00)
    t_10_30 = base_time.replace(hour=10, minute=30, second=0, microsecond=0)
    t_11_30 = base_time.replace(hour=11, minute=30, second=0, microsecond=0)

    booking_conflict = {
        "resource_id": res.id,
        "start_time": t_10_30.isoformat(),
        "end_time": t_11_30.isoformat(),
        "purpose": "Overlapping Review Meeting",
    }
    resp_conflict = client.post("/api/v1/bookings", json=booking_conflict, headers=headers)
    assert resp_conflict.status_code == 409
    err = resp_conflict.json()["error"]
    assert err["code"] == "RESOURCE_ALREADY_BOOKED"
    assert "already booked" in err["message"]

    # Non-conflicting booking: 11:00 -> 12:00 (adjacent, not overlapping)
    t_12_00 = base_time.replace(hour=12, minute=0, second=0, microsecond=0)
    booking_valid = {
        "resource_id": res.id,
        "start_time": t_11_00.isoformat(),
        "end_time": t_12_00.isoformat(),
        "purpose": "Follow-up Meeting",
    }
    resp_valid = client.post("/api/v1/bookings", json=booking_valid, headers=headers)
    assert resp_valid.status_code == 201


def test_booking_cancel_and_reject(client: TestClient, db: Session):
    user = create_user(db, "book-cancel-tester")
    headers = user_headers(client, user)

    org = Organization(name="Book Org 2", slug=f"book-org-{uuid.uuid4().hex[:6]}", is_active=True)
    db.add(org)
    db.flush()

    res = Resource(organization_id=org.id, name="Projector 1", type="projector", status="active")
    db.add(res)
    db.commit()

    now = datetime.now(timezone.utc) + timedelta(days=5)
    booking_payload = {
        "resource_id": res.id,
        "start_time": (now + timedelta(hours=1)).isoformat(),
        "end_time": (now + timedelta(hours=3)).isoformat(),
        "purpose": "Demo Session",
    }
    resp = client.post("/api/v1/bookings", json=booking_payload, headers=headers)
    b_id = resp.json()["id"]

    # Reject
    rej_resp = client.patch(f"/api/v1/bookings/{b_id}/reject", json={"status": "rejected", "rejection_reason": "Maintenance"}, headers=headers)
    assert rej_resp.status_code == 200
    assert rej_resp.json()["status"] == "rejected"

    # Cancel
    canc_resp = client.post(f"/api/v1/bookings/{b_id}/cancel", headers=headers)
    assert canc_resp.status_code == 200
    assert canc_resp.json()["status"] == "cancelled"
