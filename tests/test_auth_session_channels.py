"""Test session login BSI + channel notifikasi. 100% offline (mock Redis + mock kampus)."""
import json
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.config import settings


class FakeRedis:
    """Mini in-memory Redis untuk test offline."""

    def __init__(self):
        self.kv: dict = {}
        self.sets: dict = {}

    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, value, ex=None):
        self.kv[key] = value

    async def delete(self, *keys):
        removed = 0
        for key in keys:
            if key in self.kv:
                del self.kv[key]
                removed += 1
        return removed

    async def expire(self, key, ttl):
        return key in self.kv or key in self.sets

    async def sadd(self, key, member):
        self.sets.setdefault(key, set()).add(member)
        return 1

    async def srem(self, key, member):
        if key in self.sets:
            self.sets[key].discard(member)
            return 1
        return 0

    async def smembers(self, key):
        return set(self.sets.get(key, set()))

    async def ping(self):
        return True

    async def aclose(self):
        pass

    async def incr(self, key):
        self.kv[key] = int(self.kv.get(key, 0)) + 1
        return self.kv[key]


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    yield fake


@pytest.fixture(autouse=True)
def mock_campus(monkeypatch):
    """Strict Offline TDD: jangan pernah live hit kampus dari test auth."""
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials",
        AsyncMock(return_value=(True, True)),
    )


@pytest.fixture(autouse=True)
def tmp_sqlite(monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "test_ubsi.db"))
    from app.channels_db import init_db

    init_db()


@pytest.fixture(autouse=True)
def mock_news_scraper(monkeypatch):
    """Strict Offline TDD: jangan pernah live hit portal berita dari test auth."""
    monkeypatch.setattr("app.modules.news.news_client.fetch_posts", lambda *a, **k: [])
    monkeypatch.setattr(
        "app.modules.news.news_client.fetch_post_detail", lambda *a, **k: {}
    )


async def _login(ac: AsyncClient, fake_redis: FakeRedis, nim: str = "15260767") -> str:
    res = await ac.post(
        "/v1/auth/login",
        json={"nim": nim, "studentv2_pass": "sv_pass", "elearning_pass": "el_pass"},
    )
    assert res.status_code == 200
    token = res.cookies.get("ubsi_session")
    assert token
    return token


@pytest.mark.asyncio
async def test_login_success_sets_cookie_and_stores_session(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "15260767", "studentv2_pass": "sv", "elearning_pass": "el"},
        )
        assert res.status_code == 200
        assert "ubsi_session" in res.cookies
        set_cookie_header = res.headers.get("set-cookie", "")
        assert "HttpOnly" in set_cookie_header
        assert "SameSite=lax" in set_cookie_header
        session_keys = [k for k in fake_redis.kv if k.startswith("ubsi:session:")]
        assert len(session_keys) == 1
        payload = json.loads(fake_redis.kv[session_keys[0]])
        assert payload["nim"] == "15260767"


@pytest.mark.asyncio
async def test_login_invalid_credentials_returns_401(monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials",
        AsyncMock(return_value=(False, True)),
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "15260767", "studentv2_pass": "wrong", "elearning_pass": "el"},
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_rate_limited_per_nim(fake_redis, monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.limiter.is_allowed", AsyncMock(return_value=False)
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "15260767", "studentv2_pass": "sv", "elearning_pass": "el"},
        )
        assert res.status_code == 429
        assert res.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_session_token_grants_api_access(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = await _login(ac, fake_redis)

        with patch("app.main.settings.API_KEY", "master_secret"):
            res = await ac.get(
                "/v1/news", headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 200


@pytest.mark.asyncio
async def test_expired_or_unknown_session_returns_session_expired(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/v1/news", headers={"Authorization": "Bearer unknown-token"}
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "SESSION_EXPIRED"


@pytest.mark.asyncio
async def test_logout_deletes_session(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = await _login(ac, fake_redis)
        res = await ac.post(
            "/v1/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        session_keys = [k for k in fake_redis.kv if k.startswith("ubsi:session:")]
        assert len(session_keys) == 0


@pytest.mark.asyncio
async def test_channels_crud_flow(fake_redis, tmp_path):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = await _login(ac, fake_redis)
        auth_headers = {"Authorization": f"Bearer {token}"}

        # Create discord channel
        res = await ac.post(
            "/v1/channels",
            headers=auth_headers,
            json={
                "type": "discord",
                "categories": ["berita-kampus"],
                "config": {
                    "url": "https://discord.com/api/webhooks/1234567890123/abcdefghijklmnopqrstuvwxyz123456"
                },
            },
        )
        assert res.status_code == 201
        channel_id = res.json()["data"]["id"]
        assert res.json()["data"]["is_active"] is False

        # List
        res = await ac.get("/v1/channels", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["data"]["total"] == 1

        # Invalid payload rejected
        res = await ac.post(
            "/v1/channels",
            headers=auth_headers,
            json={"type": "discord", "categories": ["berita-kampus"], "config": {"url": "bukan-url"}},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

        # Delete
        res = await ac.delete(f"/v1/channels/{channel_id}", headers=auth_headers)
        assert res.status_code == 200
        res = await ac.get("/v1/channels", headers=auth_headers)
        assert res.json()["data"]["total"] == 0


@pytest.mark.asyncio
async def test_channels_require_session(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("app.main.settings.API_KEY", "master_secret"):
            res = await ac.get(
                "/v1/channels", headers={"X-API-Key": "master_secret"}
            )
            assert res.status_code == 403
            assert res.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_channel_limit_max_five_per_nim(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = await _login(ac, fake_redis)
        auth_headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "type": "custom",
            "categories": ["berita-kampus"],
            "config": {"url": "https://example.com/hook"},
        }
        for _ in range(5):
            res = await ac.post("/v1/channels", headers=auth_headers, json=payload)
            assert res.status_code == 201
        res = await ac.post("/v1/channels", headers=auth_headers, json=payload)
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "CHANNEL_LIMIT"


@pytest.mark.asyncio
async def test_custom_webhook_ssrf_rejected(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = await _login(ac, fake_redis)
        auth_headers = {"Authorization": f"Bearer {token}"}
        
        # Private IP rejection
        res = await ac.post(
            "/v1/channels",
            headers=auth_headers,
            json={
                "type": "custom",
                "categories": ["berita-kampus"],
                "config": {"url": "https://127.0.0.1:8000/hook"},
            },
        )
        assert res.status_code == 400
        assert "SSRF" in res.json()["error"]["message"]


@pytest.mark.asyncio
async def test_active_channels_by_category_query(fake_redis):
    from app.channels_db import add_channel, set_channel_active, list_active_by_category

    ch_id = await add_channel("15260767", "custom", ["berita-kampus"], {"url": "https://example.com/h"})
    await set_channel_active("15260767", ch_id, True)

    matched = await list_active_by_category("berita-kampus")
    assert len(matched) == 1
    assert matched[0]["id"] == ch_id
    assert matched[0]["nim"] == "15260767"

    unmatched = await list_active_by_category("tugas-baru")
    assert len(unmatched) == 0
