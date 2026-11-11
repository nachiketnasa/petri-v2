import pytest

from petri_backend import app as app_module
from petri_backend.email import send_password_reset_email, send_verification_email

from _email_capture import sent_reset_tokens, sent_verification_codes


def _capturing_send_verification_email(*, to: str, code: str) -> None:
    sent_verification_codes[to] = code
    send_verification_email(to=to, code=code)


def _capturing_send_password_reset_email(*, to: str, token: str) -> None:
    sent_reset_tokens[to] = token
    send_password_reset_email(to=to, token=token)


app_module.send_verification_email = _capturing_send_verification_email
app_module.send_password_reset_email = _capturing_send_password_reset_email


@pytest.fixture(autouse=True)
def _clear_email_capture():
    sent_verification_codes.clear()
    sent_reset_tokens.clear()
