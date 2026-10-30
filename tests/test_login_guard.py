"""Login guard (rate limit IP + blacklist), aktivitas login harian, dan ganti password. 100% offline."""
import time
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.login_guard import BAN_STEPS_SECONDS, LOGIN_IP_LIMIT, LoginGuard, mask_ip
from app.main import app
from app.password_change import (
    ChangeResult,
    change_upstream_password,
    extract_flash_message,
    find_password_form,
    is_default_password,
    validate_new_password,
)


class FakePipeline:
    def __init__(self, redis):
        self.redis = redis
        self.calls = []

    def __getattr__(self, name):
        def queue(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return self
        return queue

    async def execute(self):
        return [await getattr(self.redis, name)(*args, **kwargs) for name, args, kwargs in self.calls]


class FakeRedis:
    """Mini Redis in-memory: string, set, zset, hash, TTL, pipeline."""

    def __init__(self):
        self.kv: dict = {}
        self.sets: dict = {}
        self.zsets: dict = {}
        self.hashes: dict = {}
        self.ttls: dict = {}

    def pipeline(self, transaction=True):
        return FakePipeline(self)

    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, value, ex=None):
        self.kv[key] = value
        if ex:
            self.ttls[key] = ex

    async def delete(self, *keys):
        removed = 0
        for key in keys:
            for store in (self.kv, self.zsets, self.hashes, self.sets):
                if key in store:
                    del store[key]
                    removed += 1
        return removed

    async def expire(self, key, ttl):
        self.ttls[key] = ttl
        return True

    async def ttl(self, key):
        if key not in self.kv and key not in self.hashes:
            return -2
        return self.ttls.get(key, -1)

    async def incr(self, key):
        self.kv[key] = int(self.kv.get(key, 0)) + 1
        return self.kv[key]

    async def sadd(self, key, member):
        self.sets.setdefault(key, set()).add(member)
        return 1

    async def srem(self, key, member):
        self.sets.get(key, set()).discard(member)
        return 1

    async def smembers(self, key):
        return set(self.sets.get(key, set()))

    async def zremrangebyscore(self, key, lo, hi):
        z = self.zsets.get(key, {})
        for m in [m for m, s in z.items() if lo <= s <= hi]:
            del z[m]
        return 0

    async def zadd(self, key, mapping):
        self.zsets.setdefault(key, {}).update(mapping)
        return len(mapping)

    async def zcard(self, key):
        return len(self.zsets.get(key, {}))

    async def hincrby(self, key, field, amount=1):
        h = self.hashes.setdefault(key, {})
        h[field] = str(int(h.get(field, 0)) + amount)
        return int(h[field])

    async def hset(self, key, mapping=None, **kwargs):
        self.hashes.setdefault(key, {}).update(mapping or {})
        return len(mapping or {})

    async def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    async def aclose(self):
        pass


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("app.login_guard.login_guard._client", fake)
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    return fake


@pytest.fixture(autouse=True)
def mock_campus(monkeypatch, tmp_path):
    monkeypatch.setattr("app.modules.auth.verify_live_credentials", AsyncMock(return_value=(True, True)))
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "guard.db"))


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"_skip_auto_auth": "1"})


def _creds(nim="15260767", sv="Mhs-1945", el="rahasia99"):
    return {"nim": nim, "studentv2_pass": sv, "elearning_pass": el}


# ---------- LoginGuard unit ----------

@pytest.mark.asyncio
async def test_guard_allows_up_to_limit_then_blacklists(fake_redis):
    guard = LoginGuard("redis://unused")
    guard._client = fake_redis
    for i in range(LOGIN_IP_LIMIT):
        decision = await guard.check_ip("1.2.3.4")
        assert decision.allowed, f"percobaan ke-{i + 1} harus lolos"
    blocked = await guard.check_ip("1.2.3.4")
    assert not blocked.allowed and blocked.banned
    assert blocked.retry_after == BAN_STEPS_SECONDS[0]
    # Selama blacklist, IP tetap ditolak walau jendela menit sudah reset.
    again = await guard.check_ip("1.2.3.4")
    assert not again.allowed and again.retry_after == BAN_STEPS_SECONDS[0]
    # IP lain tidak terdampak.
    assert (await guard.check_ip("5.6.7.8")).allowed


@pytest.mark.asyncio
async def test_guard_ban_escalates_on_repeat_offense(fake_redis):
    guard = LoginGuard("redis://unused")
    guard._client = fake_redis
    durations = []
    for _ in range(3):
        for _ in range(LOGIN_IP_LIMIT + 1):
            decision = await guard.check_ip("9.9.9.9")
        durations.append(decision.retry_after)
        await fake_redis.delete("ubsi:login_guard:ban:9.9.9.9")
    assert durations == list(BAN_STEPS_SECONDS)


@pytest.mark.asyncio
async def test_guard_window_is_sliding(fake_redis):
    guard = LoginGuard("redis://unused")
    guard._client = fake_redis
    old = time.time() - 120
    fake_redis.zsets["ubsi:login_guard:window:7.7.7.7"] = {f"old{i}": old for i in range(50)}
    assert (await guard.check_ip("7.7.7.7")).allowed


