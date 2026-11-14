from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from petri_backend.app import _session_id, app, get_repository
from petri_backend.repository_memory import InMemoryRepository
from petri_backend.security import hash_lookup_code

from _email_capture import sent_reset_tokens


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


def _signup(client: TestClient, email: str = "user@example.com", password: str = "pw12345"):
    client.post(
        "/auth/signup",
        json={"email": email, "password": password, "display_name": "User"},
    )


def _verify(repo: InMemoryRepository, email: str) -> None:
    user = repo.get_user_by_email(email=email)
    repo.update_user(user_id=user.id, email_verified_at=datetime.now(timezone.utc))


def test_forgot_password_registered_email_returns_ok_and_stores_token(
    client: TestClient, repo: InMemoryRepository, capsys
):
    _signup(client, email="user@example.com")

    response = client.post("/auth/forgot-password", json={"email": "user@example.com"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert len(repo._password_resets) == 1


def test_forgot_password_unregistered_email_returns_identical_ok_body(
    client: TestClient, repo: InMemoryRepository
):
    registered = client.post(
        "/auth/forgot-password", json={"email": "doesnotexist@example.com"}
    )

    assert registered.status_code == 200
    assert registered.json() == {"status": "ok"}
    assert len(repo._password_resets) == 0


def test_forgot_password_logs_token_only_for_registered_email(client: TestClient, capsys):
    _signup(client, email="user@example.com")

    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    out = capsys.readouterr().out
    assert "to=user@example.com" in out
    token = sent_reset_tokens["user@example.com"]
    assert token in out

    capsys.readouterr()  # clear
    client.post("/auth/forgot-password", json={"email": "unregistered@example.com"})
    out = capsys.readouterr().out
    assert out == ""


def test_reset_password_with_valid_token_updates_password_and_invalidates_sessions(
    client: TestClient, repo: InMemoryRepository,
):
    _signup(client, email="user@example.com", password="oldpassword")
    _verify(repo, "user@example.com")
    login_response = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "oldpassword"}
    )
    session_token = login_response.cookies["session_id"]
    assert repo.get_session_user_id(session_id=_session_id(session_token)) is not None

    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    reset_token = sent_reset_tokens["user@example.com"]

    response = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "password": "newpassword"},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    # Old password no longer works.
    old_login = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "oldpassword"}
    )
    assert old_login.status_code == 401

    # New password works.
    new_login = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "newpassword"}
    )
    assert new_login.status_code == 200

    # Old session is gone.
    assert repo.get_session_user_id(session_id=_session_id(session_token)) is None
    assert client.get("/auth/me", cookies={"session_id": session_token}).status_code == 401


def test_reset_password_with_unknown_token_returns_generic_400(client: TestClient):
    response = client.post(
        "/auth/reset-password", json={"token": "never-issued", "password": "newpassword"}
    )
    assert response.status_code == 400
    assert "detail" in response.json()


def test_reset_password_with_expired_token_returns_generic_400_and_no_change(
    client: TestClient, repo: InMemoryRepository,
):
    _signup(client, email="user@example.com", password="oldpassword")
    _verify(repo, "user@example.com")
    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    reset_token = sent_reset_tokens["user@example.com"]

    # Force expiry.
    token_hash = hash_lookup_code(reset_token)
    user_id, _ = repo._password_resets[token_hash]
    repo._password_resets[token_hash] = (
        user_id,
        datetime.now(timezone.utc) - timedelta(minutes=1),
    )

    response = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "password": "newpassword"},
    )
    assert response.status_code == 400

    old_login = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "oldpassword"}
    )
    assert old_login.status_code == 200


def test_reusing_a_consumed_token_returns_generic_400(client: TestClient):
    _signup(client, email="user@example.com", password="oldpassword")
    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    reset_token = sent_reset_tokens["user@example.com"]

    first = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "password": "newpassword"},
    )
    assert first.status_code == 200

    second = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "password": "anotherpassword"},
    )
    assert second.status_code == 400


def test_forgot_password_missing_email_returns_400(client: TestClient):
    response = client.post("/auth/forgot-password", json={})
    assert response.status_code == 400


def test_reset_password_missing_fields_returns_400(client: TestClient):
    response = client.post("/auth/reset-password", json={"token": "x"})
    assert response.status_code == 400

    response = client.post("/auth/reset-password", json={"password": "x"})
    assert response.status_code == 400
