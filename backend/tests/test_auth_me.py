import pytest
from fastapi.testclient import TestClient

from petri_backend.app import _email_verifications, app, get_repository
from petri_backend.repository_memory import InMemoryRepository


@pytest.fixture
def repo():
    return InMemoryRepository()


@pytest.fixture
def client(repo: InMemoryRepository):
    app.dependency_overrides[get_repository] = lambda: repo
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _signup_and_login(client: TestClient, email: str = "user@example.com", password: str = "pw12345"):
    signup_response = client.post(
        "/auth/signup",
        json={"email": email, "password": password, "display_name": "User"},
    )
    user_id = signup_response.json()["id"]
    code = next(c for c, (uid, _exp) in _email_verifications.items() if uid == user_id)
    client.post("/auth/verify-email", json={"code": code})
    response = client.post("/auth/login", json={"email": email, "password": password})
    return response.cookies["session_id"]


def test_me_returns_the_signed_in_user(client: TestClient):
    token = _signup_and_login(client, email="user@example.com")

    response = client.get("/auth/me", cookies={"session_id": token})

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "user@example.com"
    assert body["display_name"] == "User"
    assert "id" in body and "timezone" in body and "created_at" in body
    assert "password_hash" not in body


def test_me_without_valid_session_returns_401(client: TestClient):
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated."}

    response = client.get("/auth/me", cookies={"session_id": "not-a-real-token"})

    assert response.status_code == 401


def test_me_only_returns_the_requesting_users_own_data(client: TestClient):
    token_a = _signup_and_login(client, email="a@example.com")
    _signup_and_login(client, email="b@example.com")

    response = client.get("/auth/me", cookies={"session_id": token_a})

    assert response.json()["email"] == "a@example.com"
