"""Tests integrasi worker + PWA push: berita broadcast, reminder, prune 404/410. Offline."""
from unittest.mock import AsyncMock, patch

import pytest

from app.pwa_push_db import (
    add_subscription,
    get_active_subscriptions_for_nim,
    init_pwa_db,
    list_nims_with_category,
    list_subscriptions,
)
from app.pwa_webpush import dispatch_pwa_to_nim


@pytest.fixture(autouse=True)
def _pwa_db(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "test_pwa.db"))
    init_pwa_db()
    monkeypatch.setattr("app.config.settings.VAPID_PRIVATE_KEY", "ab" * 32)
    monkeypatch.setattr("app.config.settings.VAPID_PUBLIC_KEY", "BPub")


@pytest.mark.asyncio
async def test_default_categories_all_on_at_subscribe():
    from app.channel_validation import ALLOWED_CATEGORIES

    await add_subscription("15260767", "https://fcm.googleapis.com/fcm/send/a", "k", "a", "HP")
    from app.pwa_push_db import list_categories

    cats = await list_categories("15260767")
    assert set(cats) == set(ALLOWED_CATEGORIES)
    assert "15260767" in await list_nims_with_category("berita-kampus")


@pytest.mark.asyncio
async def test_dispatch_prunes_404_and_keeps_201():
    await add_subscription("15260767", "https://fcm.googleapis.com/fcm/send/dead", "k", "a", "Old")
    await add_subscription("15260767", "https://fcm.googleapis.com/fcm/send/alive", "k", "a", "New")

    async def fake_send(sub, payload, ttl=86400):
        if sub["endpoint"].endswith("dead"):
            return False, 410
        return True, 201

    with patch("app.pwa_webpush.send_web_push", AsyncMock(side_effect=fake_send)):
        delivered = await dispatch_pwa_to_nim("15260767", {"title": "t", "body": "b"})

    assert delivered == 1
    subs = await list_subscriptions("15260767")
    assert len(subs) == 1
    endpoints = await get_active_subscriptions_for_nim("15260767")
    assert endpoints[0]["endpoint"].endswith("alive")


@pytest.mark.asyncio
async def test_broadcast_news_article_fans_out_to_pwa(monkeypatch):
    from app.modules.news import broadcast_news_article

    await add_subscription("15260767", "https://fcm.googleapis.com/fcm/send/n1", "k", "a", "HP")

    with patch(
        "app.pwa_webpush.dispatch_pwa_to_category",
        AsyncMock(return_value=1),
    ) as mock_pwa:
        results = await broadcast_news_article({"title": "Ujian", "id": 1})

    mock_pwa.assert_awaited_once()
    assert mock_pwa.await_args.args[0] == "berita-kampus"
    assert results.get("pwa-push") is True


@pytest.mark.asyncio
async def test_trigger_reminder_includes_pwa_push(tmp_path, monkeypatch):
    """Reminder via /v1/channels/trigger-reminder harus juga menembak PWA."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app
    from app.channels_db import init_db

    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "t2.db"))
    init_db()
    init_pwa_db()
    await add_subscription("15260767", "https://fcm.googleapis.com/fcm/send/r1", "k", "a", "HP")

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

    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials",
        AsyncMock(return_value=(True, True)),
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "15260767", "studentv2_pass": "p", "elearning_pass": "p"},
        )
        token = res.cookies.get("ubsi_session")
        with patch(
            "app.pwa_webpush.dispatch_pwa_to_nim",
            AsyncMock(return_value=1),
        ) as mock_push:
            res = await ac.post(
                "/v1/channels/trigger-reminder",
                headers={"Authorization": f"Bearer {token}"},
                json={"category": "matkul-besok"},
            )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["pwa_pushed"] == 1
    assert data["dispatched"] == 1
    mock_push.assert_awaited_once()
