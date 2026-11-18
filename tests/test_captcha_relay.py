"""Relay CAPTCHA kampus: pembuatan tantangan, penyimpanan sesi, dan endpoint.

Kampus mewajibkan CAPTCHA gambar sehingga backend tidak bisa login sendiri.
Relay menyimpan cookie + `_token` sesi login dan memakainya kembali saat user
mengirim kode CAPTCHA. Semua test di sini offline (Iron Rule #2).
"""
import json
from unittest.mock import AsyncMock, patch

import pytest
import httpx
from httpx import ASGITransport, AsyncClient

from app import captcha_relay
from app.captcha_relay import CAPTCHA_TTL_SECONDS, _extract_data_uri, consume_challenge
from app.main import app


class _Cookies:
    def __init__(self):
        self._data: dict[str, str] = {}

    def set(self, name, value):
        self._data[name] = value

    def clear(self):
        self._data.clear()

    def items(self):
        return self._data.items()

    def keys(self):
        return self._data.keys()

    def __getitem__(self, name):
        return self._data[name]


class _FakeUpstreamClient:
    """Client httpx palsu dengan cookie in-memory dan respons terjadwal."""

    def __init__(self, responses):
        self.cookies = _Cookies()
        self._responses = list(responses)
        self.urls: list[str] = []

    def set(self, name: str, value: str) -> None:
        self.cookies.set(name, value)

    def get(self, url: str, follow_redirects: bool = False):
        self.urls.append(url)
        resp = self._responses.pop(0) if len(self._responses) > 1 else self._responses[0]
        return resp


def _response(text: str = "", status_code: int = 200):
    return httpx.Response(
        status_code=status_code,
        text=text,
        headers={"content-type": "text/html"},
        request=httpx.Request("GET", "https://fake.bsi.ac.id/beranda"),
    )
PNG_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="


class FakeRedis:
    def __init__(self):
        self.kv: dict[str, str] = {}
        self.ttls: dict[str, int] = {}
        self.deleted: list[str] = []

    async def setex(self, key, ttl, value):
        self.kv[key] = value
        self.ttls[key] = ttl

    async def get(self, key):
        return self.kv.get(key)

    async def delete(self, key):
        self.deleted.append(key)
        self.kv.pop(key, None)

    async def getdel(self, key):
        value = self.kv.pop(key, None)
        if value is not None:
            self.deleted.append(key)
        return value

    async def eval(self, script, numkeys, key):
        return await self.getdel(key)
    async def set(self, key, value, ex=None):
        self.kv[key] = value

    async def sadd(self, key, member):
        self.kv.setdefault(key, set()).add(member)
        return 1

    async def expire(self, key, ttl):
        return key in self.kv

    async def ping(self):
        return True


def test_extract_data_uri_from_siakad_payload():
    assert _extract_data_uri({"image": PNG_URI}) == PNG_URI


def test_extract_data_uri_from_elearning_svg_payload():
    payload = {"svg": f'<img src="{PNG_URI}" alt="captcha">'}
    assert _extract_data_uri(payload) == PNG_URI


def test_extract_data_uri_rejects_payload_without_image():
    with pytest.raises(ValueError):
        _extract_data_uri({"status": "ok"})


@pytest.mark.asyncio
async def test_create_challenge_stores_session_in_redis():
    redis = FakeRedis()
    stored = {
        "host": "siakad",
        "nim": "12345678",
        "token": "tok-123",
        "cookies": {"s_i_a_k_d": "abc"},
        "image": PNG_URI,
    }
    with (
        patch.object(captcha_relay, "_fetch_challenge_sync", return_value=stored),
        patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)),
    ):
        challenge = await captcha_relay.create_challenge("siakad", "12345678", nonce="nonce-1")

    assert challenge["host"] == "siakad"
    assert challenge["image"] == PNG_URI
    assert challenge["expires_in"] == CAPTCHA_TTL_SECONDS
    assert len(challenge["id"]) == 32

    key = f"ubsi:captcha:{challenge['id']}"
    assert redis.ttls[key] == CAPTCHA_TTL_SECONDS
    saved = json.loads(redis.kv[key])
    assert saved["token"] == "tok-123"
    assert saved["cookies"] == {"s_i_a_k_d": "abc"}


@pytest.mark.asyncio
async def test_create_challenge_rejects_unknown_host():
    with pytest.raises(ValueError):
        await captcha_relay.create_challenge("students", "12345678", nonce="nonce-1")


