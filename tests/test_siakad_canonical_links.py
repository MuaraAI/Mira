"""Store kanonis SIAKAD di `require_studentv2_creds` dan endpoint kredensial/password.

Semua endpoint SIAKAD, link/unlink, ganti password, dan API key membaca store
kanonis per NIM (`account_links`) tanpa gerbang izin per perangkat.
Semua tes 100% offline: SQLite di tmp_path, Redis palsu, kampus di-mock.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

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
from app.main import app
from app.password_change import ChangeResult
from app.session_store import session_store
from tests.test_login_guard import FakeRedis

NIM = "12345678"
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
    init_api_keys_db()
    return fetch_mock


def _client(*, token=None, api_key=None):
    headers = {"_skip_auto_auth": "1"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if api_key:
        headers["X-API-Key"] = api_key
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers=headers,
    )


def _fetch_password(fetch_mock) -> str:
    assert fetch_mock.await_count > 0, "upstream SIAKAD tidak dipanggil"
    return fetch_mock.call_args.args[2]


async def test_session_without_canonical_link_is_unauthorized(env):
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


async def test_unlinked_tombstone_is_unauthorized(env):
    await set_link(NIM, "siakad", kind="password", secret="rahasia")
    await unlink(NIM, "siakad")
    token = await session_store.create(NIM, "sv-pass", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 401


async def test_mybest_only_session_uses_canonical_secret(env):
    """Login MyBest-only tanpa cookie device tetap mengakses SIAKAD memakai secret kanonis."""
    await set_link(NIM, "siakad", kind="password", secret="kanonis-pass")
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 200
    assert res.json()["data"] == {"courses": []}
    assert _fetch_password(env) == "kanonis-pass"


async def test_api_key_uses_canonical_secret(env):
    key_info = await create_api_key(NIM, "Kunci Uji", "stale-sv-pass", "el-pass")
    await set_link(NIM, "siakad", kind="password", secret="kanonis-pass")
    async with _client(api_key=key_info["key"]) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 200
    assert _fetch_password(env) == "kanonis-pass"


async def test_needs_relink_returns_409(env):
    await set_link(NIM, "siakad", kind="password", secret="password-lama")
    await mark_needs_relink(NIM)
    token = await session_store.create(NIM, "sv-pass", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SIAKAD_RELINK_REQUIRED"


async def test_redis_failure_falls_back_to_sqlite(env, monkeypatch):
    def _cache_down():
        raise ConnectionError("redis down")

    async def _link_cache_down():
        raise RuntimeError("cache tautan meledak")

    monkeypatch.setattr(cache, "get_client", _cache_down)
    monkeypatch.setattr("app.account_links._get_cache_client", _link_cache_down)
    await set_link(NIM, "siakad", kind="password", secret="kanonis-pass")
    token = await session_store.create(NIM, "sv-pass", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.get(SCHEDULE_PATH)
    assert res.status_code == 200
    assert res.json()["data"] == {"courses": []}
    assert _fetch_password(env) == "kanonis-pass"


async def test_connect_writes_canonical_link(env, monkeypatch):
    monkeypatch.setattr("app.modules.auth.verify_siakad_login", AsyncMock(return_value=True))
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.post(
            "/v1/auth/credentials", json={"system": "siakad", "password": "password-baru"}
        )
    assert res.status_code == 200
    assert res.json()["data"]["connected"] is True
    assert await get_link_status(NIM, "siakad") == "linked"
    assert await get_link_secret(NIM, "siakad") == "password-baru"


async def test_disconnect_writes_canonical_tombstone_without_device_cookie(env):
    await set_link(NIM, "siakad", kind="password", secret="rahasia")
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.delete("/v1/auth/credentials/siakad")
    assert res.status_code == 200
    assert res.json()["data"]["connected"] is False
    assert await get_link_status(NIM, "siakad") == "unlinked"
    assert await get_link_secret(NIM, "siakad") is None


async def test_password_change_reads_and_updates_canonical_link_on_mybest_only_session(env, monkeypatch):
    """Login MyBest-only yang punya tautan SIAKAD kanonis bisa mengganti password SIAKAD."""
    monkeypatch.setattr(
        "app.modules.auth.change_upstream_password",
        lambda *a: ChangeResult("changed", "Password SIAKAD berhasil diganti"),
    )
    await set_link(NIM, "siakad", kind="password", secret="password-lama")
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.post(
            "/v1/auth/password",
            json={
                "system": "siakad",
                "current_password": "password-lama",
                "new_password": "Kuat2026x",
            },
        )
    assert res.status_code == 200, res.text
    assert res.json()["data"]["changed"] is True
    assert await get_link_secret(NIM, "siakad") == "Kuat2026x"
    assert await get_link_status(NIM, "siakad") == "linked"


async def test_password_change_needs_relink_returns_409(env, monkeypatch):
    upstream = MagicMock(return_value=ChangeResult("changed", "ok"))
    monkeypatch.setattr("app.modules.auth.change_upstream_password", upstream)
    await set_link(NIM, "siakad", kind="password", secret="password-lama")
    await mark_needs_relink(NIM)
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.post(
            "/v1/auth/password",
            json={
                "system": "siakad",
                "current_password": "password-lama",
                "new_password": "Kuat2026x",
            },
        )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SIAKAD_RELINK_REQUIRED"
    upstream.assert_not_called()


async def test_password_change_rejection_keeps_canonical_secret(env, monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.change_upstream_password",
        lambda *a: ChangeResult("rejected", "Password lama salah"),
    )
    await set_link(NIM, "siakad", kind="password", secret="password-lama")
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.post(
            "/v1/auth/password",
            json={
                "system": "siakad",
                "current_password": "password-lama",
                "new_password": "Kuat2026x",
            },
        )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "PASSWORD_REJECTED"
    assert await get_link_secret(NIM, "siakad") == "password-lama"
    assert await get_link_status(NIM, "siakad") == "linked"


async def test_password_change_mybest_keeps_siakad_link(env, monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.change_upstream_password",
        lambda *a: ChangeResult("changed", "Password MyBest berhasil diganti"),
    )
    await set_link(NIM, "siakad", kind="password", secret="rahasia-siakad")
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.post(
            "/v1/auth/password",
            json={
                "system": "mybest",
                "current_password": "el-pass",
                "new_password": "Kuat2026x",
            },
        )
    assert res.status_code == 200, res.text
    assert await get_link_secret(NIM, "siakad") == "rahasia-siakad"
    assert await get_link_status(NIM, "siakad") == "linked"


async def test_me_and_security_sync_canonical_siakad_on_mybest_only_session(env, monkeypatch):
    """/v1/auth/me dan /v1/auth/security memakai store kanonis saat sesi tidak menyimpan studentv2_pass."""
    monkeypatch.setenv("CAMPUS_DEFAULT_PASSWORDS", "passdefault")
    monkeypatch.setattr(settings, "CAMPUS_DEFAULT_PASSWORDS", "passdefault")
    await set_link(NIM, "siakad", kind="password", secret="el-pass")
    token = await session_store.create(NIM, "", "el-pass")
    async with _client(token=token) as ac:
        me = (await ac.get("/v1/auth/me")).json()["data"]
        sec = (await ac.get("/v1/auth/security")).json()["data"]
    assert "device" not in me
    assert me["systems"] == {"siakad": True, "mybest": True}
    assert me["links"]["siakad"]["linked_password"] == "mybest"
    assert sec["systems"] == {"siakad": True, "mybest": True}
    assert sec["default_password"] == {"siakad": False, "mybest": False}

    await set_link(NIM, "siakad", kind="password", secret="passdefault")
    async with _client(token=token) as ac:
        me2 = (await ac.get("/v1/auth/me")).json()["data"]
        sec2 = (await ac.get("/v1/auth/security")).json()["data"]
    assert me2["links"]["siakad"]["linked_password"] == "separate"
    assert sec2["default_password"] == {"siakad": True, "mybest": False}


async def test_legacy_session_imports_canonical_once(env, monkeypatch):
    import app.main as main_module

    real_import = main_module.import_legacy_siakad
    calls = []

    async def spy_import(nim, password):
        calls.append(nim)
        return await real_import(nim, password)

    monkeypatch.setattr(main_module, "import_legacy_siakad", spy_import)
    token = await session_store.create(NIM, "legacy-pass", "el-pass")
    async with _client(token=token) as ac:
        assert (await ac.get("/v1/auth/me")).status_code == 200
        assert (await ac.get("/v1/auth/me")).status_code == 200
    assert calls == [NIM], "migrasi legasi hanya boleh dijalankan sekali"
    assert await get_link_secret(NIM, "siakad") == "legacy-pass"


async def test_legacy_import_without_redis_still_attempts(env, monkeypatch):
    import app.main as main_module

    real_import = main_module.import_legacy_siakad
    calls = []

    async def spy_import(nim, password):
        calls.append(nim)
        return await real_import(nim, password)

    monkeypatch.setattr(main_module, "import_legacy_siakad", spy_import)

    def _cache_down():
        raise ConnectionError("redis down")

    monkeypatch.setattr(cache, "get_client", _cache_down)
    token = await session_store.create(NIM, "legacy-pass", "el-pass")
    async with _client(token=token) as ac:
        res = await ac.get("/v1/auth/me")
    assert res.status_code == 200
    assert calls == [NIM], "tanpa Redis, migrasi tetap dicoba"


async def test_session_store_get_credentials_reads_canonical_siakad(env):
    await set_link(NIM, "siakad", kind="password", secret="kanonis-pass")
    await session_store.create(NIM, "", "el-pass")
    creds = await session_store.get_credentials_for_nim(NIM)
    assert creds == (NIM, "kanonis-pass", "el-pass")

    await unlink(NIM, "siakad")
    creds_after_unlink = await session_store.get_credentials_for_nim(NIM)
    assert creds_after_unlink == (NIM, "", "el-pass")
