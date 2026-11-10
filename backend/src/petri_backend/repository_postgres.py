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

import psycopg

from petri_backend.repository import CheckIn, Experiment, Repository, Retro, User

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


def _row_to_user(row: tuple) -> User:
    return User(
        id=str(row[0]),
        email=row[1],
        password_hash=row[2],
        display_name=row[3],
        timezone=row[4],
        created_at=row[5],
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
        experiment_id=str(row[1]),
        value_bool=row[2],
        value_rating=row[3],
        note=row[4],
        checked_in_at=row[5],
    )


def _row_to_retro(row: tuple) -> Retro:
    return Retro(
        id=str(row[0]),
        experiment_id=str(row[1]),
        what_worked=row[2],
        what_didnt=row[3],
        decision=row[4],
        created_at=row[5],
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
                """
                insert into users (email, password_hash, display_name, timezone)
                values (%s, %s, %s, %s)
                returning id, email, password_hash, display_name, timezone, created_at
                """,
                (email, password_hash, display_name, timezone),
            )
            return _row_to_user(cur.fetchone())

    def get_user_by_id(self, *, user_id: str) -> User | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, email, password_hash, display_name, timezone, created_at "
                "from users where id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            return _row_to_user(row) if row else None

    def get_user_by_email(self, *, email: str) -> User | None:
        # `users.email` is `citext` — case-insensitive comparison without lower().
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, email, password_hash, display_name, timezone, created_at "
                "from users where email = %s",
                (email,),
            )
            row = cur.fetchone()
            return _row_to_user(row) if row else None

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
                """
                insert into check_ins (experiment_id, value_bool, value_rating, note, checked_in_at)
                values (%s, %s, %s, %s, %s)
                returning id, experiment_id, value_bool, value_rating, note, checked_in_at
                """,
                (experiment_id, value_bool, value_rating, note, checked_in_at),
            )
            return _row_to_check_in(cur.fetchone())

    def list_check_ins(self, *, experiment_id: str, user_id: str) -> list[CheckIn]:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            return []
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, experiment_id, value_bool, value_rating, note, checked_in_at "
                "from check_ins where experiment_id = %s",
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
                """
                insert into retros (experiment_id, what_worked, what_didnt, decision)
                values (%s, %s, %s, %s)
                returning id, experiment_id, what_worked, what_didnt, decision, created_at
                """,
                (experiment_id, what_worked, what_didnt, decision),
            )
            return _row_to_retro(cur.fetchone())

    def get_retro(self, *, experiment_id: str, user_id: str) -> Retro | None:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            return None
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, experiment_id, what_worked, what_didnt, decision, created_at "
                "from retros where experiment_id = %s",
                (experiment_id,),
            )
            row = cur.fetchone()
            return _row_to_retro(row) if row else None
