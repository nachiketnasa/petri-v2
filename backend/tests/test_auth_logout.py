import pytest
from fastapi.testclient import TestClient

from petri_backend.app import _sessions, app, get_repository
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
    client.post(
        "/auth/signup",
        json={"email": email, "password": password, "display_name": "User"},
    )
    response = client.post("/auth/login", json={"email": email, "password": password})
    return response.cookies["session_id"]


def test_logout_success_removes_session_and_clears_cookie(client: TestClient):
    token = _signup_and_login(client)
    assert token in _sessions

    response = client.post("/auth/logout", cookies={"session_id": token})

    assert response.status_code == 204
    assert response.content == b""
    assert token not in _sessions
    # Set-Cookie header clears the cookie (expired / empty value).
    set_cookie = response.headers.get("set-cookie", "")
    assert "session_id" in set_cookie


def test_logout_without_valid_session_returns_401(client: TestClient):
    response = client.post("/auth/logout")

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated."}

    response = client.post("/auth/logout", cookies={"session_id": "not-a-real-token"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated."}


def test_replaying_stale_cookie_after_logout_returns_401(client: TestClient):
    token = _signup_and_login(client)

    logout_response = client.post("/auth/logout", cookies={"session_id": token})
    assert logout_response.status_code == 204

    replay_response = client.post("/auth/logout", cookies={"session_id": token})

    assert replay_response.status_code == 401
    assert replay_response.json() == {"detail": "Not authenticated."}
