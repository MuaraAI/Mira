"""Cookie sesi kampus wajib berdomain, bukan host-only.

Bug produksi Nov 2026: `client.cookies.set(name, value)` menyimpan entri
host-only, lalu Set-Cookie kampus menambah entri berdomain. Dua cookie bernama
sama terkirim pada request berikutnya; Laravel memakai yang lama (sesi belum
login) sehingga login terbaca gagal CAPTCHA walau kode dan password benar.
"""
import httpx

from app.modules.elearning import ElearningClient
from app.upstream_session import apply_session_cookies

_BASE = "https://elearning.bsi.ac.id"


def test_apply_session_cookies_replaces_host_only_duplicates():
    client = httpx.Client(base_url=_BASE)
    client.cookies.set("mybest_session", "lama")  # host-only, penyebab duplikat

    apply_session_cookies(client, {"mybest_session": "baru", "XSRF-TOKEN": "x"}, _BASE)

    entries = [(c.name, c.domain, c.value) for c in client.cookies.jar]
    assert entries == [
        ("mybest_session", "elearning.bsi.ac.id", "baru"),
        ("XSRF-TOKEN", "elearning.bsi.ac.id", "x"),
    ]
    # Hanya satu nilai per nama yang dikirim pada request berikutnya.
    request = client.build_request("GET", _BASE + "/user/dashboard")
    assert request.headers["cookie"].count("mybest_session=") == 1


def test_login_with_relay_session_sets_domain_cookies(monkeypatch):
    client = ElearningClient()
    fake = _FakeHttpClient()
    client._client = fake
    monkeypatch.setattr(client, "_persist_cookies", lambda nim: None)

    ok = client.login(
        "12345678",
        "rahasia",
        captcha="FPW",
        session={"cookies": {"mybest_session": "sesi-kampus"}, "token": "tok"},
    )

    assert ok is True
    assert [(c.name, c.domain) for c in fake.cookies.jar] == [
        ("mybest_session", "elearning.bsi.ac.id")
    ]


class _FakeHttpClient:
    is_closed = False

    def __init__(self):
        self.cookies = httpx.Cookies()
        self.posted = []

    def post(self, url, data=None, **kwargs):
        self.posted.append(dict(data or {}))
        return httpx.Response(
            200,
            text="<html>dashboard</html>",
            request=httpx.Request("POST", url),
        )
