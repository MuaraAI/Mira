"""SIAKAD hidup lagi: password MyBest dipakai sebagai warisan.

Saklar SIAKAD_ENABLED=false memblokir seluruh lalu lintas ke students.bsi.ac.id.
Saat hidup, dashboard tetap tidak punya kolom password SIAKAD terpisah (satu
password untuk semua akun kampus), jadi login memakai password MyBest yang sama.
"""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


def _wire(monkeypatch, tmp_path, siakad_enabled: bool):
    from app import login_guard
    from app.channels_db import init_db
    from tests.test_optional_siakad import FakeRedis

    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    monkeypatch.setattr(login_guard.login_guard, "_client", fake)
    monkeypatch.setattr("app.modules.news.news_client.fetch_posts", lambda *a, **k: [])
    monkeypatch.setattr("app.modules.news.news_client.fetch_post_detail", lambda *a, **k: {})
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "ubsi.db"))
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", siakad_enabled)
    monkeypatch.setattr("app.captcha_autosolver.candidate_session", AsyncMock(
        return_value=({"cookies": {}, "token": "t"}, ["ABCD"])
    ))
    # Rate limit per IP dihitung global; tes ini menguji alur kredensial, bukan limiter.
    monkeypatch.setattr("app.limiter.limiter.is_allowed", AsyncMock(return_value=True))
    from types import SimpleNamespace

    monkeypatch.setattr(
        "app.login_guard.login_guard.check_ip",
        AsyncMock(return_value=SimpleNamespace(allowed=True, retry_after=0)),
    )
    monkeypatch.setattr("app.login_guard.login_guard.record_attempt", AsyncMock())
    init_db()
    return fake


@pytest.mark.asyncio
async def test_siakad_uses_mybest_password_when_flag_on(monkeypatch, tmp_path):
    _wire(monkeypatch, tmp_path, siakad_enabled=True)
    calls = {}

    async def verify(nim, el_pass, sv_pass, **kwargs):
        calls["sv_pass"] = sv_pass
        return True, True

    monkeypatch.setattr("app.modules.auth.verify_live_credentials", verify)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "12345678", "studentv2_pass": "", "elearning_pass": "rahasia123"},
        )

    assert res.status_code == 200
    # Password SIAKAD diwarisi dari MyBest, bukan dikosongkan.
    assert calls["sv_pass"] == "rahasia123"
    assert res.json()["data"]["systems"]["siakad"] is True


@pytest.mark.asyncio
async def test_siakad_does_not_inherit_when_flag_off(monkeypatch, tmp_path):
    _wire(monkeypatch, tmp_path, siakad_enabled=False)
    calls = {}

    async def verify(nim, el_pass, sv_pass, **kwargs):
        calls["sv_pass"] = sv_pass
        return False, True

    monkeypatch.setattr("app.modules.auth.verify_live_credentials", verify)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "12345678", "studentv2_pass": "", "elearning_pass": "rahasia123"},
        )

    assert res.status_code == 200
    assert calls["sv_pass"] == ""


@pytest.mark.asyncio
async def test_inherited_password_failure_stays_silent(monkeypatch, tmp_path):
    """Password warisan yang ditolak tidak memunculkan warning: user tidak mengetiknya."""
    _wire(monkeypatch, tmp_path, siakad_enabled=True)

    async def verify(nim, el_pass, sv_pass, *, outcomes=None, **kwargs):
        if outcomes is not None:
            outcomes["studentv2"] = ("credentials", ["Password salah"])
        return False, True

    monkeypatch.setattr("app.modules.auth.verify_live_credentials", verify)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "12345678", "studentv2_pass": "", "elearning_pass": "rahasia123"},
        )

    assert res.status_code == 200
    warnings = res.json()["data"]["warnings"]
    assert not any("SIAKAD" in w and "terkunci" in w for w in warnings)


@pytest.mark.asyncio
async def test_explicit_siakad_password_failure_warns(monkeypatch, tmp_path):
    _wire(monkeypatch, tmp_path, siakad_enabled=True)

    async def verify(nim, el_pass, sv_pass, *, outcomes=None, **kwargs):
        if outcomes is not None:
            outcomes["studentv2"] = ("credentials", ["Password salah"])
        return False, True

    monkeypatch.setattr("app.modules.auth.verify_live_credentials", verify)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "12345678", "studentv2_pass": "beda123", "elearning_pass": "rahasia123"},
        )

    warnings = res.json()["data"]["warnings"]
    assert any("SIAKAD" in w and "terkunci" in w for w in warnings)
