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
        challenge = await captcha_relay.create_challenge("siakad", "12345678")

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
        await captcha_relay.create_challenge("students", "12345678")


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
        challenge = await captcha_relay.create_challenge("elearning", "12345678")

    with patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)):
        first = await consume_challenge(challenge["id"], "elearning", "12345678")
        second = await consume_challenge(challenge["id"], "elearning", "12345678")

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
        challenge = await captcha_relay.create_challenge("siakad", "12345678")

    with patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)):
        wrong_host = await consume_challenge(challenge["id"], "elearning", "12345678")
    with patch.object(captcha_relay.cache, "get_client", AsyncMock(return_value=redis)):
        wrong_nim = await consume_challenge(challenge["id"], "siakad", "99999999")

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
async def test_login_rejects_expired_captcha_challenge():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("app.captcha_relay.consume_challenge", AsyncMock(return_value=None)):
            res = await ac.post(
                "/v1/auth/login",
                json={
                    "nim": "12345678",
                    "elearning_pass": "secret",
                    "captcha_elearning": {"id": "a" * 32, "code": "ABC"},
                },
            )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "CAPTCHA_EXPIRED"


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
