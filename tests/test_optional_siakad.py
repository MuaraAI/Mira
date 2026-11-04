"""Login SIAKAD opsional: elearning-only masuk, fitur SIAKAD terkunci, bisa dihubungkan belakangan.

100% offline (Iron Rule #2): Redis palsu, kredensial kampus di-mock, tanpa live hit.
"""
from pathlib import Path
from unittest.mock import AsyncMock, patch

_FIXTURE_DIR = Path(__file__).parent / "fixtures"
_COURSES_HTML = (
    (_FIXTURE_DIR / "el_sch.html").read_text(encoding="utf-8")
    if (_FIXTURE_DIR / "el_sch.html").exists()
    else "<html></html>"
)

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.config import settings
from app.session_store import _decrypt_payload


class FakeRedis:
    """Mini in-memory Redis untuk test offline."""

    def __init__(self):
        self.kv: dict = {}
        self.sets: dict = {}

    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, value, ex=None):
        self.kv[key] = value

    async def delete(self, *keys):
        removed = 0
        for key in keys:
            if key in self.kv:
                del self.kv[key]
                removed += 1
        return removed

    async def expire(self, key, ttl):
        return key in self.kv or key in self.sets

    async def sadd(self, key, member):
        self.sets.setdefault(key, set()).add(member)
        return 1

    async def srem(self, key, member):
        if key in self.sets:
            self.sets[key].discard(member)
            return 1
        return 0

    async def smembers(self, key):
        return set(self.sets.get(key, set()))

    async def ping(self):
        return True

    async def aclose(self):
        pass

    async def ttl(self, key):
        return 3600

    async def incr(self, key):
        self.kv[key] = int(self.kv.get(key, 0)) + 1
        return self.kv[key]


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    yield fake


@pytest.fixture(autouse=True)
def mock_campus(monkeypatch):
    """Strict Offline TDD: jangan pernah live hit kampus dari test auth."""
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials",
        AsyncMock(return_value=(True, True)),
    )
    monkeypatch.setattr(
        "app.modules.auth.verify_siakad_login",
        AsyncMock(return_value=True),
    )


@pytest.fixture(autouse=True)
def tmp_sqlite(monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "test_ubsi.db"))
    from app.channels_db import init_db
    from app.api_keys_db import init_api_keys_db

    init_db()
    init_api_keys_db()


def _session_payload(fake_redis: FakeRedis) -> dict:
    raw_values = [v for k, v in fake_redis.kv.items() if k.startswith("ubsi:session:")]
    assert raw_values, "session tidak ditemukan di Redis"
    return _decrypt_payload(raw_values[-1], settings.API_KEY)


async def _login_elearning_only(ac: AsyncClient) -> object:
    with patch(
        "app.modules.auth.verify_live_credentials",
        AsyncMock(return_value=(False, True)),
    ):
        return await ac.post(
            "/v1/auth/login",
            json={"nim": "12345678", "studentv2_pass": "", "elearning_pass": "el_pass"},
        )


