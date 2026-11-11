# Petri

A small, contained space to run an experiment and watch it grow.

## For the evaluator

If you're grading this as an assigned evaluator from the **AI DevTools Zoomcamp 2026
cohort**, this section is for you.

### Running it locally (no Resend account needed)

```bash
git clone https://github.com/nachiketnasa/petri-v2.git
cd petri-v2
docker compose up --build
```

That's the whole setup — one command, no `.env` file required. Postgres, the FastAPI
backend, and the Vite frontend each start as their own container.

- Frontend: http://localhost:5173
- Backend / OpenAPI docs: http://localhost:8000/docs

If any of those ports are already taken on your machine, override them before
starting — `docker-compose.yml` reads `POSTGRES_PORT` / `BACKEND_PORT` /
`FRONTEND_PORT` with those same defaults, e.g.:
```bash
BACKEND_PORT=8001 FRONTEND_PORT=5174 docker compose up --build
```

**Email, without a Resend API key.** The app sends real email (sign-up verification
codes, password reset links) through [Resend](https://resend.com). You don't need an
account to evaluate it: with no `RESEND_API_KEY` set, the backend logs the code/link to
stdout instead of sending it, rather than failing or behaving differently — this is a
real code path (`backend/src/petri_backend/email.py`), not a demo-only shim. To grab a
code or link while testing:

```bash
docker compose logs backend | grep -A2 "EMAIL ("
```

Sign up, then look there for the 6-digit verification code (or use "Resend code" on
the verify screen to get a fresh one). Same for "Forgot password."

If you'd rather see real delivery, set `RESEND_API_KEY` (and `EMAIL_FROM_ADDRESS`,
once sent from a domain verified on your Resend account) in a root `.env` file before
`docker compose up` — `docker-compose.yml` already passes both through.

### Self-assessment against the grading rubric

12 criteria, 24 points, 10 to pass. Scored against this repository as submitted —
not a claim, a pointer to the actual evidence for each line, so you can check it
yourself:

