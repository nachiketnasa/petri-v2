from datetime import datetime, timezone

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


def _signup_and_login(client: TestClient, email: str, password: str = "pw12345"):
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
        "target_days": 30,
    }
    payload.update(overrides)
    response = client.post("/experiments", cookies={"session_id": token}, json=payload)
    assert response.status_code == 201
    return response.json()


def test_check_in_succeeds_on_active_experiment(client: TestClient, repo: InMemoryRepository):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    repo.update_experiment(
        experiment_id=experiment["id"], user_id=experiment["user_id"], status="active"
    )

    response = client.post(
        f"/experiments/{experiment['id']}/check-ins",
        cookies={"session_id": token},
        json={"value_bool": True, "note": "felt good"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["experiment_id"] == experiment["id"]
    assert body["value_bool"] is True
    assert body["note"] == "felt good"
    assert body["value_rating"] is None


@pytest.mark.parametrize("status", ["backlog", "reflect", "archived"])
def test_check_in_rejected_for_non_active_status(
    client: TestClient, repo: InMemoryRepository, status: str
):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    if status != "backlog":
        repo.update_experiment(
            experiment_id=experiment["id"], user_id=experiment["user_id"], status=status
        )

    response = client.post(
        f"/experiments/{experiment['id']}/check-ins",
        cookies={"session_id": token},
        json={},
    )
    assert response.status_code == 400


def test_check_in_404_identical_for_nonexistent_and_other_users_id(
    client: TestClient, repo: InMemoryRepository
):
    token_owner = _signup_and_login(client, email="owner@example.com")
    experiment = _create_experiment(client, token_owner)
    repo.update_experiment(
        experiment_id=experiment["id"], user_id=experiment["user_id"], status="active"
    )

    token_other = _signup_and_login(client, email="other@example.com")

    response_other_user = client.post(
        f"/experiments/{experiment['id']}/check-ins",
        cookies={"session_id": token_other},
        json={},
    )
    response_nonexistent = client.post(
        "/experiments/does-not-exist/check-ins",
        cookies={"session_id": token_other},
        json={},
    )

    assert response_other_user.status_code == 404
    assert response_nonexistent.status_code == 404
    assert response_other_user.json() == response_nonexistent.json()


def test_check_in_unauthenticated_returns_401(client: TestClient):
    response = client.post("/experiments/some-id/check-ins", json={})
    assert response.status_code == 401


def test_check_in_defaults_checked_in_at_to_utc_now(client: TestClient, repo: InMemoryRepository):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    repo.update_experiment(
        experiment_id=experiment["id"], user_id=experiment["user_id"], status="active"
    )

    before = datetime.now(timezone.utc)
    response = client.post(
        f"/experiments/{experiment['id']}/check-ins",
        cookies={"session_id": token},
        json={},
    )
    after = datetime.now(timezone.utc)

    assert response.status_code == 201
    checked_in_at = datetime.fromisoformat(response.json()["checked_in_at"])
    assert before <= checked_in_at <= after


def test_repository_add_check_in_raises_value_error_for_mismatched_user(
    repo: InMemoryRepository, client: TestClient
):
    # Repository-level confirmation of #14's documented behavior:
    # add_check_in raises ValueError when the experiment doesn't exist for
    # the given user (as opposed to the None-returning get_experiment).
    token_owner = _signup_and_login(client, email="owner@example.com")
    experiment = _create_experiment(client, token_owner)
    repo.update_experiment(
        experiment_id=experiment["id"], user_id=experiment["user_id"], status="active"
    )

    _signup_and_login(client, email="other@example.com")
    other_user = repo.get_user_by_email(email="other@example.com")

    with pytest.raises(ValueError):
        repo.add_check_in(
            experiment_id=experiment["id"],
            user_id=other_user.id,
            checked_in_at=datetime.now(timezone.utc),
        )


def test_check_in_route_maps_repository_value_error_to_404(
    client: TestClient, repo: InMemoryRepository, monkeypatch: pytest.MonkeyPatch
):
    # The route's get_experiment pre-check uses the identical existence/
    # ownership check as add_check_in's internal check, so a mismatched user
    # or nonexistent id never reaches add_check_in - that path is already
    # covered by the pre-check's own 404 tests. To actually drive execution
    # through the route's `except ValueError` branch, bypass the pre-check
    # by making add_check_in itself raise, for an experiment that *passes*
    # the pre-check (owned, active).
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    repo.update_experiment(
        experiment_id=experiment["id"], user_id=experiment["user_id"], status="active"
    )

    def _raise_value_error(**kwargs):
        raise ValueError("simulated repository failure")

    monkeypatch.setattr(repo, "add_check_in", _raise_value_error)

    response = client.post(
        f"/experiments/{experiment['id']}/check-ins",
        cookies={"session_id": token},
        json={},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Experiment not found."}
