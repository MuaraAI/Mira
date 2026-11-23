import asyncio
import sqlite3
from datetime import datetime, timedelta, timezone

import pytest

from app.account_devices import (
    LastTrustedDeviceError,
    approve_device,
    ensure_device,
    get_device_status,
    init_account_devices_db,
    list_devices,
    revoke_device,
)
from app.cache import cache
from app.config import settings
from tests.test_account_links import FakeRedis

NIM = "12345678"


def _backdate_last_seen(nim: str, device_id: str, days: int) -> None:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH)
    try:
        stamp = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        conn.execute(
            "UPDATE account_devices SET last_seen = ? WHERE nim = ? AND device_id = ?",
            (stamp, nim, device_id),
        )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
async def device_env(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "devices.sqlite3"))
    fake_redis = FakeRedis()
    monkeypatch.setattr(cache, "_client", fake_redis)
    await init_account_devices_db()
    return fake_redis


@pytest.mark.asyncio
async def test_first_device_becomes_trusted(device_env):
    assert (
        await ensure_device("12345678", "dev-a", label="Chrome", user_agent="UA")
        == "trusted"
    )


@pytest.mark.asyncio
async def test_second_device_is_pending_until_approved(device_env):
    nim = NIM
    await ensure_device(nim, "dev-a", label="Chrome", user_agent="UA")

    status = await ensure_device(nim, "dev-b", label="Firefox", user_agent="UA2")
    assert status == "pending"
    assert await approve_device(nim, "dev-b", approved_by="dev-a") is True
    assert await get_device_status(nim, "dev-b") == "trusted"


@pytest.mark.asyncio
async def test_revoke_last_trusted_raises(device_env):
    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="UA")

    with pytest.raises(LastTrustedDeviceError):
        await revoke_device(NIM, "dev-a")

    assert await get_device_status(NIM, "dev-a") == "trusted"


@pytest.mark.asyncio
async def test_trusted_device_expires_after_30_days_of_inactivity(device_env):
    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="UA")
    _backdate_last_seen(NIM, "dev-a", 31)

    assert await get_device_status(NIM, "dev-a") == "revoked"


@pytest.mark.asyncio
async def test_concurrent_approve_is_idempotent(device_env):
    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="UA")
    await ensure_device(NIM, "dev-b", label="Firefox", user_agent="UA2")

    results = await asyncio.gather(
        approve_device(NIM, "dev-b", approved_by="dev-a"),
        approve_device(NIM, "dev-b", approved_by="dev-a"),
    )

    assert results == [True, True]
    assert await get_device_status(NIM, "dev-b") == "trusted"


@pytest.mark.asyncio
async def test_existing_device_keeps_status_but_updates_touch_fields(device_env):
    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="UA")
    await ensure_device(NIM, "dev-b", label="Firefox", user_agent="UA2")
    await revoke_device(NIM, "dev-b")

    status = await ensure_device(NIM, "dev-b", label="Edge", user_agent="UA3")
    rows = await list_devices(NIM)
    device_b = next(row for row in rows if row["device_id"] == "dev-b")

    assert status == "revoked"
    assert device_b["label"] == "Edge"
    assert device_b["user_agent"] == "UA3"
    assert device_b["status"] == "revoked"


@pytest.mark.asyncio
async def test_missing_device_reports_missing_and_noop_mutations(device_env):
    assert await get_device_status(NIM, "dev-absen") == "missing"
    assert await approve_device(NIM, "dev-absen", approved_by="dev-a") is False
    assert await revoke_device(NIM, "dev-absen") is False
    assert await list_devices(NIM) == []


@pytest.mark.asyncio
async def test_revoke_allowed_when_other_trusted_device_exists(device_env):
    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="UA")
    await ensure_device(NIM, "dev-b", label="Firefox", user_agent="UA2")
    await approve_device(NIM, "dev-b", approved_by="dev-a")

    assert await revoke_device(NIM, "dev-a") is True
    assert await get_device_status(NIM, "dev-a") == "revoked"
    assert await get_device_status(NIM, "dev-b") == "trusted"


@pytest.mark.asyncio
async def test_list_devices_reports_lazy_revocation(device_env):
    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="UA")
    await ensure_device(NIM, "dev-b", label="Firefox", user_agent="UA2")
    await approve_device(NIM, "dev-b", approved_by="dev-a")
    _backdate_last_seen(NIM, "dev-b", 31)

    rows = await list_devices(NIM)

    assert len(rows) == 2
    assert set(rows[0]) == {"device_id", "label", "user_agent", "status", "last_seen"}
    statuses = {row["device_id"]: row["status"] for row in rows}
    assert statuses == {"dev-a": "trusted", "dev-b": "revoked"}


@pytest.mark.asyncio
async def test_mutations_purge_device_cache(device_env):
    device_key = f"ubsi:acct:device:{NIM}:dev-a"
    list_key = f"ubsi:acct:devices:{NIM}"
    device_env.values[f"{device_key}:fresh"] = "stale"
    device_env.values[f"{device_key}:lgg"] = "stale"
    device_env.values[f"{list_key}:fresh"] = "stale"

    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="UA")
    await ensure_device(NIM, "dev-b", label="Firefox", user_agent="UA2")
    await approve_device(NIM, "dev-b", approved_by="dev-a")
    await revoke_device(NIM, "dev-b")

    assert not any(key.startswith(device_key) for key in device_env.values)
    assert not any(key.startswith(list_key) for key in device_env.values)


@pytest.mark.asyncio
async def test_init_account_devices_db_is_idempotent(device_env):
    await init_account_devices_db()
    await ensure_device(NIM, "dev-a", label="Chrome", user_agent="UA")

    assert await get_device_status(NIM, "dev-a") == "trusted"
