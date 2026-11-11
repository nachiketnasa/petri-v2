import pyotp
import pytest
from fastapi.testclient import TestClient

from petri_backend.app import _email_verifications, app, get_repository
from petri_backend.repository_memory import InMemoryRepository


@pytest.fixture(autouse=True)
def _clear_module_state():
    _email_verifications.clear()


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


def _enroll_and_confirm(client: TestClient, token: str) -> list[str]:
    enroll = client.post("/auth/2fa/enroll", cookies={"session_id": token})
    secret = enroll.json()["secret"]
    code = pyotp.TOTP(secret).now()
    confirm = client.post(
        "/auth/2fa/confirm", cookies={"session_id": token}, json={"code": code}
    )
    return confirm.json()["recovery_codes"]


def test_enroll_returns_a_secret_and_an_otpauth_uri_without_enabling_2fa_yet(
    client: TestClient,
):
    token = _signup_and_login(client)

    response = client.post("/auth/2fa/enroll", cookies={"session_id": token})

    assert response.status_code == 200
    body = response.json()
    assert len(body["secret"]) > 0
    assert body["otpauth_uri"].startswith("otpauth://totp/")
    me = client.get("/auth/me", cookies={"session_id": token}).json()
    assert me["totp_enabled"] is False


def test_confirm_with_a_valid_code_enables_2fa_and_returns_recovery_codes(client: TestClient):
    token = _signup_and_login(client)
    enroll = client.post("/auth/2fa/enroll", cookies={"session_id": token})
    secret = enroll.json()["secret"]

    response = client.post(
        "/auth/2fa/confirm",
        cookies={"session_id": token},
        json={"code": pyotp.TOTP(secret).now()},
    )

    assert response.status_code == 200
    codes = response.json()["recovery_codes"]
    assert len(codes) == 8
    assert len(set(codes)) == 8  # all unique
    me = client.get("/auth/me", cookies={"session_id": token}).json()
    assert me["totp_enabled"] is True


def test_confirm_with_a_wrong_code_does_not_enable_2fa(client: TestClient):
    token = _signup_and_login(client)
    client.post("/auth/2fa/enroll", cookies={"session_id": token})

    response = client.post(
        "/auth/2fa/confirm", cookies={"session_id": token}, json={"code": "000000"}
    )

    assert response.status_code == 400
    me = client.get("/auth/me", cookies={"session_id": token}).json()
    assert me["totp_enabled"] is False


def test_login_requires_a_totp_code_once_2fa_is_enabled(client: TestClient):
    token = _signup_and_login(client, email="user@example.com", password="pw12345")
    _enroll_and_confirm(client, token)

    response = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "pw12345"}
    )

    assert response.status_code == 428
    assert response.json() == {"detail": "TOTP code required."}


def test_login_succeeds_with_a_valid_totp_code(client: TestClient):
    token = _signup_and_login(client, email="user@example.com", password="pw12345")
    enroll = client.post("/auth/2fa/enroll", cookies={"session_id": token})
    secret = enroll.json()["secret"]
    client.post("/auth/2fa/confirm", cookies={"session_id": token}, json={"code": pyotp.TOTP(secret).now()})

    response = client.post(
        "/auth/login",
        json={
            "email": "user@example.com",
            "password": "pw12345",
            "totp_code": pyotp.TOTP(secret).now(),
        },
    )

    assert response.status_code == 200
    assert "session_id" in response.cookies


def test_login_fails_with_a_wrong_totp_code(client: TestClient):
    token = _signup_and_login(client, email="user@example.com", password="pw12345")
    _enroll_and_confirm(client, token)

    response = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "pw12345", "totp_code": "000000"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password."}


def test_login_succeeds_with_a_recovery_code_and_consumes_it(client: TestClient):
    token = _signup_and_login(client, email="user@example.com", password="pw12345")
    recovery_codes = _enroll_and_confirm(client, token)
    first_code = recovery_codes[0]

    response = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "pw12345", "totp_code": first_code},
    )
    assert response.status_code == 200

    # Using the same recovery code again fails -- it's one-time use.
    second_attempt = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "pw12345", "totp_code": first_code},
    )
    assert second_attempt.status_code == 401


def test_disabling_2fa_allows_login_without_a_code_again(client: TestClient):
    token = _signup_and_login(client, email="user@example.com", password="pw12345")
    _enroll_and_confirm(client, token)

    disable_response = client.post("/auth/2fa/disable", cookies={"session_id": token})
    assert disable_response.status_code == 204

    response = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "pw12345"}
    )

    assert response.status_code == 200
    me = client.get("/auth/me", cookies={"session_id": response.cookies["session_id"]}).json()
    assert me["totp_enabled"] is False


def test_2fa_endpoints_require_authentication(client: TestClient):
    assert client.post("/auth/2fa/enroll").status_code == 401
    assert client.post("/auth/2fa/confirm", json={"code": "123456"}).status_code == 401
    assert client.post("/auth/2fa/disable").status_code == 401
