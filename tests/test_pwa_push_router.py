"""Tests router PWA push — 100% offline (FakeRedis + VAPID dummy + mock send)."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pwa_webpush import generate_vapid_keypair


class FakeRedis:
    def __init__(self):
        self.kv: dict = {}

    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, value, ex=None):
        self.kv[key] = value

    async def delete(self, *keys):
        n = 0
        for k in keys:
            if k in self.kv:
                del self.kv[k]
                n += 1
        return n

    async def expire(self, key, ttl):
        return key in self.kv

    async def sadd(self, key, member):
        return 1

    async def srem(self, key, member):
        return 0

    async def smembers(self, key):
        return set()

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
    return fake


@pytest.fixture(autouse=True)
def mock_campus(monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials",
        AsyncMock(return_value=(True, True)),
    )


@pytest.fixture(autouse=True)
def tmp_sqlite(monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "test_ubsi.db"))
    from app.channels_db import init_db
    from app.pwa_push_db import init_pwa_db

    init_db()
    init_pwa_db()


@pytest.fixture(autouse=True)
def vapid_keys(monkeypatch):
    priv_hex, pub_b64 = generate_vapid_keypair()
    monkeypatch.setattr("app.config.settings.VAPID_PRIVATE_KEY", priv_hex)
    monkeypatch.setattr("app.config.settings.VAPID_PUBLIC_KEY", pub_b64)


@pytest.fixture(autouse=True)
def allow_push_endpoints(monkeypatch):
    """Offline rule: jangan resolve DNS beneran di test router; scheme check tetap jalan."""
    monkeypatch.setattr(
        "app.modules.pwa_push.is_safe_webhook_url",
        lambda url: url.startswith("https://"),
    )


async def _login(ac: AsyncClient, nim: str = "15260767") -> str:
    res = await ac.post(
        "/v1/auth/login",
        json={"nim": nim, "studentv2_pass": "sv_pass", "elearning_pass": "el_pass"},
    )
    assert res.status_code == 200
    token = res.cookies.get("ubsi_session")
    assert token
    return token


@pytest.mark.asyncio
async def test_vapid_key_public_endpoint(fake_redis):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/notifications/pwa/vapid-key")
        assert res.status_code == 200
        assert res.json()["data"]["public_key"].startswith("B")


@pytest.mark.asyncio
async def test_subscribe_requires_session(fake_redis):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/v1/notifications/pwa/subscribe", json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/x",
            "keys": {"p256dh": "k", "auth": "a"},
            "device_name": "Test",
        })
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_subscribe_list_delete_device_flow(fake_redis):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        token = await _login(ac)
        headers = {"Authorization": f"Bearer {token}"}

        res = await ac.post("/v1/notifications/pwa/subscribe", headers=headers, json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
            "keys": {"p256dh": "BNck==", "auth": "Auth=="},
            "device_name": "Chrome on Android",
        })
        assert res.status_code == 200
        device_id = res.json()["data"]["id"]

        res = await ac.get("/v1/notifications/pwa/devices", headers=headers)
        assert res.status_code == 200
        assert res.json()["data"]["total"] == 1

        # Duplicate endpoint -> upsert, bukan duplikat
        await ac.post("/v1/notifications/pwa/subscribe", headers=headers, json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
            "keys": {"p256dh": "BNck==", "auth": "Auth=="},
            "device_name": "Chrome renamed",
        })
        res = await ac.get("/v1/notifications/pwa/devices", headers=headers)
        assert res.json()["data"]["total"] == 1

        # Endpoint non-https ditolak
        res = await ac.post("/v1/notifications/pwa/subscribe", headers=headers, json={
            "endpoint": "http://evil.example.com/push",
            "keys": {"p256dh": "k", "auth": "a"},
        })
        assert res.status_code == 400

        # Oversized keys ditolak (DB bloat guard)
        res = await ac.post("/v1/notifications/pwa/subscribe", headers=headers, json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/big",
            "keys": {"p256dh": "k" * 513, "auth": "a"},
        })
        assert res.status_code in (400, 422)

        # NIM lain tidak bisa hapus device milik owner
        token2 = await _login(ac, nim="15260673")
        res = await ac.delete(
            f"/v1/notifications/pwa/devices/{device_id}",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert res.status_code == 404

        res = await ac.delete(f"/v1/notifications/pwa/devices/{device_id}", headers=headers)
        assert res.status_code == 200
        res = await ac.get("/v1/notifications/pwa/devices", headers=headers)
        assert res.json()["data"]["total"] == 0


@pytest.mark.asyncio
async def test_subscribe_rejects_ssrf_private_ip(fake_redis, monkeypatch):
    """Restore validator beneran (tanpa DNS untuk IP literal) lalu cek tolak SSRF."""
    from app.modules.news import is_safe_webhook_url as real_validator

    monkeypatch.setattr("app.modules.pwa_push.is_safe_webhook_url", real_validator)

    # IP literal: getaddrinfo tanpa DNS lookup
    assert real_validator("https://169.254.169.254/latest/meta-data") is False
    assert real_validator("https://10.0.0.1/push") is False
    assert real_validator("https://100.100.100.200/metadata") is False

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        token = await _login(ac)
        res = await ac.post("/v1/notifications/pwa/subscribe", headers={"Authorization": f"Bearer {token}"}, json={
            "endpoint": "https://169.254.169.254/latest/meta-data",
            "keys": {"p256dh": "k", "auth": "a"},
            "device_name": "Evil",
        })
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_test_push_no_device_returns_404(fake_redis):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        token = await _login(ac)
        res = await ac.post("/v1/notifications/pwa/test", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "NO_DEVICE"


@pytest.mark.asyncio
async def test_test_push_sends_to_all_devices_and_reports(fake_redis):
    from app.pwa_push_db import add_subscription

    await add_subscription("15260767", "https://fcm.googleapis.com/fcm/send/d1", "k", "a", "HP")
    await add_subscription("15260767", "https://fcm.googleapis.com/fcm/send/d2", "k", "a", "Laptop")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        token = await _login(ac)
        with patch("app.modules.pwa_push.send_web_push", AsyncMock(return_value=(True, 201))) as m:
            res = await ac.post(
                "/v1/notifications/pwa/test",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert res.status_code == 200
        assert res.json()["data"]["delivered"] == 2
        assert m.call_count == 2
