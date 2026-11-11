import pytest
from fastapi.testclient import TestClient

from petri_backend.app import app, get_repository
from petri_backend.repository_memory import InMemoryRepository
from petri_backend.security import hash_lookup_code

from _email_capture import sent_verification_codes


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
    return client.post(
        "/auth/signup",
        json={"email": email, "password": password, "display_name": "User"},
    )


def test_signup_generates_and_emails_a_verification_code(
    client: TestClient, repo: InMemoryRepository, capsys
):
    _signup(client)

    out = capsys.readouterr().out
    assert "Verify your Petri account" in out
    assert len(repo._email_verifications) == 1


def test_login_is_rejected_until_the_code_is_confirmed(client: TestClient):
    _signup(client, email="user@example.com", password="pw12345")

    response = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "pw12345"}
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Email not verified."}


def test_verifying_the_code_allows_login_afterward(client: TestClient):
    _signup(client, email="user@example.com", password="pw12345")
    code = sent_verification_codes["user@example.com"]

    verify_response = client.post("/auth/verify-email", json={"code": code})
    assert verify_response.status_code == 200
    assert verify_response.json() == {"status": "ok"}

    login_response = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "pw12345"}
    )
    assert login_response.status_code == 200


def test_verifying_does_not_sign_the_user_in(client: TestClient):
    _signup(client, email="user@example.com", password="pw12345")
    code = sent_verification_codes["user@example.com"]

    response = client.post("/auth/verify-email", json={"code": code})

    assert "session_id" not in response.cookies


def test_an_unknown_code_returns_generic_400(client: TestClient):
    response = client.post("/auth/verify-email", json={"code": "000000"})

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid or expired code."}


def test_reusing_a_consumed_code_returns_the_same_generic_400(client: TestClient):
    _signup(client, email="user@example.com", password="pw12345")
    code = sent_verification_codes["user@example.com"]
    first = client.post("/auth/verify-email", json={"code": code})
    assert first.status_code == 200

    second = client.post("/auth/verify-email", json={"code": code})

    assert second.status_code == 400
    assert second.json() == {"detail": "Invalid or expired code."}


def test_an_expired_code_returns_generic_400(client: TestClient, repo: InMemoryRepository):
    import datetime as dt

    _signup(client, email="user@example.com", password="pw12345")
    code = sent_verification_codes["user@example.com"]
    code_hash = hash_lookup_code(code)
    user_id, _expires_at = repo._email_verifications[code_hash]
    repo._email_verifications[code_hash] = (
        user_id,
        dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=1),
    )

    response = client.post("/auth/verify-email", json={"code": code})

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid or expired code."}
