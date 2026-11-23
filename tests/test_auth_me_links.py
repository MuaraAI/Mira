"""`/v1/auth/me` menyertakan umur sesi dan status tautan per sistem.

Sesi Mira 7 hari sliding: dashboard perlu tahu sisa waktunya untuk countdown,
dan perlu tahu apakah SIAKAD memakai password MyBest atau password terpisah.
"""
from unittest.mock import AsyncMock

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.fixture(autouse=True)
def _isolated_accounts_db(tmp_path, monkeypatch):
    """Tautan kanonis di SQLite terpisah per tes supaya status tidak bocor."""
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "accounts.sqlite3"))

    from app.account_links import init_account_links_db

    asyncio.run(init_account_links_db())


def _fake_session(redis, *, siakad_pass: str, elearning_pass: str = "rahasia123"):
    from app.session_store import SESSION_TTL_SECONDS

    async def resolve(token):
        return {
            "nim": "15260767",
            "studentv2_pass": siakad_pass,
            "elearning_pass": elearning_pass,
            "expires_in": SESSION_TTL_SECONDS,
        }

    return resolve


@pytest.mark.asyncio
async def test_me_reports_session_countdown(monkeypatch):
    from app.session_store import SESSION_TTL_SECONDS

    monkeypatch.setattr("app.session_store.session_store.resolve", _fake_session(None, siakad_pass="rahasia123"))

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1", "Authorization": "Bearer sesi-uji"},
    ) as ac:
        res = await ac.get("/v1/auth/me")

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["session"]["expires_in"] == SESSION_TTL_SECONDS
    assert data["session"]["days_left"] == 7.0
    assert data["session"]["expires_at"]


@pytest.mark.asyncio
async def test_me_marks_siakad_password_inherited(monkeypatch):
    monkeypatch.setattr(
        "app.session_store.session_store.resolve",
        _fake_session(None, siakad_pass="rahasia123", elearning_pass="rahasia123"),
    )

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1", "Authorization": "Bearer sesi-uji"},
    ) as ac:
        data = (await ac.get("/v1/auth/me")).json()["data"]

    assert data["links"]["siakad"]["linked_password"] == "mybest"
    assert data["systems"]["siakad"] is True


@pytest.mark.asyncio
async def test_me_marks_siakad_password_separate(monkeypatch):
    monkeypatch.setattr(
        "app.session_store.session_store.resolve",
        _fake_session(None, siakad_pass="beda-sendiri", elearning_pass="rahasia123"),
    )

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1", "Authorization": "Bearer sesi-uji"},
    ) as ac:
        data = (await ac.get("/v1/auth/me")).json()["data"]

    assert data["links"]["siakad"]["linked_password"] == "separate"


@pytest.mark.asyncio
async def test_me_reports_siakad_unlinked(monkeypatch):
    monkeypatch.setattr(
        "app.session_store.session_store.resolve", _fake_session(None, siakad_pass="")
    )

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1", "Authorization": "Bearer sesi-uji"},
    ) as ac:
        data = (await ac.get("/v1/auth/me")).json()["data"]

    assert data["systems"]["siakad"] is False
    assert data["links"]["siakad"]["linked"] is False
    assert data["links"]["siakad"]["linked_password"] is None
    # MyBest wajib: selalu tertaut selama sesi hidup.
    assert data["links"]["mybest"]["required"] is True


@pytest.mark.asyncio
async def test_master_me_reports_siakad_link_status():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-API-Key": "test-secret-key-12345"},
    ) as ac:
        res = await ac.get("/v1/auth/me")

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["identity"] == "master"
    assert data["links"]["siakad"]["status"] == "linked"