@pytest.mark.asyncio
async def test_guard_fails_open_when_redis_down():
    guard = LoginGuard("redis://unused")
    broken = AsyncMock()
    broken.ttl.side_effect = ConnectionError("down")
    guard._client = broken
    assert (await guard.check_ip("1.1.1.1")).allowed


def test_mask_ip_hides_host_part():
    assert mask_ip("103.10.20.30") == "103.10.*.*"
    assert mask_ip("2001:db8:85a3::8a2e:370:7334").endswith(":****")


# ---------- Endpoint login ----------

@pytest.mark.asyncio
async def test_login_endpoint_blacklists_ip_after_ten_per_minute(fake_redis):
    async with _client() as ac:
        for i in range(LOGIN_IP_LIMIT):
            res = await ac.post("/v1/auth/login", json=_creds(nim=f"1526{i:04d}"))
            assert res.status_code == 200
        res = await ac.post("/v1/auth/login", json=_creds(nim="15269999"))
    assert res.status_code == 429
    err = res.json()["error"]
    assert err["code"] == "IP_BLACKLISTED"
    assert err["retry_after"] == BAN_STEPS_SECONDS[0]
    assert res.headers["retry-after"] == str(BAN_STEPS_SECONDS[0])


@pytest.mark.asyncio
async def test_blacklisted_ip_never_reaches_campus(fake_redis, monkeypatch):
    verify = AsyncMock(return_value=(True, True))
    monkeypatch.setattr("app.modules.auth.verify_live_credentials", verify)
    await fake_redis.set("ubsi:login_guard:ban:127.0.0.1", "1", ex=900)
    async with _client() as ac:
        res = await ac.post("/v1/auth/login", json=_creds())
    assert res.status_code == 429
    verify.assert_not_called()


@pytest.mark.asyncio
async def test_login_reports_default_password_and_counts_today(fake_redis, monkeypatch):
    async with _client() as ac:
        ok = await ac.post("/v1/auth/login", json=_creds())
        assert ok.status_code == 200
        assert ok.json()["data"]["default_password"] == {"siakad": True, "mybest": False}
        token = ok.json()["data"]["token"]

        monkeypatch.setattr("app.modules.auth.verify_live_credentials", AsyncMock(return_value=(False, True)))
        bad = await ac.post("/v1/auth/login", json=_creds(sv="salah"))
        assert bad.status_code == 401

        sec = await ac.get("/v1/auth/security", headers={"Authorization": f"Bearer {token}"})
    assert sec.status_code == 200
    data = sec.json()["data"]
    assert data["logins_today"] == 1
    assert data["failed_today"] == 1
    assert data["default_password"] == {"siakad": True, "mybest": False}
    assert data["last_login_ip"] == "127.0.*.*"


@pytest.mark.asyncio
async def test_security_requires_dashboard_session(fake_redis):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/auth/security")
    assert res.status_code == 403


# ---------- Ganti password ----------

def test_default_password_detection():
    assert is_default_password("Mhs-1945")
    assert is_default_password("Mhs-2026")
    assert not is_default_password("mhs-1945")
    assert not is_default_password("Rahasia2026")


@pytest.mark.parametrize(
    "new,ok",
    [
        ("short1", False),
        ("tanpaangka", False),
        ("12345678", False),
        ("Mhs-2026", False),
        ("Kuat2026x", True),
        ("abc15260767x1", False),
    ],
)
def test_validate_new_password(new, ok):
    assert (validate_new_password("15260767", "Mhs-1945", new) is None) is ok


SIAKAD_FORM = """
<html><body>
<form method="POST" action="https://students.bsi.ac.id/logout"><input type="hidden" name="_token" value="t"></form>
<form method="POST" action="/mahasiswa/password/update">
  <input type="hidden" name="_token" value="csrf123">
  <input type="hidden" name="_method" value="PUT">
  <input type="password" name="password_lama" placeholder="Password Lama">
  <input type="password" name="password_baru" placeholder="Password Baru">
  <input type="password" name="password_baru_confirmation" placeholder="Ulangi Password Baru">
  <button type="submit" name="simpan">Simpan</button>
</form></body></html>
"""


def test_find_password_form_maps_fields_and_keeps_csrf():
    form = find_password_form(SIAKAD_FORM, "https://students.bsi.ac.id/mahasiswa/password")
    assert form is not None
    assert form.action == "https://students.bsi.ac.id/mahasiswa/password/update"
    assert (form.old_field, form.new_field, form.confirm_field) == (
        "password_lama",
        "password_baru",
        "password_baru_confirmation",
    )
    payload = form.payload("Mhs-1945", "Kuat2026x")
    assert payload == {
        "_token": "csrf123",
        "_method": "PUT",
        "password_lama": "Mhs-1945",
        "password_baru": "Kuat2026x",
        "password_baru_confirmation": "Kuat2026x",
    }


