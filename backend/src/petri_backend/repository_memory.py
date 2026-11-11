"""Dict-backed in-memory implementation of `Repository`.

No business rules here (WIP limits, archive/retro requirements, etc.) —
it only stores and returns what it's given. Those rules belong to the
service/route code built on top of this interface (see #4, #7).
"""

from __future__ import annotations

import secrets
import uuid
from datetime import date, datetime
from datetime import timezone as _tz

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


class InMemoryRepository(Repository):
    def __init__(self) -> None:
        self._users: dict[str, User] = {}
        self._experiments: dict[str, Experiment] = {}
        self._check_ins: dict[str, CheckIn] = {}
        self._retros: dict[str, Retro] = {}
        self._goals: dict[str, Goal] = {}
        self._milestones: dict[str, Milestone] = {}
        self._recovery_codes: dict[str, RecoveryCode] = {}
        # code_hash/token_hash -> (user_id, expires_at); popped on consume,
        # one-time use: gone either way, same as the recovery codes above.
        self._email_verifications: dict[str, tuple[str, datetime]] = {}
        self._password_resets: dict[str, tuple[str, datetime]] = {}
        self._other_tasks: dict[str, OtherTask] = {}
        self._push_subscriptions: dict[str, PushSubscription] = {}
        self._shares: dict[str, Share] = {}
        self._comments: dict[str, Comment] = {}
        self._likes: dict[str, Like] = {}

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

    def create_email_verification(
        self, *, user_id: str, code_hash: str, expires_at: datetime
    ) -> None:
        self._email_verifications[code_hash] = (user_id, expires_at)

    def consume_email_verification(self, *, code_hash: str) -> str | None:
        entry = self._email_verifications.pop(code_hash, None)
        if entry is None:
            return None
        user_id, expires_at = entry
        return user_id if _utcnow() <= expires_at else None

    def create_password_reset(
        self, *, user_id: str, token_hash: str, expires_at: datetime
    ) -> None:
        self._password_resets[token_hash] = (user_id, expires_at)

    def consume_password_reset(self, *, token_hash: str) -> str | None:
        entry = self._password_resets.pop(token_hash, None)
        if entry is None:
            return None
        user_id, expires_at = entry
        return user_id if _utcnow() <= expires_at else None

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
                started_at=None,
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
        siblings = [m for m in self._milestones.values() if m.goal_id == goal_id]
        next_index = (max((m.order_index for m in siblings), default=-1)) + 1
        now = _utcnow()
        milestone = Milestone(
            id=str(uuid.uuid4()),
            goal_id=goal_id,
            order_index=next_index,
            title=title,
            cadence_type=cadence_type,
            cadence_days=cadence_days,
            check_in_kind=check_in_kind,
            target_date=target_date,
            started_at=None,
            status="backlog",
            ended_early=False,
            abandon_reason=None,
            created_at=now,
            updated_at=now,
            archived_at=None,
        )
        self._milestones[milestone.id] = milestone
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
    ) -> OtherTask:
        now = _utcnow()
        task = OtherTask(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            schedule_type=schedule_type,
            one_time_date=one_time_date,
            repeat_days_of_week=repeat_days_of_week,
            repeat_interval_days=repeat_interval_days,
            repeat_end_date=repeat_end_date,
            push_reminder_enabled=push_reminder_enabled,
            created_at=now,
            updated_at=now,
        )
        self._other_tasks[task.id] = task
        return task

    def list_other_tasks(self, *, user_id: str) -> list[OtherTask]:
        return [t for t in self._other_tasks.values() if t.user_id == user_id]

    def get_other_task(self, *, other_task_id: str, user_id: str) -> OtherTask | None:
        task = self._other_tasks.get(other_task_id)
        if task is None or task.user_id != user_id:
            return None
        return task

    def update_other_task(self, *, other_task_id: str, user_id: str, **fields) -> OtherTask | None:
        task = self.get_other_task(other_task_id=other_task_id, user_id=user_id)
        if task is None:
            return None
        for key, value in fields.items():
            setattr(task, key, value)
        task.updated_at = _utcnow()
        return task

    def delete_other_task(self, *, other_task_id: str, user_id: str) -> None:
        task = self.get_other_task(other_task_id=other_task_id, user_id=user_id)
        if task is not None:
            del self._other_tasks[task.id]

    def add_push_subscription(
        self, *, user_id: str, endpoint: str, p256dh_key: str, auth_key: str
    ) -> PushSubscription:
        sub = PushSubscription(
            id=str(uuid.uuid4()),
            user_id=user_id,
            endpoint=endpoint,
            p256dh_key=p256dh_key,
            auth_key=auth_key,
            created_at=_utcnow(),
        )
        self._push_subscriptions[sub.id] = sub
        return sub

    def list_push_subscriptions(self, *, user_id: str) -> list[PushSubscription]:
        return [s for s in self._push_subscriptions.values() if s.user_id == user_id]

    def delete_push_subscription(self, *, user_id: str, endpoint: str) -> None:
        for sub_id in [
            s.id
            for s in self._push_subscriptions.values()
            if s.user_id == user_id and s.endpoint == endpoint
        ]:
            del self._push_subscriptions[sub_id]


    def create_share(self, *, experiment_id: str | None, goal_id: str | None) -> Share:
        share = Share(
            id=str(uuid.uuid4()),
            experiment_id=experiment_id,
            goal_id=goal_id,
            token=secrets.token_urlsafe(16),
            created_at=_utcnow(),
        )
        self._shares[share.id] = share
        return share

    def get_share_by_token(self, *, token: str) -> Share | None:
        for s in self._shares.values():
            if s.token == token:
                return s
        return None

    def get_share_for_item(
        self, *, experiment_id: str | None = None, goal_id: str | None = None
    ) -> Share | None:
        for s in self._shares.values():
            if experiment_id is not None and s.experiment_id == experiment_id:
                return s
            if goal_id is not None and s.goal_id == goal_id:
                return s
        return None

    def delete_share(self, *, share_id: str) -> None:
        self._shares.pop(share_id, None)
        for c_id in [c.id for c in self._comments.values() if c.share_id == share_id]:
            del self._comments[c_id]
        for l_id in [l.id for l in self._likes.values() if l.share_id == share_id]:
            del self._likes[l_id]

    def add_comment(self, *, share_id: str, user_id: str, body: str) -> Comment:
        comment = Comment(
            id=str(uuid.uuid4()), share_id=share_id, user_id=user_id, body=body, created_at=_utcnow()
        )
        self._comments[comment.id] = comment
        return comment

    def list_comments(self, *, share_id: str) -> list[Comment]:
        return sorted(
            (c for c in self._comments.values() if c.share_id == share_id),
            key=lambda c: c.created_at,
        )

    def get_comment(self, *, comment_id: str) -> Comment | None:
        return self._comments.get(comment_id)

    def delete_comment(self, *, comment_id: str) -> None:
        self._comments.pop(comment_id, None)

    def add_like(self, *, share_id: str, user_id: str) -> Like:
        for like in self._likes.values():
            if like.share_id == share_id and like.user_id == user_id:
                return like
        like = Like(id=str(uuid.uuid4()), share_id=share_id, user_id=user_id, created_at=_utcnow())
        self._likes[like.id] = like
        return like

    def remove_like(self, *, share_id: str, user_id: str) -> None:
        for l_id in [
            l.id for l in self._likes.values() if l.share_id == share_id and l.user_id == user_id
        ]:
            del self._likes[l_id]

    def count_likes(self, *, share_id: str) -> int:
        return sum(1 for l in self._likes.values() if l.share_id == share_id)

    def user_has_liked(self, *, share_id: str, user_id: str) -> bool:
        return any(l.share_id == share_id and l.user_id == user_id for l in self._likes.values())

    def get_experiment_owner_id(self, *, experiment_id: str) -> str | None:
        e = self._experiments.get(experiment_id)
        return e.user_id if e else None

    def get_goal_owner_id(self, *, goal_id: str) -> str | None:
        g = self._goals.get(goal_id)
        return g.user_id if g else None


def _utcnow() -> datetime:
    return datetime.now(tz=_tz.utc)
