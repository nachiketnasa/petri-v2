from datetime import date, timedelta

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


def _signup_and_login(client: TestClient, email: str = "user@example.com", password: str = "pw12345"):
    client.post(
        "/auth/signup",
        json={"email": email, "password": password, "display_name": "User"},
    )
    response = client.post("/auth/login", json={"email": email, "password": password})
    return response.cookies["session_id"]


def _create_experiment(client: TestClient, token: str, **overrides):
    payload = {
        "title": "Morning runs",
        "hypothesis": "Running before work improves focus",
        "cadence_type": "daily",
        "target_days": 7,
    }
    payload.update(overrides)
    response = client.post("/experiments", cookies={"session_id": token}, json=payload)
    assert response.status_code == 201
    return response.json()


def test_active_experiment_transitions_to_reflect_once_target_days_has_elapsed(client: TestClient):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=10))  # 10 days in, target_days=7
    experiment = _create_experiment(client, token, start_date=old_start)
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["status"] == "reflect"


def test_active_experiment_stays_active_before_target_days_elapses(client: TestClient):
    token = _signup_and_login(client)
    recent_start = str(date.today() - timedelta(days=2))  # 2 days in, target_days=7
    experiment = _create_experiment(client, token, start_date=recent_start)
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["status"] == "active"


def test_reflect_transition_is_persisted_not_recomputed_back_to_active(
    client: TestClient, repo: InMemoryRepository
):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=10))
    experiment = _create_experiment(client, token, start_date=old_start)
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})
    client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    stored = repo.get_experiment(experiment_id=experiment["id"], user_id=experiment["user_id"])
    assert stored.status == "reflect"


def test_reflect_transition_applies_in_list_experiments_too(client: TestClient):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=10))
    experiment = _create_experiment(client, token, start_date=old_start, title="Due for reflect")
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    response = client.get("/experiments", cookies={"session_id": token})

    by_title = {e["title"]: e["status"] for e in response.json()}
    assert by_title["Due for reflect"] == "reflect"


def test_a_reflect_experiment_can_still_be_archived_directly(client: TestClient):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=10))
    experiment = _create_experiment(client, token, start_date=old_start)
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})
    client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})  # triggers reflect

    response = client.post(
        f"/experiments/{experiment['id']}/archive",
        cookies={"session_id": token},
        json={"what_worked": "a", "what_didnt": "b", "decision": "continue"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "archived"


def test_backlog_experiment_is_unaffected_by_the_transition(client: TestClient):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=10))
    experiment = _create_experiment(client, token, start_date=old_start)  # never activated

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["status"] == "backlog"
