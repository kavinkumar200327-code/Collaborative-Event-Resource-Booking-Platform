import io
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.event import Event
from app.models.registration import Registration
from app.models.notification import Notification


def create_user(db: Session, email_prefix: str = "misc-user") -> User:
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


def user_headers(user: User) -> dict:
    from app.core.security import create_access_token
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def test_attendance_and_export(client: TestClient, db: Session):
    owner = create_user(db, "att-owner")
    headers = user_headers(owner)

    org = Organization(name="Att Org", slug=f"att-org-{uuid.uuid4().hex[:6]}", is_active=True)
    db.add(org)
    db.flush()

    event = Event(
        organization_id=org.id,
        title="Check-in Event",
        starts_at=datetime.now(timezone.utc) + timedelta(days=1),
        ends_at=datetime.now(timezone.utc) + timedelta(days=1, hours=3),
        capacity=50,
        status="published",
        created_by=owner.id,
    )
    db.add(event)
    db.flush()

    attendee = create_user(db, "attendee-user")
    reg = Registration(event_id=event.id, user_id=attendee.id, status="confirmed")
    db.add(reg)
    db.commit()

    # Mark attendance
    mark_payload = {"user_id": attendee.id, "status": "attended"}
    resp = client.post(f"/api/v1/events/{event.id}/attendance", json=mark_payload, headers=headers)
    assert resp.status_code == 201
    att_id = resp.json()["id"]
    assert resp.json()["status"] == "attended"

    # List attendance
    list_resp = client.get(f"/api/v1/events/{event.id}/attendance", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # Export CSV
    csv_resp = client.get(f"/api/v1/events/{event.id}/attendance/export", headers=headers)
    assert csv_resp.status_code == 200
    assert "Attendance ID,Event ID,User ID,Status" in csv_resp.text
    assert str(attendee.id) in csv_resp.text


def test_file_upload_and_validation(client: TestClient, db: Session):
    user = create_user(db, "file-user")
    headers = user_headers(user)

    org = Organization(name="File Org", slug=f"file-org-{uuid.uuid4().hex[:6]}", is_active=True)
    db.add(org)
    db.commit()

    # 1. Valid PDF upload with magic bytes %PDF
    valid_pdf_bytes = b"%PDF-1.4\n%Fake PDF content for testing\n%%EOF"
    pdf_file = {"file": ("document.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")}
    resp_valid = client.post(
        "/api/v1/files/upload",
        data={"organization_id": org.id},
        files=pdf_file,
        headers=headers,
    )
    assert resp_valid.status_code == 201
    file_id = resp_valid.json()["id"]

    # Download file
    dl_resp = client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert dl_resp.status_code == 200
    assert dl_resp.content == valid_pdf_bytes

    # 2. Invalid content / magic byte spoofing (file named .png but content is random text)
    spoofed_file = {"file": ("malicious.png", io.BytesIO(b"NotAPNGImageFileContent"), "image/png")}
    resp_spoof = client.post(
        "/api/v1/files/upload",
        data={"organization_id": org.id},
        files=spoofed_file,
        headers=headers,
    )
    assert resp_spoof.status_code == 400
    assert resp_spoof.json()["error"]["code"] == "INVALID_FILE_TYPE"

    # 3. Invalid extension (.exe)
    exe_file = {"file": ("program.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")}
    resp_exe = client.post(
        "/api/v1/files/upload",
        data={"organization_id": org.id},
        files=exe_file,
        headers=headers,
    )
    assert resp_exe.status_code == 400
    assert resp_exe.json()["error"]["code"] == "INVALID_FILE_TYPE"


def test_comments_and_mention_notifications(client: TestClient, db: Session):
    author = create_user(db, "author-user")
    mentioned_user = create_user(db, "alice-target")
    author_headers = user_headers(author)
    target_headers = user_headers(mentioned_user)

    org = Organization(name="Comment Org", slug=f"cmt-org-{uuid.uuid4().hex[:6]}", is_active=True)
    db.add(org)
    db.flush()

    event = Event(
        organization_id=org.id,
        title="Discussion Event",
        starts_at=datetime.now(timezone.utc) + timedelta(days=2),
        ends_at=datetime.now(timezone.utc) + timedelta(days=2, hours=3),
        capacity=50,
        status="published",
        created_by=author.id,
    )
    db.add(event)
    db.commit()

    # Post comment with mention @{mentioned_user.email}
    comment_text = f"Hey @{mentioned_user.email.split('@')[0]} please review the slides for this session!"
    comment_payload = {
        "event_id": event.id,
        "content": comment_text,
    }
    resp = client.post("/api/v1/comments", json=comment_payload, headers=author_headers)
    assert resp.status_code == 201

    # Check that mentioned user received a notification
    notif_resp = client.get("/api/v1/notifications", headers=target_headers)
    assert notif_resp.status_code == 200
    notifs = notif_resp.json()["items"]
    assert any(n["type"] == "user_mentioned" for n in notifs)

    # Mark notification as read
    notif_id = notifs[0]["id"]
    read_resp = client.patch(f"/api/v1/notifications/{notif_id}/read", headers=target_headers)
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True


def test_dashboard_and_calendar_endpoints(client: TestClient, db: Session):
    user = create_user(db, "dash-user")
    user.role = "admin"
    db.commit()
    headers = user_headers(user)

    # Dashboard stats
    dash_resp = client.get("/api/v1/dashboard/stats", headers=headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "stats" in dash_data
    assert "role" in dash_data

    # Calendar events feed
    cal_resp = client.get("/api/v1/calendar/events", headers=headers)
    assert cal_resp.status_code == 200
    cal_data = cal_resp.json()
    assert "items" in cal_data
