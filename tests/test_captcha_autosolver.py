"""Tes kandidat CAPTCHA: ambil tantangan + OCR, tanpa probe validasi."""
import base64
from unittest.mock import patch

import pytest

from app.captcha_autosolver import MAX_CANDIDATES_PER_CHALLENGE, candidate_session, fetch_candidates

_PNG = base64.b64encode(b"fake-png-bytes").decode("ascii")


def _challenge(host="siakad", nim="12345678"):
    return {
        "host": host,
        "nim": nim,
        "token": "tok",
        "cookies": {"mybest_session": "xyz"},
        "image": f"data:image/png;base64,{_PNG}",
    }


@pytest.mark.asyncio
async def test_candidate_session_returns_top_candidates_without_probe():
    with patch("app.captcha_autosolver._fetch_challenge_sync", lambda host, nim: _challenge()), patch(
        "app.captcha_autosolver.ocr_candidates",
        lambda png: ["A1B", "C2D", "E3F", "G4H", "I5J"],
    ):
        session, candidates = await candidate_session("siakad", "12345678")

    assert session == {"cookies": {"mybest_session": "xyz"}, "token": "tok"}
    assert candidates == ["A1B", "C2D", "E3F", "G4H"][:MAX_CANDIDATES_PER_CHALLENGE]


@pytest.mark.asyncio
async def test_candidate_session_empty_candidates_still_returns_new_challenge():
    with patch("app.captcha_autosolver._fetch_challenge_sync", lambda host, nim: _challenge()), patch(
        "app.captcha_autosolver.ocr_candidates",
        lambda png: [],
    ):
        session, candidates = await candidate_session("siakad", "12345678")

    assert session["token"] == "tok"
    assert candidates == []


@pytest.mark.asyncio
async def test_fetch_candidates_hits_new_challenge_once():
    calls = []

    def fetch(host, nim):
        calls.append((host, nim))
        return _challenge(host, nim)

    with patch("app.captcha_autosolver._fetch_challenge_sync", fetch), patch(
        "app.captcha_autosolver.ocr_candidates",
        lambda png: ["BENAR"],
    ):
        session, candidates = await fetch_candidates("siakad", "15260767")

    assert calls == [("siakad", "15260767")]
    assert candidates == ["BENAR"]
    assert session["cookies"] == {"mybest_session": "xyz"}


@pytest.mark.asyncio
async def test_unknown_host_rejected():
    with pytest.raises(ValueError):
        await candidate_session("host-asal", "12345678")


def test_ocr_skips_tesseract_when_ddddocr_succeeds(monkeypatch):
    """Jalur cepat: ddddocr berhasil berarti tesseract tidak dijalankan sama sekali."""
    import subprocess as sp

    from app import captcha_autosolver

    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd[0])

        class R:
            stdout = "ZZ\n"

        return R()

    monkeypatch.setattr(sp, "run", fake_run)
    monkeypatch.setattr(captcha_autosolver, "_ddddocr_candidate", lambda png: ["AB12"])

    candidates = captcha_autosolver.ocr_candidates(b"fake-png")

    assert candidates == ["AB12"]
    assert calls == []


def test_ocr_falls_back_to_tesseract_when_ddddocr_missing(monkeypatch):
    import subprocess as sp

    from app import captcha_autosolver

    class FakeRun:
        def __init__(self, stdout=""):
            self.stdout = stdout

    monkeypatch.setattr(sp, "run", lambda cmd, **kw: FakeRun("QN5\n" if cmd[0] == "tesseract" else ""))
    monkeypatch.setattr(captcha_autosolver, "_ddddocr_candidate", lambda png: [])

    candidates = captcha_autosolver.ocr_candidates(b"fake-png")
    assert candidates[0] == "QN5"


