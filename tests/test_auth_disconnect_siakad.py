"""Lepas tautan SIAKAD: sesi dan API key dibersihkan, MyBest tidak tersentuh."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


def _session(monkeypatch, *, siakad_pass: str, elearning_pass: str = "rahasia123"):
    async def resolve(token):
        return {
            "nim": "15260767",
            "studentv2_pass": siakad_pass,
            "elearning_pass": elearning_pass,
            "expires_in": 604800,
        }

    monkeypatch.setattr("app.session_store.session_store.resolve", resolve)


@pytest.mark.asyncio
async def test_disconnect_clears_siakad_but_not_mybest(monkeypatch):
    _session(monkeypatch, siakad_pass="password-siakad")
    updates = []

    async def update_for_nim(nim, field, new_password):
        updates.append((field, new_password))
        return 2

    monkeypatch.setattr("app.session_store.session_store.update_password_for_nim", update_for_nim)
    monkeypatch.setattr("app.api_keys_db.update_password_for_nim", AsyncMock(return_value=1))
    monkeypatch.setattr("app.campus_session_store.drop_cookies", lambda module, nim: None)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1", "Authorization": "Bearer sesi-uji"},
    ) as ac:
        res = await ac.delete("/v1/auth/credentials/siakad")

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["connected"] is False
    assert data["sessions_updated"] == 2
    # Hanya password SIAKAD yang dikosongkan; MyBest tidak pernah disentuh.
    assert updates == [("studentv2_pass", "")]


@pytest.mark.asyncio
async def test_disconnect_when_already_unlinked_is_noop(monkeypatch):
    _session(monkeypatch, siakad_pass="")
    updates = []

    async def update_for_nim(nim, field, new_password):
        updates.append(field)
        return 0

    monkeypatch.setattr("app.session_store.session_store.update_password_for_nim", update_for_nim)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1", "Authorization": "Bearer sesi-uji"},
    ) as ac:
        res = await ac.delete("/v1/auth/credentials/siakad")

    assert res.status_code == 200
    assert res.json()["data"]["sessions_updated"] == 0
    assert updates == []


@pytest.mark.asyncio
async def test_me_reports_siakad_unlinked_after_disconnect(monkeypatch):
    """Kontrak: setelah dilepas, `systems.siakad` false dan fitur SIAKAD tertutup."""
    _session(monkeypatch, siakad_pass="")
    monkeypatch.setattr(
        "app.session_store.session_store.update_password_for_nim", AsyncMock(return_value=1)
    )

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"_skip_auto_auth": "1", "Authorization": "Bearer sesi-uji"},
    ) as ac:
        data = (await ac.get("/v1/auth/me")).json()["data"]

    assert data["systems"] == {"siakad": False, "mybest": True}
    assert data["links"]["siakad"]["linked_password"] is None
    assert data["links"]["mybest"]["required"] is True
