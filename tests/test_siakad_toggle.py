"""Test saklar SIAKAD: kapabilitas, gerbang endpoint, dan perilaku login."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


def test_error_response_merges_extra():
    from app.envelope import error_response

    body = error_response(
        "SIAKAD_DISABLED",
        "mati",
        module="auth",
        extra={"cta_url": "https://students.bsi.ac.id"},
    )
    assert body["error"]["cta_url"] == "https://students.bsi.ac.id"
    assert body["error"]["code"] == "SIAKAD_DISABLED"


def test_test_suite_defaults_to_siakad_enabled():
    from app.config import settings

    # Produksi default False; conftest menyalakan agar test SIAKAD lama tetap hijau.
    assert settings.SIAKAD_ENABLED is True


@pytest.mark.asyncio
async def test_capabilities_reports_disabled(monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", False)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1"},
    ) as ac:
        res = await ac.get("/v1/capabilities")
    assert res.status_code == 200
    assert res.json()["data"]["siakad"] == {
        "enabled": False,
        "cta_url": "https://students.bsi.ac.id",
    }


@pytest.mark.asyncio
async def test_capabilities_reports_enabled(monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", True)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1"},
    ) as ac:
        res = await ac.get("/v1/capabilities")
    assert res.status_code == 200
    assert res.json()["data"]["siakad"]["enabled"] is True
