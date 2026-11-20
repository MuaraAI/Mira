"""CAPTCHA puzzle MyBest: solver gambar + alur verify/login, semua offline.

Root cause yang dikunci di sini: MyBest Nov 2026 mengganti CAPTCHA teks-gambar
(`captcha_answer`) dengan puzzle geser (`/reload-captcha` + `/verify-captcha` ->
`captcha_token`). Solver wajib mengembalikan `x` yang tepat; `x` salah selalu
ditolak server, jadi satu-satunya cara login adalah template matching + trail.
"""
import json
import re
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from app.elearning_captcha import (
    MIN_MATCH_SCORE,
    build_trail,
    fetch_captcha_token_sync,
    solve_puzzle,
)

_FIXTURE = Path(__file__).parent / "fixtures" / "el_login_puzzle.json"
_LOGIN_HTML = '<input type="hidden" name="_token" value="csrf-token-123">'


def _puzzle() -> dict:
    return json.loads(_FIXTURE.read_text())


def test_solve_puzzle_finds_piece_position():
    """x hasil matching harus di dalam area track dan dipakai apa adanya."""
    data = _puzzle()
    x, score = solve_puzzle(data["bg"], data["piece"], data["y"], data["w"])

    assert score >= MIN_MATCH_SCORE
    assert 0 <= x <= data["w"] - data["size"]
    # Lingkaran puzzle sengaja punya satu posisi; geser 40 px harus kalah skor.
    shifted, shifted_score = solve_puzzle(data["bg"], data["piece"], data["y"], data["w"])
    assert shifted == x


def test_solve_puzzle_rejects_malformed_payload():
    from app.elearning_captcha import PuzzleError

    with pytest.raises(PuzzleError):
        solve_puzzle("bukan-data-uri", "juga-bukan", 10, 280)
    with pytest.raises(PuzzleError):
        solve_puzzle("data:image/jpeg;base64,AAAAAAAA", "data:image/png;base64,AAAA", 10, 280)


def test_build_trail_ends_exactly_at_x():
    trail = build_trail(137.5)

    assert trail[0][1] == 0.0
    assert trail[-1][1] == pytest.approx(137.5, abs=0.5)
    times = [step[0] for step in trail]
    assert times == sorted(times)
    # Gerak vertikal kecil tapi akumulatif; batasnya sepanjang jumlah langkah.
    assert all(abs(step[2] - 512) <= len(trail) for step in trail)


class _PuzzleHttpClient:
    """httpx.Client palsu: halaman login, reload puzzle, verify."""

    def __init__(self, puzzle: dict, verify_x: float, reject: bool = False):
        self.cookies = httpx.Cookies()
        self.cookies.set("mybest_session", "sess-1", domain="elearning.bsi.ac.id")
        self._puzzle = puzzle
        self._verify_x = verify_x
        self._reject = reject
        self.verified: list[dict] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get(self, url, **kwargs):
        if url.endswith("/login"):
            return httpx.Response(200, text=_LOGIN_HTML, request=httpx.Request("GET", url))
        return httpx.Response(200, json=self._puzzle, request=httpx.Request("GET", url))

    def post(self, url, json=None, **kwargs):
        body = dict(json or {})
        self.verified.append(body)
        ok = not self._reject and abs(body.get("x", 0) - self._verify_x) <= 1
        return httpx.Response(
            200,
            json={"success": ok, "token": "captcha-token-abc" if ok else None,
                  "message": None if ok else "Posisi kurang pas, coba lagi."},
            request=httpx.Request("POST", url),
        )


def test_fetch_captcha_token_returns_session_and_token():
    data = _puzzle()
    x, _ = solve_puzzle(data["bg"], data["piece"], data["y"], data["w"])
    fake = _PuzzleHttpClient(data, verify_x=x)

    with patch("app.elearning_captcha.httpx.Client", lambda **kwargs: fake):
        session, token = fetch_captcha_token_sync("elearning", "12345678")

    assert token == "captcha-token-abc"
    assert session["token"] == "csrf-token-123"
    assert session["cookies"]["mybest_session"] == "sess-1"
    assert fake.verified[0]["trail"][-1][1] == pytest.approx(x, abs=0.5)


def test_fetch_captcha_token_retries_new_challenge_when_rejected():
    data = _puzzle()
    x, _ = solve_puzzle(data["bg"], data["piece"], data["y"], data["w"])
    fake = _PuzzleHttpClient(data, verify_x=x, reject=True)

    with patch("app.elearning_captcha.httpx.Client", lambda **kwargs: fake):
        with pytest.raises(Exception):
            fetch_captcha_token_sync("elearning", "12345678", attempts=2)

    assert len(fake.verified) == 2


def test_login_posts_captcha_token_not_captcha_answer():
    """POST login wajib memakai `captcha_token`; field lama berarti captcha hangus."""
    from app.modules.elearning import ElearningClient

    class _LoginClient:
        is_closed = False

        def __init__(self):
            self.cookies = httpx.Cookies()
            self.posted: list[dict] = []

        def get(self, url, **kwargs):
            return httpx.Response(200, text=_LOGIN_HTML, request=httpx.Request("GET", url))

        def post(self, url, data=None, **kwargs):
            self.posted.append(dict(data or {}))
            return httpx.Response(
                200,
                text="<html>dashboard</html>",
                request=httpx.Request("POST", "https://elearning.bsi.ac.id/user/dashboard"),
            )

    client = ElearningClient()
    fake = _LoginClient()
    client._client = fake
    with patch.object(client, "_mark_logged_in", lambda nim=None: setattr(client, "_logged_in", True)):
        assert client.login("12345678", "password", captcha="captcha-token-abc") is True

    posted = fake.posted[0]
    assert posted["captcha_token"] == "captcha-token-abc"
    assert "captcha_answer" not in posted
    assert posted["_token"] == "csrf-token-123"


def test_login_without_captcha_solves_puzzle_internally():
    """Sesi kampus mati: jalur latar menyelesaikan puzzle sendiri, bukan OCR teks."""
    from app.modules.elearning import ElearningClient

    class _LoginClient:
        is_closed = False

        def __init__(self):
            self.cookies = httpx.Cookies()
            self.posted: list[dict] = []

        def get(self, url, **kwargs):
            return httpx.Response(200, text=_LOGIN_HTML, request=httpx.Request("GET", url))

        def post(self, url, data=None, **kwargs):
            self.posted.append(dict(data or {}))
            return httpx.Response(
                200,
                text="<html>dashboard</html>",
                request=httpx.Request("POST", "https://elearning.bsi.ac.id/user/dashboard"),
            )

    client = ElearningClient()
    fake = _LoginClient()
    client._client = fake
    solved = ({"cookies": {"mybest_session": "s"}, "token": "csrf-token-123"}, "puzzle-token")

    with patch("app.elearning_captcha.fetch_captcha_token_sync", lambda host, nim: solved):
        with patch.object(client, "_mark_logged_in", lambda nim=None: setattr(client, "_logged_in", True)):
            assert client.login("12345678", "password") is True

    assert fake.posted[0]["captcha_token"] == "puzzle-token"


def test_captcha_form_marker_accepts_puzzle_and_legacy_markup():
    from app.modules.elearning import _elearning_captcha_form

    assert _elearning_captcha_form('<input type="hidden" name="captcha_token">') is True
    assert _elearning_captcha_form('<div class="sc-box" id="sc-box"></div>') is True
    assert _elearning_captcha_form('<input name="captcha_answer">') is True
    assert _elearning_captcha_form("<html>dashboard</html>") is False
