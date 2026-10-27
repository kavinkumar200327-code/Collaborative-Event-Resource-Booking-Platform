
import uuid

import pytest

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember

BASE_URL = "/api/v1/organizations"


def create_test_user(
    db: Session,
) -> User:

    unique_id = uuid.uuid4().hex[:12]

    user = User(
        full_name=f"Test Member {unique_id}",
        email=f"member-{unique_id}@example.com",
        hash_password="test-hash",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def create_test_organization(
    db: Session,
    owner: User,
) -> Organization:

    unique_id = uuid.uuid4().hex[:12]

    organization = Organization(
        name=f"Test Organization {unique_id}",
        slug=f"test-org-{unique_id}",
        description="Organization for member API tests",
        is_active=True,
    )

    db.add(organization)
    db.flush()

    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=owner.id,
        role="admin",
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
    is_active: bool = True,
) -> OrganizationMember:

    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=user.id,
        role=role,
        is_active=is_active,
    )

    db.add(membership)
    db.commit()
    db.refresh(membership)

    return membership


def member_url(
    organization_id: str,
) -> str:

    return f"{BASE_URL}/{organization_id}/members/"

def test_add_member(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    response = client.post(
        member_url(organization.id),
        json={
            "user_id": new_user.id,
            "role": "staff",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201

    data = response.json()

    assert data["organization_id"] == organization.id
    assert data["user_id"] == new_user.id
    assert data["role"] == "staff"
    assert data["is_active"] is True
    assert "id" in data

def test_add_event_manager(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    response = client.post(
        member_url(organization.id),
        json={
            "user_id": new_user.id,
            "role": "event_manager",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["role"] == "event_manager"

def test_add_duplicate_member(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    payload = {
        "user_id": new_user.id,
        "role": "staff",
    }

    first_response = client.post(
        member_url(organization.id),
        json=payload,
        headers=auth_headers,
    )

    assert first_response.status_code == 201

    second_response = client.post(
        member_url(organization.id),
        json=payload,
        headers=auth_headers,
    )

    assert second_response.status_code == 409

def test_add_nonexistent_user(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    response = client.post(
        member_url(organization.id),
        json={
            "user_id": str(uuid.uuid4()),
            "role": "staff",
        },
        headers=auth_headers,
    )

    assert response.status_code == 404

@pytest.mark.parametrize(
    "invalid_role",
    [
        "super_admin",
        "manager",
        "guest",
        "owner",
    ],
)
def test_add_member_invalid_role(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
    invalid_role: str,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    response = client.post(
        member_url(organization.id),
        json={
            "user_id": new_user.id,
            "role": invalid_role,
        },
        headers=auth_headers,
    )

    assert response.status_code == 422

def test_list_members(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    create_test_membership(
        db=db,
        organization=organization,
        user=new_user,
    )

    response = client.get(
        member_url(organization.id),
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data

    assert data["total"] >= 2

def test_list_members_pagination(
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
        member_url(organization.id),
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

def test_list_members_invalid_pagination(
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
        member_url(organization.id),
        params={
            "page": 0,
            "page_size": 10,
        },
        headers=auth_headers,
    )

    assert response.status_code == 422

def test_list_members_by_role(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    create_test_membership(
        db=db,
        organization=organization,
        user=new_user,
        role="staff",
    )

    response = client.get(
        f"{member_url(organization.id)}roles/staff",
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, list)
    assert all(
        member["role"] == "staff"
        for member in data
    )

def test_get_member(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    membership = create_test_membership(
        db=db,
        organization=organization,
        user=new_user,
    )

    response = client.get(
        f"{member_url(organization.id)}{membership.id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == membership.id

def test_get_member_not_found(
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
        f"{member_url(organization.id)}{uuid.uuid4()}",
        headers=auth_headers,
    )

    assert response.status_code == 404

def test_update_member_role(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    membership = create_test_membership(
        db=db,
        organization=organization,
        user=new_user,
        role="staff",
    )

    response = client.patch(
        f"{member_url(organization.id)}{membership.id}",
        json={
            "role": "event_manager",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["role"] == "event_manager"

def test_activate_member(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    membership = create_test_membership(
        db=db,
        organization=organization,
        user=new_user,
        is_active=False,
    )

    response = client.patch(
        f"{member_url(organization.id)}{membership.id}/activate",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is True

def test_deactivate_member(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    membership = create_test_membership(
        db=db,
        organization=organization,
        user=new_user,
    )

    response = client.patch(
        f"{member_url(organization.id)}{membership.id}/deactivate",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False

def test_remove_member(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    new_user = create_test_user(db)

    membership = create_test_membership(
        db=db,
        organization=organization,
        user=new_user,
    )

    response = client.delete(
        f"{member_url(organization.id)}{membership.id}",
        headers=auth_headers,
    )

    assert response.status_code == 204

    assert db.get(
        OrganizationMember,
        membership.id,
    ) is None

def test_cannot_remove_last_admin(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    admin_membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == organization.id,
            OrganizationMember.user_id == test_user.id,
        )
        .first()
    )

    response = client.delete(
        f"{member_url(organization.id)}{admin_membership.id}",
        headers=auth_headers,
    )

    assert response.status_code == 400

def test_cannot_deactivate_last_admin(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    admin_membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == organization.id,
            OrganizationMember.user_id == test_user.id,
        )
        .first()
    )

    response = client.patch(
        f"{member_url(organization.id)}{admin_membership.id}/deactivate",
        headers=auth_headers,
    )

    assert response.status_code == 400

def test_cannot_demote_last_admin(
    client: TestClient,
    db: Session,
    test_user: User,
    auth_headers: dict,
):

    organization = create_test_organization(
        db=db,
        owner=test_user,
    )

    admin_membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == organization.id,
            OrganizationMember.user_id == test_user.id,
        )
        .first()
    )

    response = client.patch(
        f"{member_url(organization.id)}{admin_membership.id}",
        json={
            "role": "staff",
        },
        headers=auth_headers,
    )

    assert response.status_code == 400

def test_members_unauthorized(
    client: TestClient,
):

    response = client.get(
        f"{BASE_URL}/{uuid.uuid4()}/members/",
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
        member_url(other_organization.id),
        headers=auth_headers,
    )

    assert response.status_code == 403

def test_cannot_access_member_from_other_organization(
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

    other_membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == other_organization.id,
            OrganizationMember.user_id == other_user.id,
        )
        .first()
    )

    response = client.get(
        f"{member_url(organization.id)}{other_membership.id}",
        headers=auth_headers,
    )

    assert response.status_code == 404
