from datetime import date, timedelta

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


def _signup_and_login(client: TestClient, email: str = "user@example.com", password: str = "pw12345"):
    signup_response = client.post(
        "/auth/signup",
        json={"email": email, "password": password, "display_name": "User"},
    )
    user_id = signup_response.json()["id"]
    code = sent_verification_codes[email]
    client.post("/auth/verify-email", json={"code": code})
    response = client.post("/auth/login", json={"email": email, "password": password})
    return response.cookies["session_id"]


class TestCreateOtherTask:
    def test_creates_a_one_time_task(self, client: TestClient):
        token = _signup_and_login(client)

        response = client.post(
            "/other-tasks",
            cookies={"session_id": token},
            json={
                "title": "Submit assignment",
                "schedule_type": "one_time",
                "one_time_date": "2026-12-01",
            },
        )

        assert response.status_code == 201
        body = response.json()
        assert body["title"] == "Submit assignment"
        assert body["one_time_date"] == "2026-12-01"
        assert body["push_reminder_enabled"] is True

    def test_one_time_without_a_date_is_rejected(self, client: TestClient):
        token = _signup_and_login(client)

        response = client.post(
            "/other-tasks",
            cookies={"session_id": token},
            json={"title": "x", "schedule_type": "one_time"},
        )

        assert response.status_code == 400

    def test_creates_a_repeating_task_on_fixed_days(self, client: TestClient):
        token = _signup_and_login(client)

        response = client.post(
            "/other-tasks",
            cookies={"session_id": token},
            json={
                "title": "Gym",
                "schedule_type": "repeating",
                "repeat_days_of_week": [0, 2, 4],
                "repeat_end_date": "2026-12-31",
            },
        )

        assert response.status_code == 201
        assert response.json()["repeat_days_of_week"] == [0, 2, 4]

    def test_repeating_without_an_end_date_is_rejected(self, client: TestClient):
        token = _signup_and_login(client)

        response = client.post(
            "/other-tasks",
            cookies={"session_id": token},
            json={"title": "x", "schedule_type": "repeating", "repeat_interval_days": 3},
        )

        assert response.status_code == 400

    def test_repeating_without_days_or_interval_is_rejected(self, client: TestClient):
        token = _signup_and_login(client)

        response = client.post(
            "/other-tasks",
            cookies={"session_id": token},
            json={"title": "x", "schedule_type": "repeating", "repeat_end_date": "2026-12-31"},
        )

        assert response.status_code == 400

    def test_requires_authentication(self, client: TestClient):
        response = client.post(
            "/other-tasks",
            json={"title": "x", "schedule_type": "one_time", "one_time_date": "2026-12-01"},
        )
        assert response.status_code == 401


