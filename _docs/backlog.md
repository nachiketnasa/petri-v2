# Petri v2 — Backlog

A local mirror of the public task tracker: https://github.com/nachiketnasa/petri-v2/issues

Generated from the tracker on 2026-11-11. The tracker is the source of truth; this file is a readable snapshot committed alongside the spec, not edited independently — regenerate it with `scripts/regenerate_backlog.py` instead of hand-editing when issues change.

**Listed in build order, not issue-number order.** Each issue carries an `order-NN` label marking when work on it should start; issues sharing a number are meant to start together (e.g. the two project-setup scaffolds). Give any new issue an `order-NN` label before filing it, placed at the point in the sequence where it belongs — otherwise it sorts last, below. Issues #1, #16, and #17 span the whole product (the contract and the two test suites), so their own Acceptance criteria is a checklist of the other issues that complete them, not a bounded task on its own.

## order-01 · #16 — Backend test suite (pytest)

- **Status**: OPEN
- **Labels**: backend, testing
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/16

## What
Backend test suite (pytest + FastAPI's test client), covering the acceptance criteria in `_docs/specs.md`.

## Acceptance criteria

This issue closes when every line below is checked. Each one ticks as a side
effect of its source issue's own Engineer pass (whose own definition of done
already requires tests for new behavior) — this list exists so the running
total is visible here instead of implicit.

- [x] App boots, `GET /health` covered — this issue, health-check sub-task
- [ ] Repository interface / data layer tests — #14
- [ ] Auth tests — #2
- [ ] 2FA tests — #3
- [ ] Experiment CRUD/lifecycle/check-in/retro tests — #4
- [ ] WIP limit enforcement tests — #7
- [ ] Goal CRUD/milestone tests — #5
- [ ] Evolve/branch lineage tests — #6
- [ ] Other tasks tests — #8
- [ ] Sharing/likes/comments tests — #9

Tests run against contract behavior (what an endpoint does), not
implementation details, throughout.

Ref: `_docs/specs.md` → Technical plan, step 8.



## Implementation tasks (MVP slice)

- [x] Project setup: backend scaffold managed with `uv`, `uv sync` installs dependencies, `uv run pytest` runs one trivial passing test.
- [x] `GET /health` endpoint + test — proves the app boots before any real endpoint is built.

---

## order-01 · #17 — Frontend test suite (Vitest + RTL)

- **Status**: OPEN
- **Labels**: frontend, testing
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/17

## What
Frontend test suite: Vitest + React Testing Library.

## Acceptance criteria

This issue closes when every line below is checked, the same way as #16.

- [x] Health-check wiring covered — this issue, health-check sub-task
- [ ] Auth forms tests — #2
- [ ] Dashboard + landing/greeting tests — #10
- [ ] Creation wizard tests — #13
- [ ] Experiment detail/check-in/archive UI tests — #4
- [ ] Public landing page tests — #19
- [ ] Calendar tests — #11
- [ ] Settings screen tests — #12

Ref: `_docs/specs.md` → Tech stack, Technical plan step 8.



## Implementation tasks (MVP slice)

- [x] Project setup: frontend scaffold (inside `frontend/`), `npm install` installs dependencies, `npm test` runs one trivial passing Vitest test.
- [x] Frontend project wired to the backend's `/health` endpoint (proves CORS/base-URL config before real UI work).

---

## order-03 · #1 — OpenAPI contract: define openapi.yaml

- **Status**: OPEN
- **Labels**: documentation, infra
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/1

## What
Define `openapi.yaml` as the source of truth for every endpoint, before any backend implementation starts.

## Acceptance criteria

This issue closes when every line below is checked — each is covered by the
contract work landing alongside its source issue, not written speculatively
ahead of time.

- [ ] Auth endpoints (OAuth, email/password, verification, reset, sessions) — #2
- [ ] 2FA endpoints — #3
- [ ] Experiment endpoints (CRUD, lifecycle, check-ins, retro) — #4
- [ ] Goal endpoints (CRUD, milestones) — #5
- [ ] Evolve/branch endpoints — #6
- [ ] Other tasks endpoints — #8
- [ ] Sharing/comments/likes endpoints — #9
- [ ] Frontend and backend both generate/validate against `openapi.yaml` (checked once the above are in and both sides reference the file)

Ref: `_docs/specs.md` → Technical plan, step 3.



## Implementation tasks (MVP slice)

- [x] Write `openapi.yaml` for the MVP slice only: signup, login, logout, forgot/reset password, experiment create/list/get/archive, check-in create. OAuth/2FA/goals/sharing endpoints get added to the contract when their own issues are worked.

---

## order-04 · #2 — Auth: OAuth + email/password sign-up/sign-in

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

