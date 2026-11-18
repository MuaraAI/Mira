"""Tes auto-solver CAPTCHA kampus: kandidat OCR + probe validasi + retry."""
import base64
from unittest.mock import Mock, patch

import pytest

from app.captcha_autosolver import solve_campus_captcha

_PNG = base64.b64encode(b"fake-png-bytes").decode("ascii")


def _fake_challenge_data():
    return {
        "host": "elearning",
        "nim": "12345678",
        "token": "tok",
        "cookies": {"mybest_session": "xyz"},
        "image": f"data:image/png;base64,{_PNG}",
    }


@pytest.fixture
def fetch_counter():
    return {"count": 0}


@pytest.fixture
def patch_fetch(fetch_counter):
    def _factory():
        def _fetch(host, nim):
            fetch_counter["count"] += 1
            return _fake_challenge_data()

        return patch("app.captcha_autosolver._fetch_challenge_sync", _fetch)

    return _factory


@pytest.mark.asyncio
async def test_first_valid_candidate_returns_session_and_code(patch_fetch):
    with patch_fetch(), patch(
        "app.captcha_autosolver.ocr_candidates",
        lambda png: ["SALAH", "BENAR"],
    ), patch(
        "app.captcha_autosolver._probe_elearning",
        Mock(side_effect=[(False, "captcha"), (True, "credentials")]),
    ):
        result = await solve_campus_captcha("elearning", "12345678")
    assert result is not None
    session, code = result
    assert code == "BENAR"
    assert session["token"] == "tok"
    assert session["cookies"] == {"mybest_session": "xyz"}


@pytest.mark.asyncio
async def test_all_candidates_wrong_fetches_new_challenge(patch_fetch, fetch_counter):
    with patch_fetch(), patch(
        "app.captcha_autosolver.ocr_candidates",
        lambda png: ["SALAH"],
    ), patch(
        "app.captcha_autosolver._probe_elearning",
        Mock(return_value=(False, "captcha")),
    ):
        result = await solve_campus_captcha("elearning", "12345678")
    assert result is None
    # MAX_CHALLENGES = 5: kampus diambil ulang 5 kali sebelum menyerah
    assert fetch_counter["count"] == 5


@pytest.mark.asyncio
async def test_throttled_stops_entire_loop(patch_fetch, fetch_counter):
    with patch_fetch(), patch(
        "app.captcha_autosolver.ocr_candidates",
        lambda png: ["SALAH"],
    ), patch(
        "app.captcha_autosolver._probe_elearning",
        Mock(return_value=(False, "throttled")),
    ):
        result = await solve_campus_captcha("elearning", "12345678")
    assert result is None
    assert fetch_counter["count"] == 1  # langsung berhenti, tidak ambil tantangan baru


@pytest.mark.asyncio
async def test_unknown_host_rejected():
    with pytest.raises(ValueError):
        await solve_campus_captcha("host-asal", "12345678")


@pytest.mark.asyncio
async def test_siakad_probe_uses_siakad_probe(patch_fetch):
    calls = []

    def fake_probe(nim, session, code):
        calls.append((nim, session, code))
        return True, "credentials"

    with patch_fetch(), patch(
        "app.captcha_autosolver.ocr_candidates",
        lambda png: ["BENAR"],
    ), patch("app.captcha_autosolver._probe_siakad", fake_probe):
        result = await solve_campus_captcha("siakad", "15260767")
    assert result is not None
    _, code = result
    assert code == "BENAR"
    assert calls == [("15260767", {"cookies": {"mybest_session": "xyz"}, "token": "tok"}, "BENAR")]
