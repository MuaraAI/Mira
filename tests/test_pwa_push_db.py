"""Tests PWA push subscription SQLite store — 100% offline."""
import pytest

from app.pwa_push_db import (
    add_subscription,
    deactivate_subscription,
    get_active_subscriptions_for_nim,
    init_pwa_db,
    list_subscriptions,
    prune_subscription,
    remove_subscription,
)


@pytest.fixture(autouse=True)
def _pwa_db(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "test_pwa.db"))
    init_pwa_db()


@pytest.mark.asyncio
async def test_subscription_crud():
    sub_id = await add_subscription(
        nim="15260767",
        endpoint="https://fcm.googleapis.com/fcm/send/sample1",
        p256dh="BNcP256dh==",
        auth="AuthKey==",
        device_name="Chrome on Android",
    )
    assert sub_id > 0

    devices = await list_subscriptions("15260767")
    assert len(devices) == 1
    assert devices[0]["device_name"] == "Chrome on Android"

    active = await get_active_subscriptions_for_nim("15260767")
    assert len(active) == 1
    assert active[0]["endpoint"].endswith("sample1")

    assert await remove_subscription("15260767", sub_id) is True
    assert await list_subscriptions("15260767") == []


@pytest.mark.asyncio
async def test_duplicate_endpoint_upserts_instead_of_duplicate():
    ep = "https://fcm.googleapis.com/fcm/send/dup"
    await add_subscription("15260767", ep, "k1", "a1", "Device A")
    await add_subscription("15260767", ep, "k2", "a2", "Device A renamed")
    devices = await list_subscriptions("15260767")
    assert len(devices) == 1
    assert devices[0]["device_name"] == "Device A renamed"


@pytest.mark.asyncio
async def test_endpoint_switches_owner_on_new_subscribe():
    """Browser yang sama login akun lain: device pindah NIM, bukan silent stale."""
    ep = "https://fcm.googleapis.com/fcm/send/switch"
    await add_subscription("15260767", ep, "k1", "a1", "HP")
    await add_subscription("15260673", ep, "k2", "a2", "HP")

    # Owner lama kehilangan device, owner baru dapat
    assert await list_subscriptions("15260767") == []
    assert len(await list_subscriptions("15260673")) == 1
    # Push hanya ke owner baru
    assert await get_active_subscriptions_for_nim("15260767") == []
    assert len(await get_active_subscriptions_for_nim("15260673")) == 1


@pytest.mark.asyncio
async def test_prune_and_deactivate():
    ep = "https://fcm.googleapis.com/fcm/send/gone"
    await add_subscription("15260767", ep, "k", "a", "Old Phone")
    assert await prune_subscription(ep) is True
    assert await list_subscriptions("15260767") == []

    await add_subscription("15260767", ep, "k", "a", "Old Phone")
    assert await deactivate_subscription(ep) is True
    assert await get_active_subscriptions_for_nim("15260767") == []


@pytest.mark.asyncio
async def test_remove_other_nims_device_is_idor_safe():
    ep = "https://fcm.googleapis.com/fcm/send/a"
    await add_subscription("15260767", ep, "k", "a", "Mine")
    sub_id = (await list_subscriptions("15260767"))[0]["id"]
    await add_subscription("15260673", "https://fcm.googleapis.com/fcm/send/b", "k", "a", "Theirs")

    # NIM lain tidak bisa hapus device milik 15260767
    assert await remove_subscription("15260673", sub_id) is False
    assert len(await list_subscriptions("15260767")) == 1


@pytest.mark.asyncio
async def test_app_lifespan_creates_pwa_table(tmp_path, monkeypatch):
    """Regression: produksi crash 500 karena tabel PWA tidak dibuat saat startup."""
    import sqlite3

    fresh_db = str(tmp_path / "fresh.db")
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", fresh_db)

    from app.main import app, lifespan

    async with lifespan(app):
        pass

    conn = sqlite3.connect(fresh_db)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert "pwa_push_subscriptions" in tables
    assert "pwa_push_categories" in tables


@pytest.mark.asyncio
async def test_add_subscription_deactivates_stale_device_on_domain_migration():
    nim = "15260767"
    device_name = "Chrome on Android"

    # 1. User mendaftar dari origin lama (ubsi-api.muaraai.com)
    id1 = await add_subscription(
        nim=nim,
        endpoint="https://fcm.googleapis.com/fcm/send/old-endpoint-token-1",
        p256dh="key1",
        auth="auth1",
        device_name=device_name,
    )
    assert id1 > 0

    active_subs = await get_active_subscriptions_for_nim(nim)
    assert len(active_subs) == 1
    assert active_subs[0]["endpoint"] == "https://fcm.googleapis.com/fcm/send/old-endpoint-token-1"

    # 2. User migrasi ke origin baru (mira.muaraai.com) pada perangkat yang sama
    # Browser menerbitkan endpoint baru untuk origin baru
    id2 = await add_subscription(
        nim=nim,
        endpoint="https://fcm.googleapis.com/fcm/send/new-endpoint-token-2",
        p256dh="key2",
        auth="auth2",
        device_name=device_name,
    )
    assert id2 > 0

    # Endpoint lama harus dinonaktifkan (is_active = 0) agar tidak terjadi push duplikat
    active_subs_after = await get_active_subscriptions_for_nim(nim)
    assert len(active_subs_after) == 1
    assert active_subs_after[0]["endpoint"] == "https://fcm.googleapis.com/fcm/send/new-endpoint-token-2"

    # Perangkat berbeda (misal PC Windows) tetap aktif berdampingan
    await add_subscription(
        nim=nim,
        endpoint="https://fcm.googleapis.com/fcm/send/pc-endpoint",
        p256dh="key_pc",
        auth="auth_pc",
        device_name="Firefox on Windows",
    )
    both_active = await get_active_subscriptions_for_nim(nim)
    assert len(both_active) == 2
