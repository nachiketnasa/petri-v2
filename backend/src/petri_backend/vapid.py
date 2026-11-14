"""VAPID key pair for Web Push (#8), per specs.md's "Other tasks" ->
reminders go through the Web Push API, never email.

Only generates/exposes the key pair here -- a subscription is created by
the browser's PushManager against the public key this module exposes.
Actually *sending* an encrypted push payload (ECDH + AES128GCM + a VAPID
JWT) is a separate, larger piece of work (needs a real Web Push client
library, e.g. pywebpush, plus a background scheduler this codebase
doesn't have anywhere yet) -- not built in this pass; see the follow-up
issue filed alongside this one.
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.asymmetric import ec

_PRIVATE_KEY_ENV_VAR = "VAPID_PRIVATE_KEY"  # base64url, unsigned big-endian private value


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


def _load_private_key() -> ec.EllipticCurvePrivateKey:
    raw = os.environ.get(_PRIVATE_KEY_ENV_VAR, "").strip()
    if raw:
        decoded = _b64url_decode(raw)
        if len(decoded) != 32:
            # Never echo the value: only its decoded length.
            raise ValueError(
                f"{_PRIVATE_KEY_ENV_VAR} must decode to exactly 32 bytes, got {len(decoded)}. "
                "See README.md's 'Generating the app keys' section."
            )
        return ec.derive_private_key(int.from_bytes(decoded, "big"), ec.SECP256R1())
    if os.environ.get("RENDER"):
        raise RuntimeError(
            f"{_PRIVATE_KEY_ENV_VAR} is not set. A backend on Render refuses to start without it; "
            "generate one per environment as described in README.md's "
            "'Generating the app keys' section."
        )
    # ponytail: local/CI only (compose, CI, plain pytest) -- an ephemeral,
    # process-only key so the app runs with no setup; push subscriptions made
    # against it break on restart. On Render (RENDER set) the backend refuses
    # to start without VAPID_PRIVATE_KEY instead.
    print(
        f"WARNING: {_PRIVATE_KEY_ENV_VAR} not set -- using an ephemeral per-process VAPID key."
    )
    return ec.generate_private_key(ec.SECP256R1())


_private_key = _load_private_key()


def vapid_public_key_b64url() -> str:
    # Uncompressed EC point format (0x04 || X || Y), as the Web Push /
    # PushManager.subscribe applicationServerKey expects.
    numbers = _private_key.public_key().public_numbers()
    return _b64url_encode(b"\x04" + numbers.x.to_bytes(32, "big") + numbers.y.to_bytes(32, "big"))
