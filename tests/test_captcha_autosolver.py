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
