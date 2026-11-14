# Petri v2 — Tiny Experiments & Goals

A fresh rebuild of Petri. v1 was a kanban for personal "tiny experiments" based on the
"Tiny Experiments" (PACT) methodology: Purposeful, Actionable, Continuous, Trackable.
v2 keeps that core, lets a successful experiment grow into a full goal with its own
milestones, adds a lightweight place for ordinary obligations, and leans on the
"Art of Impossible" idea that a person can only really hold so much at once.

## Board model

Columns (fixed, PACT-inspired lifecycle), used by both experiments and milestones:

1. **Backlog** — idea captured, not started
2. **Active** — committed, running, check-ins expected on cadence
3. **Check-in Due** — cadence elapsed, awaiting a log entry (a badge on Active, derived
   from last check-in timestamp + cadence vs. now, not a persisted column)
4. **Reflect** — cadence or duration complete, or ended early; retro required before archiving
5. **Archived** — retro complete, closed

A goal has its own simpler lifecycle: **Backlog → Active → Reflect → Archived**. Its
milestones move through the five columns above, one at a time, in order.

## Core entities

- **User**: account owner. Each user sees only their own board. Optional two-factor
  enrollment (a TOTP secret and a set of one-time recovery codes) lives on the user,
  off by default.
- **Experiment**: title, hypothesis, cadence (daily/weekly/custom interval, set at
  creation), start date, target duration, status (maps to column), optional pointer to
  a successor experiment (branch) and an optional pointer to the goal it evolved into,
  if either happened.
- **Goal**: title, why-this-goal text, start date, target date, status (maps to its
  own lifecycle), ordered list of milestones, optional pointer to a successor goal
  (branch), and an optional pointer to the experiment it evolved from, if it was
  created that way.
- **Milestone**: belongs to a goal, runs exactly like a tiny experiment (own cadence,
  own check-ins) under a different label. Milestones are defined in full when the goal
  is created and locked once the goal is Active — changing the list after that requires
  explicitly abandoning the current milestone with a reason, not a quiet edit. Only one
  milestone is active at a time; completing it activates the next in order.
- **Check-in**: belongs to an experiment or a milestone. Structured field (done / not
  done, or a 1–5 rating, picked once per experiment/milestone at creation) + optional
  free-text note. Timestamped, computed against the user's own timezone.
- **Retro**: belongs to an experiment, milestone, or goal, created when moving to
  Archived. Fields: what worked, what didn't, decision (continue / stop / pivot / iterate).
