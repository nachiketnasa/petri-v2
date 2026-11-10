# AGENTS.md

Petri v2 — a planner for tiny experiments and goals. Full context lives in
the docs below, not repeated here; this file is the index plus the handful
of rules that apply everywhere.

## Docs map

| File | What it's for |
|---|---|
| [`_docs/specs.md`](_docs/specs.md) | The product spec: entities, user stories, acceptance criteria, non-goals, tech stack, technical plan. Read this before touching behavior. |
| [`_docs/architecture.html`](_docs/architecture.html) | Data flow diagram, backend layering, core entity/lineage relationships. |
| [`_docs/schema.sql`](_docs/schema.sql) | The PostgreSQL schema, verified against a real `postgres:16` instance. |
| [`_docs/backlog.md`](_docs/backlog.md) | Generated snapshot of the [issue tracker](https://github.com/nachiketnasa/petri-v2/issues), sorted by each issue's `order-NN` label — build order, not issue-number order. Run `python3 scripts/regenerate_backlog.py` after any issue change; don't hand-edit the file. Give any new issue an `order-NN` label before filing it. |
| [`_docs/process.md`](_docs/process.md) | The team roles, the orchestrator, and the PM → Engineer → QA lifecycle every issue goes through. |
| [`_docs/team/pm.md`](_docs/team/pm.md) | The PM role: grooms an issue into `_docs/task-template.md`'s shape before anyone implements it. |
| [`_docs/team/software-engineer.md`](_docs/team/software-engineer.md) | The Engineer role: implements one groomed issue, writes tests, does not close it. |
| [`_docs/team/qa-engineer.md`](_docs/team/qa-engineer.md) | The QA role: checks finished work against the issue's acceptance criteria, posts PASS/FAIL, never fixes code. |
| [`_docs/team/ux-validator.md`](_docs/team/ux-validator.md) | Standalone: checks the running frontend for visual/interaction bugs against the mockups and design system, and fixes what it finds. Not part of the PM → Engineer → QA lifecycle. |
| [`_docs/task-template.md`](_docs/task-template.md) | The Goal / Acceptance criteria / Out of scope / Constraints shape a groomed issue is written in. |

## Team

The main session is the **orchestrator**: it launches PM, Engineer, and QA
as subagents and runs the lifecycle below. It does not groom, implement, or
test itself. Full detail lives in `_docs/process.md`; this is the summary.

1. Pick the next open issue from the backlog
2. PM grooms it — one unchecked checklist line at a time if the issue has
   several, via a `## Groomed: ...` comment, not the whole issue at once
3. Engineer implements exactly that groomed task (doesn't close the issue)
4. QA verifies it against that same scope — PASS or FAIL only, never fixes code
5. FAIL → back to step 3 with the QA comment as input
6. PASS → check off that checklist line, regenerate `_docs/backlog.md`
   (`scripts/regenerate_backlog.py`), commit. Close the issue only once
   every line on it is checked — most issues take several loops.
7. Repeat until the backlog is empty

The **UX Validator** sits outside this lifecycle — run it directly against
a rendered frontend result (e.g. after a frontend issue lands) rather than
as an automatic pipeline step.

More files will land in `_docs/team/` as other roles get defined; this
table and the lifecycle above get updated each time one does.

## Commands

No code exists yet — this repo is still at the spec/backlog stage (see
`_docs/backlog.md` issues #16 and #17 for the scaffold tasks). Once those
land, these are the commands:

- `uv sync` — install backend dependencies (Python, via `uv`)
- `uv run pytest` — the backend test suite
- `npm install` — install frontend dependencies (run inside `frontend/`)
- `npm test` — the frontend test suite (Vitest)

Until the scaffold tasks are done, don't guess at these — check the issue
checklists instead.

## Rules

- `_docs/specs.md` is the source of truth for product behavior. If an issue
  or a task disagrees with it, the spec wins — fix the issue, not the spec,
  unless the user explicitly changes the spec.
- Work one GitHub issue at a time (see `_docs/process.md`). Read its
  acceptance criteria before starting and again before closing it.
- Commit regularly, not in one large batch at the end of an issue.
- Don't hand-edit `_docs/backlog.md` — it's generated from the tracker.
- Dependencies are added deliberately. Do not add one without asking first.
