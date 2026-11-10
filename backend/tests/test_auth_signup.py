import pytest
from fastapi.testclient import TestClient

from petri_backend.app import app, get_repository
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


def test_signup_returns_201_with_user_and_no_password_hash(client: TestClient):
    response = client.post(
        "/auth/signup",
        json={
            "email": "new@example.com",
            "password": "correct-horse",
            "display_name": "New User",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["display_name"] == "New User"
    assert body["timezone"] == "UTC"
    assert "id" in body and "created_at" in body
    assert "password_hash" not in body
    assert "password" not in body


def test_password_is_hashed_not_stored_plaintext(
    client: TestClient, repo: InMemoryRepository
):
    client.post(
        "/auth/signup",
        json={
            "email": "hash@example.com",
            "password": "my-plaintext-password",
            "display_name": "Hash Check",
        },
    )

    user = repo.get_user_by_email(email="hash@example.com")
    assert user is not None
    assert user.password_hash != "my-plaintext-password"
    assert "my-plaintext-password" not in user.password_hash


def test_duplicate_email_rejected_case_insensitive(client: TestClient):
    client.post(
        "/auth/signup",
        json={
            "email": "Dup@Example.com",
            "password": "pw12345",
            "display_name": "First",
        },
    )

    response = client.post(
        "/auth/signup",
        json={
            "email": "dup@example.com",
            "password": "different-pw",
            "display_name": "Second",
        },
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_duplicate_email_does_not_create_second_user(
    client: TestClient, repo: InMemoryRepository
):
    client.post(
        "/auth/signup",
        json={"email": "once@example.com", "password": "pw1", "display_name": "A"},
    )
    client.post(
        "/auth/signup",
        json={"email": "once@example.com", "password": "pw2", "display_name": "B"},
    )

    matches = [u for u in repo._users.values() if u.email.lower() == "once@example.com"]
    assert len(matches) == 1


@pytest.mark.parametrize(
    "payload",
    [
        {"password": "pw", "display_name": "No Email"},
        {"email": "a@example.com", "display_name": "No Password"},
        {"email": "a@example.com", "password": "pw"},
    ],
)
def test_signup_missing_required_field_returns_400(client: TestClient, payload: dict):
    response = client.post("/auth/signup", json=payload)

    assert response.status_code == 400
