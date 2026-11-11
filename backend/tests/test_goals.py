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


def _goal_payload(**overrides):
    payload = {
        "title": "Run a 10k",
        "why_text": "I want to prove I can commit to something for months.",
        "start_date": "2026-01-01",
        "target_date": "2026-06-01",
        "milestones": [
            {"title": "Couch to 5k", "cadence_type": "daily", "check_in_kind": "boolean"},
            {"title": "Build to 10k", "cadence_type": "weekly", "check_in_kind": "boolean"},
        ],
    }
    payload.update(overrides)
    return payload


def _create_goal(client: TestClient, token: str, **overrides):
    response = client.post("/goals", cookies={"session_id": token}, json=_goal_payload(**overrides))
    assert response.status_code == 201
    return response.json()


class TestCreateGoal:
    def test_creates_a_goal_with_its_locked_ordered_milestone_list(self, client: TestClient):
        token = _signup_and_login(client)

        goal = _create_goal(client, token)

        assert goal["status"] == "backlog"
        assert len(goal["milestones"]) == 2
        assert [m["title"] for m in goal["milestones"]] == ["Couch to 5k", "Build to 10k"]
        assert [m["order_index"] for m in goal["milestones"]] == [0, 1]
        assert all(m["status"] == "backlog" for m in goal["milestones"])

    def test_rejects_a_goal_with_zero_milestones(self, client: TestClient):
        token = _signup_and_login(client)

        response = client.post(
            "/goals", cookies={"session_id": token}, json=_goal_payload(milestones=[])
        )

        assert response.status_code == 400
        assert "at least one milestone" in response.json()["detail"].lower()

    def test_rejects_a_custom_cadence_milestone_missing_cadence_days(self, client: TestClient):
        token = _signup_and_login(client)

        response = client.post(
            "/goals",
            cookies={"session_id": token},
            json=_goal_payload(milestones=[{"title": "M1", "cadence_type": "custom"}]),
        )

        assert response.status_code == 400

    def test_requires_authentication(self, client: TestClient):
        response = client.post("/goals", json=_goal_payload())
        assert response.status_code == 401


class TestListAndGetGoals:
    def test_list_goals_scoped_to_signed_in_user(self, client: TestClient):
        token_a = _signup_and_login(client, email="a@example.com")
        token_b = _signup_and_login(client, email="b@example.com")
        _create_goal(client, token_a)

        response_a = client.get("/goals", cookies={"session_id": token_a})
        response_b = client.get("/goals", cookies={"session_id": token_b})

        assert len(response_a.json()) == 1
        assert len(response_b.json()) == 0

    def test_get_goal_404s_for_nonexistent_or_foreign_goal(self, client: TestClient):
        token_a = _signup_and_login(client, email="a@example.com")
        goal = _create_goal(client, token_a)
        token_b = _signup_and_login(client, email="b@example.com")

        response_foreign = client.get(f"/goals/{goal['id']}", cookies={"session_id": token_b})
        response_missing = client.get("/goals/does-not-exist", cookies={"session_id": token_b})

        assert response_foreign.status_code == 404
        assert response_missing.status_code == 404
        assert response_foreign.json() == response_missing.json()


class TestActivateGoal:
    def test_activating_a_backlog_goal_also_activates_its_first_milestone(self, client: TestClient):
        token = _signup_and_login(client)
        goal = _create_goal(client, token)

        response = client.post(f"/goals/{goal['id']}/activate", cookies={"session_id": token})

        body = response.json()
        assert body["status"] == "active"
        assert body["milestones"][0]["status"] == "active"
        assert body["milestones"][1]["status"] == "backlog"

    def test_rejects_activating_a_non_backlog_goal(self, client: TestClient):
        token = _signup_and_login(client)
        goal = _create_goal(client, token)
        client.post(f"/goals/{goal['id']}/activate", cookies={"session_id": token})

        response = client.post(f"/goals/{goal['id']}/activate", cookies={"session_id": token})

        assert response.status_code == 400


