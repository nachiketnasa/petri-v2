from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

import petri_backend.app as app_module
from petri_backend.app import _session_id, app, get_repository
from _email_capture import sent_verification_codes
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
    code = sent_verification_codes[email]
    client.post("/auth/verify-email", json={"code": code})
    response = client.post("/auth/login", json={"email": email, "password": password})
    # Raw header, not response.cookies: httpx drops a cookie whose Max-Age is
    # negative, which is what the backdated SESSION_TTL below produces.
    return response.headers["set-cookie"].split(";")[0].split("=", 1)[1]


def test_session_still_valid_before_ttl_expires(client: TestClient):
    token = _signup_and_login(client)

    response = client.get("/auth/me", cookies={"session_id": token})

    assert response.status_code == 200


def test_session_rejected_once_ttl_has_passed(
    client: TestClient, repo: InMemoryRepository, monkeypatch: pytest.MonkeyPatch
):
    # Backdate the session's expiry into the past instead of sleeping 30 days.
    monkeypatch.setattr(app_module, "SESSION_TTL", timedelta(seconds=-1))
    token = _signup_and_login(client)

    response = client.get("/auth/me", cookies={"session_id": token})

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated."}
    # Expired entry is cleaned up, not left to leak memory forever.
    assert _session_id(token) not in repo._sessions
