import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.event import Event
from app.models.resource import Resource
from app.models.speaker import Speaker


def create_setup(db: Session):
    owner = User(
        full_name="Session Owner",
        email=f"owner_{uuid.uuid4().hex[:6]}@example.com",
        hash_password="hashed_pwd",
        role="admin",
    )
    db.add(owner)
    db.flush()

    org = Organization(name="Sess Org", slug=f"sess-org-{uuid.uuid4().hex[:6]}", is_active=True)
    db.add(org)
    db.flush()

    mem = OrganizationMember(organization_id=org.id, user_id=owner.id, role="admin", is_active=True)
    db.add(mem)

    now = datetime.now(timezone.utc)
    event_start = now + timedelta(days=5, hours=9)  # 09:00
    event_end = now + timedelta(days=5, hours=18)   # 18:00

    event = Event(
        organization_id=org.id,
        title="Full Day Tech Summit",
        starts_at=event_start,
        ends_at=event_end,
        capacity=100,
        status="published",
        created_by=owner.id,
    )
    db.add(event)
    db.flush()

    room = Resource(
        organization_id=org.id,
        name="Auditorium B",
        type="conference_hall",
        capacity=50,
        status="active",
    )
    db.add(room)
    db.flush()

    speaker = Speaker(
        organization_id=org.id,
        name="Dr. Jane Smith",
        email="jane.smith@example.com",
        bio="Keynote speaker on Distributed Systems",
    )
    db.add(speaker)
    db.commit()

    return owner, org, event, room, speaker


def user_headers(user: User) -> dict:
    from app.core.security import create_access_token
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def test_speaker_crud(client: TestClient, db: Session):
    owner, org, event, room, speaker = create_setup(db)
    headers = user_headers(owner)

    # List speakers
    list_resp = client.get(f"/api/v1/speakers?organization_id={org.id}", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Update speaker
    patch_resp = client.patch(f"/api/v1/speakers/{speaker.id}", json={"bio": "Updated bio"}, headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["bio"] == "Updated bio"


def test_session_validations_and_conflicts(client: TestClient, db: Session):
    owner, org, event, room, speaker = create_setup(db)
    headers = user_headers(owner)

    # 1. Validation: Session cannot exist outside event time (08:00 vs event start 09:00)
    outside_payload = {
        "event_id": event.id,
        "title": "Early Bird Session",
        "start_time": (event.starts_at - timedelta(hours=1)).isoformat(),
        "end_time": (event.starts_at + timedelta(hours=1)).isoformat(),
        "capacity": 30,
    }
    resp_out = client.post("/api/v1/sessions", json=outside_payload, headers=headers)
    assert resp_out.status_code == 400
    assert resp_out.json()["error"]["code"] == "SESSION_OUTSIDE_EVENT"

    # 2. Validation: Session capacity cannot exceed room capacity (room.capacity = 50, session = 60)
    excess_capacity_payload = {
        "event_id": event.id,
        "title": "Oversubscribed Session",
        "room_id": room.id,
        "start_time": (event.starts_at + timedelta(hours=1)).isoformat(),
        "end_time": (event.starts_at + timedelta(hours=2)).isoformat(),
        "capacity": 60,
    }
    resp_cap = client.post("/api/v1/sessions", json=excess_capacity_payload, headers=headers)
    assert resp_cap.status_code == 400
    assert resp_cap.json()["error"]["code"] == "SESSION_CAPACITY_EXCEEDED"

    # 3. Create Valid Session 1: 10:00 -> 11:30 in room Auditorium B with Dr. Jane Smith
    session_1 = {
        "event_id": event.id,
        "title": "Keynote: Scalable Architecture",
        "room_id": room.id,
        "speaker_id": speaker.id,
        "start_time": (event.starts_at + timedelta(hours=1)).isoformat(),
        "end_time": (event.starts_at + timedelta(hours=2, minutes=30)).isoformat(),
        "capacity": 40,
    }
    resp1 = client.post("/api/v1/sessions", json=session_1, headers=headers)
    assert resp1.status_code == 201

    # 4. Validation: Room conflict (same room, overlapping 11:00 -> 12:00)
    room_conflict_payload = {
        "event_id": event.id,
        "title": "Conflicting Room Session",
        "room_id": room.id,
        "start_time": (event.starts_at + timedelta(hours=2)).isoformat(),
        "end_time": (event.starts_at + timedelta(hours=3)).isoformat(),
        "capacity": 30,
    }
    resp_rc = client.post("/api/v1/sessions", json=room_conflict_payload, headers=headers)
    assert resp_rc.status_code == 409
    assert resp_rc.json()["error"]["code"] == "SESSION_TIME_CONFLICT"

    # 5. Validation: Speaker conflict (different room or no room, same speaker, overlapping time)
    speaker_conflict_payload = {
        "event_id": event.id,
        "title": "Conflicting Speaker Session",
        "speaker_id": speaker.id,
        "start_time": (event.starts_at + timedelta(hours=1, minutes=30)).isoformat(),
        "end_time": (event.starts_at + timedelta(hours=2, minutes=45)).isoformat(),
        "capacity": 30,
    }
    resp_sc = client.post("/api/v1/sessions", json=speaker_conflict_payload, headers=headers)
    assert resp_sc.status_code == 409
    assert resp_sc.json()["error"]["code"] == "SPEAKER_TIME_CONFLICT"


def test_cancelled_event_cannot_receive_sessions(client: TestClient, db: Session):
    owner, org, event, room, speaker = create_setup(db)
    headers = user_headers(owner)

    event.status = "cancelled"
    db.commit()

    session_payload = {
        "event_id": event.id,
        "title": "Should Fail Session",
        "start_time": (event.starts_at + timedelta(hours=1)).isoformat(),
        "end_time": (event.starts_at + timedelta(hours=2)).isoformat(),
        "capacity": 20,
    }
    resp = client.post("/api/v1/sessions", json=session_payload, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "EVENT_CANCELLED"
