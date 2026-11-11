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
        "target_days": 30,
    }
    payload.update(overrides)
    response = client.post("/experiments", cookies={"session_id": token}, json=payload)
    assert response.status_code == 201
    return response.json()


def _check_in_on(client: TestClient, token: str, experiment_id: str, on_date: date):
    response = client.post(
        f"/experiments/{experiment_id}/check-ins",
        cookies={"session_id": token},
        json={"value_bool": True, "checked_in_at": f"{on_date.isoformat()}T09:00:00Z"},
    )
    assert response.status_code == 201


def test_streak_is_zero_for_a_brand_new_experiment_with_no_check_ins(client: TestClient):
    token = _signup_and_login(client)
    old_start = str(date.today() - timedelta(days=5))
    experiment = _create_experiment(client, token, start_date=old_start)
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["streak"] == 0


def test_streak_counts_consecutive_on_time_daily_check_ins(client: TestClient):
    token = _signup_and_login(client)
    start = date.today() - timedelta(days=4)
    experiment = _create_experiment(client, token, start_date=str(start))
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    # 4 fully-elapsed daily periods since start_date; check in on all 4.
    for i in range(4):
        _check_in_on(client, token, experiment["id"], start + timedelta(days=i))

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["streak"] == 4


def test_streak_resets_to_zero_after_a_missed_period(client: TestClient):
    token = _signup_and_login(client)
    start = date.today() - timedelta(days=4)
    experiment = _create_experiment(client, token, start_date=str(start))
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    # Checked in on the earliest period only, then missed everything since --
    # the most recently elapsed period has no check-in, so streak is 0
    # (a gap resets it, it doesn't count the earlier run).
    _check_in_on(client, token, experiment["id"], start)

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["streak"] == 0


def test_streak_counts_back_from_the_most_recent_elapsed_period_and_stops_at_a_gap(
    client: TestClient,
):
    token = _signup_and_login(client)
    start = date.today() - timedelta(days=4)
    experiment = _create_experiment(client, token, start_date=str(start))
    client.post(f"/experiments/{experiment['id']}/activate", cookies={"session_id": token})

    # Period 0 (oldest) missed, periods 1-3 (most recent 3) checked in.
    _check_in_on(client, token, experiment["id"], start + timedelta(days=1))
    _check_in_on(client, token, experiment["id"], start + timedelta(days=2))
    _check_in_on(client, token, experiment["id"], start + timedelta(days=3))

    response = client.get(f"/experiments/{experiment['id']}", cookies={"session_id": token})

    assert response.json()["streak"] == 3
