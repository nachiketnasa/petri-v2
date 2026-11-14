"""Encrypts TOTP secrets at rest, per _docs/schema.sql's own comment on
users.totp_secret: "Encrypt totp_secret at the application layer before it
lands here -- this column stores ciphertext, not a plaintext secret."

Never hand-roll encryption: uses `cryptography`'s Fernet (authenticated
AES-128-CBC + HMAC), not a bespoke scheme.
"""

from __future__ import annotations

import os

from cryptography.fernet import Fernet

_KEY_ENV_VAR = "PETRI_TOTP_KEY"


def _load_key() -> bytes:
    key = os.environ.get(_KEY_ENV_VAR)
    if key:
        return key.encode()
    # ponytail: no key configured (local/dev) -- an ephemeral, process-only
    # key so the app still runs, rather than refusing to start. TOTP
    # secrets encrypted under it won't decrypt after a restart; set
    # PETRI_TOTP_KEY (a Fernet.generate_key() value) in any real
    # deployment.
    generated = Fernet.generate_key()
    print(
        f"WARNING: {_KEY_ENV_VAR} not set -- using an ephemeral per-process key. "
        "TOTP secrets encrypted now will not decrypt after a restart. "
        f"Set {_KEY_ENV_VAR} to a real Fernet.generate_key() value in production."
    )
    return generated


_fernet = Fernet(_load_key())


def encrypt_totp_secret(secret: str) -> str:
    return _fernet.encrypt(secret.encode()).decode()


def decrypt_totp_secret(ciphertext: str) -> str:
    return _fernet.decrypt(ciphertext.encode()).decode()
