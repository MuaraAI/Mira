"""Broadcast push pengumuman (maintenance) ke semua device aktif."""
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_broadcast_requires_master_key():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1"},
    ) as ac:
        res = await ac.post(
            "/v1/notifications/pwa/broadcast",
            json={"title": "Maintenance", "body": "Mohon maaf, Mira sedang maintenance."},
        )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_broadcast_master_sends_to_all_nims(monkeypatch):
    monkeypatch.setattr("app.config.settings.API_KEY", "master_secret")
    monkeypatch.setattr("app.config.settings.VAPID_PUBLIC_KEY", "dummy-vapid-public")
    monkeypatch.setattr("app.config.settings.VAPID_PRIVATE_KEY", "dummy-vapid-private")
    monkeypatch.setattr(
        "app.pwa_push_db.list_all_active_nims", AsyncMock(return_value=["12345678", "87654321"])
    )
    sent: list[str] = []

    async def fake_dispatch(nim, payload, ttl=86400):
        sent.append(nim)
        return 1

    monkeypatch.setattr("app.pwa_webpush.dispatch_pwa_to_nim", fake_dispatch)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1"},
    ) as ac:
        res = await ac.post(
            "/v1/notifications/pwa/broadcast",
            headers={"X-API-Key": "master_secret"},
            json={
                "title": "Mira maintenance",
                "body": "Mohon maaf, Mira sedang maintenance. Kami perbaiki CAPTCHA MyBest.",
                "url": "/login",
                "tag": "mira-maintenance",
            },
        )

    assert res.status_code == 200
    assert res.json()["data"] == {"nims": 2, "delivered": 2}
    assert sorted(sent) == ["12345678", "87654321"]


@pytest.mark.asyncio
async def test_broadcast_rejects_external_url(monkeypatch):
    monkeypatch.setattr("app.config.settings.API_KEY", "master_secret")
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1"},
    ) as ac:
        res = await ac.post(
            "/v1/notifications/pwa/broadcast",
            headers={"X-API-Key": "master_secret"},
            json={"title": "x", "body": "y", "url": "https://jahat.example/"},
        )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
