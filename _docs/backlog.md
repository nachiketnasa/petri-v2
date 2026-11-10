# Petri v2 — Backlog

A local mirror of the public task tracker: https://github.com/nachiketnasa/petri-v2/issues

Generated from the tracker on 2026-11-10. The tracker is the source of truth; this file is a readable snapshot committed alongside the spec, not edited independently — re-generate it instead of hand-editing when issues change.

## #1 — OpenAPI contract: define openapi.yaml

- **Status**: OPEN
- **Labels**: documentation, infra
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/1

## What
Define `openapi.yaml` as the source of truth for every endpoint, before any backend implementation starts.

## Acceptance criteria
- Covers auth (OAuth, email/password, verification, reset, 2FA, sessions), experiments, goals, milestones, check-ins, retros, other tasks, sharing, comments, likes.
- Frontend and backend both generate/validate against it.

Ref: `_docs/specs.md` → Technical plan, step 3.



## Implementation tasks (MVP slice)

- [ ] Write `openapi.yaml` for the MVP slice only: signup, login, logout, forgot/reset password, experiment create/list/get/archive, check-in create. OAuth/2FA/goals/sharing endpoints get added to the contract when their own issues are worked.

---

## #2 — Auth: OAuth + email/password sign-up/sign-in

- **Status**: OPEN
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/2

## What
Sign-up/sign-in via Google, LinkedIn, or Microsoft OAuth, or email + password. One account per email address across every method.

## Acceptance criteria
- Apple Sign In is intentionally excluded (cost).
- Email + password sign-up requires a verification code; real forgot-password flow.
- Signing up with an email already registered under a different method never reveals that method on screen — only by email to that address.
- Explicit logout; sessions expire.
- Full account deletion removes the user's board, check-ins, retros, other tasks, and their own comments elsewhere.
- Cadence due/overdue state computed in the user's own timezone.

Ref: `_docs/specs.md` → Authentication.



## Implementation tasks (MVP slice)

- [ ] Backend: sign-up with email + password, reject duplicate email.
- [ ] Backend: sign-in + session cookie, dependency to resolve current user.
- [ ] Backend: logout, invalidates the session.
- [ ] Backend: forgot/reset password flow (the specific gap from v1 — needs its own test).
- [ ] Frontend: sign-up / sign-in forms against the above.

MVP note: OAuth and sign-up email verification are deferred past this slice; ship email/password first.

---

## #3 — Auth: TOTP two-factor authentication

- **Status**: OPEN
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/3

## What
Optional two-factor authentication (TOTP, RFC 6238), off by default, via `pyotp`.

## Acceptance criteria
- Enabling shows a QR code (and the secret as text) and requires one correct code before it actually turns on.
- A set of one-time recovery codes is generated and shown once at that point.
- A recovery code can be used exactly once; using one invalidates it immediately.
- Applies to email/password sign-in; OAuth defers to the provider's own 2FA.

Ref: `_docs/specs.md` → Authentication, `_docs/schema.sql` → `users.totp_*`, `totp_recovery_codes`.



## Implementation tasks (MVP slice)

