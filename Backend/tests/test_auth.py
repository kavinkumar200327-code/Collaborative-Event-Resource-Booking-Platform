
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_register_user(registered_user):

    response_data = registered_user["response"]

    assert response_data["message"] == "User registered successfully"
    assert response_data["user"]["full_name"] == registered_user["full_name"]
    assert response_data["user"]["email"] == registered_user["email"]
    assert "hashed_password" not in response_data["user"]


def test_register_duplicate_email(client, registered_user):

    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Another User",
            "email": registered_user["email"],
            "password": "AnotherPassword123!",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email is already registered"


def test_register_invalid_email(client):

    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test User",
            "email": "invalid-email",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 422


def test_register_short_password(client):

    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test User",
            "email": "shortpass@example.com",
            "password": "123",
        },
    )

    assert response.status_code == 422


def test_login_success(client, registered_user):

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        },
    )

    assert response.status_code == 200

    response_data = response.json()

    assert response_data["token_type"] == "bearer"
    assert response_data["access_token"]
    assert response_data["refresh_token"]
    assert response_data["user"]["email"] == registered_user["email"]


def test_login_invalid_password(client, registered_user):

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_user["email"],
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_unknown_email(client):

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "unknown@example.com",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_refresh_token_success(client, authenticated_user):

    old_refresh_token = authenticated_user["refresh_token"]

    response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": old_refresh_token,
        },
    )

    assert response.status_code == 200

    response_data = response.json()

    assert response_data["access_token"]
    assert response_data["refresh_token"]
    assert response_data["token_type"] == "bearer"

    # Refresh tokens should rotate after successful use.
    assert response_data["refresh_token"] != old_refresh_token


def test_old_refresh_token_rejected_after_rotation(
    client,
    authenticated_user,
):

    old_refresh_token = authenticated_user["refresh_token"]

    first_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )

    assert first_response.status_code == 200

    second_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )

    assert second_response.status_code == 401


def test_refresh_invalid_token(client):

    response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": "invalid-refresh-token",
        },
    )

    assert response.status_code == 401


def test_logout_success(client, authenticated_user):

    refresh_token = authenticated_user["refresh_token"]

    response = client.post(
        "/api/v1/auth/logout",
        json={
            "refresh_token": refresh_token,
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"


def test_refresh_token_rejected_after_logout(
    client,
    authenticated_user,
):

    refresh_token = authenticated_user["refresh_token"]

    logout_response = client.post(
        "/api/v1/auth/logout",
        json={
            "refresh_token": refresh_token,
        },
    )

    assert logout_response.status_code == 200

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": refresh_token,
        },
    )

    assert refresh_response.status_code == 401
