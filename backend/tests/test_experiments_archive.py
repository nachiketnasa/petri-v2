import pytest
from fastapi.testclient import TestClient

from petri_backend.app import app, get_repository
from _email_capture import sent_verification_codes
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
    signup_response = client.post(
        "/auth/signup",
        json={"email": email, "password": password, "display_name": "User"},
    )
    user_id = signup_response.json()["id"]
    code = sent_verification_codes[email]
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


def _make_active(repo: InMemoryRepository, experiment: dict):
    repo.update_experiment(
        experiment_id=experiment["id"], user_id=experiment["user_id"], status="active"
    )


def test_archive_via_retro_path_succeeds(client: TestClient, repo: InMemoryRepository):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    _make_active(repo, experiment)

    response = client.post(
        f"/experiments/{experiment['id']}/archive",
        cookies={"session_id": token},
        json={"what_worked": "a", "what_didnt": "b", "decision": "c"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "archived"
    assert body["ended_early"] is False
    assert body["abandon_reason"] is None
    assert body["archived_at"] is not None
    assert repo.get_retro(experiment_id=experiment["id"], user_id=experiment["user_id"]) is not None


def test_archive_via_abandon_path_succeeds(client: TestClient, repo: InMemoryRepository):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    _make_active(repo, experiment)

    response = client.post(
        f"/experiments/{experiment['id']}/archive",
        cookies={"session_id": token},
        json={"abandon_reason": "lost motivation"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "archived"
    assert body["ended_early"] is True
    assert body["abandon_reason"] == "lost motivation"
    assert body["archived_at"] is not None
    assert repo.get_retro(experiment_id=experiment["id"], user_id=experiment["user_id"]) is None


@pytest.mark.parametrize("status", ["backlog", "archived"])
def test_archive_rejected_for_non_active_reflect_status(
    client: TestClient, repo: InMemoryRepository, status: str
):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    if status != "backlog":
        repo.update_experiment(
            experiment_id=experiment["id"], user_id=experiment["user_id"], status=status
        )

    response = client.post(
        f"/experiments/{experiment['id']}/archive",
        cookies={"session_id": token},
        json={"abandon_reason": "lost motivation"},
    )
    assert response.status_code == 400


def test_archive_rejected_when_neither_retro_nor_abandon_supplied(
    client: TestClient, repo: InMemoryRepository
):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    _make_active(repo, experiment)

    response = client.post(
        f"/experiments/{experiment['id']}/archive",
        cookies={"session_id": token},
        json={},
    )
    assert response.status_code == 400


def test_archive_rejected_when_both_retro_and_abandon_supplied(
    client: TestClient, repo: InMemoryRepository
):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    _make_active(repo, experiment)

    response = client.post(
        f"/experiments/{experiment['id']}/archive",
        cookies={"session_id": token},
        json={
            "what_worked": "a",
            "what_didnt": "b",
            "decision": "c",
            "abandon_reason": "lost motivation",
        },
    )
    assert response.status_code == 400


def test_archive_rejected_for_partial_retro(client: TestClient, repo: InMemoryRepository):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    _make_active(repo, experiment)

    response = client.post(
        f"/experiments/{experiment['id']}/archive",
        cookies={"session_id": token},
        json={"what_worked": "a"},
    )
    assert response.status_code == 400


def test_archive_404_identical_for_nonexistent_and_other_users_id(
    client: TestClient, repo: InMemoryRepository
):
    token_owner = _signup_and_login(client, email="owner@example.com")
    experiment = _create_experiment(client, token_owner)
    _make_active(repo, experiment)

    token_other = _signup_and_login(client, email="other@example.com")

    response_other_user = client.post(
        f"/experiments/{experiment['id']}/archive",
        cookies={"session_id": token_other},
        json={"abandon_reason": "lost motivation"},
    )
    response_nonexistent = client.post(
        "/experiments/does-not-exist/archive",
        cookies={"session_id": token_other},
        json={"abandon_reason": "lost motivation"},
    )

    assert response_other_user.status_code == 404
    assert response_nonexistent.status_code == 404
    assert response_other_user.json() == response_nonexistent.json()


def test_archive_unauthenticated_returns_401(client: TestClient):
    response = client.post("/experiments/some-id/archive", json={"abandon_reason": "x"})
    assert response.status_code == 401
