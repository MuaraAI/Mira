"""API perangkat `/v1/auth/devices` dan penjagaan jalur tulis persisten.

Perangkat pending tidak boleh menyetujui perangkat lain, membuat API key,
berlangganan PWA push, atau menulis channel. Perangkat tepercaya terakhir
tidak bisa dicabut, dan pencabutan menghapus sesi perangkat itu.
100% offline: SQLite di tmp_path, Redis palsu.
"""
import sqlite3
from unittest.mock import AsyncMock
from base64 import urlsafe_b64encode

import pytest
from httpx import ASGITransport, AsyncClient

from app.account_devices import (
    approve_device,
    device_handle,
    ensure_device,
    get_device_status,
    init_account_devices_db,
)
from app.account_links import init_account_links_db
from app.cache import cache
from app.config import settings
from app.main import app
from app.session_store import session_store
from tests.test_login_guard import FakeRedis

NIM = "12345678"
TRUSTED = "a" * 64
PENDING = "b" * 64

_DISCORD_CONFIG = {
    "url": "https://discord.com/api/webhooks/1234567890123/abcdefghijklmnopqrstuvwxyz123456"
}


def _valid_pwa_keys() -> dict[str, str]:
    return {
        "p256dh": urlsafe_b64encode(bytes([0x04] + [1] * 64)).rstrip(b"=").decode(),
        "auth": urlsafe_b64encode(bytes([9] * 16)).rstrip(b"=").decode(),
    }


@pytest.fixture
async def env(monkeypatch, tmp_path):
    fake = FakeRedis()
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "accounts.sqlite3"))
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    monkeypatch.setattr(cache, "_client", fake)
    monkeypatch.setattr("app.limiter.limiter.is_allowed", AsyncMock(return_value=True))
    await init_account_links_db()
    await init_account_devices_db()
    from app.api_keys_db import init_api_keys_db
    from app.channels_db import init_db
    from app.pwa_push_db import init_pwa_db

    init_api_keys_db()
    init_db()
    init_pwa_db()
    return fake


def _client(*, token=None, cookies=None):
    headers = {"_skip_auto_auth": "1"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers=headers,
        cookies=cookies,
    )


async def _session(device_id=None):
    return await session_store.create(NIM, "sv-pass", "el-pass", device_id=device_id)


def _device_row(device_id):
    with sqlite3.connect(settings.SQLITE_DB_PATH) as conn:
        return conn.execute(
            "SELECT status FROM account_devices WHERE nim = ? AND device_id = ?",
            (NIM, device_id),
        ).fetchone()


def _code(payload):
    """Kode error dari envelope (`error`) maupun detail mentah FastAPI."""
    return (payload.get("error") or payload)["code"]


@pytest.mark.asyncio
async def test_devices_list_marks_is_current(env):
    await ensure_device(NIM, TRUSTED, label="Pertama", user_agent="ua-a")
    await ensure_device(NIM, PENDING, label="Kedua", user_agent="ua-b")
    token = await _session(device_id=TRUSTED)

    async with _client(token=token, cookies={"mira_device": TRUSTED}) as ac:
        res = await ac.get("/v1/auth/devices")

    assert res.status_code == 200
    devices = res.json()["data"]["devices"]
    by_id = {d["handle"]: d for d in devices}
    trusted_handle = device_handle(NIM, TRUSTED)
    pending_handle = device_handle(NIM, PENDING)
    assert by_id[trusted_handle]["is_current"] is True
    assert by_id[pending_handle]["is_current"] is False
    assert by_id[trusted_handle]["status"] == "trusted"
    assert all("device_id" not in d for d in devices)


@pytest.mark.asyncio
async def test_pending_device_cannot_approve(env):
    await ensure_device(NIM, TRUSTED, label="Pertama", user_agent="ua-a")
    await ensure_device(NIM, PENDING, label="Kedua", user_agent="ua-b")
    token = await _session(device_id=PENDING)

    async with _client(token=token, cookies={"mira_device": PENDING}) as ac:
        res = await ac.post(f"/v1/auth/devices/{PENDING}/approve")

    assert res.status_code == 403
    assert _code(res.json()) == "SIAKAD_DEVICE_PENDING"
    assert _device_row(PENDING)[0] == "pending"


