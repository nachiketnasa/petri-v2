import pytest
from fastapi.testclient import TestClient

from petri_backend.app import app, get_repository
from _email_capture import sent_verification_codes
from petri_backend.repository_memory import InMemoryRepository


@pytest.fixture
def client():
    repo = InMemoryRepository()
    app.dependency_overrides[get_repository] = lambda: repo
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _signup_login_logout(client: TestClient, email: str = "cookie@example.com"):
    """Returns the raw set-cookie headers of signup, login and logout."""
    signup = client.post(
        "/auth/signup",
        json={"email": email, "password": "pw12345", "display_name": "C"},
    )
    assert signup.status_code == 201
    client.post("/auth/verify-email", json={"code": sent_verification_codes[email]})
    login = client.post("/auth/login", json={"email": email, "password": "pw12345"})
    assert login.status_code == 200
    token = login.cookies["session_id"]
    client.cookies.clear()
    logout = client.post("/auth/logout", cookies={"session_id": token})
    assert logout.status_code == 204
    return (
        signup.headers["set-cookie"],
        login.headers["set-cookie"],
        logout.headers["set-cookie"],
    )


def _attrs(set_cookie: str) -> set[str]:
    return {part.strip() for part in set_cookie.split(";")[1:]}


def test_session_cookie_attributes_without_secure_on_http_origin(client, monkeypatch):
    monkeypatch.delenv("FRONTEND_ORIGIN", raising=False)
    signup, login, logout = _signup_login_logout(client)
    for header in (signup, login):
        assert {"HttpOnly", "Max-Age=2592000", "Path=/", "SameSite=lax"} <= _attrs(header)
        assert "Secure" not in _attrs(header)
    # (c) clearing cookie matches the one being cleared.
    assert {"HttpOnly", "Max-Age=0", "Path=/", "SameSite=lax"} <= _attrs(logout)
    assert "Secure" not in _attrs(logout)


def test_session_cookie_is_secure_on_https_origin(client, monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.test")
    signup, login, logout = _signup_login_logout(client)
    for header in (signup, login):
        assert {"HttpOnly", "Max-Age=2592000", "Path=/", "SameSite=lax", "Secure"} <= _attrs(header)
    assert {"HttpOnly", "Max-Age=0", "Path=/", "SameSite=lax", "Secure"} <= _attrs(logout)


def test_never_issued_cookie_is_401_not_500(client):
    response = client.get("/auth/me", cookies={"session_id": "garbage"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated."}
