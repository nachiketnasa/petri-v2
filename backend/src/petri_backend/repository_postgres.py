"""Postgres-backed implementation of `Repository`.

Plain parameterized SQL via psycopg3 (sync) against the `users`, `experiments`,
`check_ins`, and `retros` tables in `_docs/schema.sql`. No query builder, no ORM.

Semantics mirror `repository_memory.InMemoryRepository` exactly: case-insensitive
email lookup (via the schema's `citext` column), `None`/`[]` on missing/foreign
data, and `ValueError` from `add_check_in`/`add_retro` on a mismatched user.

Apply the schema by hand before using this (no migration framework):
    psql "$DATABASE_URL" -f _docs/schema.sql
"""

from __future__ import annotations

from datetime import datetime

import psycopg

import secrets

from petri_backend.repository import (
    CheckIn,
    Comment,
    Experiment,
    Goal,
    Like,
    Milestone,
    OtherTask,
    PushSubscription,
    RecoveryCode,
    Repository,
    Retro,
    Share,
    User,
)

# Columns `update_experiment` is allowed to set, matching the Experiment dataclass
# (minus id/user_id, which identify the row rather than being updatable fields).
_EXPERIMENT_UPDATABLE_FIELDS = {
    "title",
    "hypothesis",
    "cadence_type",
    "cadence_days",
    "check_in_kind",
    "start_date",
    "target_days",
    "status",
    "ended_early",
    "abandon_reason",
    "created_at",
    "updated_at",
    "archived_at",
}

# Columns `update_user` is allowed to set -- Settings preferences (#37),
# email_verified_at (#23), totp_secret/totp_enabled (#3); email/password/
# display_name/timezone go through their own dedicated flows.
_USER_UPDATABLE_FIELDS = {
    "theme",
    "sound_effects_enabled",
    "other_tasks_enabled",
    "default_landing",
    "email_verified_at",
    "totp_secret",
    "totp_enabled",
    "password_hash",
}


_USER_COLUMNS = (
    "id, email, password_hash, display_name, timezone, created_at, "
    "theme, sound_effects_enabled, other_tasks_enabled, default_landing, "
    "email_verified_at, totp_secret, totp_enabled"
)

_OTHER_TASK_COLUMNS = (
    "id, user_id, title, schedule_type, one_time_date, repeat_days_of_week, "
    "repeat_interval_days, repeat_end_date, push_reminder_enabled, created_at, updated_at"
)

_OTHER_TASK_UPDATABLE_FIELDS = {
    "title",
    "schedule_type",
    "one_time_date",
    "repeat_days_of_week",
    "repeat_interval_days",
    "repeat_end_date",
    "push_reminder_enabled",
    "updated_at",
}

_EXPERIMENT_COLUMNS = (
    "id, user_id, title, hypothesis, cadence_type, cadence_days, "
    "check_in_kind, start_date, target_days, status, ended_early, "
    "abandon_reason, created_at, updated_at, archived_at"
)

_GOAL_COLUMNS = (
    "id, user_id, title, why_text, start_date, target_date, status, "
    "ended_early, abandon_reason, evolved_from_experiment_id, "
    "branched_into_goal_id, branched_from_goal_id, created_at, updated_at, archived_at"
)

_MILESTONE_COLUMNS = (
    "id, goal_id, order_index, title, cadence_type, cadence_days, "
    "check_in_kind, target_date, started_at, status, ended_early, abandon_reason, "
    "created_at, updated_at, archived_at"
)

_CHECK_IN_COLUMNS = "id, experiment_id, milestone_id, value_bool, value_rating, note, checked_in_at"

_RETRO_COLUMNS = "id, experiment_id, milestone_id, goal_id, what_worked, what_didnt, decision, created_at"

# Columns `update_goal`/`update_milestone` are allowed to set.
_GOAL_UPDATABLE_FIELDS = {
    "title",
    "why_text",
    "start_date",
    "target_date",
    "status",
    "ended_early",
    "abandon_reason",
    "evolved_from_experiment_id",
    "branched_into_goal_id",
    "branched_from_goal_id",
    "created_at",
    "updated_at",
    "archived_at",
}

