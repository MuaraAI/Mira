"""Login mendaftarkan device dan `/v1/auth/me` melaporkan statusnya.

Semua I/O eksternal diganti FakeRedis, SQLite di tmp_path, dan kredensial kampus
di-mock. Tidak ada permintaan jaringan maupun pembacaan .env.
"""
import sqlite3
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.account_devices import ensure_device, init_account_devices_db
from app.account_links import (
    get_link_secret,
    import_legacy_siakad,
    init_account_links_db,
    set_link,
)
from app.cache import cache
from app.config import settings
from app.main import app
from app.session_store import _decrypt_payload, session_store
from tests.test_login_guard import FakeRedis

NIM = "12345678"


@pytest.fixture
async def env(monkeypatch, tmp_path):
    fake = FakeRedis()
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "accounts.sqlite3"))
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    monkeypatch.setattr(cache, "_client", fake)
    monkeypatch.setattr("app.modules.auth.verify_live_credentials", AsyncMock(return_value=(True, True)))
    monkeypatch.setattr("app.limiter.limiter.is_allowed", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.login_guard.login_guard.check_ip",
        AsyncMock(return_value=SimpleNamespace(allowed=True, retry_after=0)),
    )
    monkeypatch.setattr("app.login_guard.login_guard.record_attempt", AsyncMock())
    await init_account_links_db()
    await init_account_devices_db()
    return fake


def _client(*, cookies=None, token=None):
    headers = {"_skip_auto_auth": "1"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers=headers,
        cookies=cookies,
    )


async def _login(cookies=None):
    async with _client(cookies=cookies) as ac:
        return await ac.post(
            "/v1/auth/login",
            json={"nim": NIM, "elearning_pass": "el-pass", "studentv2_pass": "sv-pass"},
        )


async def _session(fake, *, siakad_pass="sv-pass", device_id=None):
    return await session_store.create(NIM, siakad_pass, "el-pass", device_id=device_id)


def _device_row(device_id):
    with sqlite3.connect(settings.SQLITE_DB_PATH) as conn:
        return conn.execute(
            "SELECT status FROM account_devices WHERE nim = ? AND device_id = ?",
            (NIM, device_id),
        ).fetchone()


def _device_count():
    with sqlite3.connect(settings.SQLITE_DB_PATH) as conn:
        return conn.execute("SELECT COUNT(*) FROM account_devices WHERE nim = ?", (NIM,)).fetchone()[0]


def _payload(fake):
    blobs = [value for key, value in fake.kv.items() if key.startswith("ubsi:session:")]
    assert blobs, "sesi tidak ditemukan di Redis"
    return _decrypt_payload(blobs[-1], settings.API_KEY)


@pytest.mark.asyncio
async def test_login_registers_device_and_sets_cookie(env):
    res = await _login()

    assert res.status_code == 200
    device_id = res.cookies.get("mira_device")
    assert device_id and len(device_id) == 64
    assert res.cookies.get("ubsi_session")
    assert _device_row(device_id)[0] == "trusted"
    assert _payload(env)["device_id"] == device_id


@pytest.mark.asyncio
async def test_second_login_with_existing_cookie_is_pending(env):
    first = await _login()
    first_id = first.cookies.get("mira_device")

    second = await _login(cookies={"mira_device": first_id})

    assert second.status_code == 200
    assert second.cookies.get("mira_device") == first_id
    assert _device_row(first_id)[0] == "trusted"
    assert _device_count() == 1
    assert _payload(env)["device_id"] == first_id

    fresh = await _login(cookies={"mira_device": "dev-b"})
    assert fresh.cookies.get("mira_device") == "dev-b"
    assert _device_row("dev-b")[0] == "pending"
    assert _device_count() == 2


@pytest.mark.asyncio
async def test_me_reports_device_status_and_link_status(env):
    await ensure_device(NIM, "dev-trusted", label="Pertama", user_agent="ua-trusted")
    await set_link(NIM, "siakad", kind="password", secret="sv-pass")
    token = await _session(env, device_id="dev-pending")

    async with _client(cookies={"mira_device": "dev-pending"}, token=token) as ac:
        res = await ac.get("/v1/auth/me")

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["device"]["status"] == "pending"
    link = data["links"]["siakad"]
    assert link["status"] == "linked"
    assert link["linked"] is True
    assert link["required"] is False
    assert link["linked_password"] == "separate"


@pytest.mark.asyncio
async def test_me_issues_device_cookie_when_client_has_none(env):
    token = await _session(env, device_id=None)

    async with _client(token=token) as ac:
        res = await ac.get("/v1/auth/me")

    assert res.status_code == 200
    device_id = res.cookies.get("mira_device")
    assert device_id and len(device_id) == 64
    assert _device_row(device_id)[0] == "trusted"
    assert res.json()["data"]["device"]["status"] == "trusted"


@pytest.mark.asyncio
async def test_legacy_session_imports_siakad_link_once(env, monkeypatch):
    import app.main as main_module

    spy = AsyncMock(wraps=import_legacy_siakad)
    monkeypatch.setattr(main_module, "import_legacy_siakad", spy)
    token = await _session(env, siakad_pass="legacy-pass")

    async with _client(token=token) as ac:
        first = await ac.get("/v1/auth/me")
    assert first.status_code == 200
    spy.assert_awaited_once_with(NIM, "legacy-pass")
    assert await get_link_secret(NIM, "siakad") == "legacy-pass"

    async with _client(token=token) as ac:
        second = await ac.get("/v1/auth/me")
    assert second.status_code == 200
    assert await get_link_secret(NIM, "siakad") == "legacy-pass"


@pytest.mark.asyncio
async def test_session_without_legacy_password_skips_import(env, monkeypatch):
    import app.main as main_module

    spy = AsyncMock()
    monkeypatch.setattr(main_module, "import_legacy_siakad", spy)
    token = await _session(env, siakad_pass="")

    async with _client(token=token) as ac:
        res = await ac.get("/v1/auth/me")

    assert res.status_code == 200
    spy.assert_not_awaited()
    assert res.json()["data"]["links"]["siakad"]["status"] == "unlinked"


@pytest.mark.asyncio
async def test_legacy_import_failure_does_not_break_request(env, monkeypatch, caplog):
    import app.main as main_module

    monkeypatch.setattr(
        main_module, "import_legacy_siakad", AsyncMock(side_effect=RuntimeError("db mati"))
    )
    token = await _session(env, siakad_pass="legacy-pass")

    async with _client(token=token) as ac:
        res = await ac.get("/v1/auth/me")

    assert res.status_code == 200
    assert any("Gagal migrasi tautan SIAKAD" in rec.message for rec in caplog.records)
    assert res.json()["data"]["links"]["siakad"]["status"] == "linked"
