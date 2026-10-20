"""Sesi SIAKAD/MyBest yang kedaluwarsa (~15 menit) harus dipulihkan otomatis tanpa relogin user."""
import threading
import time

import httpx
import pytest
from fastapi import HTTPException

from app.modules.elearning import ElearningClient
from app.modules.studentv2 import StudentV2Client
from app.upstream_session import UpstreamSession, is_logged_out_response


class FakeUpstream(UpstreamSession):
    BASE_URL = "https://kampus.test"
    MODULE = "test"
    HOST_LABEL = "kampus.test"

    def __init__(self, handler, login_ok=True, login_delay=0.0):
        self._logged_in = False
        self._init_upstream_session()
        self.login_calls = 0
        self._login_ok = login_ok
        self._login_delay = login_delay
        self.server_session_alive = False
        self._client = httpx.Client(transport=httpx.MockTransport(handler(self)), follow_redirects=True)

    def get_client(self):
        return self._client

    def login(self, nim, password):
        self.login_calls += 1
        time.sleep(self._login_delay)
        self.server_session_alive = self._login_ok
        return self._login_ok


def campus_server(client):
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/login":
            return httpx.Response(200, html='<form action="https://kampus.test/login"><input name="password"></form>')
        if not client.server_session_alive:
            return httpx.Response(302, headers={"location": "https://kampus.test/login"})
        return httpx.Response(200, html="<p>data kuliah</p>")

    return handle


def test_expired_upstream_session_relogs_in_automatically():
    up = FakeUpstream(campus_server)
    assert up.authed_request("GET", "/jadwal", "152", "pw").text == "<p>data kuliah</p>"
    assert up.login_calls == 1

    up.server_session_alive = False  # server kampus mengakhiri sesi setelah 15 menit
    assert up.authed_request("GET", "/jadwal", "152", "pw").text == "<p>data kuliah</p>"
    assert up.login_calls == 2


def test_session_refreshed_before_upstream_limit(monkeypatch):
    up = FakeUpstream(campus_server)
    up.authed_request("GET", "/jadwal", "152", "pw")
    assert up.login_calls == 1

    up._login_at -= 14 * 60  # sesi sudah berumur 14 menit
    up.authed_request("GET", "/jadwal", "152", "pw")
    assert up.login_calls == 2


def test_parallel_requests_share_one_relogin():
    up = FakeUpstream(campus_server, login_delay=0.05)
    results: list[str] = []

    def worker():
        results.append(up.authed_request("GET", "/jadwal", "152", "pw").text)

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results == ["<p>data kuliah</p>"] * 8
    assert up.login_calls == 1


def test_failed_relogin_reports_auth_expired():
    up = FakeUpstream(campus_server)
    up.authed_request("GET", "/jadwal", "152", "pw")
    up._login_ok = False
    up.server_session_alive = False
    with pytest.raises(HTTPException) as exc:
        up.authed_request("GET", "/jadwal", "152", "pw")
    assert exc.value.detail["error"]["code"] == "AUTH_EXPIRED"


@pytest.mark.parametrize(
    "status_code,url,body,expected",
    [
        (200, "https://kampus.test/login", "", True),
        (419, "https://kampus.test/assignment", "Page Expired", True),
        (401, "https://kampus.test/api", "{}", True),
        (200, "https://kampus.test/sch", '<form action="https://kampus.test/login"><input name="password"></form>', True),
        (200, "https://kampus.test/sch", '<form action="/logout"></form><p>Jadwal</p>', False),
    ],
)
def test_logged_out_detection(status_code, url, body, expected):
    resp = httpx.Response(status_code, html=body, request=httpx.Request("GET", url))
    assert is_logged_out_response(resp) is expected


def test_binary_download_is_not_mistaken_for_login_page():
    resp = httpx.Response(
        200,
        content=b"%PDF-1.7 name=\"password\" action=\"/login\"",
        headers={"content-type": "application/pdf"},
        request=httpx.Request("GET", "https://kampus.test/file.pdf"),
    )
    assert is_logged_out_response(resp) is False


@pytest.mark.parametrize("cls", [StudentV2Client, ElearningClient])
def test_campus_clients_use_upstream_session(cls):
    client = cls()
    assert isinstance(client, UpstreamSession)
    client._mark_logged_in()
    assert client._session_is_fresh()