- **Other task**: an ordinary obligation unrelated to the PACT model (college assignment,
  work item, exam prep). Title, schedule (one-time on a date, or repeating on chosen
  days/interval until an end date — set up like an alarm app's repeat rule), editable,
  removable. See "Other tasks" below.
- **Comment** / **Like**: belong to a shared experiment or goal's public page. Require
  the commenter/liker to be signed in. The owner can delete any comment on their own
  shared item.

## Evolving and branching

- An experiment can **evolve** into a goal, one way only. The experiment's title and
  history carry over; its single cadence is replaced by the goal's milestone structure.
  An evolved experiment leaves the WIP experiment count and the new goal occupies the
  goal slot. The source experiment stays on record (not deleted or merged away) with a
  stored pointer to the goal it became, and the goal stores the pointer back.
- A concluded experiment or a concluded goal can optionally **branch** into a
  successor of the same kind (a fresh experiment with its own cadence, or a fresh goal
  with its own new milestones). The source item is simply Archived either way —
  branching just adds a stored pointer to the item that follows it, on both ends. Not
  everything branches, and branching never changes kind (an experiment branches to an
  experiment; evolving to a goal is the separate operation above).

### Lineage, for a future branch diagram

Every evolve and every branch is written as a real, persisted, two-way pointer between
the two items involved, not just copied field values with the trail discarded. This is
a deliberate architectural commitment, made now, for a **future** node-based diagram
view showing the full lineage of branches and evolutions, either across every
experiment and goal a user has, or filtered to a chosen few. That diagram is explicit
non-goal of v2 (see Non-goals) and is not being designed or built now — but the data
model is shaped so that building it later only means reading edges that already exist,
never a migration or a breaking change to how evolve/branch work.

## Work in progress limits

A user may run **at most 2 experiments and 1 goal Active at the same time**. The product
emphasizes working in series, not in parallel. The dashboard shows this as a live count
(e.g. "2 / 2") and blocks activating a new experiment or goal past the limit.

## Abandoning something early

Ending or deleting an experiment, milestone, or goal before its cadence/duration is up
requires a mandatory one-line reason, stored permanently on that record. The dashboard
shows a quiet, always-visible **completed vs. abandoned** ratio across everything the
user has ever run, so the pattern stays visible without needing to be looked up.

## Streaks

A streak (consecutive cadence periods logged) is shown more visibly than a buried stat,
similar in spirit to Duolingo or Snapchat's streak counter. Unlike those products, Petri
does **not** add loss-aversion mechanics on top of it: no streak freezes to purchase, no
social/friend streaks, no pressure framing. It is the same streak number already tracked,
just given a persistent, visible spot — nothing is sold and nothing is lost by missing a day
beyond the number resetting.

## Other tasks

An optional feature, off by default, turned on from **Settings**. Once enabled:

- A separate "Other tasks" screen, reached from Settings, for tasks unrelated to any
  experiment or goal.
- Each task is one-time (a specific date) or repeating (selected days/interval, until an
  end date) — configured the way a phone's alarm app configures a repeat rule. Editable
  and removable at any time.
- The user can choose to view other tasks standalone, or merged into the Calendar
  alongside experiment and milestone cadences.
- **Daily load warning**: if everything due on a given day — other tasks, experiment
  check-ins, and the active goal's current milestone cadence, combined — exceeds **8**,
  the day is flagged. This threshold follows Steven Kotler's *The Art of Impossible*.
  The warning is informational (a badge/flag), never a hard block.
- **Notifications**: other tasks may trigger a browser push notification (Web Push API,
  standard permission prompt), never email — email has a real per-recipient cost at
  scale that push does not. This is a scoped exception to the product's general
  no-notifications stance (see Non-goals); the rest of the app stays badge-only.
- Native mobile apps, if built later, need their own push path (Firebase Cloud
  Messaging for Android, free; Apple's APNs for iOS, which needs the same paid Apple
  Developer account skipped for Sign in with Apple). Not needed for v2's web-only scope,
  noted here so the backend stays API-first and portable.

## Public landing page

A visitor with no account, hitting the site's root URL, sees a single public page —
not the app, not a login wall. It explains the product in plain language (tiny
experiments that can grow into goals, the PACT shape, the work-in-progress limit,
transparent endings) and offers one clear action: sign in or create an account. No pricing
tiers, no feature-comparison grid, no testimonials — the same restrained,
neumorphic "natural makeup" direction as the rest of the product, not a typical SaaS
page with a big gradient hero. This is separate from, and seen by a different
audience than, the calm post-login greeting screen below, which only a signed-in
user ever reaches.

## Landing screen and dashboard

- Immediately after signing in, the user lands on a calm greeting screen: a time-of-day
  greeting with their name (similar to a new Claude chat window), plus one quiet line
  stating how many things are due today. No stat grid, no cards, no color blocks.
  Progressive disclosure over a full dashboard dump is weakly but directionally
  supported by UX research on revealing information gradually rather than all at once.
- From there the user opens the full dashboard deliberately. A Settings toggle lets a
  user skip the greeting and land directly on the full dashboard instead, if they prefer.
- The full dashboard: card grid of active items, an Experiments / Goals / Both filter,
  WIP count tiles, the completed-vs-abandoned ratio, and a Backlog section.

## Creating an experiment or a goal

Both use a multi-step wizard (details → cadence or milestones → review) instead of one
long form, with a vertical progress rail on the side showing the current step and the
steps already completed. A goal's milestone step is where the full, locked milestone
list is defined (see "Core entities" above).

## Calendar

- **Week view**: Monday through Sunday, its own layout — never a slice cut out of the
  month grid. Previous/next navigation moves by a week.
- **Month view**: starts on the Monday of the week containing the 1st of the month, shows
  every day of that month, and continues through the Sunday that closes the week
  containing the last day — so leading and trailing days from the adjacent months appear,
  faded. Previous/next navigation moves by a month.
- A scope toggle switches between "this cadence only" and "all active" (and, if Other
  tasks is enabled, those too).

## Sharing model

Each experiment or goal can be made **shareable**: a per-item toggle generates a public,
read-only status page (unguessable token URL, no login required to view). An experiment's
page shows title, hypothesis, cadence, stage, and check-in streak. A goal's page
additionally shows milestone progress (e.g. "milestone 2 of 5"). Neither ever shows
private notes or retro content. The user shares the link however they like (copy link,
or plain `share-to` URLs for X/LinkedIn — no platform API/OAuth posting integration).

Toggling sharing off immediately invalidates the link and **deletes all likes and
comments** on that page (the user is warned before this happens). Re-enabling sharing
issues a new token and starts likes/comments at zero.

Liking or commenting on a shared page requires signing in (same accounts as the main
app). The item's owner can delete any comment on their own page.

## Authentication

- Sign-up/sign-in via **Google, LinkedIn, or Microsoft OAuth**, or **email + password**.
  Apple Sign In is intentionally excluded — it requires a paid ($99/year) Apple
  Developer account, the only option among the four with a direct cost.
- Email + password sign-up requires a verification code sent to the email address.
  Email + password accounts get a standard forgot-password flow.
- **One account per email address**, enforced across all four methods. If someone tries
  to sign up or sign in with an email already registered under a different method, the
  on-screen response stays generic ("if this email is registered, we've sent
  instructions") to avoid leaking which method to an attacker probing the form — the
  actual account owner is told which method they used only via an email sent to that
  address.
- The site sits behind **Cloudflare** for DDoS mitigation, and auth forms are protected
  by **Cloudflare Turnstile or reCAPTCHA** against bots.
- **Sessions are server-side**, not JWT: an opaque token backed by the `sessions`
  table, sent as an httpOnly cookie to the web client and (once a native app exists)
  as a `Bearer` header to mobile. Chosen over JWT because explicit logout and real
  session expiry, both already required above, are awkward with JWTs (revoking one
  early means a blocklist, which just reinvents server-side sessions), and JWT's real
  advantage — stateless verification across many independent services — doesn't apply
  to one backend talking to one Postgres.
- **Verification and reset email** goes through **Resend**, chosen for now for its
  simple setup; sending is wrapped behind a small interface
  (`send_verification_email`, `send_password_reset_email`) so switching providers
  later (Brevo's free tier, or Amazon SES for cost at real scale) is a new
  implementation of that interface, not a rewrite, the same pattern the repository
  interface gives the data store.
- **Cookie notice**: the only cookies this product sets are strictly necessary ones
  (the session cookie above, plus whatever Cloudflare's bot/security checks set) —
  nothing optional, no analytics or marketing cookies (see Non-goals). Strictly
  necessary cookies are exempt from opt-in consent under GDPR/ePrivacy, so the site
  shows a simple notice ("this site uses cookies necessary for sign-in and security;
  by using it you accept this"), not a multi-category consent manager. Revisit this
  if a future, genuinely optional cookie (analytics, etc.) is ever added.
- **Optional two-factor authentication**, off by default, turned on from Settings:
  standard TOTP (RFC 6238) codes from an authenticator app of the user's choice (Google
  Authenticator, Authy, 1Password, etc.), not SMS. This is a genuinely free addition —
  TOTP is an open protocol with no SMS carrier or third-party verification cost — so it
  carries no caveat the way Apple Sign In does. Enabling it shows a QR code (and the
  secret as text, for apps that can't scan) and requires one correct code to confirm
  before it actually turns on. A set of one-time recovery codes is generated at the same
  time, shown once, so losing the authenticator device doesn't lock the user out
  permanently. 2FA applies to email/password sign-in; OAuth sign-in defers to the
  provider's own security (Google/LinkedIn/Microsoft already offer their own 2FA).
- Explicit **logout**. Sessions expire; this isn't left implicit.
- **Account deletion** removes the user's board, check-ins, retros, other tasks, and
  their own comments elsewhere.
- Cadence due/overdue state is computed in the user's own timezone, not server time.

## Design system

Neumorphic (soft dual-tone shadows, no hairline borders), restrained rather than
glossy — "natural makeup," not an Instagram-style high-gloss treatment. Sage green marks
experiments, clay/terracotta marks goals; IBM Plex Mono is used for logged data
(timestamps, streaks, day counts), inherited from v1's "lab notebook" convention.
Copy is written the way someone would actually say it: no em dashes or hyphens used as
punctuation; established product terms (check in, cadence, retro, milestone) are kept
as-is rather than softened into generic app language.

**Theming**: a Settings page lets the user pick from four themes — Petri Light, Petri
Dark, Solarized Light, Solarized Dark (Solarized is an open, permissively licensed
palette, safe to ship). The choice applies across the whole app, saved to the account
rather than the browser.

**Sound**: a Settings toggle, off by default, plays short synthesized tones (Web Audio,
no audio files to ship or license) on starting or finishing the creation wizard, logging
a check-in, and pausing or removing a cadence. Minimal and professional, not game-like.

Illustrations are original line art in a thin single-stroke style, not literal reuse of
moodboard/reference images pulled from other designers' work.

## User stories

1. As a user, I can sign up and sign in (OAuth or email/password) so my board is private to me.
2. As a visitor with no account, I can read what Petri does and sign in or create an account from a single public landing page, before I'm asked to log in.
3. As a user, I land on a calm greeting first, and open the full dashboard when I choose to (or set it as my default in Settings).
4. As a user, I can create an experiment with a hypothesis, cadence, and target duration, through a short step-by-step flow.
5. As a user, I can create a goal, give it milestones up front, and have it run one milestone at a time like a sequence of tiny experiments.
6. As a user, I can evolve a successful experiment into a goal, and later branch a concluded experiment or goal into a new one of the same kind.
7. As a user, I can see my active experiments and goals on a dashboard, filtered by type, with my WIP limits and my completed-vs-abandoned ratio visible.
8. As a user, I can log a check-in (structured value + optional note) against anything Active.
9. As a user, I can see what's due today or overdue, visually flagged.
10. As a user, when something's duration ends, or I end it early, I'm prompted for a retro (or a mandatory abandon reason) before it closes.
11. As a user, I can view full history and retro after something's archived.
12. As a user, I can turn on Other tasks in Settings, add obligations with a one-time or repeating schedule, and get warned if a day holds more than 8 things total.
13. As a user, I can view my calendar by week or month, with the month showing complete weeks even where they spill into neighboring months.
14. As a user, I can toggle public sharing, get a link, and others can like or comment once signed in; I can delete any comment on my own shared page.
15. As a user, I can turn sharing off, which clears likes/comments and invalidates the old link.
16. As a user, I can pick a theme in Settings that applies everywhere.
17. As a user, I can delete my account or just log out.
18. As a user, I can turn on two-factor authentication with my own authenticator app, get recovery codes, and be asked for a code at sign-in from then on.

## Acceptance criteria (examples)

- An unauthenticated visitor at the root URL sees the public landing page, never the dashboard or a bare login form; signing in or creating an account is the only action it offers besides reading it.
- Creating an experiment requires title, hypothesis, cadence, target duration; a goal requires title, why-this-goal text, start/target date, and at least one milestone. Missing any → validation error, nothing created.
- A check-in cannot be logged against anything in Backlog, Reflect, or Archived — only Active.
- Activating a 3rd experiment or a 2nd goal is blocked by the WIP limit.
- Ending anything early without a reason is blocked.
- Moving to Archived requires a saved retro to exist first (experiments/goals) — enforced by the API, not just the UI.
- Each user's data is isolated; no cross-user reads or writes.
- A shared page exposes only the fields listed under "Sharing model," never notes or retro content.
- The share link uses an unguessable token, not a sequential ID; disabling and re-enabling sharing issues a new token and resets likes/comments to zero.
- Liking or commenting requires auth; viewing a shared page does not.
- Signing up with an email already registered under a different method never reveals that method on screen, only by email to that address.
- Enabling 2FA requires one correct TOTP code before it actually turns on; it isn't considered enabled off the QR code alone.
- A recovery code can be used exactly once; using one invalidates it immediately.
- A day's total (other tasks + check-ins + current milestone cadence) past 8 shows the warning; it never blocks the user from proceeding.
- The month calendar always renders complete weeks (Monday start), including faded days from the adjacent month.
- Every evolve or branch operation writes a pointer on both the source and the result, even though no diagram view reads it yet.

## Non-goals (v2)

- No Apple Sign In (cost).
- No SMS-based 2FA (per-message carrier cost, and SIM-swap risk besides) — authenticator-app TOTP only.
- No email notifications anywhere in the app except auth (verification codes, password reset, the "already registered elsewhere" notice). Other tasks use Web Push, nothing else gets push or email.
- No streak freezes, streak purchases, or social/friend streak features.
- No native mobile app in this phase — web only, kept API-first so one can follow later.
- No platform API/OAuth integration for posting (no "post to X" via their API) — sharing is a public link plus plain `share-to` URLs.
- No following/discovering other users' experiments or goals, no public directory or feed.
- No custom/user-defined board columns — the PACT lifecycle is fixed.
- No analytics/insights dashboard beyond what's specified here (WIP counts, the completed/abandoned ratio, streaks).
- No offline support / local-first sync.
- No literal reuse of reference/moodboard images as shipped product assets.
- No node-based lineage/branch diagram view in v2 — planned for later. The evolve/branch pointers it would read are stored from the start (see "Lineage, for a future branch diagram"), so building the diagram later is additive, not a data model change.

## Tech stack

- **Frontend**: React 18, plain (no meta-framework), built with Vite, written in
  TypeScript. Routing via React Router. Tests with Vitest and React Testing Library.
  Same choice v1 used, carried forward.
- **Backend**: FastAPI (Python), OpenAPI-first. Two-factor auth via `pyotp`
  (open source, MIT licensed, no external service — plain RFC 6238 TOTP).
- **Data store**: PostgreSQL from the start, behind a repository interface.
- **Runtime**: Node.js **24 LTS, pinned to ≥24.22.1** — the patched line from the
  October 21, 2026 Node.js security release, which fixed a critical Brotli-decoder
  flaw (CVE-2026-111497, CVSS 9.8). Dependency upgrades are kept small and continuous
  (Dependabot/Renovate + CI as the merge gate) rather than left to go stale, which is
  what turns a routine CVE into an emergency; this is a `plan.md`/CI-CD concern, not
  repeated here.
- **Infra**: Cloudflare in front for DDoS mitigation; Turnstile/reCAPTCHA on auth
  endpoints; Web Push via a service worker for Other task reminders.
- **Hosting**: **Render**, two environments (dev and production) declared in this repo's
  [`render.yaml`](../render.yaml) blueprint. Per environment: the backend as a Docker web
  service (built from `backend/Dockerfile`), the frontend as a static site (Vite build,
  with an SPA rewrite so deep links work), and its own Postgres database as a separate
  project on Neon's free plan (Render's free tier allows only one Postgres per account
  and expires it after 30 days).
  Addresses are `*.onrender.com` (`petri-{backend,frontend}-{dev,prod}`). CI owns every
  deploy trigger, not Render's deploy-on-push: dev deploys automatically when a merge to
  `main` is green, production only from a manual `workflow_dispatch` run behind a typed
  confirmation and an environment approval. See README.md's "Environments" section.
  The backend being API-first (already the case for the OpenAPI contract) is what keeps a
  later native mobile app possible without a backend rewrite.
  **Superseded:** the earlier plan here was a single always-free VPS (Oracle Cloud, with
  Hetzner as fallback) running frontend, backend and Postgres as Docker Compose
  containers, with a custom domain pointed at it. Render replaces that for hosting. The
  custom domain, the Cloudflare layer in front and Turnstile on auth endpoints are not
  implemented and are tracked in
  [#15](https://github.com/nachiketnasa/petri-v2/issues/15), whose VPS/Compose/domain
  acceptance criteria this bullet supersedes for hosting.
- **Session storage**, **email**, and **cookies**: see "Authentication" above.

## Technical plan

1. **This document** — done before any code.
2. **UI kit / mockups**: the neumorphic design system and the screen mockups already
   drafted (Dashboard, Sign in/Sign up, New goal wizard, Experiment detail, Calendar,
   Settings, Public share page) — carried forward and extended to cover Other tasks and
   the new-experiment wizard.
3. **OpenAPI contract**: `openapi.yaml` as the source of truth for every endpoint (auth,
   experiments, goals, milestones, check-ins, retros, other tasks, sharing, comments)
   before backend implementation.
4. **Backend v1**: FastAPI against an in-memory/mock store behind a repository
   interface, tests covering the acceptance criteria above.
5. **Backend v2**: swap the mock store for **PostgreSQL** behind that same repository
   interface, from the start, no SQLite intermediate step. Route/service code never
   touches the store directly, so the interface still pays off if persistence needs to
   change again later.
6. **Frontend build**: React + Vite + TypeScript app against the OpenAPI contract,
   component tests with Vitest/Testing Library.
7. **Infra**: Cloudflare in front for DDoS mitigation; Turnstile/reCAPTCHA on auth
   endpoints; Web Push via a service worker for Other task reminders.
8. **Tests**: unit tests (backend, against contract behavior) + frontend tests
   (component/interaction level) covering the acceptance criteria above.

## Name

**Petri** — a small, contained space to run an experiment and watch it grow.
