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


SIAKAD_PATHS = [
    "/v1/studentv2/schedule",
    "/v1/studentv2/grades",
    "/v1/studentv2/news",
    "/v1/studentv2/announcements",
    "/v1/studentv2/dashboard",
    "/v1/studentv2/profile",
    "/v1/studentv2/khs",
    "/v1/studentv2/krs",
    "/v1/studentv2/krs/print",
    "/v1/studentv2/uts",
    "/v1/studentv2/uas",
    "/v1/studentv2/calendar",
    "/v1/studentv2/prodi-contacts",
    "/v1/studentv2/certificates",
    "/v1/studentv2/lecturers",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("path", SIAKAD_PATHS)
async def test_siakad_paths_return_503_when_disabled(path, monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(path)
    assert res.status_code == 503
    error = res.json()["error"]
    assert error["code"] == "SIAKAD_DISABLED"
    assert error["cta_url"].endswith("students.bsi.ac.id")


@pytest.mark.asyncio
async def test_captcha_siakad_disabled_but_elearning_ok(monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", False)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1"},
    ) as ac:
        blocked = await ac.post("/v1/auth/captcha", json={"nim": "12345678", "host": "siakad"})
        assert blocked.status_code == 503
        assert blocked.json()["error"]["code"] == "SIAKAD_DISABLED"

        with patch(
            "app.captcha_relay.create_challenge",
            AsyncMock(
                return_value={
                    "id": "a" * 32,
                    "image": "data:image/png;base64,AAA",
                    "label": "MyBest",
                    "expires_in": 300,
                }
            ),
        ):
            allowed = await ac.post("/v1/auth/captcha", json={"nim": "12345678", "host": "elearning"})
    assert allowed.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_siakad_disabled(monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", False)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1"},
    ) as ac:
        res = await ac.post(
            "/v1/auth/forgot-password",
            json={"nim": "12345678", "email": "siswa@example.com", "system": "siakad"},
        )
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "SIAKAD_DISABLED"


@pytest.mark.asyncio
async def test_verify_siakad_target_disabled(monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", False)
    monkeypatch.setattr("app.config.settings.API_KEY", "master_secret")
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1"},
    ) as ac:
        blocked = await ac.post(
            "/v1/auth/verify",
            headers={"X-API-Key": "master_secret"},
            json={"nim": "12345678", "elearning_pass": "p1", "studentv2_pass": "p2"},
        )
        assert blocked.status_code == 503
        assert blocked.json()["error"]["code"] == "SIAKAD_DISABLED"

        with patch("app.modules.auth.verify_live_credentials", AsyncMock(return_value=(False, True))):
            opened = await ac.post(
                "/v1/auth/verify",
                headers={"X-API-Key": "master_secret"},
                json={"nim": "12345678", "elearning_pass": "p1", "studentv2_pass": ""},
            )
    assert opened.status_code == 200
    assert "studentv2" not in opened.json()["data"]