def test_ocr_prefers_four_char_candidate_over_non_four_char_ddddocr(monkeypatch):
    """Jika ddddocr tidak menghasilkan 4 karakter, tesseract mencari kandidat 4 karakter."""
    import subprocess as sp

    from app import captcha_autosolver

    class FakeRun:
        def __init__(self, stdout=""):
            self.stdout = stdout

    monkeypatch.setattr(sp, "run", lambda cmd, **kw: FakeRun("Z9X8\n" if cmd[0] == "tesseract" else ""))
    monkeypatch.setattr(captcha_autosolver, "_ddddocr_candidate", lambda png: ["A1B"])

    candidates = captcha_autosolver.ocr_candidates(b"fake-png")
    assert candidates[0] == "Z9X8"
    assert "A1B" in candidates


def test_studentv2_login_uses_ocr_on_captcha_page(monkeypatch):
    """StudentV2Client.login() dengan captcha=None otomatis menjalankan OCR CAPTCHA."""
    from types import SimpleNamespace
    from app.modules.studentv2 import StudentV2Client

    captcha_login_html = '<form action="/login"><input name="_token" value="tok1"><input name="captcha"></form>'
    captcha_err_html = '<form action="/login"><div class="alert">Kode CAPTCHA tidak valid</div><input name="captcha"></form>'

    posts = []
    challenges = [
        ({"cookies": {"c": "1"}, "token": "t1"}, ["WRNG"]),
        ({"cookies": {"c": "2"}, "token": "t2"}, ["GOOD"]),
    ]

    class FakeHttp:
        is_closed = False

        def __init__(self):
            self.cookies = None

        def get(self, url):
            return SimpleNamespace(status_code=200, text=captcha_login_html, url=url)

        def post(self, url, data=None):
            posts.append(data)
            if data and data.get("captcha") == "GOOD":
                return SimpleNamespace(status_code=200, text="<html>Beranda</html>", url="https://students.bsi.ac.id/mahasiswa/beranda")
            return SimpleNamespace(status_code=200, text=captcha_err_html, url=url)

    monkeypatch.setattr("app.captcha_autosolver.candidate_session_sync", lambda host, nim: challenges.pop(0))

    client = StudentV2Client()
    fake_http = FakeHttp()
    monkeypatch.setattr(client, "get_client", lambda: fake_http)
    monkeypatch.setattr(client, "_mark_logged_in", lambda nim=None: None)

    assert client.login("12345678", "password-dummy") is True
    assert [p["captcha"] for p in posts] == ["WRNG", "GOOD"]


def test_studentv2_login_ocr_stops_on_credentials_rejection(monkeypatch):
    from types import SimpleNamespace
    from app.modules.studentv2 import StudentV2Client

    captcha_login_html = '<form action="/login"><input name="_token" value="tok1"><input name="captcha"></form>'
    bad_pw_html = '<form action="/login"><div class="text-danger">These credentials do not match our records.</div><input name="captcha"></form>'
    calls = 0

    class FakeHttp:
        is_closed = False

        def __init__(self):
            self.cookies = None

        def get(self, url):
            return SimpleNamespace(status_code=200, text=captcha_login_html, url=url)

        def post(self, url, data=None):
            return SimpleNamespace(status_code=200, text=bad_pw_html, url=url)

    def fake_challenge(host, nim):
        nonlocal calls
        calls += 1
        return ({"cookies": {"c": "1"}, "token": "t1"}, ["GOOD"])

    relink_calls = []
    monkeypatch.setattr("app.captcha_autosolver.candidate_session_sync", fake_challenge)
    monkeypatch.setattr("app.modules.studentv2._mark_siakad_link_needs_relink", lambda nim, pw="": relink_calls.append(nim))

    client = StudentV2Client()
    fake_http = FakeHttp()
    monkeypatch.setattr(client, "get_client", lambda: fake_http)

    assert client.login("12345678", "password-salah") is False
    assert calls == 1
    assert client._login_failure == "credentials"
    assert relink_calls == ["12345678"]
