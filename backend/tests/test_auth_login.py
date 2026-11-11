import pytest
from fastapi.testclient import TestClient

from petri_backend.app import app, get_current_user, get_repository
from petri_backend.repository_memory import InMemoryRepository
from petri_backend.security import hash_password


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
    from datetime import datetime, timezone

    user = repo.get_user_by_email(email=email)
    repo.update_user(user_id=user.id, email_verified_at=datetime.now(timezone.utc))


def test_login_success_sets_cookie_and_returns_user(client: TestClient, repo: InMemoryRepository):
    _signup(client, email="user@example.com", password="pw12345")
    _verify(repo, "user@example.com")

    response = client.post(
        "/auth/login", json={"email": "User@Example.com", "password": "pw12345"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "user@example.com"
    assert "password_hash" not in body
    assert "session_id" in response.cookies


def test_login_unknown_email_returns_generic_401(client: TestClient):
    response = client.post(
        "/auth/login", json={"email": "nobody@example.com", "password": "whatever"}
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password."}
    assert "session_id" not in response.cookies


def test_login_wrong_password_returns_same_generic_401(client: TestClient):
    _signup(client, email="user2@example.com", password="correct-pw")

    response = client.post(
        "/auth/login", json={"email": "user2@example.com", "password": "wrong-pw"}
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password."}
    assert "session_id" not in response.cookies


def test_login_with_no_password_hash_returns_401_not_500(
    client: TestClient, repo: InMemoryRepository
):
    repo.create_user(
        email="oauth@example.com", password_hash=None, display_name="OAuth User"
    )

    response = client.post(
        "/auth/login", json={"email": "oauth@example.com", "password": "anything"}
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password."}


def test_two_logins_both_stay_valid(client: TestClient, repo: InMemoryRepository):
    _signup(client, email="twice@example.com", password="pw12345")
    _verify(repo, "twice@example.com")

    first = client.post(
        "/auth/login", json={"email": "twice@example.com", "password": "pw12345"}
    )
    second = client.post(
        "/auth/login", json={"email": "twice@example.com", "password": "pw12345"}
    )

    first_token = first.cookies["session_id"]
    second_token = second.cookies["session_id"]
    assert first_token != second_token

    from starlette.requests import Request

    for token in (first_token, second_token):
        scope = {
            "type": "http",
            "headers": [(b"cookie", f"session_id={token}".encode())],
        }
        assert get_current_user(Request(scope), repository=repo).email == "twice@example.com"


def test_get_current_user_resolves_valid_session(
    client: TestClient, repo: InMemoryRepository
):
    user = repo.create_user(
        email="dep@example.com",
        password_hash=hash_password("pw"),
        display_name="Dep User",
    )
    _verify(repo, "dep@example.com")
    response = client.post(
        "/auth/login", json={"email": "dep@example.com", "password": "pw"}
    )
    token = response.cookies["session_id"]

    from starlette.requests import Request

    scope = {
        "type": "http",
        "headers": [(b"cookie", f"session_id={token}".encode())],
    }
    request = Request(scope)
    resolved = get_current_user(request, repository=repo)

    assert resolved.id == user.id


def test_get_current_user_raises_401_on_missing_or_invalid_session(
    repo: InMemoryRepository,
):
    from fastapi import HTTPException
    from starlette.requests import Request

    no_cookie_request = Request({"type": "http", "headers": []})
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(no_cookie_request, repository=repo)
    assert exc_info.value.status_code == 401

    bad_cookie_request = Request(
        {"type": "http", "headers": [(b"cookie", b"session_id=not-a-real-token")]}
    )
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(bad_cookie_request, repository=repo)
    assert exc_info.value.status_code == 401
