"""Login relay yang sukses harus mencoret cooldown CAPTCHA milik NIM yang sama."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.upstream_session import block_reason, mark_login_blocked, reset_blocks


class FakeRedis:
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


@pytest.mark.asyncio
async def test_successful_login_clears_captcha_cooldown(monkeypatch, tmp_path):
    reset_blocks()
    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    monkeypatch.setattr("app.login_guard.login_guard._client", fake)
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "ubsi.db"))
    monkeypatch.setattr("app.modules.auth.verify_live_credentials", AsyncMock(return_value=(False, True)))
    monkeypatch.setattr("app.mira_captcha.verify_challenge", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.captcha_autosolver.candidate_session",
        AsyncMock(return_value=({"cookies": {"sess": "abc"}, "token": "tok"}, ["KODE"])),
    )
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

    nim = "15260767"
    mark_login_blocked("elearning", nim, "captcha", 1200)
    assert block_reason("elearning", nim) == "captcha"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={
                "nim": nim,
                "studentv2_pass": "",
                "elearning_pass": "el_pass",
                "mira_captcha": {"id": "m" * 32, "code": "abcd"},
            },
        )

    assert res.status_code == 200
    assert block_reason("elearning", nim) is None


@pytest.mark.asyncio
async def test_mybest_only_failure_reports_captcha_invalid(monkeypatch, tmp_path):
    reset_blocks()
    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    monkeypatch.setattr("app.login_guard.login_guard._client", fake)
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "ubsi.db"))
    monkeypatch.setattr("app.limiter.limiter.is_allowed", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.login_guard.login_guard.check_ip",
        AsyncMock(return_value=SimpleNamespace(allowed=True, retry_after=0)),
    )
    monkeypatch.setattr("app.login_guard.login_guard.record_attempt", AsyncMock())
    monkeypatch.setattr("app.modules.news.news_client.fetch_posts", lambda *a, **k: [])
    monkeypatch.setattr("app.modules.news.news_client.fetch_post_detail", lambda *a, **k: {})
    monkeypatch.setattr(
        "app.captcha_relay.consume_challenge",
        AsyncMock(return_value={"host": "elearning", "nim": "12345678", "token": "tok", "cookies": {}}),
    )
    monkeypatch.setattr("app.mira_captcha.verify_challenge", AsyncMock(return_value=True))

    async def verify(nim, el_pass, sv_pass, *, outcomes=None, **kwargs):
        if outcomes is not None:
            outcomes["elearning"] = ("captcha", ["Kode keamanan salah"])
        return False, False

    monkeypatch.setattr("app.modules.auth.verify_live_credentials", verify)
    from app.channels_db import init_db

    init_db()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={
                "nim": "12345678",
                "studentv2_pass": "",
                "elearning_pass": "el_pass",
                "mira_captcha": {"id": "m" * 32, "code": "abcd"},
                "campus_captcha": {"id": "a" * 32, "code": "abc"},
            },
        )

    assert res.status_code == 401
    detail = res.json()["error"]
    assert detail["code"] == "CAPTCHA_INVALID"
    assert "captcha_hosts" not in detail
