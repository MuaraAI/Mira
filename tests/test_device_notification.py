"""Notifikasi `perangkat-baru`: kategori valid dan satu kabar per device pending.

100% offline: SQLite di tmp_path, Redis palsu, `deliver` di-mock pada batas
modulnya sehingga tidak ada request keluar.
"""
import sqlite3
from unittest.mock import AsyncMock

import pytest

from app.account_devices import ensure_device, init_account_devices_db
from app.cache import cache
from app.channel_validation import validate_channel_payload
from app.config import settings
from tests.test_login_guard import FakeRedis

NIM = "12345678"


@pytest.fixture
async def env(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "devices.sqlite3"))
    monkeypatch.setattr(cache, "_client", FakeRedis())
    await init_account_devices_db()
    return FakeRedis()


def test_perangkat_baru_category_is_accepted():
    ok, message = validate_channel_payload(
        "telegram", ["perangkat-baru"], {"bot_token": "123456:abcdefghijklmnopqrstuvwxyz123456", "chat_id": "1"}
    )
    assert ok, message


@pytest.mark.asyncio
async def test_pending_device_notifies_once(env, monkeypatch):
    delivered = AsyncMock(return_value=1)
    monkeypatch.setattr("app.notifier.deliver", delivered)

    assert await ensure_device(NIM, "dev-a", label="Chrome", user_agent="ua") == "trusted"
    assert await ensure_device(NIM, "dev-b", label="Firefox", user_agent="ua") == "pending"
    assert await ensure_device(NIM, "dev-b", label="Firefox", user_agent="ua") == "pending"

    assert delivered.await_count == 1
    args = delivered.await_args.args
    assert args[0] == NIM
    assert args[1] == "perangkat-baru"


@pytest.mark.asyncio
async def test_trusted_device_does_not_notify(env, monkeypatch):
    delivered = AsyncMock(return_value=1)
    monkeypatch.setattr("app.notifier.deliver", delivered)

    assert await ensure_device(NIM, "dev-a", label="Chrome", user_agent="ua") == "trusted"
    assert delivered.await_count == 0


@pytest.mark.asyncio
async def test_notification_failure_still_returns_status(env, monkeypatch):
    monkeypatch.setattr("app.notifier.deliver", AsyncMock(side_effect=RuntimeError("boom")))

    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="ua")
    assert await ensure_device(NIM, "dev-b", label="Firefox", user_agent="ua") == "pending"

    with sqlite3.connect(settings.SQLITE_DB_PATH) as conn:
        row = conn.execute(
            "SELECT status FROM account_devices WHERE device_id = ?", ("dev-b",)
        ).fetchone()
    assert row[0] == "pending"
