"""PETRI_TOTP_KEY / VAPID_PRIVATE_KEY loading (#41 line 3).

Calls the loaders directly; the modules are not re-imported. Keys are
generated here exactly as README's "Generating the app keys" commands do,
never pasted as literals.
"""

from __future__ import annotations

import base64

import pytest
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import ec

from petri_backend import totp_crypto, vapid


def _readme_totp_key() -> str:
    return Fernet.generate_key().decode()


def _readme_vapid_key() -> str:
    k = ec.generate_private_key(ec.SECP256R1())
    return base64.urlsafe_b64encode(k.private_numbers().private_value.to_bytes(32, "big")).rstrip(b"=").decode()


def _public(key: ec.EllipticCurvePrivateKey) -> tuple[int, int]:
    n = key.public_key().public_numbers()
    return n.x, n.y


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for var in ("RENDER", "PETRI_TOTP_KEY", "VAPID_PRIVATE_KEY"):
        monkeypatch.delenv(var, raising=False)


@pytest.mark.parametrize("value", [None, "", "  \n"])
def test_render_without_totp_key_refuses(monkeypatch, value):
    monkeypatch.setenv("RENDER", "true")
    if value is not None:
        monkeypatch.setenv("PETRI_TOTP_KEY", value)
    with pytest.raises(RuntimeError, match="PETRI_TOTP_KEY") as e:
        totp_crypto._load_key()
    assert "Generating the app keys" in str(e.value)


@pytest.mark.parametrize("value", [None, "", "  \n"])
def test_render_without_vapid_key_refuses(monkeypatch, value):
    monkeypatch.setenv("RENDER", "true")
    if value is not None:
        monkeypatch.setenv("VAPID_PRIVATE_KEY", value)
    with pytest.raises(RuntimeError, match="VAPID_PRIVATE_KEY") as e:
        vapid._load_private_key()
    assert "Generating the app keys" in str(e.value)


def test_local_fallback_totp_key_is_usable(capsys):
    f = Fernet(totp_crypto._load_key())
    assert f.decrypt(f.encrypt(b"secret")) == b"secret"
    assert "WARNING: PETRI_TOTP_KEY not set" in capsys.readouterr().out


def test_local_fallback_vapid_key_is_usable(capsys):
    key = vapid._load_private_key()
    assert isinstance(key.curve, ec.SECP256R1)
    assert "WARNING: VAPID_PRIVATE_KEY not set" in capsys.readouterr().out


def test_render_with_generated_totp_key_round_trips(monkeypatch, capsys):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("PETRI_TOTP_KEY", _readme_totp_key())
    a, b = Fernet(totp_crypto._load_key()), Fernet(totp_crypto._load_key())
    assert b.decrypt(a.encrypt(b"x")) == b"x"
    assert a.decrypt(b.encrypt(b"y")) == b"y"
    assert "WARNING" not in capsys.readouterr().out


def test_render_with_generated_vapid_key_is_stable(monkeypatch, capsys):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", _readme_vapid_key())
    assert _public(vapid._load_private_key()) == _public(vapid._load_private_key())
    assert "WARNING" not in capsys.readouterr().out


@pytest.mark.parametrize("suffix", [" ", "\n", " \n"])
def test_trailing_whitespace_accepted(monkeypatch, suffix):
    totp, priv = _readme_totp_key(), _readme_vapid_key()
    monkeypatch.setenv("PETRI_TOTP_KEY", totp + suffix)
    monkeypatch.setenv("VAPID_PRIVATE_KEY", priv + suffix)
    assert totp_crypto._load_key() == totp.encode()
    monkeypatch.setenv("VAPID_PRIVATE_KEY", priv)
    expected = _public(vapid._load_private_key())
    monkeypatch.setenv("VAPID_PRIVATE_KEY", priv + suffix)
    assert _public(vapid._load_private_key()) == expected


@pytest.mark.parametrize("value", ["nope", "AA"])
def test_short_vapid_key_rejected(monkeypatch, value):
    monkeypatch.setenv("VAPID_PRIVATE_KEY", value)
    with pytest.raises(ValueError, match="32 bytes") as e:
        vapid._load_private_key()
    assert value not in str(e.value)


def test_malformed_totp_key_rejected(monkeypatch):
    monkeypatch.setenv("PETRI_TOTP_KEY", "not-a-fernet-key")
    with pytest.raises(ValueError):
        Fernet(totp_crypto._load_key())
