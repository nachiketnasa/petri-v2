from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from petri_backend.app import _reset_tokens, _sessions, app, get_repository
from petri_backend.repository_memory import InMemoryRepository


@pytest.fixture(autouse=True)
def _clear_module_state():
    _sessions.clear()
    _reset_tokens.clear()


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


def test_forgot_password_registered_email_returns_ok_and_stores_token(
    client: TestClient, capsys
):
    _signup(client, email="user@example.com")

    response = client.post("/auth/forgot-password", json={"email": "user@example.com"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert len(_reset_tokens) == 1


def test_forgot_password_unregistered_email_returns_identical_ok_body(client: TestClient):
    registered = client.post(
        "/auth/forgot-password", json={"email": "doesnotexist@example.com"}
    )

    assert registered.status_code == 200
    assert registered.json() == {"status": "ok"}
    assert len(_reset_tokens) == 0


def test_forgot_password_logs_token_only_for_registered_email(client: TestClient, capsys):
    _signup(client, email="user@example.com")

    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    out = capsys.readouterr().out
    assert "to=user@example.com" in out
    token = list(_reset_tokens.keys())[0]
    assert token in out

    capsys.readouterr()  # clear
    client.post("/auth/forgot-password", json={"email": "unregistered@example.com"})
    out = capsys.readouterr().out
    assert out == ""


def test_reset_password_with_valid_token_updates_password_and_invalidates_sessions(
    client: TestClient,
):
    _signup(client, email="user@example.com", password="oldpassword")
    login_response = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "oldpassword"}
    )
    session_token = login_response.cookies["session_id"]
    assert session_token in _sessions

    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    reset_token = list(_reset_tokens.keys())[0]

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
    assert session_token not in _sessions


def test_reset_password_with_unknown_token_returns_generic_400(client: TestClient):
    response = client.post(
        "/auth/reset-password", json={"token": "never-issued", "password": "newpassword"}
    )
    assert response.status_code == 400
    assert "detail" in response.json()


def test_reset_password_with_expired_token_returns_generic_400_and_no_change(
    client: TestClient,
):
    _signup(client, email="user@example.com", password="oldpassword")
    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    reset_token = list(_reset_tokens.keys())[0]

    # Force expiry.
    user_id, _ = _reset_tokens[reset_token]
    _reset_tokens[reset_token] = (
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
    reset_token = list(_reset_tokens.keys())[0]

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
