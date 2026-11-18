"""Login memakai kandidat CAPTCHA langsung: kampus membakar kode tiap POST.

Alur lama (probe validasi lalu pakai ulang kode) selalu gagal karena kode
sekali pakai. Test ini mengunci perilaku baru: satu kode per POST, tantangan
baru saat kode ditolak.
"""
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

__all__ = []


class FakeRedis:
    """Redis mini untuk sesi/limiter/guard di test login."""

    def __init__(self):
        self.kv: dict = {}
        self.sets: dict = {}

    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, value, ex=None):
        self.kv[key] = value

    async def delete(self, *keys):
        for key in keys:
            self.kv.pop(key, None)

    async def expire(self, key, ttl):
        return key in self.kv

    async def sadd(self, key, member):
        self.sets.setdefault(key, set()).add(member)
        return 1

    async def smembers(self, key):
        return set(self.sets.get(key, set()))

    async def ping(self):
        return True

    async def incr(self, key):
        self.kv[key] = int(self.kv.get(key, 0)) + 1
        return self.kv[key]

    async def ttl(self, key):
        return 3600


def _wire_login(monkeypatch, tmp_path, *, siakad_enabled: bool):
    from types import SimpleNamespace

    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    monkeypatch.setattr("app.login_guard.login_guard._client", fake)
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", siakad_enabled)
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "ubsi.db"))
    monkeypatch.setattr("app.limiter.limiter.is_allowed", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.login_guard.login_guard.check_ip",
        AsyncMock(return_value=SimpleNamespace(allowed=True, retry_after=0)),
    )
    monkeypatch.setattr("app.login_guard.login_guard.record_attempt", AsyncMock())
    monkeypatch.setattr("app.modules.news.news_client.fetch_posts", lambda *a, **k: [])
    monkeypatch.setattr("app.modules.news.news_client.fetch_post_detail", lambda *a, **k: {})
    from app.channels_db import init_db

    init_db()
    return fake


@pytest.mark.asyncio
async def test_login_retries_with_new_challenge_after_captcha_rejected(monkeypatch, tmp_path):
    _wire_login(monkeypatch, tmp_path, siakad_enabled=False)
    challenges = [
        ({"cookies": {"c": "1"}, "token": "t1"}, ["SALAH1"]),
        ({"cookies": {"c": "2"}, "token": "t2"}, ["SALAH2"]),
        ({"cookies": {"c": "3"}, "token": "t3"}, ["BENAR"]),
    ]
    monkeypatch.setattr(
        "app.captcha_autosolver.candidate_session",
        AsyncMock(side_effect=challenges),
    )

    seen_sessions = []

    async def verify(nim, el_pass, sv_pass, *, el_session=None, el_captcha=None, outcomes=None, **kwargs):
        seen_sessions.append((el_session, el_captcha))
        # Dua kode pertama ditolak kampus (kode hangus/salah), ketiga diterima.
        if el_session["token"] in ("t1", "t2"):
            if outcomes is not None:
                outcomes["elearning"] = ("captcha", ["Kode keamanan salah"])
            return False, False
        return False, True

    monkeypatch.setattr("app.modules.auth.verify_live_credentials", verify)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={
                "nim": "12345678",
                "studentv2_pass": "",
                "elearning_pass": "el",
                "mira_captcha": {"id": "stub-mira", "code": "abcd"},
            },
        )

    assert res.status_code == 200
    assert seen_sessions == [
        ({"cookies": {"c": "1"}, "token": "t1"}, "SALAH1"),
        ({"cookies": {"c": "2"}, "token": "t2"}, "SALAH2"),
        ({"cookies": {"c": "3"}, "token": "t3"}, "BENAR"),
    ]


@pytest.mark.asyncio
async def test_login_falls_back_after_all_captcha_attempts_rejected(monkeypatch, tmp_path):
    _wire_login(monkeypatch, tmp_path, siakad_enabled=False)
    from app.captcha_autosolver import MAX_CAPTCHA_ATTEMPTS

    calls = []

    def make_challenge(host, nim):
        calls.append((host, nim))
        return {"cookies": {}, "token": "t"}, ["SALAH"]

    monkeypatch.setattr("app.captcha_autosolver.candidate_session", AsyncMock(side_effect=make_challenge))

    async def verify(nim, el_pass, sv_pass, *, outcomes=None, **kwargs):
        if outcomes is not None:
            outcomes["elearning"] = ("captcha", ["Kode keamanan salah"])
        return False, False

    monkeypatch.setattr("app.modules.auth.verify_live_credentials", verify)
    monkeypatch.setattr(
        "app.captcha_relay.create_challenge",
        AsyncMock(
            return_value={
                "id": "f" * 32,
                "image": "data:image/png;base64,AAA",
                "label": "MyBest",
                "expires_in": 300,
            }
        ),
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={
                "nim": "12345678",
                "studentv2_pass": "",
                "elearning_pass": "el",
                "mira_captcha": {"id": "stub-mira", "code": "abcd"},
            },
        )

    assert res.status_code == 401
    error = res.json()["error"]
    assert error["code"] == "AUTH_CAPTCHA_REQUIRED"
    assert error["fallback_captcha"]["host"] == "elearning"
    assert len(calls) == MAX_CAPTCHA_ATTEMPTS
    assert all(host == "elearning" for host, _ in calls)
