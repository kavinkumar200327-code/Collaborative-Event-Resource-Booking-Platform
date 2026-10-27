
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_check():

    response = client.get("/health")

    assert response.status_code == 200

    response_data = response.json()

    assert response_data["status"] == "healthy"
    assert "application" in response_data


def test_root_endpoint():

    response = client.get("/")

    assert response.status_code == 200

    response_data = response.json()

    assert "message" in response_data
    assert "version" in response_data
    assert response_data["docs"] == "/docs"
    assert response_data["health"] == "/health"


def test_health_check_response_content_type():

    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/json"
    )
