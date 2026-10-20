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
