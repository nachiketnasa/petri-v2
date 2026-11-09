-- Petri v2 — PostgreSQL schema
--
-- Mirrors _docs/specs.md "Core entities" and "Lineage, for a future branch diagram".
-- Sits entirely behind the repository interface shown in _docs/architecture.html —
-- nothing above that layer touches this file's tables directly.
--
-- Enums are modeled as TEXT + CHECK rather than native Postgres ENUM types: adding a
-- new value is an ALTER TABLE ... DROP/ADD CONSTRAINT, not an ALTER TYPE with its own
-- quirks, which matters more here than the small storage saving a real enum gives.

create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "citext";   -- case-insensitive, unique-safe email column

-- ─── Users & auth ────────────────────────────────────────────────────────────

create table users (
  id                   uuid primary key default gen_random_uuid(),
  email                citext not null unique, -- one account per email, every signup method included
  email_verified_at    timestamptz,
  password_hash        text, -- null for users who only ever used OAuth
  display_name         text not null,
  timezone             text not null default 'UTC', -- IANA name; drives all due/overdue math
  theme                text not null default 'petri-light'
                         check (theme in ('petri-light','petri-dark','solarized-light','solarized-dark')),
  sound_effects_enabled boolean not null default true,
  other_tasks_enabled   boolean not null default false,
  default_landing       text not null default 'greeting'
                         check (default_landing in ('greeting','dashboard')),

  -- two-factor auth: off by default; totp_secret is set as soon as the user starts
  -- enrollment, but totp_enabled only flips to true once they've confirmed one
  -- correct code (see specs.md "Authentication"). Encrypt totp_secret at the
  -- application layer before it lands here — this column stores ciphertext, not a
  -- plaintext secret.
  totp_secret  text,
  totp_enabled boolean not null default false,

  created_at            timestamptz not null default now(),
  deleted_at            timestamptz -- account deletion is a hard delete; see cascades below
);

-- One row per OAuth identity linked to a user. A user may link more than one
-- provider, but every provider identity still resolves to the single users.email
-- uniqueness constraint above — that's what "one account per email" is enforced by.
create table auth_identities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  provider         text not null check (provider in ('google','linkedin','microsoft')),
  provider_user_id text not null,
  provider_email   text not null,
  created_at       timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create table email_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create table password_resets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz -- set on explicit logout
);
create index sessions_user_id_idx on sessions(user_id);

-- One-time 2FA recovery codes, generated as a batch when TOTP is first confirmed.
-- A code is deleted (not just flagged) once used, so "still present" is itself the
-- unused check — no separate used_at column to keep in sync.
create table totp_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  code_hash  text not null,
  created_at timestamptz not null default now()
);
create index totp_recovery_codes_user_idx on totp_recovery_codes(user_id);

-- ─── Experiments, goals, milestones ─────────────────────────────────────────

create table experiments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  title         text not null,
  hypothesis    text not null,
  cadence_type  text not null check (cadence_type in ('daily','weekly','custom')),
  cadence_days  smallint, -- interval in days, required when cadence_type = 'custom'
  check_in_kind text not null check (check_in_kind in ('boolean','rating')),
  start_date    date not null,
  target_days   integer not null, -- target duration, in days
  status        text not null default 'backlog'
                  check (status in ('backlog','active','reflect','archived')),
  ended_early    boolean not null default false,
  abandon_reason text, -- required when ended_early is true; enforced below

  -- lineage: evolve is one edge (experiment -> goal); branch is a two-way pointer
  -- between two experiments. See _docs/architecture.html, figure 3. goals doesn't
  -- exist yet at this point in the file, so evolved_into_goal_id's FK is added
  -- below, once both tables are created.
  evolved_into_goal_id        uuid,
  branched_into_experiment_id uuid references experiments(id),
  branched_from_experiment_id uuid references experiments(id),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,

  check (cadence_type <> 'custom' or cadence_days is not null),
  check (not ended_early or abandon_reason is not null)
);

create table goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null,
  why_text    text not null,
  start_date  date not null,
  target_date date not null,
  status      text not null default 'backlog'
                check (status in ('backlog','active','reflect','archived')),
  ended_early    boolean not null default false,
  abandon_reason text,

  evolved_from_experiment_id uuid references experiments(id),
  branched_into_goal_id      uuid references goals(id),
  branched_from_goal_id      uuid references goals(id),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,

  check (not ended_early or abandon_reason is not null)
);

-- deferred FK now that both tables exist
alter table experiments
  add constraint experiments_evolved_into_goal_fk
  foreign key (evolved_into_goal_id) references goals(id);

-- a goal can be the evolved-into target of at most one experiment
create unique index experiments_evolved_into_goal_uidx on experiments(evolved_into_goal_id) where evolved_into_goal_id is not null;