_MILESTONE_UPDATABLE_FIELDS = {
    "title",
    "cadence_type",
    "cadence_days",
    "check_in_kind",
    "target_date",
    "started_at",
    "status",
    "ended_early",
    "abandon_reason",
    "created_at",
    "updated_at",
    "archived_at",
}


def _row_to_user(row: tuple) -> User:
    return User(
        id=str(row[0]),
        email=row[1],
        password_hash=row[2],
        display_name=row[3],
        timezone=row[4],
        created_at=row[5],
        theme=row[6],
        sound_effects_enabled=row[7],
        other_tasks_enabled=row[8],
        default_landing=row[9],
        email_verified_at=row[10],
        totp_secret=row[11],
        totp_enabled=row[12],
    )


def _row_to_other_task(row: tuple) -> OtherTask:
    return OtherTask(
        id=str(row[0]),
        user_id=str(row[1]),
        title=row[2],
        schedule_type=row[3],
        one_time_date=row[4],
        repeat_days_of_week=list(row[5]) if row[5] is not None else None,
        repeat_interval_days=row[6],
        repeat_end_date=row[7],
        push_reminder_enabled=row[8],
        created_at=row[9],
        updated_at=row[10],
    )


def _row_to_share(row: tuple) -> Share:
    return Share(
        id=str(row[0]),
        experiment_id=str(row[1]) if row[1] else None,
        goal_id=str(row[2]) if row[2] else None,
        token=row[3],
        created_at=row[4],
    )


def _row_to_comment(row: tuple) -> Comment:
    return Comment(id=str(row[0]), share_id=str(row[1]), user_id=str(row[2]), body=row[3], created_at=row[4])


def _row_to_like(row: tuple) -> Like:
    return Like(id=str(row[0]), share_id=str(row[1]), user_id=str(row[2]), created_at=row[3])


def _row_to_push_subscription(row: tuple) -> PushSubscription:
    return PushSubscription(
        id=str(row[0]), user_id=str(row[1]), endpoint=row[2], p256dh_key=row[3],
        auth_key=row[4], created_at=row[5],
    )


def _row_to_recovery_code(row: tuple) -> RecoveryCode:
    return RecoveryCode(
        id=str(row[0]), user_id=str(row[1]), code_hash=row[2], created_at=row[3]
    )


def _row_to_experiment(row: tuple) -> Experiment:
    return Experiment(
        id=str(row[0]),
        user_id=str(row[1]),
        title=row[2],
        hypothesis=row[3],
        cadence_type=row[4],
        cadence_days=row[5],
        check_in_kind=row[6],
        start_date=row[7],
        target_days=row[8],
        status=row[9],
        ended_early=row[10],
        abandon_reason=row[11],
        created_at=row[12],
        updated_at=row[13],
        archived_at=row[14],
    )


def _row_to_check_in(row: tuple) -> CheckIn:
    return CheckIn(
        id=str(row[0]),
        experiment_id=str(row[1]) if row[1] else None,
        milestone_id=str(row[2]) if row[2] else None,
        value_bool=row[3],
        value_rating=row[4],
        note=row[5],
        checked_in_at=row[6],
    )


def _row_to_retro(row: tuple) -> Retro:
    return Retro(
        id=str(row[0]),
        experiment_id=str(row[1]) if row[1] else None,
        milestone_id=str(row[2]) if row[2] else None,
        goal_id=str(row[3]) if row[3] else None,
        what_worked=row[4],
        what_didnt=row[5],
        decision=row[6],
        created_at=row[7],
    )


def _row_to_goal(row: tuple) -> Goal:
    return Goal(
        id=str(row[0]),
        user_id=str(row[1]),
        title=row[2],
        why_text=row[3],
        start_date=row[4],
        target_date=row[5],
        status=row[6],
        ended_early=row[7],
        abandon_reason=row[8],
        evolved_from_experiment_id=str(row[9]) if row[9] else None,
        branched_into_goal_id=str(row[10]) if row[10] else None,
        branched_from_goal_id=str(row[11]) if row[11] else None,
        created_at=row[12],
        updated_at=row[13],
        archived_at=row[14],
    )


