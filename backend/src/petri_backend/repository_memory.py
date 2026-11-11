"""Dict-backed in-memory implementation of `Repository`.

No business rules here (WIP limits, archive/retro requirements, etc.) —
it only stores and returns what it's given. Those rules belong to the
service/route code built on top of this interface (see #4, #7).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from datetime import timezone as _tz

from petri_backend.repository import (
    CheckIn,
    Experiment,
    Goal,
    Milestone,
    RecoveryCode,
    Repository,
    Retro,
    User,
)


class InMemoryRepository(Repository):
    def __init__(self) -> None:
        self._users: dict[str, User] = {}
        self._experiments: dict[str, Experiment] = {}
        self._check_ins: dict[str, CheckIn] = {}
        self._retros: dict[str, Retro] = {}
        self._goals: dict[str, Goal] = {}
        self._milestones: dict[str, Milestone] = {}
        self._recovery_codes: dict[str, RecoveryCode] = {}

    def create_user(
        self,
        *,
        email: str,
        password_hash: str | None,
        display_name: str,
        timezone: str = "UTC",
    ) -> User:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            password_hash=password_hash,
            display_name=display_name,
            timezone=timezone,
            created_at=_utcnow(),
        )
        self._users[user.id] = user
        return user

    def get_user_by_id(self, *, user_id: str) -> User | None:
        return self._users.get(user_id)

    def get_user_by_email(self, *, email: str) -> User | None:
        target = email.lower()
        for user in self._users.values():
            if user.email.lower() == target:
                return user
        return None

    def update_user(self, *, user_id: str, **fields) -> User | None:
        user = self.get_user_by_id(user_id=user_id)
        if user is None:
            return None
        for key, value in fields.items():
            setattr(user, key, value)
        return user

    def replace_recovery_codes(self, *, user_id: str, code_hashes: list[str]) -> list[RecoveryCode]:
        for rc_id in [rc.id for rc in self._recovery_codes.values() if rc.user_id == user_id]:
            del self._recovery_codes[rc_id]
        created = []
        for code_hash in code_hashes:
            rc = RecoveryCode(
                id=str(uuid.uuid4()), user_id=user_id, code_hash=code_hash, created_at=_utcnow()
            )
            self._recovery_codes[rc.id] = rc
            created.append(rc)
        return created

    def list_recovery_codes(self, *, user_id: str) -> list[RecoveryCode]:
        return [rc for rc in self._recovery_codes.values() if rc.user_id == user_id]

    def delete_recovery_code(self, *, recovery_code_id: str) -> None:
        self._recovery_codes.pop(recovery_code_id, None)

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
    ) -> Experiment:
        now = _utcnow()
        experiment = Experiment(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            hypothesis=hypothesis,
            cadence_type=cadence_type,
            cadence_days=cadence_days,
            check_in_kind=check_in_kind,
            start_date=start_date,
            target_days=target_days,
            status="backlog",
            ended_early=False,
            abandon_reason=None,
            created_at=now,
            updated_at=now,
            archived_at=None,
        )
        self._experiments[experiment.id] = experiment
        return experiment

    def list_experiments(
        self, *, user_id: str, status: str | None = None
    ) -> list[Experiment]:
        return [
            experiment
            for experiment in self._experiments.values()
            if experiment.user_id == user_id
            and (status is None or experiment.status == status)
        ]

    def get_experiment(self, *, experiment_id: str, user_id: str) -> Experiment | None:
        experiment = self._experiments.get(experiment_id)
        if experiment is None or experiment.user_id != user_id:
            return None
        return experiment

    def update_experiment(
        self, *, experiment_id: str, user_id: str, **fields
    ) -> Experiment | None:
        experiment = self.get_experiment(experiment_id=experiment_id, user_id=user_id)
        if experiment is None:
            return None
        for key, value in fields.items():
            setattr(experiment, key, value)
        return experiment

    def add_check_in(
        self,
        *,
        experiment_id: str,
        user_id: str,
        value_bool: bool | None = None,
        value_rating: int | None = None,
        note: str | None = None,
        checked_in_at: datetime,
    ) -> CheckIn:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            raise ValueError("experiment not found for this user")
        check_in = CheckIn(
            id=str(uuid.uuid4()),
            experiment_id=experiment_id,
            value_bool=value_bool,
            value_rating=value_rating,
            note=note,
            checked_in_at=checked_in_at,
        )
        self._check_ins[check_in.id] = check_in
        return check_in

    def list_check_ins(self, *, experiment_id: str, user_id: str) -> list[CheckIn]:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            return []
        return [
            check_in
            for check_in in self._check_ins.values()
            if check_in.experiment_id == experiment_id
        ]

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
        retro = Retro(
            id=str(uuid.uuid4()),
            experiment_id=experiment_id,
            what_worked=what_worked,
            what_didnt=what_didnt,
            decision=decision,
            created_at=_utcnow(),
        )
        self._retros[retro.id] = retro
        return retro

    def get_retro(self, *, experiment_id: str, user_id: str) -> Retro | None:
        if self.get_experiment(experiment_id=experiment_id, user_id=user_id) is None:
            return None
        for retro in self._retros.values():
            if retro.experiment_id == experiment_id:
                return retro
        return None

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
        now = _utcnow()
        goal = Goal(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            why_text=why_text,
            start_date=start_date,
            target_date=target_date,
            status="backlog",
            ended_early=False,
            abandon_reason=None,
            evolved_from_experiment_id=None,
            branched_into_goal_id=None,
            branched_from_goal_id=None,
            created_at=now,
            updated_at=now,
            archived_at=None,
        )
        self._goals[goal.id] = goal
        for index, spec in enumerate(milestones):
            milestone = Milestone(
                id=str(uuid.uuid4()),
                goal_id=goal.id,
                order_index=index,
                title=spec["title"],
                cadence_type=spec["cadence_type"],
                cadence_days=spec.get("cadence_days"),
                check_in_kind=spec.get("check_in_kind") or "boolean",
                target_date=spec.get("target_date"),
                status="backlog",
                ended_early=False,
                abandon_reason=None,
                created_at=now,
                updated_at=now,
                archived_at=None,
            )
            self._milestones[milestone.id] = milestone
        return goal

    def list_goals(self, *, user_id: str, status: str | None = None) -> list[Goal]:
        return [
            goal
            for goal in self._goals.values()
            if goal.user_id == user_id and (status is None or goal.status == status)
        ]

    def get_goal(self, *, goal_id: str, user_id: str) -> Goal | None:
        goal = self._goals.get(goal_id)
        if goal is None or goal.user_id != user_id:
            return None
        return goal

    def update_goal(self, *, goal_id: str, user_id: str, **fields) -> Goal | None:
        goal = self.get_goal(goal_id=goal_id, user_id=user_id)
        if goal is None:
            return None
        for key, value in fields.items():
            setattr(goal, key, value)
        return goal

    def list_milestones(self, *, goal_id: str, user_id: str) -> list[Milestone]:
        if self.get_goal(goal_id=goal_id, user_id=user_id) is None:
            return []
        return sorted(
            (m for m in self._milestones.values() if m.goal_id == goal_id),
            key=lambda m: m.order_index,
        )

    def get_milestone(self, *, milestone_id: str, user_id: str) -> Milestone | None:
        milestone = self._milestones.get(milestone_id)
        if milestone is None:
            return None
        if self.get_goal(goal_id=milestone.goal_id, user_id=user_id) is None:
            return None
        return milestone

    def update_milestone(self, *, milestone_id: str, user_id: str, **fields) -> Milestone | None:
        milestone = self.get_milestone(milestone_id=milestone_id, user_id=user_id)
        if milestone is None:
            return None
        for key, value in fields.items():
            setattr(milestone, key, value)
        return milestone

    def add_milestone_check_in(
        self,
        *,
        milestone_id: str,
        user_id: str,
        value_bool: bool | None = None,
        value_rating: int | None = None,
        note: str | None = None,
        checked_in_at: datetime,
    ) -> CheckIn:
        if self.get_milestone(milestone_id=milestone_id, user_id=user_id) is None:
            raise ValueError("milestone not found for this user")
        check_in = CheckIn(
            id=str(uuid.uuid4()),
            experiment_id=None,
            milestone_id=milestone_id,
            value_bool=value_bool,
            value_rating=value_rating,
            note=note,
            checked_in_at=checked_in_at,
        )
        self._check_ins[check_in.id] = check_in
        return check_in

    def list_milestone_check_ins(self, *, milestone_id: str, user_id: str) -> list[CheckIn]:
        if self.get_milestone(milestone_id=milestone_id, user_id=user_id) is None:
            return []
        return [c for c in self._check_ins.values() if c.milestone_id == milestone_id]

    def add_goal_retro(
        self, *, goal_id: str, user_id: str, what_worked: str, what_didnt: str, decision: str
    ) -> Retro:
        if self.get_goal(goal_id=goal_id, user_id=user_id) is None:
            raise ValueError("goal not found for this user")
        retro = Retro(
            id=str(uuid.uuid4()),
            experiment_id=None,
            goal_id=goal_id,
            what_worked=what_worked,
            what_didnt=what_didnt,
            decision=decision,
            created_at=_utcnow(),
        )
        self._retros[retro.id] = retro
        return retro

    def add_milestone_retro(
        self, *, milestone_id: str, user_id: str, what_worked: str, what_didnt: str, decision: str
    ) -> Retro:
        if self.get_milestone(milestone_id=milestone_id, user_id=user_id) is None:
            raise ValueError("milestone not found for this user")
        retro = Retro(
            id=str(uuid.uuid4()),
            experiment_id=None,
            milestone_id=milestone_id,
            what_worked=what_worked,
            what_didnt=what_didnt,
            decision=decision,
            created_at=_utcnow(),
        )
        self._retros[retro.id] = retro
        return retro


def _utcnow() -> datetime:
    return datetime.now(tz=_tz.utc)