| # | Criterion | Self-score | Evidence |
|---|---|---|---|
| 1 | Problem description | 2 / 2 | This README's [problem](#the-problem) and [functionality](#functionality) sections. |
| 2 | Product specification | 2 / 2 | [`_docs/specs.md`](_docs/specs.md) (entities, user stories, acceptance criteria); public tracker at [Issues](https://github.com/nachiketnasa/petri-v2/issues), snapshotted in [`_docs/backlog.md`](_docs/backlog.md). |
| 3 | Agent team specification | 2 / 2 | [`_docs/process.md`](_docs/process.md) (PM → Engineer → QA lifecycle) and [`_docs/team/`](_docs/team) (one file per role). **Evidence the roles were actually used, not just documented:** [issue #30](https://github.com/nachiketnasa/petri-v2/issues/30)'s comment thread shows the full cycle on one issue — PM's `## Groomed:` comment, Engineer's `Implemented:` comment, QA's `## QA: FAIL`, Engineer's follow-up fix, and QA's final `## QA: PASS` before close. |
| 4 | Context management | 2 / 2 | [`AGENTS.md`](AGENTS.md) indexes every doc below it; each is scoped to one concern. |
| 5 | Application | 2 / 2 | `docker compose up --build` runs frontend + backend + Postgres together; see [Running it locally](#running-it-locally-no-resend-account-needed) above. |
| 6 | Testing | 2 / 2 | Backend, one command runs unit *and* integration tests (against real Postgres, see `backend/tests/test_repository_postgres.py`) together: `docker compose up -d postgres && cd backend && DATABASE_URL=postgresql://petri:petri@localhost:5432/petri uv run pytest` (210 passed, 0 skipped, verified). If port 5432 is already taken on your machine, set `POSTGRES_PORT` first, e.g. `POSTGRES_PORT=5433 docker compose up -d postgres` and point `DATABASE_URL` at that port instead — `docker-compose.yml`'s ports are all overridable this way (`POSTGRES_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`), with the same defaults (5432/8000/5173) if left unset. A bare `uv run pytest` still works and stays green, but skips the Postgres-backed tests — pass `DATABASE_URL` to include them. Frontend: `cd frontend && npm test` (Vitest + React Testing Library). |
| 7 | Containerization | 2 / 2 | Single `docker-compose.yml` for all three services. |
| 8 | Deployment | 0 / 2 | Not deployed yet. `_docs/specs.md`'s Tech stack section names the intended target (a VPS, `petri.nachiketnasa.com`), not yet acted on. |
| 9 | CI/CD | 0 / 3 | No `.github/workflows` yet. |
| 10 | Observability | 0 / 2 | No metrics/traces/structured logs with request correlation yet. |
| 11 | Alerting | 0 / 1 | None yet. |
| 12 | On-call agent | 0 / 2 | None yet. |
| | **Total** | **14 / 24** | Pass threshold is 10. |

The honest gap is entirely in the ops layer (deployment, CI/CD, observability,
alerting, on-call) — nothing in the product, spec, testing, or containerization rows
above is partial credit.

## The problem

Most people either commit to nothing (a vague New Year's resolution that dies in a
week) or overcommit to everything (five new habits, three side projects, and a
half-written novel, all started the same Monday). Neither works. The first never gets
tested; the second collapses under its own weight, and *The Art of Impossible* makes
the mechanism explicit: a person can only really hold so much at once before none of
it sticks.

Petri is a planner built around one idea: test small before you commit big, and never
run more at once than you can actually carry. A "tiny experiment" is a cheap,
time-boxed test of a hypothesis ("if I walk after lunch, then my focus holds longer").
If it works, it can grow into a full goal with real milestones, not just stay a
habit tracker forever. If it doesn't, ending it early is simply recorded as an
outcome, not concealed as a failure.

## Functionality

### Public landing page
Anyone without an account who hits the site sees one public page explaining what
Petri does, not the app and not a login wall, with a single action: sign in or create
an account. No pricing tiers, no testimonials, same restrained design as the rest of
the product. This is separate from the signed-in greeting screen described below.

### Tiny experiments
A hypothesis, a cadence (daily, weekly, or a custom interval), and a target duration,
set once at creation. Check in on schedule with a structured value (done/not done, or
a 1–5 rating, picked once per experiment) plus an optional free-text note. A card is
visually flagged once a check-in is due or overdue. An experiment can only be checked
into while it's Active, not while it's sitting in the backlog or already archived.
When its duration ends, or it's ended early, a short retro (what worked, what didn't,
continue/stop/pivot/iterate) is required before it can archive.

### Goals and milestones
A goal is a bigger commitment: a title, a reason for pursuing it, a start and target
date, and a full list of milestones defined up front. Milestones are locked once the
goal is active, changing them later requires explicitly abandoning the current one
with a reason, not a quiet edit. Only one milestone runs at a time, each exactly like
a tiny experiment (its own cadence and check-ins); completing one activates the next
in order. A tiny experiment that proves itself out can **evolve** into a goal
(one-way). Separately, any concluded experiment or goal can optionally **branch**
into a fresh successor of the same kind, an experiment into a new experiment, a goal
into a new goal, so a result can lead straight into the next round without starting
from a blank backlog. Every evolve and branch is stored as a real link between the two
items involved, not just copied data, laying the groundwork for a future node-based
diagram showing that lineage across all or selected experiments and goals. That
diagram itself isn't built in v2, but the data it would need already is.

### Work in progress limits
At most 2 experiments and 1 goal can be active at the same time, enforced by the
system, not just suggested by the UI. The product is built around working through
things one at a time rather than juggling several at once.

### Transparent endings
Ending or deleting anything before its cadence or duration is up requires a one-line
reason, which is kept permanently on that item's record. The dashboard shows a plain,
always-visible count of completed versus abandoned items, so the pattern stays
visible rather than something you'd have to go dig up.

### Streaks
Consecutive logged cadence periods are counted and shown in a persistent, visible
spot, similar in presentation to apps like Duolingo. Unlike those apps, there is no
streak freeze to buy, no social or friend-streak pressure mechanic, and nothing is
lost beyond the number resetting if a day is missed.

### Dashboard and landing screen
Signing in opens a calm greeting screen first (a time-of-day greeting plus a single
line noting how many things are due today), not the full dashboard. From there the
user opens the full dashboard deliberately, or sets it as their default landing view
in Settings. The dashboard itself is a card grid of active items, filterable by
Experiments, Goals, or Both, with the work-in-progress counts and the
completed-versus-abandoned ratio always visible, plus a backlog section.

### Creating an experiment or a goal
Both are created through a short, multi-step wizard (details, then cadence or
milestones, then review) with a progress rail on the side showing the current step,
rather than one long form.

### Calendar
A week view (Monday through Sunday) and a month view, each its own layout. The month
view always renders full weeks: it starts on the Monday of the week containing the
1st, covers every day of the month, and continues through the Sunday that closes out
the week containing the last day, showing the spillover days from the neighboring
months, faded. Both views support moving to the previous or next period, and a scope
toggle switches between "this cadence only" and "everything active."

### Other tasks (optional, off by default)
A separate, lower-profile feature, turned on from Settings, for ordinary obligations
that aren't experiments or goals, coursework, a work deadline, exam prep, and so on.
Each task is one-time (a specific date) or repeating (chosen days or interval, until
an end date), configured the way a phone's alarm app configures a repeat rule, and
can be edited or removed at any time. These can be viewed on their own or merged into
the Calendar alongside experiment and milestone cadences. If everything due on a
single day, other tasks, check-ins, and the active goal's current milestone, combined,
passes 8 items, that day is flagged as a warning (never a hard block). Other tasks can
send a browser push notification (with the standard permission prompt); nothing in
Petri sends email notifications outside of account security messages.

### Sharing, likes, and comments
Any experiment or goal can be made public: a per-item toggle generates a read-only
page at an unguessable link, requiring no login to view. An experiment's page shows
its title, hypothesis, cadence, stage, and check-in streak; a goal's page also shows
milestone progress. Neither ever shows private notes or retro content. The link can
be copied or posted through plain share-to links (X, LinkedIn); there's no
"post on your behalf" API integration. Visitors can like or comment once signed in,
and the item's owner can delete any comment on their own page. Turning sharing off
deletes all likes and comments on that page and invalidates the link; turning it back
on issues a new link, starting at zero.

### Accounts
Sign up or sign in with Google, LinkedIn, or Microsoft OAuth, or with email and
password (email sign-up requires a verification code, and gets a real forgot-password
flow). Only one account exists per email address, no matter which method it was
created with. Explicit logout, and full account deletion on request. The site sits
behind Cloudflare for DDoS mitigation, and auth forms are protected against bots.
Two-factor authentication is optional, off by default, and uses a standard
authenticator app of the user's choice (Google Authenticator, Authy, 1Password, and
the like) rather than SMS, a genuinely free addition since TOTP is an open protocol
with no carrier cost behind it. Turning it on shows a QR code and a set of one-time
recovery codes. The only cookies the site sets are strictly necessary ones (sign-in,
security), disclosed with a simple notice rather than a cookie-category picker, since
there's nothing optional to pick between.

### Settings
Theme (a choice of four: Petri Light, Petri Dark, Solarized Light, Solarized Dark,
applied across the whole app and saved to the account), a sound effects toggle (short
tones on starting or finishing setup, logging a check-in, and pausing or removing a
cadence), the Other tasks feature toggle, the landing-screen preference, two-factor
authentication, and account deletion.

## Expected behavior

The full, authoritative behavior spec, including every user story, acceptance
criterion, and explicit non-goal, lives in [`_docs/specs.md`](_docs/specs.md). In short:

- Nothing can be checked into, or logged against, an experiment or milestone that
  isn't Active.
- Nothing can be archived without a retro (or, if ended early, an abandon reason)
  recorded first.
- The WIP limit is enforced server-side, not just hinted at in the UI.
- A shared page only ever exposes title, hypothesis/goal text, cadence, stage, streak,
  and (for goals) milestone progress — never private notes or retro content.
- Every user's data is isolated; there is no cross-user access.

## Tech stack

- **Backend**: FastAPI (Python), OpenAPI-first — `openapi.yaml` is the contract every
  endpoint is built and tested against. Two-factor auth uses `pyotp` (open source,
  MIT licensed, no external service) for TOTP generation/verification.
- **Data store**: PostgreSQL from the start, behind a repository interface so
  route/service code never depends on it directly.
- **Frontend**: React 18 (no meta-framework), Vite, TypeScript, React Router for
  routing, Vitest and React Testing Library for tests. The same choice Petri v1 used.
- **Runtime**: Node.js 24 LTS, pinned to **≥24.22.1** (the patched line from the
  October 2026 Node.js security release).
- **Infra**: Cloudflare in front for DDoS mitigation and bot protection (Turnstile/
  reCAPTCHA) on auth forms; Web Push for the one notification type the product sends
  (Other task reminders).
- **Hosting**: a single VPS (Oracle Cloud's Always Free tier, Hetzner as the paid
  fallback), frontend and backend as separate Docker Compose containers talking to
  each other, Postgres as a third. `petri.nachiketnasa.com` points at it.
- **Sessions**: server-side, not JWT — an httpOnly cookie for the web client now, a
  `Bearer` token for a native mobile app later, both backed by the same session store.
- **Email**: Resend for now, behind a swappable interface so moving to Brevo or
  Amazon SES later needs no rewrite.

## Project docs

- [`_docs/specs.md`](_docs/specs.md) — product specification: entities, user stories,
  acceptance criteria, non-goals, and the technical plan.
- [`_docs/architecture.html`](_docs/architecture.html) — data flow diagram, backend
  layering, and the core entity/lineage relationships.
- [`_docs/schema.sql`](_docs/schema.sql) — the PostgreSQL schema, verified against a
  real `postgres:16` instance.
- [Issue tracker](https://github.com/nachiketnasa/petri-v2/issues) — every acceptance
  criterion above broken into tasks; [`_docs/backlog.md`](_docs/backlog.md) is a
  generated snapshot of it, committed for convenience (the tracker is authoritative).
- Agent team docs: in progress.

## Status

Full-stack and functional: every feature in this document is built and running —
signup/sign-in (email+password, TOTP 2FA), experiments and goals/milestones end to
end (create, activate, check in, complete via retro or abandon), the calendar,
sharing/likes/comments, Settings, and Other tasks. Backed by real integration tests
against Postgres, not just the in-memory repository. Not yet done: a deployed public
URL, CI/CD, and observability/alerting (see the evaluator table above for the exact
breakdown).

## Credits and disclaimers

**This project builds on prior work of my own.** Petri started as a homework
submission for the AI DevTools Zoomcamp (the original: [nachiketnasa/petri](https://github.com/nachiketnasa/petri)).
This repository is a deliberate v2: the same product idea, substantially redesigned
and extended (goals and milestones, branching, Other tasks, a new design system, and
more, as this document describes) rather than a copy resubmitted unchanged. It's
noted here explicitly so the overlap with that earlier submission is never mistaken
for undisclosed self-plagiarism.

Petri's design also borrows structure and language from a few outside frameworks,
named here for attribution:

- The **PACT** methodology (Purposeful, Actionable, Continuous, Trackable), the term
  "tiny experiments," and the retro's what-worked/what-didn't/decision shape (which
  draws on the book's own "Plus, Minus, Next" reflection exercise and its
  "Persist, Pivot, Pause" decision framework) all come from Anne-Laure Le Cunff's book
  *Tiny Experiments*.
- The 8-items-a-day threshold used for the Other tasks warning is drawn from Steven
  Kotler's book *The Art of Impossible*.

These are referenced as named concepts and general methodology for structural
inspiration only. No text, figures, or other copyrighted material from these works is
reproduced here. All rights to these works, their titles, and their content remain
with their respective authors and publishers. Petri is an independent project, not
affiliated with, endorsed by, or sponsored by any of the authors or publishers named
above, and no claim of license or ownership over their work is made or implied.
