"""Captures the plaintext code/token a request would have emailed, keyed by
recipient -- tests read from here instead of reaching into app.py's old
in-memory dicts (verification codes and reset tokens are now stored hashed,
in Postgres/InMemoryRepository, so the plaintext only ever exists on the
way out through email.py). See conftest.py for the patching.
"""

sent_verification_codes: dict[str, str] = {}
sent_reset_tokens: dict[str, str] = {}
