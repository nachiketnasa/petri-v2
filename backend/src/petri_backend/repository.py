"""Storage interface for Petri v2.

Everything above this module (auth, experiment routes/services) talks to a
`Repository`, never to a concrete store directly. See
`repository_memory.py` for the in-memory implementation used until the
Postgres one lands.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime


@dataclass
class User:
    id: str
    email: str
    password_hash: str | None
    display_name: str
    timezone: str
    created_at: datetime
    theme: str = "petri-light"
    sound_effects_enabled: bool = True
    default_landing: str = "greeting"


@dataclass
class Experiment:
    id: str
    user_id: str
    title: str
    hypothesis: str
    cadence_type: str
    cadence_days: int | None
    check_in_kind: str
    start_date: date
    target_days: int
    status: str
    ended_early: bool
    abandon_reason: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


@dataclass
class Goal:
    id: str
    user_id: str
    title: str
    why_text: str
    start_date: date
    target_date: date
    status: str
    ended_early: bool
    abandon_reason: str | None
    evolved_from_experiment_id: str | None
    branched_into_goal_id: str | None
    branched_from_goal_id: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


@dataclass
class Milestone:
    id: str
    goal_id: str
    order_index: int
    title: str
    cadence_type: str
    cadence_days: int | None
    check_in_kind: str
    target_date: date | None
    status: str
    ended_early: bool
    abandon_reason: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


@dataclass
class CheckIn:
    id: str
    experiment_id: str | None
    value_bool: bool | None
    value_rating: int | None
    note: str | None
    checked_in_at: datetime
    milestone_id: str | None = None


@dataclass
class Retro:
    id: str
    experiment_id: str | None
    what_worked: str
    what_didnt: str
    decision: str
    created_at: datetime
    milestone_id: str | None = None
    goal_id: str | None = None


class Repository(ABC):
    """Storage interface covering users, experiments, check-ins, and retros."""

    @abstractmethod
    def create_user(
        self,
        *,
        email: str,
        password_hash: str | None,
        display_name: str,
        timezone: str = "UTC",
    ) -> User: ...

    @abstractmethod
    def get_user_by_id(self, *, user_id: str) -> User | None: ...

    @abstractmethod
    def get_user_by_email(self, *, email: str) -> User | None: ...

    @abstractmethod
    def update_user(self, *, user_id: str, **fields) -> User | None: ...

    @abstractmethod
    def create_experiment(
        self,
        *,
        user_id: str,
        title: str,
        hypothesis: str,
        cadence_type: str,
        cadence_days: int | None,
        check_in_kind: str,
        start_date: date,
        target_days: int,
    ) -> Experiment: ...

    @abstractmethod
    def list_experiments(
        self, *, user_id: str, status: str | None = None
    ) -> list[Experiment]: ...

    @abstractmethod
    def get_experiment(
        self, *, experiment_id: str, user_id: str
    ) -> Experiment | None: ...

    @abstractmethod
    def update_experiment(
        self, *, experiment_id: str, user_id: str, **fields
    ) -> Experiment | None: ...

    @abstractmethod
    def add_check_in(
        self,
        *,
        experiment_id: str,
        user_id: str,
        value_bool: bool | None = None,
        value_rating: int | None = None,
        note: str | None = None,
        checked_in_at: datetime,
    ) -> CheckIn: ...

    @abstractmethod
    def list_check_ins(
        self, *, experiment_id: str, user_id: str
    ) -> list[CheckIn]: ...

    @abstractmethod
    def add_retro(
        self,
        *,
        experiment_id: str,
        user_id: str,
        what_worked: str,
        what_didnt: str,
        decision: str,
    ) -> Retro: ...

    @abstractmethod
    def get_retro(self, *, experiment_id: str, user_id: str) -> Retro | None: ...

    @abstractmethod
    def create_goal(
        self,
        *,
        user_id: str,
        title: str,
        why_text: str,
        start_date: date,
        target_date: date,
        milestones: list[dict],
    ) -> Goal:
        """`milestones` is an ordered list of
        {title, cadence_type, cadence_days, check_in_kind, target_date} dicts,
        persisted with order_index 0..n-1, matching that order exactly."""
        ...

    @abstractmethod
    def list_goals(self, *, user_id: str, status: str | None = None) -> list[Goal]: ...

    @abstractmethod
    def get_goal(self, *, goal_id: str, user_id: str) -> Goal | None: ...

    @abstractmethod
    def update_goal(self, *, goal_id: str, user_id: str, **fields) -> Goal | None: ...

    @abstractmethod
    def list_milestones(self, *, goal_id: str, user_id: str) -> list[Milestone]: ...

    @abstractmethod
    def get_milestone(self, *, milestone_id: str, user_id: str) -> Milestone | None: ...

    @abstractmethod
    def update_milestone(self, *, milestone_id: str, user_id: str, **fields) -> Milestone | None: ...

    @abstractmethod
    def add_milestone_check_in(
        self,
        *,
        milestone_id: str,
        user_id: str,
        value_bool: bool | None = None,
        value_rating: int | None = None,
        note: str | None = None,
        checked_in_at: datetime,
    ) -> CheckIn: ...

    @abstractmethod
    def list_milestone_check_ins(self, *, milestone_id: str, user_id: str) -> list[CheckIn]: ...

    @abstractmethod
    def add_goal_retro(
        self, *, goal_id: str, user_id: str, what_worked: str, what_didnt: str, decision: str
    ) -> Retro: ...

    @abstractmethod
    def add_milestone_retro(
        self, *, milestone_id: str, user_id: str, what_worked: str, what_didnt: str, decision: str
    ) -> Retro: ...
