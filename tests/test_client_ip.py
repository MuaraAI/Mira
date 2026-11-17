"""Regresi: IP klien di balik Cloudflare harus IP user, bukan IP edge.

Latar belakang: TRUSTED_PROXIES hanya mencocokkan IP persis. Request dari edge
Cloudflare (mis. 104.22.x.x) tidak pernah dianggap proxy tepercaya, sehingga
semua user dibatasi bersama lewat beberapa IP edge.
"""
from types import SimpleNamespace

import pytest

from app import main
from app.config import settings


class _FakeRequest:
    def __init__(self, client_host: str, headers: dict[str, str] | None = None):
        self.client = SimpleNamespace(host=client_host)
        self.headers = {k.lower(): v for k, v in (headers or {}).items()}


@pytest.fixture
def trusted(monkeypatch):
    def _set(value: str) -> None:
        monkeypatch.setattr(settings, "TRUSTED_PROXIES", value)

    return _set


def test_cloudflare_edge_in_cidr_range_uses_cf_connecting_ip(trusted):
    trusted("127.0.0.1,104.16.0.0/13")
    request = _FakeRequest("104.22.222.29", {"CF-Connecting-IP": "203.0.113.7"})

    assert main.extract_client_ip(request) == "203.0.113.7"


def test_direct_client_outside_trusted_ranges_cannot_spoof_header(trusted):
    trusted("127.0.0.1,104.16.0.0/13")
    request = _FakeRequest("198.51.100.9", {"CF-Connecting-IP": "10.0.0.1"})

    assert main.extract_client_ip(request) == "198.51.100.9"


def test_exact_ip_entry_still_supported(trusted):
    trusted("127.0.0.1,10.0.0.5")
    request = _FakeRequest("10.0.0.5", {"X-Real-IP": "192.0.2.4"})

    assert main.extract_client_ip(request) == "192.0.2.4"


def test_invalid_entries_are_ignored(trusted):
    trusted("not-an-ip,104.16.0.0/99,104.16.0.0/13")
    request = _FakeRequest("104.22.222.29", {"CF-Connecting-IP": "203.0.113.7"})

    assert main.extract_client_ip(request) == "203.0.113.7"