- [x] Backend: sign-up with email + password, reject duplicate email.
- [x] Backend: sign-in + session cookie, dependency to resolve current user.
- [x] Backend: logout, invalidates the session.
- [x] Backend: forgot/reset password flow (the specific gap from v1 — needs its own test).
- [x] Frontend: sign-up / sign-in forms against the above.

MVP note: OAuth and sign-up email verification are deferred past this slice; ship email/password first.

---

## order-04b · #20 — Auth: session expiration / TTL

- **Status**: OPEN
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/20

## What

Issue #2's own Acceptance criteria says "sessions expire," but no checklist
line on #2 covers automatic, time-based expiration — only manual logout
(invalidating one session on request) is scheduled there. This issue is
that gap: sessions created by sign-in (#2) should expire after some TTL
even if the user never calls logout.

Split out during grooming of "Backend: sign-in + session cookie, dependency
to resolve current user" (see the `## Groomed:` comment on #2) because it
depends on that task's session-store shape and is a separate piece of
behavior from a single logout call.

## Acceptance criteria

- [ ] A session created by `POST /auth/login` stops being valid after a
      defined TTL, even without a `POST /auth/logout` call.
- [ ] A request using an expired session's cookie through `get_current_user`
      (see #2) gets 401, same as an unknown/missing session.

Ref: `_docs/specs.md` → Authentication; `_docs/team/pm.md` for grooming into
the task template before implementation.

---

## order-04c · #21 — Auth: send real emails for password reset (replace dev-log token)

- **Status**: OPEN
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/21

## What

The forgot/reset password flow being built on #2 (`order-04`, see the
"## Groomed: forgot/reset password" comment there) writes the reset token
to stdout instead of emailing it — a deliberate MVP stand-in, not the
real behavior. This issue is the real implementation: send the reset
token to the user's actual email address via a real provider, per
`_docs/specs.md`'s tech stack decision (Resend for now, behind a
swappable interface so switching to Brevo/SES later needs no rewrite).

## Acceptance criteria

- [ ] `POST /auth/forgot-password` sends an email containing the reset
      link/token to the requesting user's address, instead of (or in
      addition to, during transition) printing it to stdout.
- [ ] Email sending goes through a small interface
      (`send_password_reset_email`, per `_docs/specs.md` → Technical
      plan) rather than calling Resend's SDK directly from the route.
- [ ] No enumeration regression: the forgot-password response is
      identical whether or not the email is registered, exactly as #2's
      dev-log version already requires — sending (or not sending) an
      email must not leak anything observable in the HTTP response.
- [ ] Missing/invalid Resend API key or a provider error does not 500 the
      request in a way that reveals account existence; fails safely.

Ref: `_docs/specs.md` → Authentication, Technical plan.

Split out while grooming #2's "forgot/reset password" checklist line,
since this needs its own Resend account/API key (an external dependency
the dev-log version deliberately avoided) and shouldn't block that task.

---

## order-04d · #22 — Frontend: forgot/reset password form

- **Status**: OPEN
- **Labels**: frontend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/22

## What