@pytest.mark.asyncio
async def test_trusted_device_can_approve_pending(env):
    await ensure_device(NIM, TRUSTED, label="Pertama", user_agent="ua-a")
    await ensure_device(NIM, PENDING, label="Kedua", user_agent="ua-b")
    token = await _session(device_id=TRUSTED)

    async with _client(token=token, cookies={"mira_device": TRUSTED}) as ac:
        res = await ac.post(f"/v1/auth/devices/{device_handle(NIM, PENDING)}/approve")

    assert res.status_code == 200
    assert await get_device_status(NIM, PENDING) == "trusted"


@pytest.mark.asyncio
async def test_revoke_last_trusted_returns_409(env):
    await ensure_device(NIM, TRUSTED, label="Pertama", user_agent="ua-a")
    token = await _session(device_id=TRUSTED)

    async with _client(token=token, cookies={"mira_device": TRUSTED}) as ac:
        res = await ac.delete(f"/v1/auth/devices/{device_handle(NIM, TRUSTED)}")

    assert res.status_code == 409
    assert _code(res.json()) == "LAST_TRUSTED_DEVICE"
    assert _device_row(TRUSTED)[0] == "trusted"


@pytest.mark.asyncio
async def test_revoke_removes_sessions_of_that_device_only(env):
    await ensure_device(NIM, TRUSTED, label="Pertama", user_agent="ua-a")
    await ensure_device(NIM, "c" * 64, label="Ketiga", user_agent="ua-c")
    await ensure_device(NIM, "b" * 64, label="Keempat", user_agent="ua-d")
    await approve_device(NIM, "dev-b", approved_by=TRUSTED)
    token_survivor = await session_store.create(
        NIM, "sv-pass", "el-pass", device_id=TRUSTED
    )
    token = await _session(device_id=TRUSTED)

    async with _client(token=token, cookies={"mira_device": TRUSTED}) as ac:
        res = await ac.delete(f"/v1/auth/devices/{device_handle(NIM, "b" * 64)}")

    assert res.status_code == 200
    assert _device_row("b" * 64)[0] == "revoked"
    assert await session_store.resolve(token_survivor) is not None


@pytest.mark.asyncio
async def test_pending_device_cannot_create_api_key(env):
    await ensure_device(NIM, TRUSTED, label="Pertama", user_agent="ua-a")
    await ensure_device(NIM, PENDING, label="Kedua", user_agent="ua-b")
    token = await _session(device_id=PENDING)

    async with _client(token=token, cookies={"mira_device": PENDING}) as ac:
        res = await ac.post("/v1/auth/keys", json={"name": "Bot"})

    assert res.status_code == 403
    assert _code(res.json()) == "SIAKAD_DEVICE_PENDING"


@pytest.mark.asyncio
async def test_pending_device_cannot_subscribe_pwa(env):
    await ensure_device(NIM, TRUSTED, label="Pertama", user_agent="ua-a")
    await ensure_device(NIM, PENDING, label="Kedua", user_agent="ua-b")
    token = await _session(device_id=PENDING)

    async with _client(token=token, cookies={"mira_device": PENDING}) as ac:
        res = await ac.post(
            "/v1/notifications/pwa/subscribe",
            json={
                "endpoint": "https://fcm.googleapis.com/fcm/send/abc",
                "keys": _valid_pwa_keys(),
                "device_name": "Test",
            },
        )

    assert res.status_code == 403
    assert _code(res.json()) == "SIAKAD_DEVICE_PENDING"


@pytest.mark.asyncio
async def test_pending_device_cannot_create_channel(env):
    await ensure_device(NIM, TRUSTED, label="Pertama", user_agent="ua-a")
    await ensure_device(NIM, PENDING, label="Kedua", user_agent="ua-b")
    token = await _session(device_id=PENDING)

    async with _client(token=token, cookies={"mira_device": PENDING}) as ac:
        res = await ac.post(
            "/v1/channels",
            json={"type": "discord", "categories": ["berita-kampus"], "config": _DISCORD_CONFIG},
        )

    assert res.status_code == 403
    assert _code(res.json()) == "SIAKAD_DEVICE_PENDING"
