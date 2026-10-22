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
        raw_val = fake_redis.kv[session_keys[0]]
        # Nilai di Redis terenkripsi AES-256 (bukan plaintext JSON)
        assert not raw_val.startswith("{")
        from app.session_store import _decrypt_payload
        payload = _decrypt_payload(raw_val, settings.API_KEY)
        assert payload is not None
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
        with patch("app.main.settings.API_KEY", "master_secret"):
            token = await _login(ac, fake_redis)
            res = await ac.get(
                "/v1/news", headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 200

            # Raw browser cookie without Origin or X-Requested-With is strictly rejected (anti-leak)
            res_raw_cookie = await ac.get(
                "/v1/news", cookies={"ubsi_session": token}
            )
            assert res_raw_cookie.status_code == 401
            assert res_raw_cookie.json()["error"]["code"] == "UNAUTHORIZED"

            # Cookie with dashboard X-Requested-With header is accepted
            res_dash = await ac.get(
                "/v1/news",
                cookies={"ubsi_session": token},
                headers={"X-Requested-With": "dashboard"},
            )
            assert res_dash.status_code == 200


@pytest.mark.asyncio
async def test_invalid_session_payload_is_deleted_not_refreshed(fake_redis, monkeypatch):
    monkeypatch.setattr("app.config.settings.API_KEY", "master_secret")
    from app.session_store import session_store, _KEY_PREFIX, _hash_token

    # Simulasikan blob tampered/legacy-invalid di Redis
    bad_token = "tampered_token_123"
    bad_key = _KEY_PREFIX + _hash_token(bad_token)
    fake_redis.kv[bad_key] = "bukan-blob-terenkripsi-valid"

    result = await session_store.resolve(bad_token)
    assert result is None
    # Blob invalid harus dihapus, bukan di-refresh TTL-nya
    assert bad_key not in fake_redis.kv


@pytest.mark.asyncio
async def test_download_endpoint_accepts_dashboard_referer_and_query_token(fake_redis):
    transport = ASGITransport(app=app)
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.content = b"%PDF-1.4 file"
    mock_resp.headers = {"content-type": "application/pdf"}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("app.main.settings.API_KEY", "master_secret"), \
             patch("app.modules.elearning.pooled_elearning_client.download_file", return_value=mock_resp):
            token = await _login(ac, fake_redis)

            # 1. Cookie + Dashboard Referer is accepted on /download path
            res_ref = await ac.get(
                "/v1/elearning/assignments/download?file_url=https://elearning.bsi.ac.id/storage/soal/t1.pdf",
                cookies={"ubsi_session": token},
                headers={"Referer": "https://ubsi-api.muaraai.com/dashboard/tugas"},
            )
            assert res_ref.status_code == 200
            assert "Content-Disposition" in res_ref.headers.get("access-control-expose-headers", "")

            # 2. Query parameter session token is rejected to prevent URL credential leakage
            res_query = await ac.get(
                f"/v1/elearning/assignments/download?file_url=https://elearning.bsi.ac.id/storage/soal/t1.pdf&token={token}"
            )
            assert res_query.status_code == 401



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
        listed_config = res.json()["data"]["channels"][0]["config"]
        assert "abcdefghijklmnopqrstuvwxyz123456" not in listed_config["url"]

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
async def test_channel_categories_can_be_updated_only_by_owner(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        owner_token = await _login(ac, fake_redis, nim="15260767")
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        created = await ac.post(
            "/v1/channels",
            headers=owner_headers,
            json={
                "type": "custom",
                "categories": ["berita-kampus"],
                "config": {"url": "https://example.com/hook"},
            },
        )
        channel_id = created.json()["data"]["id"]

        updated = await ac.patch(
            f"/v1/channels/{channel_id}",
            headers=owner_headers,
            json={"categories": ["nilai-keluar", "jadwal-ujian"]},
        )
        assert updated.status_code == 200
        assert updated.json()["data"]["categories"] == ["nilai-keluar", "jadwal-ujian"]

        invalid = await ac.patch(
            f"/v1/channels/{channel_id}",
            headers=owner_headers,
            json={"categories": []},
        )
        assert invalid.status_code == 400
        assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"

        other_token = await _login(ac, fake_redis, nim="15260768")
        forbidden = await ac.patch(
            f"/v1/channels/{channel_id}",
            headers={"Authorization": f"Bearer {other_token}"},
            json={"categories": ["berita-kampus"]},
        )
        assert forbidden.status_code == 404
        assert forbidden.json()["error"]["code"] == "NOT_FOUND"


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
