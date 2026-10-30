"""Lupa password lewat Mira. 100% offline (kampus dan Redis di-mock)."""
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.password_reset import (
    CampusResult,
    nim_email_mismatch,
    remember_nim_email,
    request_reset_link,
)
import app.password_reset as password_reset
from tests.test_login_guard import FakeRedis


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("app.login_guard.login_guard._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    return fake


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"_skip_auto_auth": "1"})


# ---------- NIM <-> email ----------

@pytest.mark.asyncio
async def test_campus_email_must_match_nim(fake_redis):
    assert await nim_email_mismatch(fake_redis, "15260767", "15260999@bsi.ac.id")
    assert not await nim_email_mismatch(fake_redis, "15260767", "15260767@BSI.ac.id")


@pytest.mark.asyncio
async def test_known_profile_email_rejects_other_nim(fake_redis):
    await remember_nim_email(fake_redis, "15260767", "Budi@Gmail.com ")
    assert not await nim_email_mismatch(fake_redis, "15260767", "budi@gmail.com")
    assert await nim_email_mismatch(fake_redis, "15260767", "orang.lain@gmail.com")
    assert await nim_email_mismatch(fake_redis, "15269999", "budi@gmail.com")
    # NIM tanpa data: tidak bisa dipastikan, biarkan kampus yang memutuskan.
    assert not await nim_email_mismatch(fake_redis, "15260000", "siapa@gmail.com")
    # Email disimpan sebagai HMAC, bukan teks asli.
    assert "budi@gmail.com" not in str(fake_redis.sets) + str(fake_redis.kv)


@pytest.mark.asyncio
async def test_forgot_password_mismatch_flags_both_fields(fake_redis, monkeypatch):
    called = []
    monkeypatch.setattr("app.modules.auth.request_reset_link", lambda *a: called.append(a))
    async with _client() as ac:
        res = await ac.post("/v1/auth/forgot-password", json={"nim": "15260767", "email": "15260111@bsi.ac.id"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "NIM_EMAIL_MISMATCH"
    assert res.json()["error"]["fields"] == ["nim", "email"]
    assert not called


@pytest.mark.asyncio
async def test_forgot_password_validates_format(fake_redis):
    async with _client() as ac:
        res = await ac.post("/v1/auth/forgot-password", json={"nim": "abc", "email": "budi@gmail.com"})
    assert res.status_code == 422
    assert res.json()["error"]["fields"] == ["nim"]


@pytest.mark.asyncio
async def test_forgot_password_sends_link(fake_redis, monkeypatch):
    calls = []

    def fake_request(system, email):
        calls.append((system, email))
        return CampusResult("sent", "ok")

    monkeypatch.setattr("app.modules.auth.request_reset_link", fake_request)
    async with _client() as ac:
        res = await ac.post(
            "/v1/auth/forgot-password", json={"nim": "15260767", "email": " Budi@Gmail.com", "system": "mybest"}
        )
        again = await ac.post("/v1/auth/forgot-password", json={"nim": "15260767", "email": "budi@gmail.com"})
    assert res.status_code == 200, res.text
    assert res.json()["data"]["expires_in_minutes"] == 60
    assert calls == [("mybest", "budi@gmail.com")]
    assert again.status_code == 429


@pytest.mark.asyncio
async def test_forgot_password_unregistered_email_flags_email(fake_redis, monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.request_reset_link", lambda *a: CampusResult("not_found", "Email ini tidak terdaftar di MyBest.")
    )
    async with _client() as ac:
        res = await ac.post("/v1/auth/forgot-password", json={"nim": "15260767", "email": "budi@gmail.com"})
    assert res.status_code == 404
    assert res.json()["error"]["fields"] == ["email"]


@pytest.mark.asyncio
async def test_forgot_password_shares_ip_blacklist(fake_redis):
    await fake_redis.set("ubsi:login_guard:ban:127.0.0.1", "1", ex=900)
    async with _client() as ac:
        res = await ac.post("/v1/auth/forgot-password", json={"nim": "15260767", "email": "budi@gmail.com"})
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "IP_BLACKLISTED"


# ---------- Interaksi form kampus (client palsu) ----------

FORGOT_PAGE = """<html><body><p class="text-gray-600">Masukkan email terdaftar untuk link reset</p>
<form method="POST" action="https://elearning.bsi.ac.id/forgot-password">
<input type="hidden" name="_token" value="csrf1"><input type="email" name="email"></form></body></html>"""


class _Resp:
    def __init__(self, text, url, status=200, data=None):
        self.text, self.url, self.status_code, self._data = text, url, status, data
        self.is_success = status < 400

    def json(self):
        if self._data is None:
            raise ValueError("bukan json")
        return self._data


def _fake_client(get_html, post_resp, posts):
    class Http:
        def get(self, url, **kw):
            return _Resp(get_html, url)

        def post(self, url, **kw):
            posts.append((url, kw))
            return post_resp

    class Client:
        BASE_URL = "https://elearning.bsi.ac.id"

        def __init__(self, proxy=None):
            pass

        def get_client(self):
            return Http()

        def close(self):
            pass

    return Client


def test_request_reset_link_mybest_success_and_not_found(monkeypatch):
    posts = []
    ok_page = FORGOT_PAGE.replace("<form", '<div class="mb-4 text-green-600">Kami telah mengirim link reset password ke email Anda.</div><form')
    monkeypatch.setitem(password_reset.RESET_SYSTEMS["mybest"], "client", _fake_client(FORGOT_PAGE, _Resp(ok_page, "u"), posts))
    assert request_reset_link("mybest", "budi@gmail.com").status == "sent"
    assert posts[0][1]["data"] == {"_token": "csrf1", "email": "budi@gmail.com"}

    err_page = FORGOT_PAGE.replace("<form", '<ul class="text-red-600"><li>Kami tidak dapat menemukan pengguna dengan alamat email tersebut.</li></ul><form')
    monkeypatch.setitem(password_reset.RESET_SYSTEMS["mybest"], "client", _fake_client(FORGOT_PAGE, _Resp(err_page, "u"), []))
    assert request_reset_link("mybest", "budi@gmail.com").status == "not_found"


def test_request_reset_link_siakad_json(monkeypatch):
    page = "<script>fetch('x',{headers:{'X-CSRF-TOKEN': 'abc123',}})</script>"
    posts = []
    resp = _Resp("", "u", 422, {"errors": {"email": ["Email tidak terdaftar, silahkan konfirmasi ke admin"]}})
    monkeypatch.setitem(password_reset.RESET_SYSTEMS["siakad"], "client", _fake_client(page, resp, posts))
    assert request_reset_link("siakad", "budi@gmail.com").status == "not_found"
    assert posts[0][1]["json"] == {"email": "budi@gmail.com"}
    assert posts[0][1]["headers"]["X-CSRF-TOKEN"] == "abc123"