class TestListGetUpdateDeleteOtherTask:
    def _create(self, client: TestClient, token: str, **overrides):
        payload = {"title": "Task", "schedule_type": "one_time", "one_time_date": "2026-12-01"}
        payload.update(overrides)
        response = client.post("/other-tasks", cookies={"session_id": token}, json=payload)
        assert response.status_code == 201
        return response.json()

    def test_list_scoped_to_signed_in_user(self, client: TestClient):
        token_a = _signup_and_login(client, email="a@example.com")
        token_b = _signup_and_login(client, email="b@example.com")
        self._create(client, token_a)

        assert len(client.get("/other-tasks", cookies={"session_id": token_a}).json()) == 1
        assert len(client.get("/other-tasks", cookies={"session_id": token_b}).json()) == 0

    def test_get_404s_for_nonexistent_or_foreign_task(self, client: TestClient):
        token_a = _signup_and_login(client, email="a@example.com")
        task = self._create(client, token_a)
        token_b = _signup_and_login(client, email="b@example.com")

        assert client.get(f"/other-tasks/{task['id']}", cookies={"session_id": token_b}).status_code == 404
        assert client.get("/other-tasks/nope", cookies={"session_id": token_b}).status_code == 404

    def test_update_is_editable_at_any_time(self, client: TestClient):
        token = _signup_and_login(client)
        task = self._create(client, token)

        response = client.patch(
            f"/other-tasks/{task['id']}", cookies={"session_id": token}, json={"title": "Renamed"}
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Renamed"

    def test_update_validates_the_merged_schedule(self, client: TestClient):
        token = _signup_and_login(client)
        task = self._create(client, token)

        response = client.patch(
            f"/other-tasks/{task['id']}",
            cookies={"session_id": token},
            json={"schedule_type": "repeating"},  # now missing repeat_end_date/days/interval
        )

        assert response.status_code == 400

    def test_delete_removes_it(self, client: TestClient):
        token = _signup_and_login(client)
        task = self._create(client, token)

        response = client.delete(f"/other-tasks/{task['id']}", cookies={"session_id": token})

        assert response.status_code == 204
        assert client.get(f"/other-tasks/{task['id']}", cookies={"session_id": token}).status_code == 404


class TestDailyLoad:
    def test_counts_a_one_time_task_due_on_the_given_date(self, client: TestClient):
        token = _signup_and_login(client)
        client.post(
            "/other-tasks",
            cookies={"session_id": token},
            json={"title": "x", "schedule_type": "one_time", "one_time_date": "2026-12-01"},
        )

        response = client.get(
            "/daily-load", cookies={"session_id": token}, params={"date": "2026-12-01"}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["breakdown"]["other_tasks"] == 1
        assert body["count"] == 1

    def test_does_not_count_a_one_time_task_on_a_different_date(self, client: TestClient):
        token = _signup_and_login(client)
        client.post(
            "/other-tasks",
            cookies={"session_id": token},
            json={"title": "x", "schedule_type": "one_time", "one_time_date": "2026-12-01"},
        )

        response = client.get(
            "/daily-load", cookies={"session_id": token}, params={"date": "2026-12-02"}
        )

        assert response.json()["breakdown"]["other_tasks"] == 0

    def test_flags_over_threshold_when_combined_count_exceeds_8(self, client: TestClient):
        token = _signup_and_login(client)
        for i in range(9):
            client.post(
                "/other-tasks",
                cookies={"session_id": token},
                json={"title": f"t{i}", "schedule_type": "one_time", "one_time_date": "2026-12-01"},
            )

        response = client.get(
            "/daily-load", cookies={"session_id": token}, params={"date": "2026-12-01"}
        )

        body = response.json()
        assert body["count"] == 9
        assert body["over_threshold"] is True

    def test_is_not_flagged_at_exactly_the_threshold(self, client: TestClient):
        token = _signup_and_login(client)
        for i in range(8):
            client.post(
                "/other-tasks",
                cookies={"session_id": token},
                json={"title": f"t{i}", "schedule_type": "one_time", "one_time_date": "2026-12-01"},
            )

        response = client.get(
            "/daily-load", cookies={"session_id": token}, params={"date": "2026-12-01"}
        )

        body = response.json()
        assert body["count"] == 8
        assert body["over_threshold"] is False

    def test_never_blocks_creating_more_tasks_past_the_threshold(self, client: TestClient):
        token = _signup_and_login(client)
        for i in range(10):
            response = client.post(
                "/other-tasks",
                cookies={"session_id": token},
                json={"title": f"t{i}", "schedule_type": "one_time", "one_time_date": "2026-12-01"},
            )
            assert response.status_code == 201  # purely informational, never a hard block

    def test_counts_an_active_experiments_cadence_for_the_date(self, client: TestClient):
        token = _signup_and_login(client)
        exp = client.post(
            "/experiments",
            cookies={"session_id": token},
            json={
                "title": "Daily walk",
                "hypothesis": "h",
                "cadence_type": "daily",
                "target_days": 30,
                "start_date": "2026-11-01",
            },
        ).json()
        client.post(f"/experiments/{exp['id']}/activate", cookies={"session_id": token})

        response = client.get(
            "/daily-load", cookies={"session_id": token}, params={"date": "2026-11-05"}
        )

        assert response.json()["breakdown"]["experiment_check_ins"] == 1

    def test_defaults_to_today_when_no_date_given(self, client: TestClient):
        token = _signup_and_login(client)

        response = client.get("/daily-load", cookies={"session_id": token})

        assert response.status_code == 200
        assert response.json()["date"] == str(date.today())


class TestPushSubscriptions:
    def test_vapid_public_key_is_exposed_without_auth(self, client: TestClient):
        response = client.get("/push/vapid-public-key")

        assert response.status_code == 200
        assert len(response.json()["public_key"]) > 0

    def test_subscribe_and_unsubscribe(self, client: TestClient):
        token = _signup_and_login(client)

        subscribe = client.post(
            "/push/subscribe",
            cookies={"session_id": token},
            json={"endpoint": "https://push.example/abc", "p256dh_key": "p", "auth_key": "a"},
        )
        assert subscribe.status_code == 201

        unsubscribe = client.post(
            "/push/unsubscribe",
            cookies={"session_id": token},
            json={"endpoint": "https://push.example/abc"},
        )
        assert unsubscribe.status_code == 204

    def test_subscribe_requires_authentication(self, client: TestClient):
        response = client.post(
            "/push/subscribe", json={"endpoint": "x", "p256dh_key": "p", "auth_key": "a"}
        )
        assert response.status_code == 401