@pytest.mark.asyncio
async def test_login_elearning_only_success(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["systems"] == {"siakad": False, "mybest": True}
        assert data["warnings"] == []
        assert "ubsi_session" in res.cookies
        payload = _session_payload(fake_redis)
        assert payload["studentv2_pass"] == ""
        assert payload["elearning_pass"] == "el_pass"


@pytest.mark.asyncio
async def test_login_wrong_siakad_still_success_with_warning(fake_redis):
    """Opsi A: password SIAKAD diisi tapi salah -> login tetap sukses, SIAKAD terkunci."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch(
            "app.modules.auth.verify_live_credentials",
            AsyncMock(return_value=(False, True)),
        ):
            res = await ac.post(
                "/v1/auth/login",
                json={"nim": "12345678", "studentv2_pass": "wrong", "elearning_pass": "el_pass"},
            )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["systems"] == {"siakad": False, "mybest": True}
        assert len(data["warnings"]) == 1
        assert "SIAKAD" in data["warnings"][0]
        # Password salah tidak boleh ikut tersimpan di sesi
        payload = _session_payload(fake_redis)
        assert payload["studentv2_pass"] == ""


@pytest.mark.asyncio
async def test_login_mybest_wrong_returns_401(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch(
            "app.modules.auth.verify_live_credentials",
            AsyncMock(return_value=(True, False)),
        ):
            res = await ac.post(
                "/v1/auth/login",
                json={"nim": "12345678", "studentv2_pass": "sv", "elearning_pass": "wrong"},
            )
        assert res.status_code == 401
        error = res.json()["error"]
        assert error["code"] == "INVALID_CREDENTIALS"
        assert "MyBest" in error["message"]
        assert not [k for k in fake_redis.kv if k.startswith("ubsi:session:")]


@pytest.mark.asyncio
async def test_login_full_credentials_unlocks_siakad(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/v1/auth/login",
            json={"nim": "12345678", "studentv2_pass": "sv_pass", "elearning_pass": "el_pass"},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["systems"] == {"siakad": True, "mybest": True}
        assert data["warnings"] == []
        payload = _session_payload(fake_redis)
        assert payload["studentv2_pass"] == "sv_pass"


@pytest.mark.asyncio
async def test_me_reports_systems_flags(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        me = await ac.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["data"]["systems"] == {"siakad": False, "mybest": True}

        with patch(
            "app.modules.auth.verify_live_credentials",
            AsyncMock(return_value=(True, True)),
        ):
            res2 = await ac.post(
                "/v1/auth/login",
                json={"nim": "12345678", "studentv2_pass": "sv", "elearning_pass": "el"},
            )
        token2 = res2.cookies.get("ubsi_session")
        me2 = await ac.get("/v1/auth/me", headers={"Authorization": f"Bearer {token2}"})
        assert me2.json()["data"]["systems"] == {"siakad": True, "mybest": True}


@pytest.mark.asyncio
async def test_elearning_only_session_locked_on_siakad_endpoint(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        locked = await ac.get(
            "/v1/studentv2/schedule", headers={"Authorization": f"Bearer {token}"}
        )
        assert locked.status_code == 401
        assert locked.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_elearning_only_session_can_use_elearning_endpoint(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        with patch(
            "app.modules.elearning.pooled_elearning_client.fetch_page",
            AsyncMock(return_value=_COURSES_HTML),
        ):
            ok = await ac.get(
                "/v1/elearning/courses", headers={"Authorization": f"Bearer {token}"}
            )
        assert ok.status_code == 200


@pytest.mark.asyncio
async def test_api_key_without_siakad_created_and_resolves(fake_redis):
    """Keputusan #3: API key boleh dibuat tanpa SIAKAD; key tetap resolve, studentv2 tetap 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        auth = {"Authorization": f"Bearer {token}"}

        created = await ac.post("/v1/auth/keys", json={"name": "bot"}, headers=auth)
        assert created.status_code == 200
        plain_key = created.json()["data"]["key"]

        key_auth = {"Authorization": f"Bearer {plain_key}"}
        me = await ac.get("/v1/auth/me", headers=key_auth)
        assert me.status_code == 200
        assert me.json()["data"]["systems"] == {"siakad": False, "mybest": True}

        locked = await ac.get("/v1/studentv2/schedule", headers=key_auth)
        assert locked.status_code == 401

        with patch(
            "app.modules.elearning.pooled_elearning_client.fetch_page",
            AsyncMock(return_value=_COURSES_HTML),
        ):
            ok = await ac.get("/v1/elearning/courses", headers=key_auth)
        assert ok.status_code == 200


@pytest.mark.asyncio
async def test_connect_siakad_credentials_success(fake_redis):
    """Keputusan #2: hubungkan SIAKAD belakangan via POST /v1/auth/credentials."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        auth = {"Authorization": f"Bearer {token}"}

        connected = await ac.post(
            "/v1/auth/credentials",
            json={"system": "siakad", "password": "sv_baru"},
            headers=auth,
        )
        assert connected.status_code == 200
        assert connected.json()["data"]["systems"]["siakad"] is True

        payload = _session_payload(fake_redis)
        assert payload["studentv2_pass"] == "sv_baru"

        me = await ac.get("/v1/auth/me", headers=auth)
        assert me.json()["data"]["systems"] == {"siakad": True, "mybest": True}


@pytest.mark.asyncio
async def test_connect_siakad_wrong_password_rejected(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        auth = {"Authorization": f"Bearer {token}"}

        with patch(
            "app.modules.auth.verify_siakad_login",
            AsyncMock(return_value=False),
        ):
            connected = await ac.post(
                "/v1/auth/credentials",
                json={"system": "siakad", "password": "salah"},
                headers=auth,
            )
        assert connected.status_code == 400
        assert connected.json()["error"]["code"] == "INVALID_CREDENTIALS"
        payload = _session_payload(fake_redis)
        assert payload["studentv2_pass"] == ""


@pytest.mark.asyncio
async def test_connect_credentials_requires_session(fake_redis):
    """API key/master tidak boleh memakai endpoint hubungkan kredensial."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        auth = {"Authorization": f"Bearer {token}"}
        created = await ac.post("/v1/auth/keys", json={"name": "bot"}, headers=auth)
        plain_key = created.json()["data"]["key"]

        denied = await ac.post(
            "/v1/auth/credentials",
            json={"system": "siakad", "password": "sv"},
            headers={"Authorization": f"Bearer {plain_key}"},
        )
        assert denied.status_code == 403


@pytest.mark.asyncio
async def test_connect_credentials_rate_limited(fake_redis):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        auth = {"Authorization": f"Bearer {token}"}
        with patch("app.modules.auth.limiter.is_allowed", AsyncMock(return_value=False)):
            limited = await ac.post(
                "/v1/auth/credentials",
                json={"system": "siakad", "password": "sv"},
                headers=auth,
            )
        assert limited.status_code == 429


@pytest.mark.asyncio
async def test_change_password_siakad_requires_connected(fake_redis):
    """Ganti password SIAKAD ditolak jelas saat SIAKAD belum terhubung."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await _login_elearning_only(ac)
        token = res.cookies.get("ubsi_session")
        auth = {"Authorization": f"Bearer {token}"}

        changed = await ac.post(
            "/v1/auth/password",
            json={"system": "siakad", "current_password": "x", "new_password": "y"},
            headers=auth,
        )
        assert changed.status_code == 400
        assert changed.json()["error"]["code"] == "SYSTEM_NOT_CONNECTED"