#2's checklist line being groomed as "Frontend: sign-up / sign-in forms
against the above" covers only sign-up and sign-in — its own title names
just those two. The backend forgot/reset password flow (also on #2,
`POST /auth/forgot-password` / `POST /auth/reset-password`, dev-log token
delivery) has no frontend counterpart anywhere in the backlog. This issue
is that gap: a form to request a reset and a form to set a new password
from the emailed (for now, dev-log-printed, see #21) token.

## Acceptance criteria

- [ ] A "forgot password" form (email only) submits to
      `POST /auth/forgot-password` and shows the same generic
      confirmation regardless of whether the email is registered — the
      frontend must not add its own "if this email exists" branching,
      since the backend's response is already identical either way.
- [ ] A "reset password" form (token + new password) submits to
      `POST /auth/reset-password`. Where the token comes from (e.g. a
      query param on a reset link) is this task's call to make.
- [ ] A failed reset (unknown/expired/already-used token, or validation
      error) renders the backend's `detail` message, not invented copy.
- [ ] A successful reset confirms the password changed and does not
      silently sign the user in (#2's backend groomed comment makes a
      reset invalidate all of that user's existing sessions).
- [ ] A Vitest + RTL test per form covering success and failure paths,
      fetch mocked — same pattern as the sign-up/sign-in forms task.

## Out of scope

- Real email delivery of the reset link — #21 (`order-04c`). This form
  works against the dev-log token in the meantime (paste it in manually,
  or load the link with the token as a query param).
- Routing to a protected dashboard after reset — #10.
- Neumorphic/pixel-accurate design polish — later design pass.

## Constraints

- Stay inside `frontend/src/`.
- Match `ForgotPasswordRequest`/`ResetPasswordRequest` in `openapi.yaml`
  exactly.
- Follow the same component/env-var pattern as `HealthStatus.tsx`
  (`import.meta.env.VITE_BACKEND_URL`) and whatever pattern the
  sign-up/sign-in forms task (#2) establishes for calling the backend
  and rendering errors.

---

## order-04e · #23 — Auth: sign-up email verification code

- **Status**: OPEN
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/23

## What

#2's own Acceptance criteria requires "email + password sign-up requires a
verification code," but the MVP-slice checklist on #2 (now fully checked)
only covers unverified sign-up — no email is sent, no verification step
exists, and an unverified account can sign in immediately. This issue is
that missing verification step.

## Acceptance criteria

- [ ] On sign-up, a verification code/link is generated and sent to the
      user's email (reuse whatever provider interface #21, order-04c,
      ends up building for password reset — don't build a second one).
- [ ] An unverified account cannot sign in (or is clearly marked
      unverified) until the code is confirmed.
- [ ] Confirming the code marks the account verified; confirming twice or
      with a wrong/expired code fails cleanly without revealing which.

Ref: `_docs/specs.md` → Authentication.

Split out while auditing #2's full scope against its MVP checklist: this
line in the original Acceptance criteria was never captured in any
checklist item.

---

## order-04f · #24 — Auth: OAuth sign-up/sign-in (Google, LinkedIn, Microsoft)

- **Status**: OPEN
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/24

## What

#2's own Acceptance criteria and title both include OAuth (Google,
LinkedIn, Microsoft), explicitly deferred past the MVP slice ("OAuth and
sign-up email verification are deferred past this slice; ship
email/password first" — #2's own MVP note). The MVP checklist on #2 is
now fully checked and only covers email/password. This issue is OAuth
itself.

## Acceptance criteria

- [ ] Sign-up/sign-in via Google, LinkedIn, and Microsoft OAuth (Apple
      excluded per #2's own acceptance criteria — cost).
- [ ] One account per email address across every method — signing up via
      OAuth with an email already registered under email/password (or a
      different OAuth provider) never reveals that on screen, only by
      email to that address (matches the no-enumeration pattern #2's
      email/password flow already follows).
- [ ] 2FA (#3) continues to defer to the OAuth provider's own security for
      OAuth sign-ins, per #2's acceptance criteria.

Ref: `_docs/specs.md` → Authentication.

Split out while auditing #2's full scope against its MVP checklist.

---

## order-05 · #4 — Experiments: CRUD + lifecycle + check-ins + retro gate

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

## order-06 · #7 — Enforce work-in-progress limits (2 experiments + 1 goal)

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

## order-07 · #10 — Dashboard + calm landing/greeting screen

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

## order-08 · #13 — Multi-step creation wizard (experiment/goal)

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

## order-08b · #14 — Backend data layer: Postgres + repository interface

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

- [x] Repository interface + in-memory implementation first — every later backend task is written against the interface, not a concrete store.
- [ ] Swap in the Postgres implementation once the schema in `_docs/schema.sql` is wired up; no route/service changes, only a second implementation of the same interface.

---

## order-09 · #19 — Public landing page

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

---

## order-10 · #11 — Calendar: week and month views

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

## order-11 · #12 — Settings screen

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

## order-12 · #15 — Hosting and deployment (VPS, Docker Compose, domain)

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

## order-13 · #18 — CI/CD pipeline (deferred)

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

## order-14 · #5 — Goals: CRUD + locked ordered milestone list

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

## order-15 · #6 — Evolve and branch lineage pointers

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

## order-16 · #3 — Auth: TOTP two-factor authentication

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

## order-17 · #8 — Other tasks: scheduling, daily load warning, Web Push

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

## order-18 · #9 — Sharing, likes, and comments

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

## order-18b · #25 — Auth: account deletion (backend cascade)

- **Status**: OPEN
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/25

## What

#2's own Acceptance criteria requires "full account deletion removes the
user's board, check-ins, retros, other tasks, and their own comments
elsewhere," but no checklist item on #2 (now fully checked) covers it.
#12 (Settings screen) has an "account deletion" bullet, but that's the
frontend entry point/button — this issue is the backend logic it calls.

## Acceptance criteria

- [ ] A backend endpoint deletes the signed-in user's account: their user
      record, every experiment/goal/milestone/check-in/retro/other task
      they own, their own comments on other people's shared pages, and
      invalidates every session for that user.
- [ ] Deleting an account does not delete content other users still need
      intact — e.g. a comment someone else left on this user's (now
      deleted) shared page should itself be removed too, per the shared
      page cascading when sharing is turned off (see #9's own acceptance
      criteria for that cascade's shape).
- [ ] The endpoint requires authentication (`get_current_user`) and cannot
      delete a different user's account.

Ref: `_docs/specs.md` → Authentication, Accounts.

Split out while auditing #2's full scope against its MVP checklist.
Depends on #4 (experiments)/#5 (goals)/#9 (sharing) existing first, since
the cascade touches their data — scheduled after those in the sequence.
