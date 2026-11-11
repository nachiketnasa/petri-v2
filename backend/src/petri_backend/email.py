"""Email sending, behind a small interface (send_password_reset_email,
send_verification_email) so switching providers later (Brevo, SES) is a
new implementation of this interface, not a rewrite -- the same pattern
repository.py gives the data store. _docs/specs.md -> Technical plan.

Uses Resend's plain HTTP API via stdlib `urllib` (no SDK dependency) --
Resend's API is one POST with a bearer token, not worth a whole library.
"""

from __future__ import annotations

import json
import os
import urllib.request

_RESEND_API_URL = "https://api.resend.com/emails"


def _send(*, to: str, subject: str, html: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    from_address = os.environ.get("EMAIL_FROM_ADDRESS", "Petri <onboarding@resend.dev>")

    if not api_key:
        # No key configured (local/dev, or CI): fall back to the dev-log
        # behavior rather than ever raising into the request path -- an
        # unconfigured key must not 500 a request or otherwise behave
        # differently from a real send, which could leak whether the
        # account exists (#21's own acceptance criteria).
        print(f"EMAIL (no RESEND_API_KEY set) to={to} subject={subject!r}\n{html}")
        return

    payload = json.dumps(
        {"from": from_address, "to": [to], "subject": subject, "html": html}
    ).encode()
    request = urllib.request.Request(
        _RESEND_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # Cloudflare (fronting Resend's API) blocks urllib's default
            # "Python-urllib/x.y" User-Agent as a bot signature.
            "User-Agent": "petri-backend",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10):
            pass
    except Exception:
        # Fails safely: a provider error (bad key, network issue, Resend
        # outage) must not 500 the request in a way that could reveal
        # account existence -- log it and move on, same as #21 requires.
        print(f"EMAIL send failed to={to} subject={subject!r}")


def send_password_reset_email(*, to: str, token: str) -> None:
    frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
    reset_url = f"{frontend_origin}/reset-password?token={token}"
    _send(
        to=to,
        subject="Reset your Petri password",
        html=(
            f'<p>Use this link to reset your password: '
            f'<a href="{reset_url}">{reset_url}</a></p>'
            f"<p>This link expires in 15 minutes. If you didn't request this, "
            f"you can ignore this email.</p>"
        ),
    )


def send_verification_email(*, to: str, code: str) -> None:
    _send(
        to=to,
        subject="Verify your Petri account",
        html=f"<p>Your verification code is: <strong>{code}</strong></p>",
    )