No MVP-slice breakdown yet — 2FA is deferred past the MVP slice (see issue #2's note). Revisit once email/password auth is working end to end.

---

## #4 — Experiments: CRUD + lifecycle + check-ins + retro gate

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/4

## What
Experiment CRUD and lifecycle: Backlog → Active → Check-in Due (badge) → Reflect → Archived.

## Acceptance criteria
- Creating requires title, hypothesis, cadence, target duration — missing any → validation error, nothing created.
- A check-in cannot be logged against anything in Backlog, Reflect, or Archived — only Active.
- "Check-in Due" is a derived badge on Active, not a persisted column.
- Moving to Archived requires a saved retro first, enforced by the API.
- Ending early without a one-line reason is blocked; the reason is stored permanently.

Ref: `_docs/specs.md` → Board model, Core entities, Abandoning something early.



## Implementation tasks (MVP slice)

- [ ] Backend: create experiment (title, hypothesis, cadence, target duration; 400 on missing field; checked against the WIP limit from #7).
- [ ] Backend: list + get experiments, scoped to the signed-in user (proves per-user isolation).
- [ ] Backend: log a check-in, rejected unless the experiment is Active.
- [ ] Backend: archive, blocked without a retro (duration ran out) or a one-line abandon reason (ended early).
- [ ] Frontend: experiment detail page + check-in form.
- [ ] Frontend: archive/retro form, mirrors the backend's own validation client-side.

---

## #5 — Goals: CRUD + locked ordered milestone list

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/5

## What
Goal CRUD with an ordered, locked milestone list; milestones run their own PACT lifecycle one at a time.

## Acceptance criteria
- A goal requires title, why-this-goal text, start/target date, and at least one milestone.
- Milestones are locked once the goal is Active — changing them later requires explicitly abandoning the current one with a reason.
- Only one milestone is active at a time; completing it activates the next in order.
- Moving a goal/milestone to Archived requires a saved retro first.

Ref: `_docs/specs.md` → Core entities, Board model.

---

## #6 — Evolve and branch lineage pointers

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/6

## What
Evolve (experiment → goal, one-way) and branch (experiment → experiment, goal → goal), with lineage pointers stored on both ends for a future lineage diagram.

## Acceptance criteria
- Evolve carries the experiment's title/history over; the source experiment stays on record with a pointer to the goal it became.
- Branch is optional, same-kind only, and writes a two-way pointer (both `branched_into_*` and `branched_from_*`).
- Every evolve/branch operation writes its pointer even though no diagram view reads it yet.

Ref: `_docs/specs.md` → Evolving and branching, Lineage section. `_docs/schema.sql` → lineage columns.

---

## #7 — Enforce work-in-progress limits (2 experiments + 1 goal)

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/7

## What
Enforce the work-in-progress limit: at most 2 experiments and 1 goal Active at the same time.

## Acceptance criteria
- Activating a 3rd experiment or a 2nd goal is blocked server-side, not just hinted at in the UI.
- Dashboard shows the live count (e.g. "2 / 2").

Ref: `_docs/specs.md` → Work in progress limits.

---

## #8 — Other tasks: scheduling, daily load warning, Web Push

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/8

## What
Other tasks: an optional, off-by-default feature for ordinary obligations.

## Acceptance criteria
- Each task is one-time (a date) or repeating (days/interval, until an end date) — alarm-app style.
- Editable and removable at any time.
- Viewable standalone or merged into the Calendar.
- Daily load warning: other tasks + check-ins due + active milestone cadence, combined, over 8 → flagged (never blocks).
- Push notifications only (Web Push API), never email, for reminders.

Ref: `_docs/specs.md` → Other tasks.

---

## #9 — Sharing, likes, and comments

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/9

## What
Public sharing, likes, and comments.

## Acceptance criteria
- Per-item toggle generates a read-only page at an unguessable token URL, no login to view.
- Experiment page shows title/hypothesis/cadence/stage/streak; goal page also shows milestone progress. Never notes or retro content.
- Liking/commenting requires sign-in; the owner can delete any comment on their own page.
- Turning sharing off deletes all likes/comments and invalidates the link; re-enabling issues a new token, starting at zero.

Ref: `_docs/specs.md` → Sharing model. `_docs/schema.sql` → `shares`, `comments`, `likes`.

---

## #10 — Dashboard + calm landing/greeting screen

- **Status**: OPEN
- **Labels**: frontend, design
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/10

## What
Dashboard and the calm landing/greeting screen.

## Acceptance criteria
- Landing: time-of-day greeting + a one-line due-today count, no stat grid/cards. Settings toggle to default straight to the dashboard instead.
- Dashboard: card grid, Experiments/Goals/Both filter, WIP count tiles, completed-vs-abandoned ratio, Backlog section.
- Streak shown visibly (Duolingo-style number) — no streak freezes, no social/friend-streak features.

Ref: `_docs/specs.md` → Landing screen and dashboard, Streaks.



## Implementation tasks (MVP slice)

- [ ] Frontend: dashboard card grid listing the signed-in user's experiments (MVP: list + stage only, filters/streak/ratio tiles can follow once data exists).

---

## #11 — Calendar: week and month views

- **Status**: OPEN
- **Labels**: frontend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/11

## What
Calendar: week and month views.

## Acceptance criteria
- Week view: Monday–Sunday, its own layout, never a slice of the month grid. Prev/next navigation by week.
- Month view: starts the Monday of the week containing the 1st, shows every day of the month, continues through the Sunday closing the last week (faded adjacent-month days included). Prev/next by month.
- Scope toggle: "this cadence only" vs "all active" (and Other tasks, if enabled).

Ref: `_docs/specs.md` → Calendar.

---

## #12 — Settings screen

- **Status**: OPEN
- **Labels**: frontend, design
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/12

## What
Settings screen.

## Acceptance criteria
- Theme: Petri Light, Petri Dark, Solarized Light, Solarized Dark — applies across the whole app, saved to the account.
- Sound effects toggle (short synthesized tones: start/finish setup, check-in tick, pause/remove cadence).
- Other tasks feature toggle, landing-screen preference, 2FA enrollment, account deletion.
- Cookie notice: strictly-necessary-only disclosure, no category picker.

Ref: `_docs/specs.md` → Design system/theming, Other tasks, Authentication.

---

## #13 — Multi-step creation wizard (experiment/goal)

- **Status**: OPEN
- **Labels**: frontend, design
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/13

## What
Multi-step creation wizard for a new experiment or goal, with a side progress rail.

## Acceptance criteria
- Steps: details → cadence (experiment) or milestones (goal) → review.
- Goal's milestone step is where the full, locked milestone list is defined.

Ref: `_docs/specs.md` → Creating an experiment or a goal.



## Implementation tasks (MVP slice)

- [ ] Frontend: plain new-experiment form (hypothesis, cadence, target duration) wired to `POST /experiments`. The multi-step wizard + side progress rail is a follow-up polish pass once the fields and the request round-trip work.

---

## #14 — Backend data layer: Postgres + repository interface

- **Status**: OPEN
- **Labels**: backend, infra
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/14

## What
Backend data layer: PostgreSQL from the start, behind a repository interface.

## Acceptance criteria
- Schema matches `_docs/schema.sql` (already drafted and verified against a real `postgres:16` instance).
- Route/service code never touches SQL directly — only the repository interface does.
- Each user's data is isolated; no cross-user reads or writes.

Ref: `_docs/specs.md` → Technical plan, `_docs/schema.sql`, `_docs/architecture.html`.



## Implementation tasks (MVP slice)

- [ ] Repository interface + in-memory implementation first — every later backend task is written against the interface, not a concrete store.
- [ ] Swap in the Postgres implementation once the schema in `_docs/schema.sql` is wired up; no route/service changes, only a second implementation of the same interface.

---

## #15 — Hosting and deployment (VPS, Docker Compose, domain)

- **Status**: OPEN
- **Labels**: infra
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/15

## What
Hosting and deployment.

## Acceptance criteria
- Single VPS: Oracle Cloud Always Free tier first choice, Hetzner Cloud as the paid fallback.
- Frontend and backend as separate Docker Compose containers talking to each other, Postgres as a third.
- `petri.nachiketnasa.com` points at the VPS.
- Cloudflare in front for DDoS mitigation; Turnstile/reCAPTCHA on auth endpoints.

Ref: `_docs/specs.md` → Tech stack (Infra, Hosting).



## Implementation tasks (MVP slice)

- [ ] Docker Compose: backend, frontend, and Postgres as three services, one `docker compose up`, no manual steps after it. Deploying that compose file to the actual VPS/domain is a separate follow-up once it runs locally.

---

## #16 — Backend test suite (pytest)

- **Status**: OPEN
- **Labels**: backend, testing
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/16

## What
Backend test suite (pytest + FastAPI's test client), covering the acceptance criteria in `_docs/specs.md`.

## Acceptance criteria
- Key endpoints covered: auth (incl. 2FA), create/list/update experiment and goal, log check-in, create retro, sharing, other tasks.
- Tests run against the contract behavior, not implementation details.

Ref: `_docs/specs.md` → Technical plan, step 8.



## Implementation tasks (MVP slice)

- [ ] Project setup: backend scaffold managed with `uv`, `uv sync` installs dependencies, `uv run pytest` runs one trivial passing test.
- [ ] `GET /health` endpoint + test — proves the app boots before any real endpoint is built.

---

## #17 — Frontend test suite (Vitest + RTL)

- **Status**: OPEN
- **Labels**: frontend, testing
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/17

## What
Frontend test suite: Vitest + React Testing Library.

## Acceptance criteria
- Component/interaction-level tests covering the acceptance criteria in `_docs/specs.md`.

Ref: `_docs/specs.md` → Tech stack, Technical plan step 8.



## Implementation tasks (MVP slice)

- [ ] Project setup: frontend scaffold (inside `frontend/`), `npm install` installs dependencies, `npm test` runs one trivial passing Vitest test.
- [ ] Frontend project wired to the backend's `/health` endpoint (proves CORS/base-URL config before real UI work).

---

## #18 — CI/CD pipeline (deferred)

- **Status**: OPEN
- **Labels**: infra
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/18

## What
CI/CD pipeline.

**Deferred** — explicitly held for later in discussion with the user; revisit once the MVP backend/frontend exist. Should include: automated test run on PR, Dependabot/Renovate for dependency updates with CI as the merge gate (see cost/vulnerability discussion), and a deploy step to the VPS.

Ref: conversation history — "hold for now" on CI/CD.



## Implementation tasks (MVP slice)

- [ ] GitHub Actions workflow: run `pytest` and `vitest run` on every pull request against `main`. This is just the merge gate — the deploy step stays deferred as noted above.

---

## #19 — Public landing page

- **Status**: OPEN
- **Labels**: frontend, design
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/19

## What
A single public landing page for unauthenticated visitors, separate from the signed-in greeting screen.

## Acceptance criteria
- An unauthenticated visitor at the root URL sees this page, never the dashboard or a bare login form.
- Explains the product (tiny experiments that can grow into goals, PACT, the work-in-progress limit, transparent endings) in plain language.
- One clear action: sign in or create an account. No pricing tiers, feature-comparison grid, or testimonials.
- Same restrained, neumorphic design direction as the rest of the product — not a typical SaaS gradient-hero page.

Ref: `_docs/specs.md` → Public landing page.
