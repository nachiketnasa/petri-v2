"""Postgres-backed repository tests. Same cases as `test_repository_memory.py`,
run against a real `postgres:16` with `_docs/schema.sql` applied.

Run locally:
    docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
    psql postgresql://postgres:postgres@localhost:5432/postgres -f _docs/schema.sql
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres uv run pytest backend/tests/test_repository_postgres.py

Skipped entirely when DATABASE_URL isn't set, so a plain `uv run pytest` stays green
without a database running.
"""

from __future__ import annotations

import os
from datetime import date, datetime, timezone

import pytest

psycopg = pytest.importorskip("psycopg")

from petri_backend.repository_postgres import PostgresRepository  # noqa: E402

DATABASE_URL = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="DATABASE_URL not set; skipping Postgres-backed tests"
)


@pytest.fixture
def repo():
    repository = PostgresRepository(DATABASE_URL)
    yield repository
    # ponytail: truncate instead of a wrapped transaction -- PostgresRepository
    # opens/commits its own connection per call (autocommit), so there's no
    # single transaction to roll back. Cascades clean check_ins/retros too.
    with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute("truncate table users, experiments, check_ins, retros cascade")
        conn.commit()


def _make_experiment(repo, user_id, **overrides):
    fields = dict(
        user_id=user_id,
        title="Drink more water",
        hypothesis="I'll feel better",
        cadence_type="daily",
        cadence_days=None,
        check_in_kind="boolean",
        start_date=date(2026, 1, 1),
        target_days=30,
    )
    fields.update(overrides)
    return repo.create_experiment(**fields)


def test_get_user_by_email_is_case_insensitive(repo):
    user = repo.create_user(
        email="Foo@Example.com",
        password_hash="hash",
        display_name="Foo",
    )

    found = repo.get_user_by_email(email="foo@example.com")

    assert found is not None
    assert found.id == user.id


def test_get_experiment_scoped_to_owner(repo):
    owner = repo.create_user(email="owner@example.com", password_hash=None, display_name="Owner")
    other = repo.create_user(email="other@example.com", password_hash=None, display_name="Other")
    experiment = _make_experiment(repo, owner.id)

    assert repo.get_experiment(experiment_id=experiment.id, user_id=other.id) is None
    assert repo.get_experiment(experiment_id=experiment.id, user_id=owner.id) is not None


def test_update_experiment_scoped_to_owner_makes_no_change(repo):
    owner = repo.create_user(email="owner2@example.com", password_hash=None, display_name="Owner")
    other = repo.create_user(email="other2@example.com", password_hash=None, display_name="Other")
    experiment = _make_experiment(repo, owner.id)

    result = repo.update_experiment(
        experiment_id=experiment.id, user_id=other.id, status="active"
    )

    assert result is None
    assert repo.get_experiment(experiment_id=experiment.id, user_id=owner.id).status == "backlog"


def test_list_experiments_scoped_by_user_and_status(repo):
    alice = repo.create_user(email="alice@example.com", password_hash=None, display_name="Alice")
    bob = repo.create_user(email="bob@example.com", password_hash=None, display_name="Bob")

    alice_active = _make_experiment(repo, alice.id, title="Alice active")
    repo.update_experiment(experiment_id=alice_active.id, user_id=alice.id, status="active")

    _make_experiment(repo, alice.id, title="Alice backlog")

    bob_active = _make_experiment(repo, bob.id, title="Bob active")
    repo.update_experiment(experiment_id=bob_active.id, user_id=bob.id, status="active")

    result = repo.list_experiments(user_id=alice.id, status="active")

    assert len(result) == 1
    assert result[0].id == alice_active.id
    assert result[0].status == "active"


def test_full_lifecycle_round_trip(repo):
    user = repo.create_user(
        email="lifecycle@example.com",
        password_hash="hash",
        display_name="Lifecycle",
    )
    assert repo.get_user_by_id(user_id=user.id) == user

    experiment = _make_experiment(
        repo, user.id, title="Daily stretch", hypothesis="I'll be less sore", target_days=14
    )
    assert repo.get_experiment(experiment_id=experiment.id, user_id=user.id) == experiment

    check_in = repo.add_check_in(
        experiment_id=experiment.id,
        user_id=user.id,
        value_bool=True,
        checked_in_at=datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc),
    )
    assert repo.list_check_ins(experiment_id=experiment.id, user_id=user.id) == [check_in]

    retro = repo.add_retro(
        experiment_id=experiment.id,
        user_id=user.id,
        what_worked="Stretching in the morning",
        what_didnt="Forgot on weekends",
        decision="continue",
    )
    assert repo.get_retro(experiment_id=experiment.id, user_id=user.id) == retro

    updated = repo.update_experiment(
        experiment_id=experiment.id, user_id=user.id, status="archived"
    )
    assert updated is not None
    assert updated.status == "archived"
    assert repo.get_experiment(experiment_id=experiment.id, user_id=user.id).status == "archived"


def test_add_check_in_raises_value_error_on_mismatched_user(repo):
    owner = repo.create_user(email="ci-owner@example.com", password_hash=None, display_name="Owner")
    other = repo.create_user(email="ci-other@example.com", password_hash=None, display_name="Other")
    experiment = _make_experiment(repo, owner.id)

    with pytest.raises(ValueError):
        repo.add_check_in(
            experiment_id=experiment.id,
            user_id=other.id,
            value_bool=True,
            checked_in_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )


def test_add_retro_raises_value_error_on_mismatched_user(repo):
    owner = repo.create_user(email="retro-owner@example.com", password_hash=None, display_name="Owner")
    other = repo.create_user(email="retro-other@example.com", password_hash=None, display_name="Other")
    experiment = _make_experiment(repo, owner.id)

    with pytest.raises(ValueError):
        repo.add_retro(
            experiment_id=experiment.id,
            user_id=other.id,
            what_worked="x",
            what_didnt="y",
            decision="continue",
        )


def test_list_check_ins_and_get_retro_return_empty_for_missing_or_foreign_experiment(repo):
    owner = repo.create_user(email="scope-owner@example.com", password_hash=None, display_name="Owner")
    other = repo.create_user(email="scope-other@example.com", password_hash=None, display_name="Other")
    experiment = _make_experiment(repo, owner.id)

    assert repo.list_check_ins(experiment_id=experiment.id, user_id=other.id) == []
    assert repo.get_retro(experiment_id=experiment.id, user_id=other.id) is None
    assert repo.list_check_ins(experiment_id="00000000-0000-0000-0000-000000000000", user_id=owner.id) == []


def test_update_experiment_rejects_unknown_field(repo):
    user = repo.create_user(email="unknown-field@example.com", password_hash=None, display_name="U")
    experiment = _make_experiment(repo, user.id)

    with pytest.raises(ValueError):
        repo.update_experiment(experiment_id=experiment.id, user_id=user.id, not_a_real_column="x")