@pytest.mark.asyncio
async def test_consume_challenge_is_single_use():
    redis = FakeRedis()
    with (
        patch.object(captcha_relay, "_fetch_challenge_sync", return_value={
            "host": "elearning",
            "nim": "12345678",
            "token": "tok-el",
            "cookies": {"laravel": "xyz"},
            "image": PNG_URI,
        }),
        patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)),
    ):
        challenge = await captcha_relay.create_challenge("elearning", "12345678", nonce="nonce-2")

    with patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)):
        first = await consume_challenge(challenge["id"], "elearning", "12345678", nonce="nonce-2")
        second = await consume_challenge(challenge["id"], "elearning", "12345678", nonce="nonce-2")

    assert first is not None and first["token"] == "tok-el"
    assert second is None  # sekali pakai


@pytest.mark.asyncio
async def test_consume_challenge_rejects_host_or_nim_mismatch():
    redis = FakeRedis()
    with (
        patch.object(captcha_relay, "_fetch_challenge_sync", return_value={
            "host": "siakad",
            "nim": "12345678",
            "token": "tok",
            "cookies": {"c": "1"},
            "image": PNG_URI,
        }),
        patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)),
    ):
        challenge = await captcha_relay.create_challenge("siakad", "12345678", nonce="nonce-3")

    with patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)):
        wrong_host = await consume_challenge(challenge["id"], "elearning", "12345678", nonce="nonce-3")
    with patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)):
        wrong_nim = await consume_challenge(challenge["id"], "siakad", "99999999", nonce="nonce-3")

    assert wrong_host is None
    assert wrong_nim is None


