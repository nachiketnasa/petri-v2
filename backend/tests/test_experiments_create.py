from datetime import datetime, timezone

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


def test_create_experiment_success_with_all_fields(client: TestClient):
    token = _signup_and_login(client)

    response = client.post(
        "/experiments",
        cookies={"session_id": token},
        json={
            "title": "Morning runs",
            "hypothesis": "Running before work improves focus",
            "cadence_type": "daily",
            "cadence_days": 1,
            "check_in_kind": "rating",
            "start_date": "2026-01-01",
            "target_days": 30,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Morning runs"
    assert body["hypothesis"] == "Running before work improves focus"
    assert body["cadence_type"] == "daily"
    assert body["cadence_days"] == 1
    assert body["check_in_kind"] == "rating"
    assert body["start_date"] == "2026-01-01"
    assert body["target_days"] == 30
    assert body["status"] == "backlog"


@pytest.mark.parametrize(
    "payload",
    [
        {"hypothesis": "h", "cadence_type": "daily", "target_days": 10},
        {"title": "t", "cadence_type": "daily", "target_days": 10},
        {"title": "t", "hypothesis": "h", "target_days": 10},
        {"title": "t", "hypothesis": "h", "cadence_type": "daily"},
    ],
)
def test_create_experiment_missing_required_field_returns_400(
    client: TestClient, payload: dict
):
    token = _signup_and_login(client)

    response = client.post("/experiments", cookies={"session_id": token}, json=payload)

    assert response.status_code == 400


def test_create_experiment_custom_cadence_without_cadence_days_returns_400(
    client: TestClient, repo: InMemoryRepository
):
    token = _signup_and_login(client)

    response = client.post(
        "/experiments",
        cookies={"session_id": token},
        json={
            "title": "Custom thing",
            "hypothesis": "h",
            "cadence_type": "custom",
            "target_days": 10,
        },
    )

    assert response.status_code == 400
    assert repo.list_experiments(user_id=list(repo._users.values())[0].id) == []


def test_create_experiment_custom_cadence_with_days_succeeds(client: TestClient):
    token = _signup_and_login(client)

    response = client.post(
        "/experiments",
        cookies={"session_id": token},
        json={
            "title": "Custom thing",
            "hypothesis": "h",
            "cadence_type": "custom",
            "cadence_days": 3,
            "target_days": 10,
        },
    )

    assert response.status_code == 201
    assert response.json()["cadence_days"] == 3


def test_create_experiment_defaults_check_in_kind_to_boolean(client: TestClient):
    token = _signup_and_login(client)

    response = client.post(
        "/experiments",
        cookies={"session_id": token},
        json={
            "title": "No check-in kind given",
            "hypothesis": "h",
            "cadence_type": "weekly",
            "target_days": 20,
        },
    )

    assert response.status_code == 201
    assert response.json()["check_in_kind"] == "boolean"


def test_create_experiment_defaults_start_date_to_today(client: TestClient):
    token = _signup_and_login(client)

    response = client.post(
        "/experiments",
        cookies={"session_id": token},
        json={
            "title": "No start date given",
            "hypothesis": "h",
            "cadence_type": "weekly",
            "target_days": 20,
        },
    )

    assert response.status_code == 201
    assert response.json()["start_date"] == datetime.now(timezone.utc).date().isoformat()


def test_create_experiment_unauthenticated_returns_401(client: TestClient):
    response = client.post(
        "/experiments",
        json={
            "title": "t",
            "hypothesis": "h",
            "cadence_type": "daily",
            "target_days": 10,
        },
    )

    assert response.status_code == 401


def test_create_experiment_scoped_to_signed_in_user(
    client: TestClient, repo: InMemoryRepository
):
    token = _signup_and_login(client, email="owner@example.com")

    response = client.post(
        "/experiments",
        cookies={"session_id": token},
        json={
            "title": "Owned experiment",
            "hypothesis": "h",
            "cadence_type": "daily",
            "target_days": 10,
        },
    )
    assert response.status_code == 201
    experiment_id = response.json()["id"]

    owner = repo.get_user_by_email(email="owner@example.com")
    assert repo.get_experiment(experiment_id=experiment_id, user_id=owner.id) is not None

    other_user = repo.create_user(
        email="other@example.com",
        password_hash=None,
        display_name="Other",
    )
    assert (
        repo.get_experiment(experiment_id=experiment_id, user_id=other_user.id) is None
    )