class TestMilestoneCheckIns:
    def _active_goal(self, client: TestClient, token: str):
        goal = _create_goal(client, token)
        client.post(f"/goals/{goal['id']}/activate", cookies={"session_id": token})
        return client.get(f"/goals/{goal['id']}", cookies={"session_id": token}).json()

    def test_logs_a_check_in_against_the_active_milestone(self, client: TestClient):
        token = _signup_and_login(client)
        goal = self._active_goal(client, token)
        active_milestone_id = goal["milestones"][0]["id"]

        response = client.post(
            f"/milestones/{active_milestone_id}/check-ins",
            cookies={"session_id": token},
            json={"value_bool": True},
        )

        assert response.status_code == 201
        assert response.json()["milestone_id"] == active_milestone_id
        assert response.json()["experiment_id"] is None

    def test_rejects_a_check_in_against_a_not_yet_active_milestone(self, client: TestClient):
        token = _signup_and_login(client)
        goal = self._active_goal(client, token)
        backlog_milestone_id = goal["milestones"][1]["id"]

        response = client.post(
            f"/milestones/{backlog_milestone_id}/check-ins",
            cookies={"session_id": token},
            json={"value_bool": True},
        )

        assert response.status_code == 400

    def test_list_milestone_check_ins_returns_history(self, client: TestClient):
        token = _signup_and_login(client)
        goal = self._active_goal(client, token)
        active_milestone_id = goal["milestones"][0]["id"]
        client.post(
            f"/milestones/{active_milestone_id}/check-ins",
            cookies={"session_id": token},
            json={"value_bool": True},
        )

        response = client.get(
            f"/milestones/{active_milestone_id}/check-ins", cookies={"session_id": token}
        )

        assert len(response.json()) == 1


class TestMilestoneArchiveAndSequencing:
    def _active_goal(self, client: TestClient, token: str):
        goal = _create_goal(client, token)
        client.post(f"/goals/{goal['id']}/activate", cookies={"session_id": token})
        return client.get(f"/goals/{goal['id']}", cookies={"session_id": token}).json()

    def test_archiving_the_current_milestone_activates_the_next_one(self, client: TestClient):
        token = _signup_and_login(client)
        goal = self._active_goal(client, token)
        first_id = goal["milestones"][0]["id"]

        response = client.post(
            f"/milestones/{first_id}/archive",
            cookies={"session_id": token},
            json={"what_worked": "a", "what_didnt": "b", "decision": "continue"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "archived"

        updated_goal = client.get(f"/goals/{goal['id']}", cookies={"session_id": token}).json()
        assert updated_goal["milestones"][0]["status"] == "archived"
        assert updated_goal["milestones"][1]["status"] == "active"
        assert updated_goal["status"] == "active"  # goal itself not done yet

    def test_archiving_the_last_milestone_moves_the_goal_to_reflect(self, client: TestClient):
        token = _signup_and_login(client)
        goal = self._active_goal(client, token)
        first_id = goal["milestones"][0]["id"]
        second_id = goal["milestones"][1]["id"]

        client.post(
            f"/milestones/{first_id}/archive",
            cookies={"session_id": token},
            json={"what_worked": "a", "what_didnt": "b", "decision": "continue"},
        )
        response = client.post(
            f"/milestones/{second_id}/archive",
            cookies={"session_id": token},
            json={"what_worked": "a", "what_didnt": "b", "decision": "continue"},
        )

        assert response.status_code == 200
        updated_goal = client.get(f"/goals/{goal['id']}", cookies={"session_id": token}).json()
        assert updated_goal["status"] == "reflect"

    def test_abandoning_the_current_milestone_early_still_activates_the_next_one(
        self, client: TestClient
    ):
        token = _signup_and_login(client)
        goal = self._active_goal(client, token)
        first_id = goal["milestones"][0]["id"]

        response = client.post(
            f"/milestones/{first_id}/archive",
            cookies={"session_id": token},
            json={"abandon_reason": "lost motivation"},
        )

        assert response.status_code == 200
        assert response.json()["ended_early"] is True
        updated_goal = client.get(f"/goals/{goal['id']}", cookies={"session_id": token}).json()
        assert updated_goal["milestones"][1]["status"] == "active"

    def test_archive_requires_either_retro_or_abandon_reason(self, client: TestClient):
        token = _signup_and_login(client)
        goal = self._active_goal(client, token)
        first_id = goal["milestones"][0]["id"]

        response = client.post(
            f"/milestones/{first_id}/archive", cookies={"session_id": token}, json={}
        )

        assert response.status_code == 400


class TestArchiveGoal:
    def test_archives_a_goal_via_retro(self, client: TestClient):
        token = _signup_and_login(client)
        goal = _create_goal(client, token)
        client.post(f"/goals/{goal['id']}/activate", cookies={"session_id": token})

        response = client.post(
            f"/goals/{goal['id']}/archive",
            cookies={"session_id": token},
            json={"what_worked": "a", "what_didnt": "b", "decision": "continue"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "archived"

    def test_rejects_archiving_a_backlog_goal(self, client: TestClient):
        token = _signup_and_login(client)
        goal = _create_goal(client, token)

        response = client.post(
            f"/goals/{goal['id']}/archive",
            cookies={"session_id": token},
            json={"what_worked": "a", "what_didnt": "b", "decision": "continue"},
        )

        assert response.status_code == 400
