import json
import urllib.request

import pytest

from petri_backend import email


@pytest.fixture(autouse=True)
def _clear_resend_key(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)


def test_send_password_reset_email_logs_instead_of_calling_resend_when_no_key_set(capsys):
    email.send_password_reset_email(to="user@example.com", token="abc123")

    out = capsys.readouterr().out
    assert "to=user@example.com" in out
    assert "abc123" in out


def test_send_password_reset_email_calls_resend_when_key_is_set(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "test-key")
    captured = {}

    class _FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def _fake_urlopen(request, timeout=None):
        captured["url"] = request.full_url
        captured["headers"] = dict(request.headers)
        captured["body"] = json.loads(request.data)
        return _FakeResponse()

    monkeypatch.setattr(urllib.request, "urlopen", _fake_urlopen)

    email.send_password_reset_email(to="user@example.com", token="abc123")

    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["body"]["to"] == ["user@example.com"]
    assert "abc123" in captured["body"]["html"]


def test_a_provider_error_fails_safely_without_raising(monkeypatch, capsys):
    monkeypatch.setenv("RESEND_API_KEY", "test-key")

    def _raise(*args, **kwargs):
        raise OSError("network down")

    monkeypatch.setattr(urllib.request, "urlopen", _raise)

    # Must not raise -- a provider error can't be allowed to 500 the
    # request calling this, which would leak account existence (#21).
    email.send_password_reset_email(to="user@example.com", token="abc123")

    assert "send failed" in capsys.readouterr().out


def test_send_verification_email_logs_the_code_when_no_key_set(capsys):
    email.send_verification_email(to="user@example.com", code="123456")

    out = capsys.readouterr().out
    assert "123456" in out