@pytest.mark.asyncio
async def test_captcha_endpoint_returns_challenge():
    payload = {
        "id": "a" * 32,
        "host": "elearning",
        "label": "MyBest",
        "image": PNG_URI,
        "expires_in": CAPTCHA_TTL_SECONDS,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("app.captcha_relay.create_challenge", AsyncMock(return_value=payload)):
            res = await ac.post(
                "/v1/auth/captcha", json={"nim": "12345678", "host": "elearning"}
            )
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["host"] == "elearning"
    assert body["data"]["image"].startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_captcha_endpoint_reports_upstream_failure():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch(
            "app.captcha_relay.create_challenge", AsyncMock(side_effect=ValueError("no token"))
        ):
            res = await ac.post("/v1/auth/captcha", json={"nim": "12345678", "host": "siakad"})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "CAPTCHA_UNAVAILABLE"


@pytest.mark.asyncio
async def test_login_fallback_issues_new_captcha_when_expired():
    """Challenge kampus kedaluwarsa di fallback: server terbitkan captcha baru."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with (
            patch("app.mira_captcha.verify_challenge", AsyncMock(return_value=True)),
            patch("app.captcha_relay.consume_challenge", AsyncMock(return_value=None)),
            patch(
                "app.captcha_relay.create_challenge",
                AsyncMock(
                    return_value={
                        "id": "f" * 32,
                        "image": "data:image/png;base64,AAA",
                        "label": "MyBest",
                        "expires_in": 300,
                    }
                ),
            ),
        ):
            res = await ac.post(
                "/v1/auth/login",
                json={
                    "nim": "12345678",
                    "elearning_pass": "secret",
                    "mira_captcha": {"id": "m" * 32, "code": "ABCD"},
                    "campus_captcha": {"id": "a" * 32, "code": "ABC"},
                },
            )
    assert res.status_code == 401
    error = res.json()["error"]
    assert error["code"] == "AUTH_CAPTCHA_REQUIRED"
    assert error["fallback_captcha"]["host"] == "elearning"
    assert error["fallback_captcha"]["id"] == "f" * 32


@pytest.mark.asyncio
async def test_ensure_session_restores_persisted_cookies():
    """Cookie tersimpan harus dipakai tanpa login baru (penyebab CAPTCHA)."""
    from app.upstream_session import UpstreamSession

    class _Probe(UpstreamSession):
        BASE_URL = "https://fake.bsi.ac.id"
        MODULE = "probe_restore"
        HOST_LABEL = "fake"
        PROBE_PATH = "/beranda"

        def __init__(self, probe_html: str):
            self._http = _FakeUpstreamClient([_response(text=probe_html)])
            self._logged_in = False
            self.login_calls = 0
            self._init_upstream_session()

        def get_client(self):
            return self._http

        def login(self, nim, password, captcha=None, session=None):
            self.login_calls += 1
            return False

    from app import campus_session_store

    saved = {}
    with (
        patch.object(campus_session_store, "load_cookies", lambda m, n: {"sess": "abc"}),
        patch.object(campus_session_store, "store_cookies", lambda m, n, c: saved.update({n: c})),
        patch.object(campus_session_store, "drop_cookies", lambda m, n: None),
    ):
        client = _Probe(probe_html="<html>beranda mahasiswa</html>")
        assert client.ensure_session("12345678", "secret") is True
        assert client.login_calls == 0  # tanpa login baru
        assert saved.get("12345678") == {"sess": "abc"}

        client_invalid = _Probe(probe_html="")
        with patch.object(
            campus_session_store,
            "load_cookies",
            lambda m, n: {"sess": "abc"},
        ):
            with patch(
                "app.upstream_session.is_logged_out_response", lambda r: True
            ):
                assert client_invalid.ensure_session("12345678", "secret") is False


@pytest.mark.asyncio
async def test_challenge_nonce_only_consumed_by_matching_cookie():
    redis = FakeRedis()
    stored = {
        "host": "elearning",
        "nim": "12345678",
        "token": "tok-el",
        "cookies": {"laravel_session": "xyz"},
        "image": PNG_URI,
    }
    with (
        patch.object(captcha_relay, "_fetch_challenge_sync", return_value=stored),
        patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)),
    ):
        wrong_challenge = await captcha_relay.create_challenge("elearning", "12345678", nonce="nonce-abc")
        right_challenge = await captcha_relay.create_challenge("elearning", "12345678", nonce="nonce-abc")

    with patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)):
        wrong = await consume_challenge(wrong_challenge["id"], "elearning", "12345678", nonce="nonce-salah")
        right = await consume_challenge(right_challenge["id"], "elearning", "12345678", nonce="nonce-abc")

    assert wrong is None
    assert right is not None and right["token"] == "tok-el"


@pytest.mark.asyncio
async def test_captcha_endpoint_sets_nonce_cookie():
    payload = {
        "id": "b" * 32,
        "host": "elearning",
        "label": "MyBest",
        "image": PNG_URI,
        "expires_in": CAPTCHA_TTL_SECONDS,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch(
            "app.captcha_relay.create_challenge", AsyncMock(return_value=payload)
        ) as create:
            res = await ac.post("/v1/auth/captcha", json={"nim": "12345678", "host": "elearning"})

    assert res.status_code == 200
    assert len(res.cookies.get("ubsi_captcha_elearning") or "") >= 16
    assert create.await_args.kwargs["nonce"] == res.cookies.get("ubsi_captcha_elearning")


@pytest.mark.asyncio
async def test_login_requires_nonce_cookie_from_captcha_endpoint(monkeypatch, tmp_path):
    from types import SimpleNamespace

    redis = FakeRedis()
    challenge_payload = json.dumps(
        {
            "host": "elearning",
            "nim": "12345678",
            "token": "tok-el",
            "cookies": {"laravel_session": "xyz"},
            "nonce": "nonce-abc",
        }
    )
    redis.kv["ubsi:captcha:" + "c" * 32] = challenge_payload
    redis.kv["ubsi:captcha:" + "d" * 32] = challenge_payload
    monkeypatch.setattr("app.captcha_relay.cache.get_client", AsyncMock(return_value=redis))
    monkeypatch.setattr("app.session_store.session_store._client", redis)
    monkeypatch.setattr("app.limiter.limiter.is_allowed", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.login_guard.login_guard.check_ip",
        AsyncMock(return_value=SimpleNamespace(allowed=True, retry_after=0)),
    )
    monkeypatch.setattr("app.login_guard.login_guard.record_attempt", AsyncMock())
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "ubsi.db"))
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials", AsyncMock(return_value=(False, True))
    )
    monkeypatch.setattr("app.mira_captcha.verify_challenge", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.captcha_relay.create_challenge",
        AsyncMock(
            return_value={
                "id": "f" * 32,
                "image": "data:image/png;base64,AAA",
                "label": "MyBest",
                "expires_in": 300,
            }
        ),
    )
    monkeypatch.setattr("app.modules.news.news_client.fetch_posts", lambda *a, **k: [])
    monkeypatch.setattr("app.modules.news.news_client.fetch_post_detail", lambda *a, **k: {})
    from app.channels_db import init_db

    init_db()

    body = {
        "nim": "12345678",
        "studentv2_pass": "",
        "elearning_pass": "el_pass",
        "mira_captcha": {"id": "m" * 32, "code": "abcd"},
        "campus_captcha": {"id": "c" * 32, "code": "abc"},
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        no_cookie = await ac.post("/v1/auth/login", json=body)
        ac.cookies.set("ubsi_captcha_elearning", "nonce-abc")
        with_cookie = await ac.post(
            "/v1/auth/login",
            json={**body, "campus_captcha": {"id": "d" * 32, "code": "abc"}},
        )

    assert no_cookie.status_code == 401
    assert no_cookie.json()["error"]["code"] == "AUTH_CAPTCHA_REQUIRED"
    assert with_cookie.status_code == 200