-- a branch pointer is 1:1 in each direction
create unique index experiments_branched_into_uidx on experiments(branched_into_experiment_id) where branched_into_experiment_id is not null;
create unique index goals_branched_into_uidx on goals(branched_into_goal_id) where branched_into_goal_id is not null;
create index experiments_user_status_idx on experiments(user_id, status);
create index goals_user_status_idx on goals(user_id, status);

create table milestones (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid not null references goals(id) on delete cascade,
  order_index   smallint not null, -- fixed at goal creation; the locked, ordered list
  title         text not null,
  cadence_type  text not null check (cadence_type in ('daily','weekly','custom')),
  cadence_days  smallint,
  check_in_kind text not null check (check_in_kind in ('boolean','rating')),
  target_date   date,
  status        text not null default 'backlog'
                  check (status in ('backlog','active','reflect','archived')),
  ended_early    boolean not null default false,
  abandon_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,

  unique (goal_id, order_index),
  check (cadence_type <> 'custom' or cadence_days is not null),
  check (not ended_early or abandon_reason is not null)
);
create index milestones_goal_idx on milestones(goal_id, order_index);

-- ─── Check-ins & retros ──────────────────────────────────────────────────────

-- belongs to exactly one of an experiment or a milestone
create table check_ins (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid references experiments(id) on delete cascade,
  milestone_id  uuid references milestones(id) on delete cascade,
  value_bool    boolean,
  value_rating  smallint check (value_rating between 1 and 5),
  note          text,
  checked_in_at timestamptz not null, -- in the user's own timezone when written

  check (num_nonnulls(experiment_id, milestone_id) = 1),
  check (num_nonnulls(value_bool, value_rating) = 1)
);
create index check_ins_experiment_idx on check_ins(experiment_id, checked_in_at desc);
create index check_ins_milestone_idx on check_ins(milestone_id, checked_in_at desc);

-- belongs to exactly one of an experiment, a milestone, or a goal; required before
-- that item can move to Archived
create table retros (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid references experiments(id) on delete cascade,
  milestone_id  uuid references milestones(id) on delete cascade,
  goal_id       uuid references goals(id) on delete cascade,
  what_worked   text not null,
  what_didnt    text not null,
  decision      text not null check (decision in ('continue','stop','pivot','iterate')),
  created_at    timestamptz not null default now(),

  check (num_nonnulls(experiment_id, milestone_id, goal_id) = 1)
);

-- ─── Other tasks (optional feature, off by default) ─────────────────────────

create table other_tasks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  title                 text not null,
  schedule_type         text not null check (schedule_type in ('one_time','repeating')),
  one_time_date         date, -- required when schedule_type = 'one_time'
  repeat_days_of_week   smallint[], -- 0=Mon .. 6=Sun; required when repeating on fixed days
  repeat_interval_days  integer, -- alternative to repeat_days_of_week, e.g. "every 3 days"
  repeat_end_date       date, -- required when schedule_type = 'repeating'
  push_reminder_enabled boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  check (schedule_type <> 'one_time' or one_time_date is not null),
  check (schedule_type <> 'repeating' or repeat_end_date is not null)
);
create index other_tasks_user_idx on other_tasks(user_id);

-- no foreign key to experiments/goals/milestones: these only ever feed the daily
-- load count (other tasks + check-ins due + current milestone cadence, see
-- specs.md "Other tasks"), computed in application code, not stored.

-- web push subscriptions, one row per device/browser the user enabled push on
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh_key text not null,
  auth_key   text not null,
  created_at timestamptz not null default now()
);

-- ─── Sharing, comments, likes ────────────────────────────────────────────────

-- a row exists only while sharing is on. Unsharing deletes the row outright
-- (cascading to comments/likes, per specs.md); re-sharing inserts a fresh row
-- with a new token, which is what makes likes/comments start back at zero.
create table shares (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid references experiments(id) on delete cascade,
  goal_id       uuid references goals(id) on delete cascade,
  token         text not null unique, -- unguessable, not the row's sequential id
  created_at    timestamptz not null default now(),

  check (num_nonnulls(experiment_id, goal_id) = 1)
);
create unique index shares_experiment_uidx on shares(experiment_id) where experiment_id is not null;
create unique index shares_goal_uidx on shares(goal_id) where goal_id is not null;
create unique index shares_token_uidx on shares(token);

create table comments (
  id         uuid primary key default gen_random_uuid(),
  share_id   uuid not null references shares(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade, -- commenting requires sign-in
  body       text not null,
  created_at timestamptz not null default now()
);
create index comments_share_idx on comments(share_id, created_at);

create table likes (
  id         uuid primary key default gen_random_uuid(),
  share_id   uuid not null references shares(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (share_id, user_id)
);
