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


class FakeRedis:
    """Redis mini untuk sesi/limiter/guard di test login."""

    def __init__(self):
        self.kv: dict = {}
        self.sets: dict = {}

    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, value, ex=None):
        self.kv[key] = value

    async def delete(self, *keys):
        for key in keys:
            self.kv.pop(key, None)

    async def expire(self, key, ttl):
        return key in self.kv

    async def sadd(self, key, member):
        self.sets.setdefault(key, set()).add(member)
        return 1

    async def smembers(self, key):
        return set(self.sets.get(key, set()))

    async def ping(self):
        return True

    async def incr(self, key):
        self.kv[key] = int(self.kv.get(key, 0)) + 1
        return self.kv[key]

    async def ttl(self, key):
        return 3600


def _wire_login(monkeypatch, tmp_path, *, siakad_enabled: bool):
    from types import SimpleNamespace

    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    monkeypatch.setattr("app.login_guard.login_guard._client", fake)
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", siakad_enabled)
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "ubsi.db"))
    monkeypatch.setattr("app.limiter.limiter.is_allowed", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.login_guard.login_guard.check_ip",
        AsyncMock(return_value=SimpleNamespace(allowed=True, retry_after=0)),
    )
    monkeypatch.setattr("app.login_guard.login_guard.record_attempt", AsyncMock())
    monkeypatch.setattr("app.modules.news.news_client.fetch_posts", lambda *a, **k: [])
    monkeypatch.setattr("app.modules.news.news_client.fetch_post_detail", lambda *a, **k: {})
    from app.channels_db import init_db

    init_db()
    return fake


@pytest.mark.asyncio
async def test_login_ignores_siakad_pass_when_disabled(monkeypatch, tmp_path):
    _wire_login(monkeypatch, tmp_path, siakad_enabled=False)
    solver = AsyncMock(return_value=({"cookies": {}, "token": "t"}, "KODE"))
    monkeypatch.setattr("app.captcha_autosolver.solve_campus_captcha", solver)
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials", AsyncMock(return_value=(False, True))
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={
                "nim": "12345678",
                "studentv2_pass": "apa-saja",
                "elearning_pass": "el",
                "mira_captcha": {"id": "stub-mira", "code": "abcd"},
            },
        )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["systems"] == {"siakad": False, "mybest": True}
    assert any("SIAKAD dinonaktifkan" in warning for warning in data["warnings"])
    assert all(call.args[0] != "siakad" for call in solver.await_args_list)


@pytest.mark.asyncio
async def test_credentials_returns_503_when_disabled(monkeypatch, tmp_path):
    _wire_login(monkeypatch, tmp_path, siakad_enabled=False)
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials", AsyncMock(return_value=(False, True))
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login = await ac.post(
            "/v1/auth/login",
            json={
                "nim": "12345678",
                "studentv2_pass": "",
                "elearning_pass": "el",
                "mira_captcha": {"id": "stub-mira", "code": "abcd"},
            },
        )
        token = login.json()["data"]["token"]
        res = await ac.post(
            "/v1/auth/credentials",
            headers={"Authorization": f"Bearer {token}"},
            json={"system": "siakad", "password": "x"},
        )

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "SIAKAD_DISABLED"


@pytest.mark.asyncio
async def test_change_password_siakad_disabled_but_elearning_ok(monkeypatch, tmp_path):
    from app.password_change import ChangeResult

    _wire_login(monkeypatch, tmp_path, siakad_enabled=False)
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials", AsyncMock(return_value=(False, True))
    )
    changed = []

    def fake_change(system, nim, old, new):
        changed.append((system, nim, old, new))
        return ChangeResult("changed", "Password berhasil diganti")

    monkeypatch.setattr("app.modules.auth.change_upstream_password", fake_change)
    monkeypatch.setattr(
        "app.session_store.session_store.update_password_for_nim", AsyncMock(return_value=1)
    )
    monkeypatch.setattr("app.api_keys_db.update_password_for_nim", AsyncMock(return_value=0))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login = await ac.post(
            "/v1/auth/login",
            json={
                "nim": "12345678",
                "studentv2_pass": "",
                "elearning_pass": "el",
                "mira_captcha": {"id": "stub-mira", "code": "abcd"},
            },
        )
        token = login.json()["data"]["token"]
        blocked = await ac.post(
            "/v1/auth/password",
            headers={"Authorization": f"Bearer {token}"},
            json={"system": "siakad", "current_password": "x", "new_password": "Kuat2026x"},
        )
        allowed = await ac.post(
            "/v1/auth/password",
            headers={"Authorization": f"Bearer {token}"},
            json={"system": "mybest", "current_password": "el", "new_password": "Kuat2026x"},
        )

    assert blocked.status_code == 503
    assert blocked.json()["error"]["code"] == "SIAKAD_DISABLED"
    assert allowed.status_code == 200
    assert changed == [("mybest", "12345678", "el", "Kuat2026x")]
