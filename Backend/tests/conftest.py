import os

os.environ.setdefault(
    "DATABASE_URL",
    "sqlite:///./test_collaborative_booking.db",
)

os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-only-secret-key-for-collaborative-booking-platform",
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app

TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args = {"check_same_thread" : False},
    poolclass = StaticPool,
)

TestingSessionLocal = sessionmaker(
    bind = test_engine,
    autoflush = False,
    autocommit = False,
)

@pytest.fixture(scope = "function")
def db_session():

    Base.metadata.create_all(bind = test_engine)
    db = TestingSessionLocal()

    try:
        yield db

    finally:
        db.close()
        Base.metadata.drop_all(bind = test_engine)

@pytest.fixture(scope = "function")
def client(db_session):
    def override_get_db():

        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()

@pytest.fixture(scope = "function")
def registered_user(client):

    user_data = {
        "full_name" : "Test User",
        "email" : "testuser@example.com",
        "password" : "TestPassword123!",
    }

    response = client.post(
        "/api/v1/auth/register",
        json = user_data,
    )

    assert response.status_code == 201, response.text

    return {
        **user_data,
        "response" : response.json(),
    }

@pytest.fixture(scope = "function")
def authenticated_user(client, registered_user):

    response = client.post(
        "/api/v1/auth/login",
        json = {
            "email" : registered_user["email"],
            "password" : registered_user["password"],
        },
    )

    assert response.status_code == 200, response.text

    token_data = response.json()

    return {
        "user" : token_data["user"],
        "access_token" : token_data["access_token"],
        "refresh_token" : token_data["refresh_token"],
        "headers" : {
            "Authorization" : f"Bearer {token_data['access_token']}",
        },
    }

@pytest.fixture(scope="function")
def test_user(db_session, authenticated_user):
    from app.models.user import User
    user_id = authenticated_user["user"]["id"]
    return db_session.get(User, user_id)

@pytest.fixture(scope="function")
def auth_headers(authenticated_user):
    return authenticated_user["headers"]

@pytest.fixture(scope="function")
def db(db_session):
    return db_session
