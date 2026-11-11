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


def _signup_and_login(client: TestClient, email: str, password: str = "pw12345"):
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


def test_list_experiments_scoped_to_signed_in_user(client: TestClient):
    token_a = _signup_and_login(client, email="a@example.com")
    _create_experiment(client, token_a, title="A's experiment")

    token_b = _signup_and_login(client, email="b@example.com")
    _create_experiment(client, token_b, title="B's experiment")

    response_a = client.get("/experiments", cookies={"session_id": token_a})
    assert response_a.status_code == 200
    titles_a = [e["title"] for e in response_a.json()]
    assert titles_a == ["A's experiment"]

    response_b = client.get("/experiments", cookies={"session_id": token_b})
    assert response_b.status_code == 200
    titles_b = [e["title"] for e in response_b.json()]
    assert titles_b == ["B's experiment"]


def test_list_experiments_filters_by_status(client: TestClient, repo: InMemoryRepository):
    token = _signup_and_login(client, email="user@example.com")
    created = _create_experiment(client, token, title="Backlog item")

    response = client.get(
        "/experiments", params={"status": "backlog"}, cookies={"session_id": token}
    )
    assert response.status_code == 200
    assert [e["id"] for e in response.json()] == [created["id"]]

    response_no_match = client.get(
        "/experiments", params={"status": "active"}, cookies={"session_id": token}
    )
    assert response_no_match.status_code == 200
    assert response_no_match.json() == []


def test_list_experiments_no_status_returns_all(client: TestClient):
    token = _signup_and_login(client, email="user@example.com")
    _create_experiment(client, token, title="One")
    _create_experiment(client, token, title="Two")

    response = client.get("/experiments", cookies={"session_id": token})
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_list_experiments_unauthenticated_returns_401(client: TestClient):
    response = client.get("/experiments")
    assert response.status_code == 401


def test_get_experiment_returns_owned_experiment(client: TestClient):
    token = _signup_and_login(client, email="user@example.com")
    created = _create_experiment(client, token)

    response = client.get(f"/experiments/{created['id']}", cookies={"session_id": token})
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["title"] == created["title"]
    assert body["status"] == "backlog"


def test_get_experiment_404_identical_for_nonexistent_and_other_users_id(
    client: TestClient,
):
    token_owner = _signup_and_login(client, email="owner@example.com")
    created = _create_experiment(client, token_owner)

    token_other = _signup_and_login(client, email="other@example.com")

    response_other_user = client.get(
        f"/experiments/{created['id']}", cookies={"session_id": token_other}
    )
    response_nonexistent = client.get(
        "/experiments/does-not-exist", cookies={"session_id": token_other}
    )

    assert response_other_user.status_code == 404
    assert response_nonexistent.status_code == 404
    assert response_other_user.json() == response_nonexistent.json()


def test_get_experiment_unauthenticated_returns_401(client: TestClient):
    response = client.get("/experiments/some-id")
    assert response.status_code == 401
