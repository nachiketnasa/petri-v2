from datetime import date, datetime, timezone

import pytest

from petri_backend.repository import Repository
from petri_backend.repository_memory import InMemoryRepository


@pytest.fixture
def repo() -> InMemoryRepository:
    return InMemoryRepository()


def test_implements_exactly_the_interface_methods():
    interface_methods = {
        name
        for name in Repository.__abstractmethods__
    }
    assert interface_methods == {
        "create_user",
        "get_user_by_id",
        "get_user_by_email",
        "create_experiment",
        "list_experiments",
        "get_experiment",
        "update_experiment",
        "add_check_in",
        "list_check_ins",
        "add_retro",
        "get_retro",
    }


def test_get_user_by_email_is_case_insensitive(repo: InMemoryRepository):
    user = repo.create_user(
        email="Foo@Example.com",
        password_hash="hash",
        display_name="Foo",
    )

    found = repo.get_user_by_email(email="foo@example.com")

    assert found is not None
    assert found.id == user.id


def test_get_experiment_scoped_to_owner(repo: InMemoryRepository):
    owner = repo.create_user(email="owner@example.com", password_hash=None, display_name="Owner")
    other = repo.create_user(email="other@example.com", password_hash=None, display_name="Other")
    experiment = repo.create_experiment(
        user_id=owner.id,
        title="Drink more water",
        hypothesis="I'll feel better",
        cadence_type="daily",
        cadence_days=None,
        check_in_kind="boolean",
        start_date=date(2026, 1, 1),
        target_days=30,
    )

    assert repo.get_experiment(experiment_id=experiment.id, user_id=other.id) is None
    assert repo.get_experiment(experiment_id=experiment.id, user_id=owner.id) is not None


def test_update_experiment_scoped_to_owner_makes_no_change(repo: InMemoryRepository):
    owner = repo.create_user(email="owner2@example.com", password_hash=None, display_name="Owner")
    other = repo.create_user(email="other2@example.com", password_hash=None, display_name="Other")
    experiment = repo.create_experiment(
        user_id=owner.id,
        title="Drink more water",
        hypothesis="I'll feel better",
        cadence_type="daily",
        cadence_days=None,
        check_in_kind="boolean",
        start_date=date(2026, 1, 1),
        target_days=30,
    )

    result = repo.update_experiment(
        experiment_id=experiment.id, user_id=other.id, status="active"
    )

    assert result is None
    assert repo.get_experiment(experiment_id=experiment.id, user_id=owner.id).status == "backlog"


def test_list_experiments_scoped_by_user_and_status(repo: InMemoryRepository):
    alice = repo.create_user(email="alice@example.com", password_hash=None, display_name="Alice")
    bob = repo.create_user(email="bob@example.com", password_hash=None, display_name="Bob")

    alice_active = repo.create_experiment(
        user_id=alice.id,
        title="Alice active",
        hypothesis="h",
        cadence_type="daily",
        cadence_days=None,
        check_in_kind="boolean",
        start_date=date(2026, 1, 1),
        target_days=30,
    )
    repo.update_experiment(experiment_id=alice_active.id, user_id=alice.id, status="active")

    repo.create_experiment(
        user_id=alice.id,
        title="Alice backlog",
        hypothesis="h",
        cadence_type="daily",
        cadence_days=None,
        check_in_kind="boolean",
        start_date=date(2026, 1, 1),
        target_days=30,
    )

    bob_active = repo.create_experiment(
        user_id=bob.id,
        title="Bob active",
        hypothesis="h",
        cadence_type="daily",
        cadence_days=None,
        check_in_kind="boolean",
        start_date=date(2026, 1, 1),
        target_days=30,
    )
    repo.update_experiment(experiment_id=bob_active.id, user_id=bob.id, status="active")

    result = repo.list_experiments(user_id=alice.id, status="active")

    assert len(result) == 1
    assert result[0].id == alice_active.id
    assert result[0].status == "active"


def test_full_lifecycle_round_trip(repo: InMemoryRepository):
    user = repo.create_user(
        email="lifecycle@example.com",
        password_hash="hash",
        display_name="Lifecycle",
    )
    assert repo.get_user_by_id(user_id=user.id) == user

    experiment = repo.create_experiment(
        user_id=user.id,
        title="Daily stretch",
        hypothesis="I'll be less sore",
        cadence_type="daily",
        cadence_days=None,
        check_in_kind="boolean",
        start_date=date(2026, 1, 1),
        target_days=14,
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


def test_memory_repo_does_not_enforce_business_rules(repo: InMemoryRepository):
    user = repo.create_user(email="rules@example.com", password_hash=None, display_name="Rules")
    experiment = repo.create_experiment(
        user_id=user.id,
        title="No rules here",
        hypothesis="h",
        cadence_type="daily",
        cadence_days=None,
        check_in_kind="boolean",
        start_date=date(2026, 1, 1),
        target_days=30,
    )

    # Experiment is still "backlog", not "active" — a check-in and an archive
    # with no retro both succeed because business rules aren't this layer's job.
    check_in = repo.add_check_in(
        experiment_id=experiment.id,
        user_id=user.id,
        value_bool=True,
        checked_in_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    assert check_in is not None

    archived = repo.update_experiment(
        experiment_id=experiment.id, user_id=user.id, status="archived"
    )
    assert archived.status == "archived"
    assert repo.get_retro(experiment_id=experiment.id, user_id=user.id) is None
