from datetime import date, timedelta

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


def _create_experiment(client: TestClient, token: str, **overrides):
    payload = {
        "title": "Morning runs",
        "hypothesis": "Running before work improves focus",
        "cadence_type": "daily",
        "target_days": 30,
    }
    payload.update(overrides)
    response = client.post("/experiments", cookies={"session_id": token}, json=payload)
    assert response.status_code == 201
    return response.json()


def test_check_in_due_false_for_a_non_active_experiment(client: TestClient):
    token = _signup_and_login(client)
    experiment = _create_experiment(client, token)  # still backlog

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["check_in_due"] is False


def test_check_in_due_false_right_after_activating_with_todays_start_date(
    client: TestClient, repo: InMemoryRepository
):
    token = _signup_and_login(client)
    experiment = _create_experiment(client, token, start_date=str(date.today()))

    response = client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    assert response.json()["check_in_due"] is False


def test_check_in_due_true_for_an_active_daily_experiment_with_no_check_ins_past_start_date(
    client: TestClient,
):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=2))
    experiment = _create_experiment(client, token, start_date=old_start)
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["check_in_due"] is True


def test_check_in_due_false_right_after_logging_todays_check_in(client: TestClient):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=2))
    experiment = _create_experiment(client, token, start_date=old_start)
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    client.post(
        f"/experiments/{experiment['id']}/check-ins",
        cookies={"session_id": token},
        json={"value_bool": True},
    )

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["check_in_due"] is False


def test_check_in_due_respects_custom_cadence_days(client: TestClient):
    token = _signup_and_login(client)
    # custom, every 5 days: 2 days in is not due yet.
    recent_start = str(date.today() - timedelta(days=2))
    experiment = _create_experiment(
        client, token, cadence_type="custom", cadence_days=5, start_date=recent_start
    )
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["check_in_due"] is False


def test_list_experiments_includes_check_in_due_per_experiment(client: TestClient):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=2))
    due_experiment = _create_experiment(client, token, start_date=old_start, title="Due one")
    client.post(f"/experiments/{due_experiment['id']}/activate", cookies={"session_id": token})
    _create_experiment(client, token, title="Still backlog")

    response = client.get("/experiments", cookies={"session_id": token})

    by_title = {e["title"]: e["check_in_due"] for e in response.json()}
    assert by_title["Due one"] is True
    assert by_title["Still backlog"] is False
