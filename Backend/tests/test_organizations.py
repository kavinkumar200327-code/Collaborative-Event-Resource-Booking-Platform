
import uuid

import pytest

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember

def organization_payload(
    name: str = "Test Organization",
) -> dict:

    unique_id = uuid.uuid4().hex[:10]

    return {
        "name": name,
        "slug": f"test-organization-{unique_id}",
        "description": "Organization created for API testing",
        "email": f"organization-{unique_id}@example.com",
        "phone": "9876543210",
        "address": "Salem, Tamil Nadu",
    }


def create_test_organization(
    db: Session,
    user: User,
    role: str = "admin",
) -> Organization:

    data = organization_payload()

    organization = Organization(
        **data,
        is_active=True,
    )

    db.add(organization)
    db.flush()

    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=user.id,
        role=role,
        is_active=True,
    )

    db.add(membership)
    db.commit()
    db.refresh(organization)

    return organization


def add_test_member(
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

def test_create_organization(
    client: TestClient,
    auth_headers: dict,
):

    payload = organization_payload()

    response = client.post(
        "/api/v1/organizations/",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 201

    data = response.json()

    assert data["name"] == payload["name"]
    assert data["slug"] == payload["slug"]
    assert data["is_active"] is True
    assert "id" in data

def test_create_organization_duplicate_slug(
    client: TestClient,
    auth_headers: dict,
):

    payload = organization_payload()

    first_response = client.post(
        "/api/v1/organizations/",
        json=payload,
        headers=auth_headers,
    )

    assert first_response.status_code == 201

    second_response = client.post(
        "/api/v1/organizations/",
        json=payload,
        headers=auth_headers,
    )

    assert second_response.status_code == 409

def test_create_organization_unauthorized(
    client: TestClient,
):

    response = client.post(
        "/api/v1/organizations/",
        json=organization_payload(),
    )

    assert response.status_code == 401

@pytest.mark.parametrize(
    "invalid_data",
    [
        {
            "name": "",
            "slug": "invalid-organization",
        },
        {
            "name": "Invalid Organization",
            "slug": "INVALID SLUG",
        },
        {
            "name": "Invalid Organization",
            "slug": "valid-slug",
            "email": "invalid-email",
        },
    ],
)
def test_create_organization_invalid_data(
    client: TestClient,
    auth_headers: dict,
    invalid_data: dict,
):

    response = client.post(
        "/api/v1/organizations/",
        json=invalid_data,
        headers=auth_headers,
    )

    assert response.status_code == 422

def test_list_organizations(
    client: TestClient,
    auth_headers: dict,
):

    payload = organization_payload()

    create_response = client.post(
        "/api/v1/organizations/",
        json=payload,
        headers=auth_headers,
    )

    assert create_response.status_code == 201

    response = client.get(
        "/api/v1/organizations/",
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data

    assert data["total"] >= 1

def test_list_organizations_pagination(
    client: TestClient,
    auth_headers: dict,
):

    response = client.get(
        "/api/v1/organizations/",
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

def test_list_organizations_invalid_pagination(
    client: TestClient,
    auth_headers: dict,
):

    response = client.get(
        "/api/v1/organizations/",
        params={
            "page": 0,
            "page_size": 10,
        },
        headers=auth_headers,
    )

    assert response.status_code == 422

def test_get_organization(
    client: TestClient,
    auth_headers: dict,
):

    create_response = client.post(
        "/api/v1/organizations/",
        json=organization_payload(),
        headers=auth_headers,
    )

    assert create_response.status_code == 201

    organization_id = create_response.json()["id"]

    response = client.get(
        f"/api/v1/organizations/{organization_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200

    assert response.json()["id"] == organization_id

def test_get_organization_not_found(
    client: TestClient,
    auth_headers: dict,
):

    organization_id = str(uuid.uuid4())

    response = client.get(
        f"/api/v1/organizations/{organization_id}",
        headers=auth_headers,
    )

    assert response.status_code == 404

def test_update_organization(
    client: TestClient,
    auth_headers: dict,
):

    create_response = client.post(
        "/api/v1/organizations/",
        json=organization_payload(),
        headers=auth_headers,
    )

    assert create_response.status_code == 201

    organization_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/organizations/{organization_id}",
        json={
            "name": "Updated Organization Name",
            "description": "Updated organization description",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["name"] == "Updated Organization Name"
    assert data["description"] == "Updated organization description"

def test_update_organization_invalid_data(
    client: TestClient,
    auth_headers: dict,
):

    create_response = client.post(
        "/api/v1/organizations/",
        json=organization_payload(),
        headers=auth_headers,
    )

    organization_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/organizations/{organization_id}",
        json={
            "email": "invalid-email",
        },
        headers=auth_headers,
    )

    assert response.status_code == 422

def test_delete_organization(
    client: TestClient,
    auth_headers: dict,
):

    create_response = client.post(
        "/api/v1/organizations/",
        json=organization_payload(),
        headers=auth_headers,
    )

    assert create_response.status_code == 201

    organization_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/api/v1/organizations/{organization_id}",
        headers=auth_headers,
    )

    assert delete_response.status_code == 204

    get_response = client.get(
        f"/api/v1/organizations/{organization_id}",
        headers=auth_headers,
    )

    assert get_response.status_code == 404

def test_organization_member_can_view(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        user=test_user,
        role="staff",
    )

    response = client.get(
        f"/api/v1/organizations/{organization.id}",
        headers=auth_headers,
    )

    assert response.status_code == 200

def test_staff_cannot_update_organization(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        user=test_user,
        role="staff",
    )

    response = client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "name": "Unauthorized Update",
        },
        headers=auth_headers,
    )

    assert response.status_code == 403

def test_staff_cannot_delete_organization(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        user=test_user,
        role="staff",
    )

    response = client.delete(
        f"/api/v1/organizations/{organization.id}",
        headers=auth_headers,
    )

    assert response.status_code == 403

def test_inactive_member_cannot_access(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        user=test_user,
        role="staff",
    )

    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == organization.id,
            OrganizationMember.user_id == test_user.id,
        )
        .first()
    )

    membership.is_active = False

    db.commit()

    response = client.get(
        f"/api/v1/organizations/{organization.id}",
        headers=auth_headers,
    )

    assert response.status_code == 404

def test_cross_organization_access_denied(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    other_user = User(
        full_name="Other Organization Owner",
        email=f"other-{uuid.uuid4().hex[:10]}@example.com",
        hash_password="test-hash",
    )

    db.add(other_user)
    db.commit()
    db.refresh(other_user)

    organization = create_test_organization(
        db=db,
        user=other_user,
        role="admin",
    )

    response = client.get(
        f"/api/v1/organizations/{organization.id}",
        headers=auth_headers,
    )

    assert response.status_code == 404

def test_organization_list_isolation(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    other_user = User(
        full_name="Isolated Organization Owner",
        email=f"isolated-{uuid.uuid4().hex[:10]}@example.com",
        hash_password="test-hash",
    )

    db.add(other_user)
    db.commit()
    db.refresh(other_user)

    organization = create_test_organization(
        db=db,
        user=other_user,
        role="admin",
    )

    response = client.get(
        "/api/v1/organizations/",
        headers=auth_headers,
    )

    assert response.status_code == 200

    organization_ids = [
        item["id"]
        for item in response.json()["items"]
    ]

    assert organization.id not in organization_ids
