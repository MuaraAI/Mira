"""Login latar: CAPTCHA gambar hanya dijawab dari kandidat OCR, bukan tebakan regex."""
import httpx
import pytest

from app.captcha_autosolver import MAX_CAPTCHA_ATTEMPTS
from app.modules.elearning import ElearningClient

_HTML = (
    '<input type="hidden" name="_token" value="tok-123">'
    '<input id="captcha_answer" name="captcha_answer" maxlength="3">'
    '<img src="data:image/png;base64,iVBOR3+3wAAAABJRU5ErkJggg==" alt="Kode Keamanan">'
)


class _FakeHttpClient:
    is_closed = False

    def __init__(self, captcha_error: bool = True):
        self.cookies = httpx.Cookies()
        self.posted: list[dict] = []
        self._captcha_error = captcha_error

    def get(self, url, **kwargs):
        return httpx.Response(200, text=_HTML, request=httpx.Request("GET", url))

    def post(self, url, data=None, **kwargs):
        self.posted.append(dict(data or {}))
        if not self._captcha_error:
            return httpx.Response(
                200,
                text="<html>dashboard</html>",
                request=httpx.Request("POST", "https://elearning.bsi.ac.id/user"),
            )
        return httpx.Response(
            200,
            text=(
                '<input name="password" type="password">'
                '<div class="invalid-feedback">Kode keamanan salah. Silakan periksa kembali '
                "karakter pada gambar.</div>"
            ),
            request=httpx.Request("POST", url),
        )


def test_ocr_empty_never_posts_guessed_answer(monkeypatch):
    """Tanpa kandidat OCR, tidak boleh ada POST: tebakan regex lama (6) berbahaya."""
    monkeypatch.setattr(
        "app.captcha_autosolver.candidate_session_sync",
        lambda host, nim: ({"cookies": {}, "token": "t"}, []),
    )
    client = ElearningClient()
    fake = _FakeHttpClient()
    client._client = fake

    assert client.login("12345678", "password") is False
    assert client._login_failure == "captcha"
    assert fake.posted == []


def test_ocr_candidate_is_submitted_once_per_challenge(monkeypatch):
    monkeypatch.setattr(
        "app.captcha_autosolver.candidate_session_sync",
        lambda host, nim: ({"cookies": {}, "token": "t"}, ["FPW"]),
    )
    client = ElearningClient()
    fake = _FakeHttpClient()
    client._client = fake

    assert client.login("12345678", "password") is False
    assert [p["captcha_answer"] for p in fake.posted] == ["FPW"] * MAX_CAPTCHA_ATTEMPTS
    assert all(p["_token"] == "t" for p in fake.posted)


def test_ocr_success_marks_session_logged_in(monkeypatch):
    sessions = []

    class _CampusSession:
        @staticmethod
        def store_cookies(module, nim, cookies):
            sessions.append((module, nim))

    monkeypatch.setattr(
        "app.captcha_autosolver.candidate_session_sync",
        lambda host, nim: ({"cookies": {}, "token": "t"}, ["FPW"]),
    )
    client = ElearningClient()
    fake = _FakeHttpClient(captcha_error=False)
    client._client = fake
    monkeypatch.setattr(client, "_persist_cookies", lambda nim: sessions.append(("elearning", nim)))

    assert client.login("12345678", "password") is True
    assert fake.posted[0]["captcha_answer"] == "FPW"
    assert sessions == [("elearning", "12345678")]
