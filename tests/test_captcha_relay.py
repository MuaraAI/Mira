"""Ambil tantangan CAPTCHA kampus untuk OCR: parsing gambar dan restore sesi.

CAPTCHA kini diselesaikan OCR di server (lihat app/captcha_autosolver.py), jadi
relay hanya membuka sesi login kampus dan mengambil gambar. Semua test di sini
offline (Iron Rule #2).
"""
from unittest.mock import patch

import httpx
import pytest

from app.captcha_relay import _extract_data_uri
from app.main import app  # noqa: F401  (memastikan app import bersih)


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
