- Tasks are Github issues, one at a time
- Read the acceptance criteria before starting and before closing
- Commit regularly

Roles

- PM - grooms a task before anyone implements it, follows _docs/team/pm.md
- Engineer - implements one groomed task, follows _docs/team/software-engineer.md
- QA - checks finished work against the issue's acceptance criteria and posts a PASS/FAIL verdict, follows _docs/team/qa-engineer.md
- UX validator - checks the running frontend for visual and interaction bugs against the mockups, follows _docs/team/ux-validator.md

Orchestrator

The main session is the orchestrator. It launches the PM, the engineer
and QA as subagents. It does not groom, implement or test itself.

Lifecycle

1. Pick the next open issue from the backlog
2. PM grooms it
3. Engineer implements it
4. QA verifies it
5. On FAIL, back to step 3 with the QA comment as input
6. On PASS: check the issue is still OPEN before anything else — a
   commit using a GitHub closing keyword (`Fix #4`, `Closes #4`, etc.)
   auto-closes it on push regardless of how much is actually done; if so,
   reopen it immediately. Then check off the groomed checklist line on
   the issue (if PM groomed one line rather than the whole issue),
   regenerate `_docs/backlog.md` with `scripts/regenerate_backlog.py`,
   and commit. Close the issue only once every line/criterion on it is
   checked — most issues take several passes through this loop before
   that's true.
7. Before moving to the next order number: if this pass named anything
   as out of scope or deferred (per PM's rule below), check it already
   has an `order-NN` (or lettered `order-NNx`) label somewhere. If not,
   assign one now — a deferred item with no schedule position silently
   falls out of the backlog instead of coming back later. Also check
   whether the next order number actually depends on something still
   unchecked in the current issue (e.g. a later feature needing an
   earlier feature's current-user resolution) — if so, finish the
   current issue's blocking line(s) first rather than advancing anyway.
8. Repeat until the backlog is empty

Rules

- Do not skip step 2
- The engineer does not close the issue
- QA does not fix the code, only outputs PASS or FAIL
- The orchestrator closes the issue only after QA outputs PASS