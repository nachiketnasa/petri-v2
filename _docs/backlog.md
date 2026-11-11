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

## order-04g · #31 — Auth: expose current signed-in user (display_name) for greeting

- **Status**: OPEN
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/31

## Goal

A way for the frontend to know the signed-in user's `display_name` (and `timezone`) on any page load, not only in the instant right after sign-up/sign-in — needed so the calm greeting screen (#10) can render "Good morning, <name>" after a refresh, not just immediately post-login.

## Acceptance criteria

- [ ] A signed-in request (valid session cookie) to the new endpoint returns the user's `id`, `email`, `display_name`, `timezone`, `created_at` — the same shape `/auth/signup` and `/auth/login` already return.
- [ ] A request with no session cookie, or an expired one, returns 401 with a `detail` message, same error shape as `GET /experiments`'s 401.
- [ ] No other user's data is ever returned — only the session's own user.
- [ ] Documented in `openapi.yaml` alongside the existing auth paths.

## Out of scope

- Any frontend change to consume this (that's part of grooming #10's greeting screen, or a later checklist line on it).
- Session TTL/expiration behavior itself — tracked separately (#20, order-04b).

## Constraints

- Backend only (FastAPI), follows the existing repository-interface pattern already used for experiments.
- Reuse the existing session-cookie auth dependency already used by `GET /experiments`, don't invent a second auth check.

---

## order-04h · #33 — Auth: sign-up does not establish a session (no cookie set)

- **Status**: CLOSED
- **Labels**: backend, auth
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/33

## Goal
A successful `POST /auth/signup` should leave the caller signed in, the same way `POST /auth/login` does right now — matching normal product expectations and what the frontend (`AuthForm.tsx`) already assumes.

## Acceptance criteria
- [x] `POST /auth/signup` sets the same `session_id` cookie (httponly) that `/auth/login` sets, using a new session token for the newly created user — verifiable with `curl -i`, a `Set-Cookie` header is present on the 201 response.
- [x] Immediately after a successful signup, a request carrying that cookie (e.g. `GET /experiments`) returns 200, not 401.
- [x] `/auth/login`'s existing behavior is unchanged.
- [x] A signup that fails with 400 (duplicate email) does not set a `Set-Cookie` header — no session is created for a failed signup.

## Out of scope
- Any frontend change — `AuthForm.tsx` already treats a successful signup response as "authenticated"; once the backend actually sets the cookie, the existing frontend flow starts working correctly with no frontend change needed. If that turns out to be false, file a separate frontend follow-up.
- Session TTL/expiration — tracked in #20 (order-04b).
- Exposing the current user on page reload — tracked in #31 (order-04g).

## Constraints
- Files: `backend/src/petri_backend/app.py` (the `signup` handler), mirroring the existing `login` handler's session-creation lines (`new_session_token()`, `_sessions[token] = user.id`, `response.set_cookie(...)`).
- Add/extend a backend test asserting the signup response includes a working session cookie (not just a 201 status).

## Found by
Discovered during QA verification of #10 (dashboard/greeting screen) — QA used real curl requests against the live Docker Compose stack instead of mocked fetches and caught that signup never actually logs the user in. Pre-existing bug, unrelated to #10's own file changes.

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

- [x] Backend: create experiment (title, hypothesis, cadence, target duration; 400 on missing field; checked against the WIP limit from #7).
- [x] Backend: list + get experiments, scoped to the signed-in user (proves per-user isolation).
- [x] Backend: log a check-in, rejected unless the experiment is Active.
- [x] Backend: archive, blocked without a retro (duration ran out) or a one-line abandon reason (ended early).
- [x] Frontend: experiment detail page + check-in form.
- [x] Frontend: archive/retro form, mirrors the backend's own validation client-side.

---

## order-05 · #26 — Check-ins: validate value_bool/value_rating against the experiment's check_in_kind

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/26

## What

`openapi.yaml`'s `CreateCheckInRequest` allows both `value_bool` and `value_rating` as optional/nullable, with no constraint tying them to the owning experiment's `check_in_kind` (`"boolean"` or whatever rating kind is chosen at experiment creation, per `_docs/specs.md` → Core entities: "Structured field (done / not done, or a 1-5 rating, picked once per experiment ... at creation)").

Right now nothing stops a client from POSTing `value_rating` on a boolean-kind experiment, or vice versa, or both, or neither.

## Why it's split out

Noticed while grooming #4's "log a check-in" checklist line. That task is scoped to the Active-only status gate; it doesn't touch kind-matching validation, which isn't called for by that checklist line, by `openapi.yaml` (no `oneOf`/conditional schema), or by the dataclass. Folding it in would widen that task's acceptance criteria beyond what it's meant to cover.

## Suggested acceptance criteria

- `check_in_kind == "boolean"`: `value_bool` required (or at least non-null), `value_rating` must be null/omitted → 400 otherwise.
- `check_in_kind` is a rating kind: `value_rating` required, in range (spec says 1-5), `value_bool` must be null/omitted → 400 otherwise.
- Decide and document the exact rejection shape (400, per the existing `CreateCheckInRequest` error response in `openapi.yaml`).

## Out of scope

- The Active-only status gate on check-ins — #4's own checklist line.

---

## order-05b · #27 — Check-in Due derived badge: not computed/exposed anywhere

- **Status**: OPEN
- **Labels**: backend, frontend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/27

## What

#4's own top-level Acceptance criteria lists: *"'Check-in Due' is a derived badge on Active, not a persisted column."* (`_docs/specs.md` → Board model, item 3: cadence elapsed, awaiting a log entry, derived from last check-in timestamp + cadence vs. now.)

Auditing #4's Implementation tasks checklist against its own top-level AC (same audit done on #2): create, list/get, check-in, and archive are all covered by a checklist line. This one isn't — nothing in #4's checklist computes or exposes "Check-in Due," on the backend or the frontend. It's easy to lose since it's a derived/badge concept, not a stored field, so there's no dataclass or migration to remind anyone it's missing.

## Acceptance criteria

- [ ] Decide where "Check-in Due" is computed: either a field added to the `Experiment` API response (e.g. `check_in_due: bool`, computed per-request from `cadence_type`/`cadence_days` + the latest check-in's `checked_in_at` vs. now, only meaningful when `status == "active"`), or computed client-side in the frontend from data it already has (last check-in + cadence already present on `Experiment`). Either is viable; pick one explicitly rather than leaving it implicit.
- [ ] The badge only ever shows for experiments with `status == "active"` (per the board model: it's "a badge on Active," not a separate persisted status).
- [ ] An experiment with zero check-ins logged since `start_date` past its first cadence interval shows as check-in-due (don't assume a check-in always exists to diff against).
- [ ] Covered by a test (backend computation, or frontend render logic) depending on where it's decided to live.

## Out of scope

- Any backend endpoint change beyond adding a computed field (if that's the path chosen) — no new persisted column, no migration.

Ref: `_docs/specs.md` → Board model (item 3).

---

## order-05c · #28 — Check-ins: no GET endpoint to list an experiment's check-in history

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/28

## What

`openapi.yaml` only has `POST /experiments/{id}/check-ins` (create). There is
no `GET /experiments/{id}/check-ins` (or any other route) that returns the
list of check-ins already logged for an experiment. `GET /experiments/{id}`
returns only the `Experiment` schema — it has no `check_ins` field.

**Label note:** this should carry an `order-05c` label (slots right after
#26/#27, which are `order-05`/`order-05b`), but that label doesn't exist yet
and this session couldn't create it. Tagged `order-05` for now — please
create `order-05c` and move this issue to it, then regenerate
`_docs/backlog.md`.

## Why it's split out

Noticed while grooming #4's "Frontend: experiment detail page + check-in
form" checklist line. That task was asked to show "check-in history" on the
detail page, but there is nothing in `openapi.yaml` or the repository
interface to fetch it from — `repository.add_check_in` writes a check-in but
nothing reads them back as a list. Inventing a history endpoint wasn't in
scope for a frontend-only task, so the detail page instead shows only the
check-in(s) made during the current browser session (from each successful
`POST`'s own response body), not true persisted history across reloads.

## Suggested acceptance criteria

- [ ] A way to fetch an experiment's check-ins (e.g. `GET
      /experiments/{id}/check-ins`, scoped to the signed-in owner, 404 for a
      nonexistent/foreign id — same pattern as `GET /experiments/{id}`).
- [ ] Added to `openapi.yaml` first, then implemented, per this repo's
      contract-first workflow.
- [ ] The frontend experiment detail page (#4) is updated to call it instead
      of only showing same-session check-ins.

## Out of scope

- The check-in creation route and its Active-only gate — already on #4.

Ref: `_docs/specs.md` → Core entities (check-ins).

---

## order-05d · #32 — Check-ins: compute and expose per-experiment streak count

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/32

## Goal

A computed "streak" (consecutive cadence periods logged without a gap) available per experiment, so the dashboard (#10) can show a real, persistent streak number instead of a placeholder. Mirrors how "Check-in Due" is a derived, non-persisted value (#27, order-05b) rather than a stored column.

## Acceptance criteria

- [ ] Streak is computed from check-in history (depends on #28, order-05c, which adds the GET endpoint to list an experiment's check-ins — streak can't be computed without it).
- [ ] Streak counts consecutive completed cadence periods up to and including the most recently elapsed one; a single missed cadence period resets it to 0 (same "nothing sold, nothing lost beyond the number resetting" framing as `_docs/specs.md`'s Streaks section — no freeze/purchase mechanic, this issue is read-only computation).
- [ ] Exposed via the API (either a field on the experiment representation, or a small dedicated endpoint) so the frontend doesn't reimplement the cadence-vs-check-in-timestamp math itself.
- [ ] Computed in the user's own timezone, consistent with how cadence due/overdue is computed elsewhere (per `_docs/specs.md`'s Authentication section: "Cadence due/overdue state is computed in the user's own timezone, not server time").
- [ ] Unit tests cover: an on-time streak continuing, a missed period resetting to 0, and a brand-new experiment with no check-ins yet reading 0 (not null, not an error).

## Out of scope

- Any UI to display the streak — that's #10's own dashboard acceptance criteria.
- Milestone/goal streaks — goals don't exist yet (#5, order-14); revisit once they do.
- Any loss-aversion mechanic (streak freezes, social streaks) — explicitly a non-goal per `_docs/specs.md`.

## Constraints

- Backend only. Depends on #28 (order-05c) landing first for check-in history data to compute from.
- Follows the existing repository-interface pattern; no new persisted "streak" column needed if it can stay a derived read, consistent with how Check-in Due (#27) is handled.

---

## order-06 · #7 — Enforce work-in-progress limits (2 experiments + 1 goal)

- **Status**: CLOSED
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/7

## Goal

A user can be running at most 2 experiments Active at the same time; a 3rd activation attempt is rejected server-side. This requires adding the activate transition itself, since no endpoint currently moves an experiment from "backlog" to "active" (deferred here from issue number 4's grooming).

## Acceptance criteria

- [x] `POST /experiments/{id}/activate` exists, documented in openapi.yaml, following the same shape as the existing `POST /experiments/{id}/archive` endpoint.
- [x] Calling it on a `backlog` experiment when the user has 0 or 1 other experiments already `active` succeeds: status becomes `active`, response is the updated Experiment.
- [x] Calling it on a `backlog` experiment when the user already has 2 experiments `active` is rejected with 400, and both existing active experiments remain active and unchanged.
- [x] Calling it on an experiment that is not currently `backlog` (already `active`, in `reflect`, or `archived`) is rejected with 400.
- [x] The limit is scoped per-user: one user being at their limit does not block a different user's activation.
- [x] Calling it on a nonexistent experiment id, or an experiment id belonging to another user, returns the same identical-404 shape used by `GET /experiments/{id}` and the archive endpoint (don't distinguish "doesn't exist" from "exists but isn't yours").
- [x] Calling it unauthenticated returns 401, consistent with every other experiment endpoint.
- [x] The active count is derived at request time via `repository.list_experiments(user_id=..., status="active")` - no new persisted counter field.

## Out of scope

- The "1 goal Active" half of this issue's original acceptance criteria - goals don't exist yet (issue number 5, order-14, is still open). Filed as its own follow-up: issue number 29 (order-14b), to be picked up once issue number 5 lands.
- "Dashboard shows the live count (e.g. '2 / 2')" - this is a frontend/UI concern, not a backend check. It belongs with issue number 10 (dashboard, order-07), which is already next in the build sequence. This task only needs to make the limit real server-side; the UI reads it back from `GET /experiments?status=active` (count the array length) once this ships.

## Constraints

- Backend only: `backend/src/petri_backend/app.py` (new route), `openapi.yaml` (new path + schema additions), and `backend/src/petri_backend/repository.py` / `repository_memory.py` only if the existing `update_experiment(**fields)` / `list_experiments(...)` methods turn out not to be enough (they should be - no new abstract Repository method is expected).
- No new dependency - a single count-and-compare against `list_experiments(status="active")` is in scope, not a generic quota/rate-limit framework.
- Ref: `_docs/specs.md` -> "Work in progress limits".

---

## order-07 · #10 — Dashboard + calm landing/greeting screen

- **Status**: CLOSED
- **Labels**: frontend, design
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/10

## Goal

A signed-in user, right after sign-in, lands on a calm time-of-day greeting (not the dashboard directly); from there they deliberately open the full dashboard, which shows a card grid of their experiments plus WIP, ratio, streak, and Backlog info. Visual treatment follows `_docs/specs.md`'s neumorphic "natural makeup" design system, not the current plain default-Vite styling.

## Acceptance criteria

**Routing / greeting screen**

- [x] After a successful sign-in, the user lands on a new greeting screen, not directly on `/dashboard` (today `Home` redirects straight to `/dashboard` in `App.tsx` — that redirect target changes to the greeting screen).
- [x] Greeting text reads a time-of-day salutation + the user's `display_name` (e.g. "Good morning, Nachiket."), computed from the browser's local clock.
- [x] One quiet line below the greeting states how many things are due today. No stat grid, no cards, no color blocks anywhere on this screen.
- [x] Zero due today reads as a real sentence ("Nothing due today"), not "0 things due today."
- [x] A single explicit action ("Open dashboard" or equivalent) navigates to `/dashboard`. Nothing on this screen is a dashboard preview.
- [x] Refreshing the page while signed in still shows the correct name (not blank/undefined) — see Out of scope re: `/auth/me`.

**Dashboard**

- [x] Each experiment renders as a neumorphic card (soft dual-tone shadow, no hairline border, sage green accent) in a responsive grid — replacing the current plain `<ul><li>` three-line list in `Dashboard.tsx`.
- [x] An Experiments / Goals / Both filter control is present and defaults to "Both." Selecting "Goals" or "Both" shows an empty/zero state for goals (see Out of scope — no goal data exists yet); selecting "Experiments" or "Both" shows the real experiment cards.
- [x] A WIP tile shows the live experiment count against the cap, e.g. "Experiments 1/2," computed by counting `status === 'Active'` in the already-fetched experiments list. A goal WIP tile shows a static "Goals 0/1" until goals exist.
- [x] A completed-vs-abandoned ratio tile is computed from the same experiment list: abandoned = `ended_early === true`, completed = `status === 'Archived' && !ended_early`. Displays as e.g. "3 completed · 1 abandoned."
- [x] A streak number is shown prominently, Duolingo-style (large, set in IBM Plex Mono). No backend streak data exists yet (see Out of scope), so the tile renders in its final position/typography with a muted placeholder (e.g. "—") rather than a fabricated number.
- [x] A Backlog section lists experiments with `status === 'Backlog'` separately from the active grid (title + cadence type only, same card style, no extra fields).
- [x] Empty state (no experiments at all): one calm message (e.g. "No experiments yet.") instead of four empty section headers; the existing "New experiment" link stays visible.
- [x] 10+ experiments: grid wraps responsively, no horizontal scroll, no fixed per-row count.
- [x] A long title wraps or truncates with an ellipsis (full title available via a `title` attribute) without breaking the card or pushing the WIP/ratio tiles out of place.
- [x] While `GET /experiments` is in flight, the dashboard shows one loading indicator — no partial grid, no empty-state flash before data arrives.
- [x] On a non-ok response (including 401), the existing `role="alert"` error text renders alone — no grid, tiles, ratio, or streak placeholder alongside it.
- [x] Both screens respect the existing light/dark `prefers-color-scheme` variables already defined in `index.css` — no new hardcoded colors that break dark mode.

## Out of scope

- Goals actually appearing in the filter/grid/WIP tile — the Goals backend doesn't exist yet. Tracked in #5 (Goals CRUD, `order-14`) and #29 (goal WIP limit, `order-14b`); revisit this dashboard once those ship.
- A Settings toggle to default straight to the dashboard — the Settings screen itself doesn't exist yet. Tracked in #12 (`order-11`). This issue ships greeting-first as the only behavior for now; #12 adds the opt-out toggle.
- The due-today count's underlying computation — depends on the Check-in Due derived badge, tracked in #27 (`order-05b`, currently open). Use that computation once it lands rather than inventing a separate ad hoc calculation here.
- The real streak number — no backend data exists to compute it. New follow-up filed: #32 (`order-05d`).
- The signed-in user's `display_name` surviving a page reload — `AuthContext` only has it transiently right after sign-up/sign-in via the `onAuthenticated` callback, nothing on reload (no `/auth/me`-style endpoint exists). New follow-up filed: #31 (`order-04g`).
- Full 4-theme theming (Petri Light/Dark, Solarized Light/Dark) — Settings screen, #12 (`order-11`).
- The unauthenticated public landing page — a different screen for a different audience, #19 (`order-09`).
- Calendar, Other tasks, and the creation wizard — unrelated screens, not touched here (#11, #8, #13).

## Constraints

- Files: `frontend/src/Dashboard.tsx` + `Dashboard.test.tsx`, a new greeting component + its test, `frontend/src/App.tsx` (routing change only), plus whatever CSS file(s) carry the new neumorphic styling.
- Reuse the existing `BASE_URL` / `credentials: 'include'` / fetch-then-catch-finally pattern already used across `AuthForm.tsx`, `AuthContext.tsx`, `ExperimentDetail.tsx` — no new HTTP library.
- Reuse `AuthContext`'s existing `experiments` / `experimentsError` / `signedIn` state for the WIP and ratio tiles — don't add a second `GET /experiments` fetch.
- No new routing library beyond the already-installed `react-router-dom`; no new global state library.
- Follow `_docs/specs.md`'s "Design system" section: sage green for experiment cards (clay/terracotta is reserved for goals, applied once goals exist), IBM Plex Mono for the streak number and any day-count figures, no em dashes or hyphens used as punctuation in any new copy.
- Don't block the rest of this issue on the two new backend follow-ups (#31, #32) — ship the streak tile and the greeting's name with the placeholder/deferred behavior described above so everything else lands now.

---

## order-08 · #13 — Multi-step creation wizard (experiment/goal)

- **Status**: OPEN
- **Labels**: frontend, design
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/13

## Goal

Replace today's single long new-experiment form with a 3-step wizard (Details -> Cadence -> Review) plus a vertical side progress rail showing the user's position, while still submitting through the same, already-working `POST /experiments` call. This pass covers the experiment branch only; the goal branch is deferred (see Out of scope).

## Acceptance criteria

**Steps and fields**

- [ ] The wizard renders at the same route as today, `/experiments/new`, replacing the current single-screen `NewExperimentForm`.
- [ ] Step 1, "Details": `title` and `hypothesis` text inputs. Both required to advance.
- [ ] Step 2, "Cadence": `cadence_type`, `target_days` (required); `cadence_days` input appears only when `cadence_type === 'custom'` and is required in that case; `check_in_kind` and `start_date` remain optional, same as today.
- [ ] Step 3, "Review": a read-only summary of every value entered in Steps 1-2 (labeled, e.g. "Title: ...", "Hypothesis: ...", "Cadence: ..."), a "Back" control, and the submit action ("Create experiment"). No form inputs live on this step.

**Side progress rail**

- [ ] A vertical rail is visible beside the step content at all times, listing all three step names ("Details", "Cadence", "Review").
- [ ] The current step is visually distinguished (e.g. sage accent/bold) from the other two.
- [ ] Steps already completed show a distinct completed state (e.g. a checkmark), visually different from both the current step and not-yet-reached steps.
- [ ] Clicking a completed step's label in the rail navigates back to that step with its previously entered values still populated (see data-persistence criterion below).
- [ ] A step not yet reached is not clickable and cannot be jumped to directly (no skipping Step 2's validation by clicking straight to "Review").

**Validation**

- [ ] Attempting "Next" on Step 1 with `title` or `hypothesis` empty shows an inline error and does not advance.
- [ ] Attempting "Next" on Step 2 with `cadence_type` or `target_days` empty, or `cadence_days` empty while `cadence_type === 'custom'`, shows an inline error (reusing today's existing error copy where applicable) and does not advance.
- [ ] No additional validation happens on Review beyond what Steps 1-2 already enforced; Review's own possible error is only a failed submit (see below).

**Submit**

- [ ] Clicking "Create experiment" on Review sends the same request shape `NewExperimentForm.tsx` sends today: `POST {BASE_URL}/experiments`, `credentials: 'include'`, JSON body built from the three steps' values, omitting `cadence_days`/`check_in_kind`/`start_date` when empty exactly as today.
- [ ] The submit button is disabled while the request is in flight (mirrors today's `submitting` state).
- [ ] On success: `refetch()` from `useAuth()` is called and the user is navigated to `/dashboard`, same as today.
- [ ] On a non-ok response (400 or 401), the backend's `detail` message renders via `role="alert"` on the Review step; the user stays on Review with their data intact and can retry.

**Edge cases**

- [ ] Data entered on Step 1/2 is still present if the user goes Back to Step 1/2 from Review, or forward again to Review — wizard state lives above the per-step views, not reset on step mount.
- [ ] Navigating away mid-wizard (sign out, clicking another link) simply abandons the in-progress entry with no confirmation prompt and no draft saved — same "no persistence" behavior as today's form, just now spread across steps instead of one screen.
- [ ] The browser back button, when pressed mid-wizard, navigates away from `/experiments/new` entirely (back to wherever the user came from) rather than stepping back within the wizard — step navigation only happens via the rail/in-wizard Back control, not the browser history stack.
- [ ] All interactive elements (Next/Back buttons, rail step labels, inputs) are real, focusable `<button>`/`<input>` elements reachable by Tab in visual order and operable with Enter/Space; no custom keyboard shortcuts are introduced.
- [ ] Refreshing the browser mid-wizard loses all entered data and returns to Step 1 on reload — acceptable given today's form has no persistence either.

## Out of scope

- The goal branch of this wizard (a milestones step instead of cadence, submitting to a goal-creation endpoint). There is currently no backend support for Goals at all: #5 ("Goals: CRUD + locked ordered milestone list", `order-14`) is still open and not started, so a goal branch here would have nothing real to submit to. Follow-up filed: #34 (`order-14a`), to be built once #5 ships and slotted in right after it. This issue ships the experiment branch only, with the wizard shell built so #34 can extend it rather than fork a second implementation.
- Draft persistence/autosave across a page reload or closed tab mid-wizard. Not in today's spec, and the single-shot form being replaced has none either.
- The Settings sound effect on wizard start/finish mentioned in `_docs/specs.md`'s Design system section. The Settings screen doesn't exist yet, tracked in #12 (`order-11`).
- Full 4-theme theming behavior. Same, #12.
- Inline editing of fields directly within the Review step's summary. Review is a read-only summary with a Back control; editing happens by going back to the relevant step.

## Constraints

- Files: `frontend/src/NewExperimentForm.tsx` (restructure into the wizard, or split into step components alongside it), `frontend/src/neumorphic.css` (add rail/step styling reusing the existing `--sage`, `--neu-surface`, `--neu-shadow-dark`, `--neu-shadow-light` tokens; no new hardcoded colors). `frontend/src/App.tsx` only changes if the route itself needs to change (it shouldn't; `/experiments/new` stays the single entry point).
- Reuse the exact existing fetch pattern from `NewExperimentForm.tsx`: `BASE_URL` from `VITE_BACKEND_URL`, `credentials: 'include'`, `refetch()` from `useAuth()`, `navigate('/dashboard')` on success. No new HTTP library.
- Wizard step state is local React state within the existing route; no new routing library (one route per step is not required) and no new global state library.
- Sage green accent for the current/completed step markers per the Design system section (clay/terracotta is reserved for goals, not used here since this pass is experiment-only).
- No em dashes or hyphens used as punctuation in any new copy; keep "cadence", "check in" terms as-is.

---

## order-08b · #14 — Backend data layer: Postgres + repository interface

- **Status**: CLOSED
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
- [x] Swap in the Postgres implementation once the schema in `_docs/schema.sql` is wired up; no route/service changes, only a second implementation of the same interface.

---

## order-08c · #30 — Wire frontend into one signed-in app flow (router + shared auth state)

- **Status**: CLOSED
- **Labels**: frontend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/30

## What

Every frontend piece built so far (AuthForm, Dashboard, ExperimentDetail,
NewExperimentForm, HealthStatus) works and is tested in isolation, but
none of them are actually connected. Right now App.tsx just stacks them
vertically on one page, on top of the untouched Vite scaffold (hero
images, counter button, docs/social links). Concretely broken today:

- ExperimentDetail isn't even imported into App.tsx -- it's unreachable.
- Dashboard fetches once on mount; signing in via AuthForm afterward
  does not make it refetch.
- There is no router, so there is no way to navigate from a Dashboard
  card to that experiment's detail page -- ExperimentDetail currently
  requires a hardcoded experimentId prop with nothing supplying one.
- Creating an experiment via NewExperimentForm does not update
  Dashboard's list.
- No shared auth/session state exists across components; each one
  independently discovers whether a request is authenticated by trying
  its own fetch call and reacting to a 401.

This issue is that wiring. It was repeatedly deferred across the
Dashboard/ExperimentDetail/NewExperimentForm grooming passes, each time
by pointing at a different issue's scope rather than landing a concrete
task anywhere -- this is that concrete task.

## Acceptance criteria

- [x] A router is installed (react-router-dom -- the one deliberate new
      dependency this task adds) with at least these routes: a
      signed-out view (shows AuthForm), a dashboard view (Dashboard),
      an experiment detail view reading its id from the URL (not a
      hardcoded prop), and some way to reach NewExperimentForm from the
      dashboard (a route or a toggle -- implementer's call, state it).
- [x] A shared auth state (minimal context, no new state-management
      dependency) tracks whether the user is signed in, derived once
      (e.g. a `/auth/me`-equivalent check on load -- check whether such
      an endpoint exists in openapi.yaml; if not, deciding how to derive
      "am I signed in" cheaply is part of this task) and updated on
      sign-in/sign-out, so Dashboard/ExperimentDetail don't each
      independently discover auth state via a failed fetch.
- [x] Signing in via AuthForm transitions to the dashboard view and
      Dashboard's list is fetched with the now-valid session.
- [x] Clicking a Dashboard card navigates to that experiment's real
      detail page (via its real id, through the router), not a
      hardcoded id.
- [x] Creating an experiment via NewExperimentForm returns the user to
      (or otherwise updates) the dashboard view, and the new experiment
      appears in the list without a manual page reload.
- [x] The leftover Vite scaffold content (hero images, counter button,
      "Explore Vite"/docs/social sections) is removed from App.tsx --
      this is the actual product now, not the starter template.
- [x] Existing component-level tests for AuthForm/Dashboard/
      ExperimentDetail/NewExperimentForm still pass unmodified in their
      standalone form where reasonable; new integration-level tests
      (Vitest + RTL) cover at least: sign up -> land on dashboard,
      create an experiment -> see it on dashboard, click into it -> see
      its detail page.

## Out of scope

- Visual/design-system polish (neumorphic styling, the Pinterest-derived
  mockups) -- functional wiring only. The standalone UX Validator role
  (`_docs/team/ux-validator.md`) covers visual bugs separately, once
  there's a real flow to look at.
- The real multi-step creation wizard (#13's own remaining scope) --
  this task wires up whatever form currently exists, doesn't rebuild it.
- The calm landing/greeting screen (#10's own remaining scope).
- Running the backend against a real, persistently-running Postgres for
  an actual local demo -- that's #15 (order-12, Docker Compose). This
  task is pure frontend wiring and works the same regardless of which
  repository implementation the backend happens to be running against.

## Constraints

- `frontend/src/` only. No backend changes unless a genuinely missing
  "who am I" endpoint turns up during implementation, in which case
  flag it rather than silently adding one -- check first whether
  something already covers it (none of GET /experiments's existing
  behavior requires a separate identity endpoint; reusing whatever's
  cheapest is the goal).
- No new dependency beyond react-router-dom.

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

- [x] Docker Compose: backend, frontend, and Postgres as three services, one `docker compose up`, no manual steps after it. Deploying that compose file to the actual VPS/domain is a separate follow-up once it runs locally.

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

## order-14a · #34 — Multi-step creation wizard: add Goal branch (milestones step)

- **Status**: OPEN
- **Labels**: frontend, design
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/34

## Goal

Once Goals exist on the backend (#5, `order-14`), extend the experiment-creation wizard shipped for #13 with a second entity branch: creating a Goal through the same wizard shell, with a milestones step in place of the cadence step.

## Acceptance criteria

- [ ] An entry point to "New goal" exists (dashboard and/or wizard's own entity picker) alongside the existing "New experiment" entry point.
- [ ] Steps: details (title, why-this-goal text, start/target date) -> milestones (define the full, locked, ordered milestone list) -> review.
- [ ] The milestones step lets the user add, reorder, and remove milestone entries before submitting; at least one milestone is required to proceed.
- [ ] Submit wires to whatever goal-creation endpoint #5 ships (shape TBD until #5 lands), following the same refetch-then-navigate pattern used for experiments.
- [ ] The side progress rail, back/forward behavior, per-step validation, and keyboard/browser-back handling match the conventions established for the experiment branch in #13 (ref that issue once groomed).

## Out of scope

- Everything already covered for the experiment branch in #13 — this issue only adds the goal branch.
- Milestone editing after the goal is Active (locked-list change via explicit abandon-with-reason) — that's goal lifecycle behavior owned by #5, not wizard behavior.

## Constraints

- Depends on #5 shipping first (`order-14`); do not start before the goal-creation endpoint exists.
- Reuse the wizard shell/progress-rail component built for #13 rather than forking a second wizard implementation.
- Follow `_docs/specs.md` -> "Creating an experiment or a goal" and "Core entities" (milestone definition) for intended behavior.
- Clay/terracotta accent color (not sage) per the Design system section, consistent with goals elsewhere once they exist.

---

## order-14b · #29 — Enforce goal WIP limit (1 goal Active at a time)

- **Status**: OPEN
- **Labels**: backend
- **Link**: https://github.com/nachiketnasa/petri-v2/issues/29

## Goal

A user may have at most 1 goal Active at a time, enforced server-side on whatever endpoint activates a goal, mirroring the experiment WIP limit added for issue number 7.

## Acceptance criteria

- [ ] Activating a 1st goal succeeds.
- [ ] Activating a 2nd goal while one is already Active is rejected with 400, and the first goal remains Active.
- [ ] The limit is scoped per-user.
- [ ] Activating a nonexistent/other-user's goal returns the same 404 shape used elsewhere.
- [ ] Unauthenticated requests get 401.
- [ ] The activate endpoint (and the goal's state machine generally) is documented in openapi.yaml.

## Out of scope

- Dashboard display of the live goal count - that is a frontend concern tracked under issue number 10 (order-07).

## Constraints

- Depends on issue number 5 (Goals CRUD + milestones, order-14) landing first - there is no Goal entity, repository method, or activate transition to enforce a limit on yet.
- Follow the same shape/pattern used for the experiment WIP limit (issue number 7): count the user's goals with status="active" before allowing activation, reject the over-limit attempt with 400, identical-404 for not-found/cross-user.
- Mirrors `_docs/specs.md` -> "Work in progress limits".

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
