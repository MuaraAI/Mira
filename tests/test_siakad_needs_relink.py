"""Login SIAKAD ditolak kampus harus menulis status tautan kanonis.

Hanya penolakan berbasis pesan kredensial yang membuktikan password berubah:
captcha dan throttled bukan bukti, jadi status tautan tetap `linked`.
100% offline: SQLite di tmp_path, Redis palsu, HTTP kampus dipalsukan.
"""
import asyncio

import pytest

import httpx

from app.account_links import (
    get_link_status,
    init_account_links_db,
    set_link,
)
from app.cache import cache
from app.config import settings
from app.modules.studentv2 import StudentV2Client
from tests.test_account_links import FakeRedis

NIM = "12345678"

_CAPTCHA_FORM = (
    '<div id="captcha-svg-container"><img src="data:image/png;base64,x"></div>'
    '<input id="captcha_answer" name="captcha_answer" required>'
)
_LOGIN_PAGE = '<form action="/login"><input name="_token" value="tok"></form>'
_CREDENTIALS_REJECTED = _CAPTCHA_FORM + (
    '<div class="invalid-feedback">NIM atau password salah.</div>'
)
_CAPTCHA_REJECTED = _CAPTCHA_FORM + (
    '<div class="invalid-feedback">Kode captcha tidak sesuai.</div>'
)


def _response(url: str, text: str, status_code: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        text=text,
        headers={"content-type": "text/html"},
        request=httpx.Request("GET", url),
    )


class _FakeUpstreamClient(StudentV2Client):
    """StudentV2Client dengan HTTP kampus palsu (tanpa jaringan)."""

    def __init__(self, post_text: str, post_status: int = 200):
        super().__init__(proxy=None)
        self._post_text = post_text
        self._post_status = post_status

    def get_client(self):
        return self

    def get(self, url: str) -> httpx.Response:
        return _response(url, _LOGIN_PAGE)

    def post(self, url: str, data=None) -> httpx.Response:
        return _response(url, self._post_text, self._post_status)


@pytest.fixture
async def link_env(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "links.sqlite3"))
    fake_redis = FakeRedis()
    monkeypatch.setattr(cache, "_client", fake_redis)
    await init_account_links_db()
    await set_link(NIM, "siakad", kind="password", secret="old-pass", status="linked")
    return fake_redis


@pytest.mark.asyncio
async def test_credentials_rejection_marks_link_needs_relink(link_env):
    client = _FakeUpstreamClient(_CREDENTIALS_REJECTED)

    ok = await asyncio.to_thread(client.login, NIM, "wrong-pass")

    assert ok is False
    assert await get_link_status(NIM, "siakad") == "needs_relink"


@pytest.mark.asyncio
async def test_captcha_rejection_keeps_link_linked(link_env):
    client = _FakeUpstreamClient(_CAPTCHA_REJECTED)

    ok = await asyncio.to_thread(client.login, NIM, "old-pass", captcha="0000")

    assert ok is False
    assert await get_link_status(NIM, "siakad") == "linked"


@pytest.mark.asyncio
async def test_throttled_rejection_keeps_link_linked(link_env):
    client = _FakeUpstreamClient("too many", post_status=429)

    ok = await asyncio.to_thread(client.login, NIM, "old-pass")

    assert ok is False
    assert await get_link_status(NIM, "siakad") == "linked"