def _row_to_milestone(row: tuple) -> Milestone:
    return Milestone(
        id=str(row[0]),
        goal_id=str(row[1]),
        order_index=row[2],
        title=row[3],
        cadence_type=row[4],
        cadence_days=row[5],
        check_in_kind=row[6],
        target_date=row[7],
        started_at=row[8],
        status=row[9],
        ended_early=row[10],
        abandon_reason=row[11],
        created_at=row[12],
        updated_at=row[13],
        archived_at=row[14],
    )


class PostgresRepository(Repository):
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def _connect(self) -> psycopg.Connection:
        conn = psycopg.connect(self._database_url)
        conn.autocommit = True
        return conn

    def create_user(
        self,
        *,
        email: str,
        password_hash: str | None,
        display_name: str,
        timezone: str = "UTC",
    ) -> User:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into users (email, password_hash, display_name, timezone)
                values (%s, %s, %s, %s)
                returning {_USER_COLUMNS}
                """,
                (email, password_hash, display_name, timezone),
            )
            return _row_to_user(cur.fetchone())

    def get_user_by_id(self, *, user_id: str) -> User | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_USER_COLUMNS} from users where id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            return _row_to_user(row) if row else None

    def get_user_by_email(self, *, email: str) -> User | None:
        # `users.email` is `citext` — case-insensitive comparison without lower().
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_USER_COLUMNS} from users where email = %s",
                (email,),
            )
            row = cur.fetchone()
            return _row_to_user(row) if row else None

    def update_user(self, *, user_id: str, **fields) -> User | None:
        if not fields:
            return self.get_user_by_id(user_id=user_id)

        unknown = set(fields) - _USER_UPDATABLE_FIELDS
        if unknown:
            raise ValueError(f"unknown user field(s): {sorted(unknown)}")

        set_clause = ", ".join(f"{key} = %s" for key in fields)
        values = list(fields.values()) + [user_id]
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"update users set {set_clause} where id = %s returning {_USER_COLUMNS}",
                values,
            )
            row = cur.fetchone()
            return _row_to_user(row) if row else None

    def replace_recovery_codes(self, *, user_id: str, code_hashes: list[str]) -> list[RecoveryCode]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("delete from totp_recovery_codes where user_id = %s", (user_id,))
            created = []
            for code_hash in code_hashes:
                cur.execute(
                    """
                    insert into totp_recovery_codes (user_id, code_hash)
                    values (%s, %s)
                    returning id, user_id, code_hash, created_at
                    """,
                    (user_id, code_hash),
                )
                created.append(_row_to_recovery_code(cur.fetchone()))
            return created

    def list_recovery_codes(self, *, user_id: str) -> list[RecoveryCode]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, user_id, code_hash, created_at from totp_recovery_codes "
                "where user_id = %s",
                (user_id,),
            )
            return [_row_to_recovery_code(row) for row in cur.fetchall()]

    def delete_recovery_code(self, *, recovery_code_id: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("delete from totp_recovery_codes where id = %s", (recovery_code_id,))

    def create_email_verification(
        self, *, user_id: str, code_hash: str, expires_at: datetime
    ) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into email_verifications (user_id, code_hash, expires_at) "
                "values (%s, %s, %s)",
                (user_id, code_hash, expires_at),
            )

    def consume_email_verification(self, *, code_hash: str) -> str | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "update email_verifications set consumed_at = now() "
                "where code_hash = %s and consumed_at is null and expires_at > now() "
                "returning user_id",
                (code_hash,),
            )
            row = cur.fetchone()
            return str(row[0]) if row else None

    def create_password_reset(
        self, *, user_id: str, token_hash: str, expires_at: datetime
    ) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into password_resets (user_id, token_hash, expires_at) "
                "values (%s, %s, %s)",
                (user_id, token_hash, expires_at),
            )

    def consume_password_reset(self, *, token_hash: str) -> str | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "update password_resets set consumed_at = now() "
                "where token_hash = %s and consumed_at is null and expires_at > now() "
                "returning user_id",
                (token_hash,),
            )
            row = cur.fetchone()
            return str(row[0]) if row else None

    def create_session(
        self, *, session_id: str, user_id: str, expires_at: datetime
    ) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            # Keeps dead rows bounded per user without a purge job.
            cur.execute(
                "delete from sessions where user_id = %s "
                "and (expires_at <= now() or revoked_at is not null)",
                (user_id,),
            )
            cur.execute(
                "insert into sessions (id, user_id, expires_at) values (%s, %s, %s)",
                (session_id, user_id, expires_at),
            )

    def get_session_user_id(self, *, session_id: str) -> str | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select user_id from sessions "
                "where id = %s and revoked_at is null and expires_at > now()",
                (session_id,),
            )
            row = cur.fetchone()
            return str(row[0]) if row else None

    def revoke_session(self, *, session_id: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "update sessions set revoked_at = now() "
                "where id = %s and revoked_at is null",
                (session_id,),
            )

    def revoke_user_sessions(self, *, user_id: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "update sessions set revoked_at = now() "
                "where user_id = %s and revoked_at is null",
                (user_id,),
            )

    def create_experiment(
        self,
        *,
        user_id: str,
        title: str,
        hypothesis: str,
        cadence_type: str,
        cadence_days: int | None,
        check_in_kind: str,
        start_date,
        target_days: int,
    ) -> Experiment:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into experiments
                    (user_id, title, hypothesis, cadence_type, cadence_days,
                     check_in_kind, start_date, target_days)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                returning id, user_id, title, hypothesis, cadence_type, cadence_days,
                          check_in_kind, start_date, target_days, status, ended_early,
                          abandon_reason, created_at, updated_at, archived_at
                """,
                (
                    user_id,
                    title,
                    hypothesis,
                    cadence_type,
                    cadence_days,
                    check_in_kind,
                    start_date,
                    target_days,
                ),
            )
            return _row_to_experiment(cur.fetchone())

    def list_experiments(
        self, *, user_id: str, status: str | None = None
    ) -> list[Experiment]:
        with self._connect() as conn, conn.cursor() as cur:
            if status is None:
                cur.execute(
                    """
                    select id, user_id, title, hypothesis, cadence_type, cadence_days,
                           check_in_kind, start_date, target_days, status, ended_early,
                           abandon_reason, created_at, updated_at, archived_at
                    from experiments where user_id = %s
                    """,
                    (user_id,),
                )
            else:
                cur.execute(
                    """
                    select id, user_id, title, hypothesis, cadence_type, cadence_days,
                           check_in_kind, start_date, target_days, status, ended_early,
                           abandon_reason, created_at, updated_at, archived_at
                    from experiments where user_id = %s and status = %s
                    """,
                    (user_id, status),
                )
            return [_row_to_experiment(row) for row in cur.fetchall()]

    def get_experiment(self, *, experiment_id: str, user_id: str) -> Experiment | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select id, user_id, title, hypothesis, cadence_type, cadence_days,
                       check_in_kind, start_date, target_days, status, ended_early,
                       abandon_reason, created_at, updated_at, archived_at
                from experiments where id = %s and user_id = %s
                """,
                (experiment_id, user_id),
            )
            row = cur.fetchone()
            return _row_to_experiment(row) if row else None

    def update_experiment(
        self, *, experiment_id: str, user_id: str, **fields
    ) -> Experiment | None:
        if not fields:
            return self.get_experiment(experiment_id=experiment_id, user_id=user_id)

        unknown = set(fields) - _EXPERIMENT_UPDATABLE_FIELDS
        if unknown:
            raise ValueError(f"unknown experiment field(s): {sorted(unknown)}")

        set_clause = ", ".join(f"{key} = %s" for key in fields)
        values = list(fields.values()) + [experiment_id, user_id]
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                update experiments set {set_clause}
                where id = %s and user_id = %s
                returning id, user_id, title, hypothesis, cadence_type, cadence_days,
                          check_in_kind, start_date, target_days, status, ended_early,
                          abandon_reason, created_at, updated_at, archived_at
                """,
                values,
            )
            row = cur.fetchone()
            return _row_to_experiment(row) if row else None

    def add_check_in(
        self,
        *,
        experiment_id: str,
        user_id: str,
        value_bool: bool | None = None,
        value_rating: int | None = None,
        note: str | None = None,
        checked_in_at,
    ) -> CheckIn:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            raise ValueError("experiment not found for this user")
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into check_ins (experiment_id, value_bool, value_rating, note, checked_in_at)
                values (%s, %s, %s, %s, %s)
                returning {_CHECK_IN_COLUMNS}
                """,
                (experiment_id, value_bool, value_rating, note, checked_in_at),
            )
            return _row_to_check_in(cur.fetchone())

    def list_check_ins(self, *, experiment_id: str, user_id: str) -> list[CheckIn]:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            return []
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_CHECK_IN_COLUMNS} from check_ins where experiment_id = %s",
                (experiment_id,),
            )
            return [_row_to_check_in(row) for row in cur.fetchall()]

    def add_retro(
        self,
        *,
        experiment_id: str,
        user_id: str,
        what_worked: str,
        what_didnt: str,
        decision: str,
    ) -> Retro:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            raise ValueError("experiment not found for this user")
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into retros (experiment_id, what_worked, what_didnt, decision)
                values (%s, %s, %s, %s)
                returning {_RETRO_COLUMNS}
                """,
                (experiment_id, what_worked, what_didnt, decision),
            )
            return _row_to_retro(cur.fetchone())

    def get_retro(self, *, experiment_id: str, user_id: str) -> Retro | None:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            return None
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_RETRO_COLUMNS} from retros where experiment_id = %s",
                (experiment_id,),
            )
            row = cur.fetchone()
            return _row_to_retro(row) if row else None

    def create_goal(
        self,
        *,
        user_id: str,
        title: str,
        why_text: str,
        start_date,
        target_date,
        milestones: list[dict],
    ) -> Goal:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into goals (user_id, title, why_text, start_date, target_date)
                values (%s, %s, %s, %s, %s)
                returning {_GOAL_COLUMNS}
                """,
                (user_id, title, why_text, start_date, target_date),
            )
            goal = _row_to_goal(cur.fetchone())
            for index, spec in enumerate(milestones):
                cur.execute(
                    """
                    insert into milestones
                        (goal_id, order_index, title, cadence_type, cadence_days,
                         check_in_kind, target_date)
                    values (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        goal.id,
                        index,
                        spec["title"],
                        spec["cadence_type"],
                        spec.get("cadence_days"),
                        spec.get("check_in_kind") or "boolean",
                        spec.get("target_date"),
                    ),
                )
            return goal

    def list_goals(self, *, user_id: str, status: str | None = None) -> list[Goal]:
        with self._connect() as conn, conn.cursor() as cur:
            if status is None:
                cur.execute(f"select {_GOAL_COLUMNS} from goals where user_id = %s", (user_id,))
            else:
                cur.execute(
                    f"select {_GOAL_COLUMNS} from goals where user_id = %s and status = %s",
                    (user_id, status),
                )
            return [_row_to_goal(row) for row in cur.fetchall()]

    def get_goal(self, *, goal_id: str, user_id: str) -> Goal | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_GOAL_COLUMNS} from goals where id = %s and user_id = %s",
                (goal_id, user_id),
            )
            row = cur.fetchone()
            return _row_to_goal(row) if row else None

    def update_goal(self, *, goal_id: str, user_id: str, **fields) -> Goal | None:
        if not fields:
            return self.get_goal(goal_id=goal_id, user_id=user_id)
        unknown = set(fields) - _GOAL_UPDATABLE_FIELDS
        if unknown:
            raise ValueError(f"unknown goal field(s): {sorted(unknown)}")
        set_clause = ", ".join(f"{key} = %s" for key in fields)
        values = list(fields.values()) + [goal_id, user_id]
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                update goals set {set_clause}
                where id = %s and user_id = %s
                returning {_GOAL_COLUMNS}
                """,
                values,
            )
            row = cur.fetchone()
            return _row_to_goal(row) if row else None

    def list_milestones(self, *, goal_id: str, user_id: str) -> list[Milestone]:
        if self.get_goal(goal_id=goal_id, user_id=user_id) is None:
            return []
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_MILESTONE_COLUMNS} from milestones "
                "where goal_id = %s order by order_index",
                (goal_id,),
            )
            return [_row_to_milestone(row) for row in cur.fetchall()]

    def get_milestone(self, *, milestone_id: str, user_id: str) -> Milestone | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select {", ".join(f"m.{c.strip()}" for c in _MILESTONE_COLUMNS.split(","))}
                from milestones m join goals g on g.id = m.goal_id
                where m.id = %s and g.user_id = %s
                """,
                (milestone_id, user_id),
            )
            row = cur.fetchone()
            return _row_to_milestone(row) if row else None

    def update_milestone(self, *, milestone_id: str, user_id: str, **fields) -> Milestone | None:
        if self.get_milestone(milestone_id=milestone_id, user_id=user_id) is None:
            return None
        if not fields:
            return self.get_milestone(milestone_id=milestone_id, user_id=user_id)
        unknown = set(fields) - _MILESTONE_UPDATABLE_FIELDS
        if unknown:
            raise ValueError(f"unknown milestone field(s): {sorted(unknown)}")
        set_clause = ", ".join(f"{key} = %s" for key in fields)
        values = list(fields.values()) + [milestone_id]
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"update milestones set {set_clause} where id = %s returning {_MILESTONE_COLUMNS}",
                values,
            )
            row = cur.fetchone()
            return _row_to_milestone(row) if row else None

    def add_milestone(
        self,
        *,
        goal_id: str,
        user_id: str,
        title: str,
        cadence_type: str,
        cadence_days: int | None,
        check_in_kind: str,
        target_date,
    ) -> Milestone | None:
        if self.get_goal(goal_id=goal_id, user_id=user_id) is None:
            return None
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select coalesce(max(order_index), -1) + 1 from milestones where goal_id = %s",
                (goal_id,),
            )
            next_index = cur.fetchone()[0]
            cur.execute(
                f"""
                insert into milestones
                    (goal_id, order_index, title, cadence_type, cadence_days,
                     check_in_kind, target_date)
                values (%s, %s, %s, %s, %s, %s, %s)
                returning {_MILESTONE_COLUMNS}
                """,
                (goal_id, next_index, title, cadence_type, cadence_days, check_in_kind, target_date),
            )
            return _row_to_milestone(cur.fetchone())

    def add_milestone_check_in(
        self,
        *,
        milestone_id: str,
        user_id: str,
        value_bool: bool | None = None,
        value_rating: int | None = None,
        note: str | None = None,
        checked_in_at,
    ) -> CheckIn:
        if self.get_milestone(milestone_id=milestone_id, user_id=user_id) is None:
            raise ValueError("milestone not found for this user")
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into check_ins (milestone_id, value_bool, value_rating, note, checked_in_at)
                values (%s, %s, %s, %s, %s)
                returning {_CHECK_IN_COLUMNS}
                """,
                (milestone_id, value_bool, value_rating, note, checked_in_at),
            )
            return _row_to_check_in(cur.fetchone())

    def list_milestone_check_ins(self, *, milestone_id: str, user_id: str) -> list[CheckIn]:
        if self.get_milestone(milestone_id=milestone_id, user_id=user_id) is None:
            return []
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_CHECK_IN_COLUMNS} from check_ins where milestone_id = %s",
                (milestone_id,),
            )
            return [_row_to_check_in(row) for row in cur.fetchall()]

    def add_goal_retro(
        self, *, goal_id: str, user_id: str, what_worked: str, what_didnt: str, decision: str
    ) -> Retro:
        if self.get_goal(goal_id=goal_id, user_id=user_id) is None:
            raise ValueError("goal not found for this user")
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into retros (goal_id, what_worked, what_didnt, decision)
                values (%s, %s, %s, %s)
                returning {_RETRO_COLUMNS}
                """,
                (goal_id, what_worked, what_didnt, decision),
            )
            return _row_to_retro(cur.fetchone())

    def add_milestone_retro(
        self, *, milestone_id: str, user_id: str, what_worked: str, what_didnt: str, decision: str
    ) -> Retro:
        if self.get_milestone(milestone_id=milestone_id, user_id=user_id) is None:
            raise ValueError("milestone not found for this user")
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into retros (milestone_id, what_worked, what_didnt, decision)
                values (%s, %s, %s, %s)
                returning {_RETRO_COLUMNS}
                """,
                (milestone_id, what_worked, what_didnt, decision),
            )
            return _row_to_retro(cur.fetchone())

    def create_other_task(
        self,
        *,
        user_id: str,
        title: str,
        schedule_type: str,
        one_time_date,
        repeat_days_of_week: list[int] | None,
        repeat_interval_days: int | None,
        repeat_end_date,
        push_reminder_enabled: bool,
    ) -> OtherTask:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into other_tasks
                    (user_id, title, schedule_type, one_time_date, repeat_days_of_week,
                     repeat_interval_days, repeat_end_date, push_reminder_enabled)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                returning {_OTHER_TASK_COLUMNS}
                """,
                (
                    user_id,
                    title,
                    schedule_type,
                    one_time_date,
                    repeat_days_of_week,
                    repeat_interval_days,
                    repeat_end_date,
                    push_reminder_enabled,
                ),
            )
            return _row_to_other_task(cur.fetchone())

    def list_other_tasks(self, *, user_id: str) -> list[OtherTask]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_OTHER_TASK_COLUMNS} from other_tasks where user_id = %s", (user_id,)
            )
            return [_row_to_other_task(row) for row in cur.fetchall()]

    def get_other_task(self, *, other_task_id: str, user_id: str) -> OtherTask | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {_OTHER_TASK_COLUMNS} from other_tasks where id = %s and user_id = %s",
                (other_task_id, user_id),
            )
            row = cur.fetchone()
            return _row_to_other_task(row) if row else None

    def update_other_task(self, *, other_task_id: str, user_id: str, **fields) -> OtherTask | None:
        if self.get_other_task(other_task_id=other_task_id, user_id=user_id) is None:
            return None
        if not fields:
            return self.get_other_task(other_task_id=other_task_id, user_id=user_id)
        unknown = set(fields) - _OTHER_TASK_UPDATABLE_FIELDS
        if unknown:
            raise ValueError(f"unknown other_task field(s): {sorted(unknown)}")
        set_clause = ", ".join(f"{key} = %s" for key in fields)
        values = list(fields.values()) + [other_task_id, user_id]
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                update other_tasks set {set_clause}
                where id = %s and user_id = %s
                returning {_OTHER_TASK_COLUMNS}
                """,
                values,
            )
            row = cur.fetchone()
            return _row_to_other_task(row) if row else None

    def delete_other_task(self, *, other_task_id: str, user_id: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "delete from other_tasks where id = %s and user_id = %s", (other_task_id, user_id)
            )

    def add_push_subscription(
        self, *, user_id: str, endpoint: str, p256dh_key: str, auth_key: str
    ) -> PushSubscription:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
                values (%s, %s, %s, %s)
                on conflict (endpoint) do update set p256dh_key = excluded.p256dh_key,
                    auth_key = excluded.auth_key
                returning id, user_id, endpoint, p256dh_key, auth_key, created_at
                """,
                (user_id, endpoint, p256dh_key, auth_key),
            )
            return _row_to_push_subscription(cur.fetchone())

    def list_push_subscriptions(self, *, user_id: str) -> list[PushSubscription]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, user_id, endpoint, p256dh_key, auth_key, created_at "
                "from push_subscriptions where user_id = %s",
                (user_id,),
            )
            return [_row_to_push_subscription(row) for row in cur.fetchall()]

    def delete_push_subscription(self, *, user_id: str, endpoint: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "delete from push_subscriptions where user_id = %s and endpoint = %s",
                (user_id, endpoint),
            )

    def create_share(self, *, experiment_id: str | None, goal_id: str | None) -> Share:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into shares (experiment_id, goal_id, token)
                values (%s, %s, %s)
                returning id, experiment_id, goal_id, token, created_at
                """,
                (experiment_id, goal_id, secrets.token_urlsafe(16)),
            )
            return _row_to_share(cur.fetchone())

    def get_share_by_token(self, *, token: str) -> Share | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, experiment_id, goal_id, token, created_at from shares where token = %s",
                (token,),
            )
            row = cur.fetchone()
            return _row_to_share(row) if row else None

    def get_share_for_item(
        self, *, experiment_id: str | None = None, goal_id: str | None = None
    ) -> Share | None:
        with self._connect() as conn, conn.cursor() as cur:
            if experiment_id is not None:
                cur.execute(
                    "select id, experiment_id, goal_id, token, created_at from shares "
                    "where experiment_id = %s",
                    (experiment_id,),
                )
            else:
                cur.execute(
                    "select id, experiment_id, goal_id, token, created_at from shares "
                    "where goal_id = %s",
                    (goal_id,),
                )
            row = cur.fetchone()
            return _row_to_share(row) if row else None

    def delete_share(self, *, share_id: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("delete from shares where id = %s", (share_id,))  # cascades in schema.sql

    def add_comment(self, *, share_id: str, user_id: str, body: str) -> Comment:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into comments (share_id, user_id, body)
                values (%s, %s, %s)
                returning id, share_id, user_id, body, created_at
                """,
                (share_id, user_id, body),
            )
            return _row_to_comment(cur.fetchone())

    def list_comments(self, *, share_id: str) -> list[Comment]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, share_id, user_id, body, created_at from comments "
                "where share_id = %s order by created_at",
                (share_id,),
            )
            return [_row_to_comment(row) for row in cur.fetchall()]

    def get_comment(self, *, comment_id: str) -> Comment | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, share_id, user_id, body, created_at from comments where id = %s",
                (comment_id,),
            )
            row = cur.fetchone()
            return _row_to_comment(row) if row else None

    def delete_comment(self, *, comment_id: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("delete from comments where id = %s", (comment_id,))

    def add_like(self, *, share_id: str, user_id: str) -> Like:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into likes (share_id, user_id)
                values (%s, %s)
                on conflict (share_id, user_id) do update set share_id = excluded.share_id
                returning id, share_id, user_id, created_at
                """,
                (share_id, user_id),
            )
            return _row_to_like(cur.fetchone())

    def remove_like(self, *, share_id: str, user_id: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "delete from likes where share_id = %s and user_id = %s", (share_id, user_id)
            )

    def count_likes(self, *, share_id: str) -> int:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("select count(*) from likes where share_id = %s", (share_id,))
            return cur.fetchone()[0]

    def user_has_liked(self, *, share_id: str, user_id: str) -> bool:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select 1 from likes where share_id = %s and user_id = %s", (share_id, user_id)
            )
            return cur.fetchone() is not None

    def get_experiment_owner_id(self, *, experiment_id: str) -> str | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("select user_id from experiments where id = %s", (experiment_id,))
            row = cur.fetchone()
            return str(row[0]) if row else None

    def get_goal_owner_id(self, *, goal_id: str) -> str | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("select user_id from goals where id = %s", (goal_id,))
            row = cur.fetchone()
            return str(row[0]) if row else None
