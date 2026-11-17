"""Regresi: cooldown login upstream saat kampus meminta CAPTCHA atau membalas 429.

Latar belakang: sejak Nov 2026 form login SIAKAD dan MyBest mewajibkan CAPTCHA
gambar. Tanpa cooldown, worker notifikasi + retry menembak login terus-menerus
dan membuat IP server kena rate limit, sehingga user yang sah ikut gagal.
"""
import time

import httpx
import pytest
from fastapi import HTTPException

from app import upstream_session
from app.modules.elearning import _elearning_image_captcha
from app.modules.studentv2 import _siakad_captcha_required
from app.upstream_session import (
    CAPTCHA_COOLDOWN_SECONDS,
    THROTTLE_COOLDOWN_SECONDS,
    UpstreamSession,
    block_reason,
    reset_blocks,
)


@pytest.fixture(autouse=True)
def _clean_blocks():
    reset_blocks()
    yield
    reset_blocks()


class _Cookies:
    def clear(self) -> None:
        return None


class _FakeClient:
    def __init__(self, responses):
        self.cookies = _Cookies()
        self._responses = list(responses)
        self.requests = 0

    def request(self, method, url, **kwargs):
        self.requests += 1
        if len(self._responses) > 1:
            return self._responses.pop(0)
        return self._responses[0]


def _response(status_code: int = 200, text: str = "", url: str = "https://fake/", headers=None):
    return httpx.Response(
        status_code=status_code,
        text=text,
        headers=headers or {},
        request=httpx.Request("GET", url),
    )


class _ProbeClient(UpstreamSession):
    BASE_URL = "https://fake.bsi.ac.id"
    MODULE = "probe"
    HOST_LABEL = "server kampus uji"

    def __init__(self, *, login_ok: bool, reason: str, responses=None):
        self._login_ok = login_ok
        self._reason = reason
        self.login_calls = 0
        self._http = _FakeClient(responses or [_response()])
        self._logged_in = False
        self._init_upstream_session()

    def get_client(self) -> _FakeClient:
        return self._http

    def login(self, nim: str, password: str) -> bool:
        self.login_calls += 1
        self._login_failure = self._reason
        if self._login_ok:
            self._mark_logged_in()
        return self._login_ok


def _error_code(exc: HTTPException) -> str:
    detail = exc.detail if isinstance(exc.detail, dict) else {}
    return str((detail.get("error") or {}).get("code") or "")


def test_captcha_login_marks_cooldown_and_stops_retrying():
    client = _ProbeClient(login_ok=False, reason="captcha")

    assert client.ensure_session("12345678", "secret") is False
    assert client.login_calls == 1
    assert block_reason("probe", "12345678") == "captcha"

    with pytest.raises(HTTPException) as exc_info:
        client.ensure_session("12345678", "secret")
    assert _error_code(exc_info.value) == "AUTH_CAPTCHA_REQUIRED"
    # Cooldown aktif: login tidak dicoba lagi.
    assert client.login_calls == 1


def test_captcha_cooldown_expires():
    client = _ProbeClient(login_ok=False, reason="captcha")
    client.ensure_session("12345678", "secret")
    assert block_reason("probe", "12345678") == "captcha"

    # Mundurkan waktu cooldown agar dianggap kedaluwarsa.
    expired = time.monotonic() - 1
    upstream_session._login_blocks[("probe", "12345678")] = (expired, "captcha")
    assert block_reason("probe", "12345678") is None


def test_upstream_429_marks_host_throttle_and_raises():
    client = _ProbeClient(
        login_ok=True,
        reason="unknown",
        responses=[_response(status_code=429, text="Too Many Requests", headers={"Retry-After": "60"})],
    )

    with pytest.raises(HTTPException) as exc_info:
        client.authed_request("GET", "/mahasiswa/beranda", "12345678", "secret")

    assert _error_code(exc_info.value) == "UPSTREAM_THROTTLED"
    assert block_reason("probe") == "throttled"
    assert THROTTLE_COOLDOWN_SECONDS >= 60


def test_blocked_host_skips_new_login_attempts():
    client = _ProbeClient(login_ok=True, reason="unknown")
    upstream_session.mark_host_blocked("probe", "throttled", 60)

    with pytest.raises(HTTPException) as exc_info:
        client.ensure_session("12345678", "secret")

    assert _error_code(exc_info.value) == "UPSTREAM_THROTTLED"
    assert client.login_calls == 0


def test_successful_login_clears_cooldown():
    client = _ProbeClient(login_ok=True, reason="captcha")
    upstream_session.mark_login_blocked("probe", "12345678", "captcha", 1)
    upstream_session._login_blocks[("probe", "12345678")] = (time.monotonic() - 1, "captcha")

    assert client.ensure_session("12345678", "secret") is True
    assert block_reason("probe", "12345678") is None


def test_siakad_captcha_marker_detected():
    page = (
        '<form method="POST" action="https://students.bsi.ac.id/login">'
        '<div data-login-captcha><input id="login-captcha-web" name="captcha" '
        'required minlength="4" maxlength="4"></div></form>'
    )
    assert _siakad_captcha_required(page) is True
    assert _siakad_captcha_required('<form action="/login"><input name="password"></form>') is False
    assert _siakad_captcha_required("") is False


def test_elearning_image_captcha_marker_detected():
    page = (
        '<div id="captcha-svg-container">'
        '<img src="data:image/png;base64,iVBORw0KGgo="></div>'
        '<input id="captcha_answer" name="captcha_answer" maxlength="3" required>'
        '<button id="reload-captcha-btn"></button>'
    )
    assert _elearning_image_captcha(page) is True
    assert _elearning_image_captcha('<svg><text>4E7</text></svg>') is False
    assert _elearning_image_captcha("") is False


def test_unknown_login_failure_marks_cooldown_and_stops_retrying():
    # Regresi: kegagalan tanpa penyebab jelas (mis. token login tidak ditemukan)
    # dulu tidak diberi cooldown, sehingga worker login ulang setiap siklus.
    client = _ProbeClient(login_ok=False, reason="unknown")

    assert client.ensure_session("12345678", "secret") is False
    assert client.login_calls == 1
    assert block_reason("probe", "12345678") == "unknown"

    with pytest.raises(HTTPException) as exc_info:
        client.ensure_session("12345678", "secret")
    assert _error_code(exc_info.value) == "AUTH_FAILED"
    assert client.login_calls == 1


def test_captcha_cooldown_constant_is_reasonably_long():
    # Cooldown harus lebih panjang dari satu siklus worker (10 menit default)
    # supaya tidak ada login berulang di siklus berikutnya.
    assert CAPTCHA_COOLDOWN_SECONDS > 10 * 60
