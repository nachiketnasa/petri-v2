"""Password hashing.

Stdlib-only (`hashlib.pbkdf2_hmac`) — no bcrypt/passlib dependency needed
for the MVP slice.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets

_ITERATIONS = 390_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    salt_hex, _, digest_hex = password_hash.partition("$")
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return hmac.compare_digest(candidate.hex(), digest_hex)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def new_reset_token() -> str:
    return secrets.token_urlsafe(32)


def new_verification_code() -> str:
    # Six digits: short enough to type in by hand from an email, unlike the
    # URL-safe tokens above which are only ever clicked, never typed.
    return f"{secrets.randbelow(1_000_000):06d}"
