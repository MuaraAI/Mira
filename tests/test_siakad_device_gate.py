"""Gerbang SIAKAD di `require_studentv2_creds` dan penulis store kanonis.

Sesi wajib membawa device `trusted` sebelum password SIAKAD kanonis dilepas;
API key dilewati dari gerbang device karena keputusan eksplisit pemilik akun.
Semua tes offline: SQLite di tmp_path, Redis palsu, kampus di-mock.
"""
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request
from fastapi import HTTPException

from app.account_devices import ensure_device, init_account_devices_db, revoke_device
from app.account_links import (
    get_link_secret,
    get_link_status,
    init_account_links_db,
    mark_needs_relink,
    set_link,
    unlink,
)
from app.api_keys_db import create_api_key, init_api_keys_db
from app.cache import cache
from app.config import settings
from app.deps import require_studentv2_creds
from app.device_identity import DEVICE_COOKIE
from app.main import app
from app.session_store import session_store
from tests.test_login_guard import FakeRedis

NIM = "12345678"
TRUSTED_DEVICE = "dev-trusted"
PENDING_DEVICE = "dev-pending"
SCHEDULE_PATH = "/v1/studentv2/schedule"


@pytest.fixture
async def env(monkeypatch, tmp_path):
    fake = FakeRedis()
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "accounts.sqlite3"))
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    monkeypatch.setattr(cache, "_client", fake)
    monkeypatch.setattr("app.limiter.limiter.is_allowed", AsyncMock(return_value=True))
    fetch_mock = AsyncMock(return_value="<html><body>jadwal</body></html>")
    monkeypatch.setattr("app.modules.studentv2.studentv2_client.fetch_page", fetch_mock)
    monkeypatch.setattr("app.modules.studentv2.parse_schedule", lambda html: {"courses": []})
    await init_account_links_db()
    await init_account_devices_db()
    init_api_keys_db()
    return fetch_mock


def _client(*, token=None, cookies=None, api_key=None):
    headers = {"_skip_auto_auth": "1"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if api_key:
        headers["X-API-Key"] = api_key
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers=headers,
        cookies=cookies,
    )


def _fetch_password(fetch_mock) -> str:
    assert fetch_mock.await_count > 0, "upstream SIAKAD tidak dipanggil"
    return fetch_mock.call_args.args[2]


async def _gate_rejected(env, *, device_id):
    """Sesi dengan device yang ditolak harus 403 SIAKAD_DEVICE_PENDING."""
    token = await session_store.create(NIM, "sv-pass", "el-pass", device_id=device_id)
    async with _client(token=token, cookies={DEVICE_COOKIE: device_id}) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 403
    body = res.json()["error"]
    assert body["code"] == "SIAKAD_DEVICE_PENDING"


async def test_pending_device_gets_device_pending_error(env):
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    await ensure_device(NIM, PENDING_DEVICE, label="Kedua", user_agent="ua")
    await _gate_rejected(env, device_id=PENDING_DEVICE)


async def test_revoked_device_gets_device_pending_error(env):
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    await ensure_device(NIM, PENDING_DEVICE, label="Kedua", user_agent="ua")
    await revoke_device(NIM, PENDING_DEVICE)
    # Dicabut harus 403 yang jelas, bukan 500 maupun lolos gerbang.
    await _gate_rejected(env, device_id=PENDING_DEVICE)


async def test_missing_device_cookie_on_session_is_rejected(env):
    """Cookie device tak dikenal (rusak/hapus DB) berarti missing, bukan trusted."""
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    token = await session_store.create(NIM, "sv-pass", "el-pass", device_id=None)
    async with _client(token=token, cookies={DEVICE_COOKIE: "dev-tidak-ada"}) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "SIAKAD_DEVICE_PENDING"


async def test_session_without_device_id_is_rejected():
    """Panggilan langsung dependency: sesi tanpa device_id ditolak 403."""
    req = Request({"type": "http", "headers": [], "state": {}})
    req.state.nim = NIM
    req.state.auth_type = "session"
    req.state.studentv2_pass = "salinan-lama"
    with pytest.raises(HTTPException) as exc_info:
        await require_studentv2_creds(req)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error"]["code"] == "SIAKAD_DEVICE_PENDING"


async def test_session_without_canonical_link_is_unauthorized(env):
    """Device trusted tapi belum ada baris kanonis: 401 seperti perilaku lama."""
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    token = await session_store.create(NIM, "", "el-pass", device_id=TRUSTED_DEVICE)
    async with _client(token=token, cookies={DEVICE_COOKIE: TRUSTED_DEVICE}) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


async def test_unlinked_tombstone_is_unauthorized(env):
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    await set_link(NIM, "siakad", kind="password", secret="rahasia")
    await unlink(NIM, "siakad")
    token = await session_store.create(NIM, "sv-pass", "el-pass", device_id=TRUSTED_DEVICE)
    async with _client(token=token, cookies={DEVICE_COOKIE: TRUSTED_DEVICE}) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 401