def test_find_password_form_laravel_style_without_old_field():
    page = """<form method="post" action="/profil/password">
      <input name="_token" type="hidden" value="x">
      <input name="nama" type="text" value="Budi">
      <input type="password" name="password"><input type="password" name="password_confirmation">
    </form>"""
    form = find_password_form(page, "https://elearning.bsi.ac.id/profil")
    assert (form.old_field, form.new_field, form.confirm_field) == (None, "password", "password_confirmation")
    assert form.fields == {"_token": "x", "nama": "Budi"}


def test_find_password_form_rejects_foreign_action_host():
    page = """<form method="post" action="https://evil.example.com/steal">
      <input type="password" name="old"><input type="password" name="new"></form>"""
    assert find_password_form(page, "https://students.bsi.ac.id/mahasiswa/password") is None


def test_find_password_form_none_when_absent():
    assert find_password_form("<form><input type='password' name='password'></form>", "https://x.id/") is None


def test_extract_flash_message():
    page = '<div class="alert alert-danger">Password lama salah</div>'
    assert extract_flash_message(page) == "Password lama salah"


class _Resp:
    def __init__(self, text, url):
        self.text = text
        self.url = url


class _Http:
    def __init__(self, log):
        self.log = log

    def get(self, url, **kw):
        return _Resp(SIAKAD_FORM, url)

    def post(self, url, data=None, **kw):
        self.log.append((url, data))
        return _Resp('<div class="alert alert-success">Password berhasil diubah</div>', url)


def _fake_client_cls(valid_passwords, posts):
    class FakeClient:
        BASE_URL = "https://students.bsi.ac.id"

        def __init__(self, proxy=None):
            pass

        def login(self, nim, password):
            return password in valid_passwords

        def get_client(self):
            return _Http(posts)

        def close(self):
            pass

    return FakeClient


def test_change_upstream_password_verified_by_real_relogin(monkeypatch):
    posts = []
    valid = {"Mhs-1945"}
    cls = _fake_client_cls(valid, posts)
    original_post = _Http.post

    def post_and_apply(self, url, data=None, **kw):
        valid.clear()
        valid.add(data["password_baru"])
        return original_post(self, url, data=data, **kw)

    monkeypatch.setattr(_Http, "post", post_and_apply)
    monkeypatch.setitem(__import__("app.password_change", fromlist=["SYSTEMS"]).SYSTEMS["siakad"], "client", cls)
    result = change_upstream_password("siakad", "15260767", "Mhs-1945", "Kuat2026x")
    assert result.status == "changed"
    assert posts[0][1]["password_lama"] == "Mhs-1945"


def test_change_upstream_password_rejected_when_new_login_fails(monkeypatch):
    posts = []
    cls = _fake_client_cls({"Mhs-1945"}, posts)
    monkeypatch.setitem(__import__("app.password_change", fromlist=["SYSTEMS"]).SYSTEMS["siakad"], "client", cls)
    result = change_upstream_password("siakad", "15260767", "Mhs-1945", "Kuat2026x")
    assert result.status == "rejected"
    assert len(posts) == 1


@pytest.mark.asyncio
async def test_change_password_endpoint_updates_session(fake_redis, monkeypatch):
    calls = []

    def fake_change(system, nim, old, new):
        calls.append((system, nim, old, new))
        return ChangeResult("changed", "Password SIAKAD berhasil diganti")

    monkeypatch.setattr("app.modules.auth.change_upstream_password", fake_change)
    async with _client() as ac:
        token = (await ac.post("/v1/auth/login", json=_creds())).json()["data"]["token"]
        headers = {"Authorization": f"Bearer {token}"}

        mismatch = await ac.post(
            "/v1/auth/password",
            headers=headers,
            json={"system": "siakad", "current_password": "salah", "new_password": "Kuat2026x"},
        )
        assert mismatch.status_code == 400
        assert mismatch.json()["error"]["code"] == "CURRENT_PASSWORD_MISMATCH"

        weak = await ac.post(
            "/v1/auth/password",
            headers=headers,
            json={"system": "siakad", "current_password": "Mhs-1945", "new_password": "Mhs-2026"},
        )
        assert weak.status_code == 422
        assert not calls

        res = await ac.post(
            "/v1/auth/password",
            headers=headers,
            json={"system": "siakad", "current_password": "Mhs-1945", "new_password": "Kuat2026x"},
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["sessions_updated"] == 1
        assert calls == [("siakad", "15260767", "Mhs-1945", "Kuat2026x")]

        sec = await ac.get("/v1/auth/security", headers=headers)
    assert sec.json()["data"]["default_password"] == {"siakad": False, "mybest": False}


@pytest.mark.asyncio
async def test_change_password_endpoint_surfaces_upstream_rejection(fake_redis, monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.change_upstream_password",
        lambda *a: ChangeResult("rejected", "Password lama salah"),
    )
    async with _client() as ac:
        token = (await ac.post("/v1/auth/login", json=_creds())).json()["data"]["token"]
        res = await ac.post(
            "/v1/auth/password",
            headers={"Authorization": f"Bearer {token}"},
            json={"system": "siakad", "current_password": "Mhs-1945", "new_password": "Kuat2026x"},
        )
    assert res.status_code == 400
    assert res.json()["error"] == {"code": "PASSWORD_REJECTED", "message": "Password lama salah", "module": "auth"}
