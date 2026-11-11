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


def test_me_includes_default_preferences(client: TestClient):
    token = _signup_and_login(client)

    response = client.get("/auth/me", cookies={"session_id": token})

    body = response.json()
    assert body["theme"] == "petri-light"
    assert body["sound_effects_enabled"] is True
    assert body["default_landing"] == "greeting"


def test_patch_users_me_updates_one_field_leaving_others_untouched(client: TestClient):
    token = _signup_and_login(client)

    response = client.patch(
        "/users/me", cookies={"session_id": token}, json={"theme": "solarized-dark"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["theme"] == "solarized-dark"
    assert body["sound_effects_enabled"] is True
    assert body["default_landing"] == "greeting"


def test_patch_users_me_updates_multiple_fields_at_once(client: TestClient):
    token = _signup_and_login(client)

    response = client.patch(
        "/users/me",
        cookies={"session_id": token},
        json={"sound_effects_enabled": False, "default_landing": "dashboard"},
    )

    body = response.json()
    assert body["sound_effects_enabled"] is False
    assert body["default_landing"] == "dashboard"


def test_patch_users_me_persists_across_a_subsequent_get(client: TestClient):
    token = _signup_and_login(client)
    client.patch("/users/me", cookies={"session_id": token}, json={"theme": "petri-dark"})

    response = client.get("/auth/me", cookies={"session_id": token})

    assert response.json()["theme"] == "petri-dark"


def test_patch_users_me_rejects_an_invalid_theme(client: TestClient):
    token = _signup_and_login(client)

    response = client.patch(
        "/users/me", cookies={"session_id": token}, json={"theme": "not-a-real-theme"}
    )

    assert response.status_code == 400


def test_patch_users_me_rejects_an_invalid_default_landing(client: TestClient):
    token = _signup_and_login(client)

    response = client.patch(
        "/users/me", cookies={"session_id": token}, json={"default_landing": "somewhere-else"}
    )

    assert response.status_code == 400


def test_patch_users_me_requires_authentication(client: TestClient):
    response = client.patch("/users/me", json={"theme": "petri-dark"})

    assert response.status_code == 401


def test_patch_users_me_only_ever_updates_the_callers_own_row(client: TestClient):
    token_a = _signup_and_login(client, email="a@example.com")
    token_b = _signup_and_login(client, email="b@example.com")

    client.patch("/users/me", cookies={"session_id": token_a}, json={"theme": "solarized-light"})

    response_b = client.get("/auth/me", cookies={"session_id": token_b})
    assert response_b.json()["theme"] == "petri-light"
