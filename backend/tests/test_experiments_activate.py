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


def _activate(client: TestClient, token: str, experiment_id: str):
    return client.post(f"/experiments/{experiment_id}/activate", cookies={"session_id": token})


def test_first_and_second_activation_succeed(client: TestClient):
    token = _signup_and_login(client, email="user@example.com")
    e1 = _create_experiment(client, token)
    e2 = _create_experiment(client, token)

    r1 = _activate(client, token, e1["id"])
    r2 = _activate(client, token, e2["id"])

    assert r1.status_code == 200
    assert r1.json()["status"] == "active"
    assert r2.status_code == 200
    assert r2.json()["status"] == "active"


def test_third_activation_rejected_and_first_two_untouched(
    client: TestClient, repo: InMemoryRepository
):
    token = _signup_and_login(client, email="user@example.com")
    e1 = _create_experiment(client, token)
    e2 = _create_experiment(client, token)
    e3 = _create_experiment(client, token)

    _activate(client, token, e1["id"])
    _activate(client, token, e2["id"])
    response = _activate(client, token, e3["id"])

    assert response.status_code == 400

    stored1 = repo.get_experiment(experiment_id=e1["id"], user_id=e1["user_id"])
    stored2 = repo.get_experiment(experiment_id=e2["id"], user_id=e2["user_id"])
    stored3 = repo.get_experiment(experiment_id=e3["id"], user_id=e3["user_id"])
    assert stored1.status == "active"
    assert stored2.status == "active"
    assert stored3.status == "backlog"


@pytest.mark.parametrize("status", ["active", "reflect", "archived"])
def test_activate_rejected_for_non_backlog_status(
    client: TestClient, repo: InMemoryRepository, status: str
):
    token = _signup_and_login(client, email="user@example.com")
    experiment = _create_experiment(client, token)
    repo.update_experiment(experiment_id=experiment["id"], user_id=experiment["user_id"], status=status)

    response = _activate(client, token, experiment["id"])
    assert response.status_code == 400


def test_limit_scoped_per_user(client: TestClient):
    token_a = _signup_and_login(client, email="a@example.com")
    token_b = _signup_and_login(client, email="b@example.com")

    a1 = _create_experiment(client, token_a)
    a2 = _create_experiment(client, token_a)
    b1 = _create_experiment(client, token_b)

    _activate(client, token_a, a1["id"])
    _activate(client, token_a, a2["id"])

    response_b = _activate(client, token_b, b1["id"])
    assert response_b.status_code == 200
    assert response_b.json()["status"] == "active"


def test_activate_404_identical_for_nonexistent_and_other_users_id(client: TestClient):
    token_owner = _signup_and_login(client, email="owner@example.com")
    experiment = _create_experiment(client, token_owner)

    token_other = _signup_and_login(client, email="other@example.com")

    response_other_user = _activate(client, token_other, experiment["id"])
    response_nonexistent = _activate(client, token_other, "does-not-exist")

    assert response_other_user.status_code == 404
    assert response_nonexistent.status_code == 404
    assert response_other_user.json() == response_nonexistent.json()


def test_activate_unauthenticated_returns_401(client: TestClient):
    response = client.post("/experiments/some-id/activate")
    assert response.status_code == 401