async def test_trusted_session_uses_canonical_secret(env):
    """Sesi trusted membaca password kanonis, bukan salinan lama di sesi."""
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    await set_link(NIM, "siakad", kind="password", secret="kanonis-pass")
    token = await session_store.create(
        NIM, "salinan-lama", "el-pass", device_id=TRUSTED_DEVICE
    )
    async with _client(token=token, cookies={DEVICE_COOKIE: TRUSTED_DEVICE}) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 200
    assert res.json()["data"] == {"courses": []}
    assert _fetch_password(env) == "kanonis-pass"


async def test_api_key_path_skips_device_gate_and_uses_canonical_secret(env):
    """API key tanpa device apa pun tetap jalan, dan memakai password kanonis."""
    key_info = await create_api_key(NIM, "Kunci Uji", "stale-sv-pass", "el-pass")
    await set_link(NIM, "siakad", kind="password", secret="kanonis-pass")
    async with _client(api_key=key_info["key"]) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 200
    assert _fetch_password(env) == "kanonis-pass"


async def test_needs_relink_returns_409(env):
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    await set_link(NIM, "siakad", kind="password", secret="password-lama")
    await mark_needs_relink(NIM)
    token = await session_store.create(NIM, "sv-pass", "el-pass", device_id=TRUSTED_DEVICE)
    async with _client(token=token, cookies={DEVICE_COOKIE: TRUSTED_DEVICE}) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SIAKAD_RELINK_REQUIRED"


async def test_redis_failure_falls_back_to_sqlite(env, monkeypatch):
    """Cache mati total: gerbang tetap membaca SQLite dan endpoint tetap 200."""

    def _cache_down():
        raise ConnectionError("redis down")

    async def _link_cache_down():
        raise RuntimeError("cache tautan meledak")

    monkeypatch.setattr(cache, "get_client", _cache_down)
    monkeypatch.setattr("app.account_links._get_cache_client", _link_cache_down)
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    await set_link(NIM, "siakad", kind="password", secret="kanonis-pass")
    token = await session_store.create(NIM, "sv-pass", "el-pass", device_id=TRUSTED_DEVICE)
    async with _client(token=token, cookies={DEVICE_COOKIE: TRUSTED_DEVICE}) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 200
    assert res.json()["data"] == {"courses": []}
    assert _fetch_password(env) == "kanonis-pass"


# Task 6b: penulis store kanonis di endpoint kredensial.


async def _trusted_session_token():
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    return await session_store.create(
        NIM, "sv-pass", "el-pass", device_id=TRUSTED_DEVICE
    )


async def test_connect_writes_canonical_link(env, monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.verify_siakad_login", AsyncMock(return_value=True)
    )
    token = await _trusted_session_token()
    async with _client(token=token, cookies={DEVICE_COOKIE: TRUSTED_DEVICE}) as ac:
        res = await ac.post(
            "/v1/auth/credentials", json={"system": "siakad", "password": "password-baru"}
        )
    assert res.status_code == 200
    assert res.json()["data"]["connected"] is True
    assert await get_link_status(NIM, "siakad") == "linked"
    assert await get_link_secret(NIM, "siakad") == "password-baru"


async def test_disconnect_writes_canonical_tombstone(env):
    await set_link(NIM, "siakad", kind="password", secret="rahasia")
    token = await _trusted_session_token()
    async with _client(token=token, cookies={DEVICE_COOKIE: TRUSTED_DEVICE}) as ac:
        res = await ac.delete("/v1/auth/credentials/siakad")
    assert res.status_code == 200
    assert res.json()["data"]["connected"] is False
    assert await get_link_status(NIM, "siakad") == "unlinked"
    assert await get_link_secret(NIM, "siakad") is None


async def test_connect_pending_device_rejected_without_store_write(env, monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.verify_siakad_login", AsyncMock(return_value=True)
    )
    await ensure_device(NIM, TRUSTED_DEVICE, label="Pertama", user_agent="ua")
    await ensure_device(NIM, PENDING_DEVICE, label="Kedua", user_agent="ua")
    # Salinan sesi dikosongkan agar migrasi legasi middleware tidak ikut menulis store.
    token = await session_store.create(NIM, "", "el-pass", device_id=PENDING_DEVICE)
    async with _client(token=token, cookies={DEVICE_COOKIE: PENDING_DEVICE}) as ac:
        res = await ac.post(
            "/v1/auth/credentials", json={"system": "siakad", "password": "password-baru"}
        )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "SIAKAD_DEVICE_PENDING"
    # Device pending tidak boleh menyentuh store kanonis.
    assert await get_link_status(NIM, "siakad") is None
