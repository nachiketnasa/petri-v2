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
    other_tasks_enabled: bool = False
    default_landing: str = "greeting"
    email_verified_at: datetime | None = None
    totp_secret: str | None = None  # ciphertext (totp_crypto.py), never plaintext
    totp_enabled: bool = False


@dataclass
class RecoveryCode:
    id: str
    user_id: str
    code_hash: str
    created_at: datetime


@dataclass
class OtherTask:
    id: str
    user_id: str
    title: str
    schedule_type: str  # 'one_time' | 'repeating'
    one_time_date: date | None
    repeat_days_of_week: list[int] | None  # 0=Mon .. 6=Sun
    repeat_interval_days: int | None
    repeat_end_date: date | None
    push_reminder_enabled: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class PushSubscription:
    id: str
    user_id: str
    endpoint: str
    p256dh_key: str
    auth_key: str
    created_at: datetime


@dataclass
class Share:
    id: str
    experiment_id: str | None
    goal_id: str | None
    token: str
    created_at: datetime


@dataclass
class Comment:
    id: str
    share_id: str
    user_id: str
    body: str
    created_at: datetime


@dataclass
class Like:
    id: str
    share_id: str
    user_id: str
    created_at: datetime


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
    started_at: datetime | None
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
    def replace_recovery_codes(self, *, user_id: str, code_hashes: list[str]) -> list[RecoveryCode]:
        """Deletes any existing recovery codes for this user and inserts a
        fresh set -- used both at initial 2FA enrollment and to mirror
        deleting them on disable."""
        ...

    @abstractmethod
    def list_recovery_codes(self, *, user_id: str) -> list[RecoveryCode]: ...

    @abstractmethod
    def delete_recovery_code(self, *, recovery_code_id: str) -> None:
        """A code is deleted outright once used, not flagged -- "still
        present" is itself the unused check (_docs/schema.sql)."""
        ...

    @abstractmethod
    def create_email_verification(
        self, *, user_id: str, code_hash: str, expires_at: datetime
    ) -> None: ...

    @abstractmethod
    def consume_email_verification(self, *, code_hash: str) -> str | None:
        """Marks the matching, unconsumed, unexpired row consumed and
        returns its user_id -- or None if no such row exists (one-time
        use: gone either way)."""
        ...

    @abstractmethod
    def create_password_reset(
        self, *, user_id: str, token_hash: str, expires_at: datetime
    ) -> None: ...

    @abstractmethod
    def consume_password_reset(self, *, token_hash: str) -> str | None:
        """Same contract as consume_email_verification, for the
        password_resets table."""
        ...

    @abstractmethod
    def create_session(
        self, *, session_id: str, user_id: str, expires_at: datetime
    ) -> None:
        """session_id is derived from the cookie token (never the raw token)."""
        ...

    @abstractmethod
    def get_session_user_id(self, *, session_id: str) -> str | None:
        """user_id for a live session; None if missing, expired or revoked."""
        ...

    @abstractmethod
    def revoke_session(self, *, session_id: str) -> None: ...

    @abstractmethod
    def revoke_user_sessions(self, *, user_id: str) -> None: ...

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
    def add_milestone(
        self,
        *,
        goal_id: str,
        user_id: str,
        title: str,
        cadence_type: str,
        cadence_days: int | None,
        check_in_kind: str,
        target_date: date | None,
    ) -> Milestone | None:
        """Appends one milestone at the end of goal_id's ordered list
        (order_index = current max + 1). Returns None if no such goal is
        owned by user_id. Callers enforce the "only while backlog" rule
        (_docs/specs.md "Milestone" -- locked once Active) -- this layer
        just appends; it doesn't know about goal lifecycle status."""
        ...

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

    @abstractmethod
    def create_other_task(
        self,
        *,
        user_id: str,
        title: str,
        schedule_type: str,
        one_time_date: date | None,
        repeat_days_of_week: list[int] | None,
        repeat_interval_days: int | None,
        repeat_end_date: date | None,
        push_reminder_enabled: bool,
    ) -> OtherTask: ...

    @abstractmethod
    def list_other_tasks(self, *, user_id: str) -> list[OtherTask]: ...

    @abstractmethod
    def get_other_task(self, *, other_task_id: str, user_id: str) -> OtherTask | None: ...

    @abstractmethod
    def update_other_task(self, *, other_task_id: str, user_id: str, **fields) -> OtherTask | None: ...

    @abstractmethod
    def delete_other_task(self, *, other_task_id: str, user_id: str) -> None: ...

    @abstractmethod
    def add_push_subscription(
        self, *, user_id: str, endpoint: str, p256dh_key: str, auth_key: str
    ) -> PushSubscription: ...

    @abstractmethod
    def list_push_subscriptions(self, *, user_id: str) -> list[PushSubscription]: ...

    @abstractmethod
    def delete_push_subscription(self, *, user_id: str, endpoint: str) -> None: ...

    @abstractmethod
    def create_share(self, *, experiment_id: str | None, goal_id: str | None) -> Share: ...

    @abstractmethod
    def get_share_by_token(self, *, token: str) -> Share | None: ...

    @abstractmethod
    def get_share_for_item(
        self, *, experiment_id: str | None = None, goal_id: str | None = None
    ) -> Share | None: ...

    @abstractmethod
    def delete_share(self, *, share_id: str) -> None:
        """Also deletes every comment/like on it (schema.sql's on delete cascade)."""
        ...

    @abstractmethod
    def add_comment(self, *, share_id: str, user_id: str, body: str) -> Comment: ...

    @abstractmethod
    def list_comments(self, *, share_id: str) -> list[Comment]: ...

    @abstractmethod
    def get_comment(self, *, comment_id: str) -> Comment | None: ...

    @abstractmethod
    def delete_comment(self, *, comment_id: str) -> None: ...

    @abstractmethod
    def add_like(self, *, share_id: str, user_id: str) -> Like:
        """Idempotent: liking twice returns the existing Like, no duplicate row."""
        ...

    @abstractmethod
    def remove_like(self, *, share_id: str, user_id: str) -> None: ...

    @abstractmethod
    def count_likes(self, *, share_id: str) -> int: ...

    @abstractmethod
    def user_has_liked(self, *, share_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def get_experiment_owner_id(self, *, experiment_id: str) -> str | None:
        """Owner-agnostic lookup for the public shared-page route, which has
        no signed-in owner to scope a normal get_experiment call by."""
        ...

    @abstractmethod
    def get_goal_owner_id(self, *, goal_id: str) -> str | None: ...
