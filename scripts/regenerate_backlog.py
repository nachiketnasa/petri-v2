#!/usr/bin/env python3
"""Regenerate _docs/backlog.md from the live GitHub issue tracker.

The tracker is the source of truth; this script is the only thing that
should ever write _docs/backlog.md. Run it after any issue changes
(body, labels, state) instead of hand-editing the file.
"""
import datetime
import json
import re
import subprocess

REPO = "nachiketnasa/petri-v2"
ORDER_RE = re.compile(r"order-(\d+)$")


def fetch_issues() -> list[dict]:
    out = subprocess.run(
        [
            "gh", "issue", "list", "--repo", REPO, "--state", "all", "--limit", "100",
            "--json", "number,title,state,labels,body,url",
        ],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def order_key(issue: dict) -> tuple[int, int]:
    for label in issue["labels"]:
        m = ORDER_RE.match(label["name"])
        if m:
            return (int(m.group(1)), issue["number"])
    return (10**6, issue["number"])  # unordered issues sort last


def render(issues: list[dict]) -> str:
    today = datetime.date.today().isoformat()
    lines = [
        "# Petri v2 — Backlog\n",
        f"A local mirror of the public task tracker: https://github.com/{REPO}/issues\n",
        f"Generated from the tracker on {today}. The tracker is the source of truth; "
        "this file is a readable snapshot committed alongside the spec, not edited "
        "independently — regenerate it with `scripts/regenerate_backlog.py` instead "
        "of hand-editing when issues change.\n",
        "**Listed in build order, not issue-number order.** Each issue carries an "
        "`order-NN` label marking when work on it should start; issues sharing a "
        "number are meant to start together (e.g. the two project-setup scaffolds). "
        "Give any new issue an `order-NN` label before filing it, placed at the "
        "point in the sequence where it belongs — otherwise it sorts last, below. "
        "Issues #1, #16, and #17 span the whole product (the contract and the two "
        "test suites), so their own Acceptance criteria is a checklist of the "
        "other issues that complete them, not a bounded task on its own.\n",
    ]

    for issue in sorted(issues, key=order_key):
        order_label = next(
            (l["name"] for l in issue["labels"] if ORDER_RE.match(l["name"])), None
        )
        prefix = f"{order_label} · " if order_label else "unordered · "
        lines.append(f"## {prefix}#{issue['number']} — {issue['title']}\n")
        lines.append(f"- **Status**: {issue['state']}")
        other_labels = ", ".join(
            l["name"] for l in issue["labels"] if not ORDER_RE.match(l["name"])
        ) or "none"
        lines.append(f"- **Labels**: {other_labels}")
        lines.append(f"- **Link**: {issue['url']}\n")
        lines.append(issue["body"].rstrip() + "\n")
        lines.append("---\n")

    if lines[-1] == "---\n":
        lines.pop()

    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    issues = fetch_issues()
    with open("_docs/backlog.md", "w") as f:
        f.write(render(issues))


if __name__ == "__main__":
    main()
