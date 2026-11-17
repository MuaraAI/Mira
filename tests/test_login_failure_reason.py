"""Regresi: alasan login kampus ditolak harus dibaca dari pesan error, bukan dari kata "captcha".

Latar belakang: halaman login MyBest/SIAKAD selalu memuat form CAPTCHA, jadi
password salah pun dulu terbaca sebagai "captcha" dan user hanya melihat
INVALID_CREDENTIALS tanpa penjelasan.
"""
from app.upstream_session import classify_login_failure, extract_login_errors

CAPTCHA_FORM = (
    '<div id="captcha-svg-container"><img src="data:image/png;base64,iVBORw0KGgo="></div>'
    '<input id="captcha_answer" name="captcha_answer" required>'
)


def test_wrong_password_with_captcha_form_is_credentials():
    html = CAPTCHA_FORM + '<div class="invalid-feedback">Username atau password salah.</div>'

    reason, errors = classify_login_failure(html, has_captcha_form=True)

    assert reason == "credentials"
    assert errors == ["Username atau password salah."]


def test_wrong_captcha_error_is_captcha():
    html = CAPTCHA_FORM + '<div class="invalid-feedback">Kode captcha tidak sesuai.</div>'

    reason, _ = classify_login_failure(html, has_captcha_form=True)

    assert reason == "captcha"


def test_captcha_form_without_error_text_is_captcha():
    reason, errors = classify_login_failure(CAPTCHA_FORM, has_captcha_form=True)

    assert reason == "captcha"
    assert errors == []


def test_no_error_and_no_captcha_is_unknown():
    reason, errors = classify_login_failure("<form></form>", has_captcha_form=False)

    assert reason == "unknown"
    assert errors == []


def test_extract_strips_tags_and_collapses_whitespace():
    html = '<div class="alert alert-danger"><b>Gagal</b>   login <i>ulang</i></div>'

    assert extract_login_errors(html) == ["Gagal login ulang"]
