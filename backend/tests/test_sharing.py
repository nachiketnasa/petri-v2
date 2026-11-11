import pytest
from fastapi.testclient import TestClient

from petri_backend.app import _email_verifications, app, get_repository
from petri_backend.repository_memory import InMemoryRepository


@pytest.fixture(autouse=True)
def _clear_module_state():
    _email_verifications.clear()


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
        json={"email": email, "password": password, "display_name": email.split("@")[0]},
    )
    user_id = signup_response.json()["id"]
    code = next(c for c, (uid, _exp) in _email_verifications.items() if uid == user_id)
    client.post("/auth/verify-email", json={"code": code})
    response = client.post("/auth/login", json={"email": email, "password": password})
    return response.cookies["session_id"]


def _create_experiment(client: TestClient, token: str):
    response = client.post(
        "/experiments",
        cookies={"session_id": token},
        json={"title": "Daily walk", "hypothesis": "h", "cadence_type": "daily", "target_days": 7},
    )
    return response.json()


class TestShareToggle:
    def test_sharing_an_experiment_returns_a_token(self, client: TestClient):
        token = _signup_and_login(client)
        exp = _create_experiment(client, token)

        response = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": token})

        assert response.status_code == 200
        assert len(response.json()["token"]) > 0

    def test_sharing_twice_returns_the_same_token(self, client: TestClient):
        token = _signup_and_login(client)
        exp = _create_experiment(client, token)

        first = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": token}).json()
        second = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": token}).json()

        assert first["token"] == second["token"]

    def test_unsharing_then_resharing_issues_a_new_token(self, client: TestClient):
        token = _signup_and_login(client)
        exp = _create_experiment(client, token)
        first = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": token}).json()

        client.delete(f"/experiments/{exp['id']}/share", cookies={"session_id": token})
        second = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": token}).json()

        assert first["token"] != second["token"]

    def test_unsharing_invalidates_the_old_link(self, client: TestClient):
        token = _signup_and_login(client)
        exp = _create_experiment(client, token)
        share = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": token}).json()

        client.delete(f"/experiments/{exp['id']}/share", cookies={"session_id": token})

        assert client.get(f"/shared/{share['token']}").status_code == 404

    def test_share_requires_ownership(self, client: TestClient):
        token_a = _signup_and_login(client, email="a@example.com")
        exp = _create_experiment(client, token_a)
        token_b = _signup_and_login(client, email="b@example.com")

        response = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": token_b})

        assert response.status_code == 404


class TestSharedPage:
    def test_viewing_a_shared_page_requires_no_login(self, client: TestClient):
        token = _signup_and_login(client)
        exp = _create_experiment(client, token)
        share = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": token}).json()

        response = client.get(f"/shared/{share['token']}")

        assert response.status_code == 200
        body = response.json()
        assert body["kind"] == "experiment"
        assert body["title"] == "Daily walk"
        assert body["hypothesis"] == "h"
        assert "note" not in body and "notes" not in body

    def test_unknown_token_returns_404(self, client: TestClient):
        response = client.get("/shared/does-not-exist")
        assert response.status_code == 404


class TestLikesAndComments:
    def _shared(self, client: TestClient, owner_token: str):
        exp = _create_experiment(client, owner_token)
        return client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": owner_token}).json()

    def test_liking_requires_sign_in(self, client: TestClient):
        owner_token = _signup_and_login(client, email="owner@example.com")
        share = self._shared(client, owner_token)

        client.cookies.clear()  # TestClient persists cookies; this call must be unauthenticated
        response = client.post(f"/shared/{share['token']}/like")

        assert response.status_code == 401

    def test_like_and_unlike_updates_the_count(self, client: TestClient):
        owner_token = _signup_and_login(client, email="owner@example.com")
        share = self._shared(client, owner_token)
        liker_token = _signup_and_login(client, email="liker@example.com")

        client.post(f"/shared/{share['token']}/like", cookies={"session_id": liker_token})
        page = client.get(f"/shared/{share['token']}").json()
        assert page["like_count"] == 1

        client.delete(f"/shared/{share['token']}/like", cookies={"session_id": liker_token})
        page = client.get(f"/shared/{share['token']}").json()
        assert page["like_count"] == 0

    def test_commenting_requires_sign_in(self, client: TestClient):
        owner_token = _signup_and_login(client, email="owner@example.com")
        share = self._shared(client, owner_token)

        client.cookies.clear()
        response = client.post(f"/shared/{share['token']}/comments", json={"body": "nice!"})

        assert response.status_code == 401

    def test_posting_and_reading_comments(self, client: TestClient):
        owner_token = _signup_and_login(client, email="owner@example.com")
        share = self._shared(client, owner_token)
        commenter_token = _signup_and_login(client, email="commenter@example.com")

        post = client.post(
            f"/shared/{share['token']}/comments",
            cookies={"session_id": commenter_token},
            json={"body": "nice!"},
        )
        assert post.status_code == 201

        page = client.get(f"/shared/{share['token']}").json()
        assert len(page["comments"]) == 1
        assert page["comments"][0]["body"] == "nice!"

    def test_owner_can_delete_any_comment(self, client: TestClient):
        owner_token = _signup_and_login(client, email="owner@example.com")
        share = self._shared(client, owner_token)
        commenter_token = _signup_and_login(client, email="commenter@example.com")
        comment = client.post(
            f"/shared/{share['token']}/comments",
            cookies={"session_id": commenter_token},
            json={"body": "nice!"},
        ).json()

        response = client.delete(
            f"/shared/{share['token']}/comments/{comment['id']}", cookies={"session_id": owner_token}
        )

        assert response.status_code == 204
        assert client.get(f"/shared/{share['token']}").json()["comments"] == []

    def test_a_different_user_cannot_delete_someone_elses_comment(self, client: TestClient):
        owner_token = _signup_and_login(client, email="owner@example.com")
        share = self._shared(client, owner_token)
        commenter_token = _signup_and_login(client, email="commenter@example.com")
        comment = client.post(
            f"/shared/{share['token']}/comments",
            cookies={"session_id": commenter_token},
            json={"body": "nice!"},
        ).json()
        other_token = _signup_and_login(client, email="other@example.com")

        response = client.delete(
            f"/shared/{share['token']}/comments/{comment['id']}", cookies={"session_id": other_token}
        )

        assert response.status_code == 403

    def test_unsharing_deletes_comments_and_likes(self, client: TestClient):
        owner_token = _signup_and_login(client, email="owner@example.com")
        exp = _create_experiment(client, owner_token)
        share = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": owner_token}).json()
        liker_token = _signup_and_login(client, email="liker@example.com")
        client.post(f"/shared/{share['token']}/like", cookies={"session_id": liker_token})
        client.post(
            f"/shared/{share['token']}/comments",
            cookies={"session_id": liker_token},
            json={"body": "x"},
        )

        client.delete(f"/experiments/{exp['id']}/share", cookies={"session_id": owner_token})
        reshared = client.post(f"/experiments/{exp['id']}/share", cookies={"session_id": owner_token}).json()

        page = client.get(f"/shared/{reshared['token']}").json()
        assert page["like_count"] == 0
        assert page["comments"] == []
