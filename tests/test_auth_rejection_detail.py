"""Pesan penolakan login harus menyebut sistem dan penyebabnya, bukan INVALID_CREDENTIALS generik."""
from app.modules.auth import _rejection_detail


def _code(detail: dict) -> str:
    return detail["error"]["code"]


def _message(detail: dict) -> str:
    return detail["error"]["message"]


def test_credentials_rejection_names_system_and_quotes_campus_message():
    detail = _rejection_detail("elearning", "credentials", ["Username atau password salah."])

    assert _code(detail) == "INVALID_CREDENTIALS"
    assert "MyBest" in _message(detail)
    assert "Username atau password salah." in _message(detail)


def test_wrong_captcha_gets_its_own_code():
    detail = _rejection_detail("elearning", "captcha", ["Kode captcha tidak sesuai."])

    assert _code(detail) == "CAPTCHA_INVALID"
    assert "CAPTCHA MyBest" in _message(detail)


def test_unknown_rejection_still_explains_what_to_check():
    detail = _rejection_detail("studentv2", "unknown", [])

    assert _code(detail) == "INVALID_CREDENTIALS"
    assert "SIAKAD" in _message(detail)
    assert "Pesan dari" not in _message(detail)


def test_long_campus_text_is_truncated_in_message():
    detail = _rejection_detail("elearning", "credentials", ["x" * 500])

    assert len(_message(detail)) < 400
