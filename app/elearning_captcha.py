"""Penyelesai CAPTCHA puzzle-geser MyBest (`elearning.bsi.ac.id`).

Sejak 20 Nov 2026 halaman login MyBest mengganti CAPTCHA teks-gambar dengan
puzzle geser: `GET /reload-captcha` mengembalikan `{bg, piece, y, w, h, size}`,
lalu `POST /verify-captcha {"x", "trail"}` memvalidasi posisi dan mengembalikan
`{"success": true, "token": ...}`. Token itulah yang wajib disertakan form login
sebagai `captcha_token`; jawaban salah membuat kampus menerbitkan puzzle baru.

`x` dicari dengan masked template matching OpenCV (piece transparan di atas
band horizontal sepanjang baris `y`); `trail` meniru gerakan drag manusia
(mulai 0, easing kubik ke `x`, ±1 px vertikal, timestamp monoton naik).
Validasi posisi dilakukan kampus, bukan trail: solver murni tanpa trail tetap
diterima selama `x` benar, dan `x` salah selalu ditolak.
"""
from __future__ import annotations

import base64
import logging
import random
import re
from typing import Any, Optional

import httpx

from app.proxy import get_proxy

logger = logging.getLogger("app.elearning_captcha")

BASE_URL = "https://elearning.bsi.ac.id"
LOGIN_URL = f"{BASE_URL}/login"
RELOAD_URL = f"{BASE_URL}/reload-captcha"
VERIFY_URL = f"{BASE_URL}/verify-captcha"

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_TOKEN_RE = re.compile(r"""name=["']_token["']\s+value=["']([^"']+)["']""")

# Di bawah skor ini puzzle dianggap gagal dibaca (gambar blur/salah crop):
# lebih aman minta tantangan baru daripada mengirim `x` yang salah.
MIN_MATCH_SCORE = 0.55


class PuzzleError(RuntimeError):
    """Puzzle tidak bisa diambil atau diselesaikan; pemanggil minta tantangan baru."""


def _decode(uri: str, flags: int) -> Any:
    import cv2
    import numpy as np

    if not isinstance(uri, str) or "," not in uri:
        raise PuzzleError("Payload puzzle tidak memuat data URI")
    raw = base64.b64decode(uri.split(",", 1)[1])
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), flags)
    if image is None:
        raise PuzzleError("Gambar puzzle tidak bisa didekode")
    return image


def solve_puzzle(bg_uri: str, piece_uri: str, y: float, width: float) -> tuple[float, float]:
    """Posisi `x` (dalam ruang CSS `width`) + skor kecocokan template."""
    import cv2

    bg = _decode(bg_uri, cv2.IMREAD_COLOR)
    piece = _decode(piece_uri, cv2.IMREAD_UNCHANGED)
    if bg.ndim != 3 or piece.ndim not in (2, 3):
        raise PuzzleError("Dimensi gambar puzzle tidak dikenal")

    scale = bg.shape[1] / float(width or bg.shape[1])
    top = int(round(float(y) * scale))
    height = piece.shape[0]
    band = bg[top : top + height]
    if band.shape[0] != height or band.shape[1] < piece.shape[1]:
        raise PuzzleError("Band puzzle di luar batas gambar")

    template = piece[:, :, :3] if piece.ndim == 3 else piece
    mask = piece[:, :, 3] if piece.ndim == 3 and piece.shape[2] == 4 else None
    result = cv2.matchTemplate(band, template, cv2.TM_CCOEFF_NORMED, mask=mask)
    _, score, _, loc = cv2.minMaxLoc(result)
    return round(loc[0] / scale, 2), round(float(score), 4)


def build_trail(x: float, y: int = 512, duration_ms: int = 850, steps: int = 40) -> list[list[float]]:
    """Trail drag manusiawi berakhir tepat di `x`; format `[t_ms, x_css, client_y]`."""
    trail: list[list[float]] = [[0, 0.0, y]]
    cursor_y = y
    for step in range(1, steps + 1):
        eased = 1 - (1 - step / steps) ** 3
        cursor_y += random.choice((-1, 0, 0, 1))
        trail.append(
            [
                int(duration_ms * step / steps) + random.randint(0, 7),
                round(max(0.0, x * eased + random.uniform(-0.25, 0.25)), 2),
                cursor_y,
            ]
        )
    return trail


def _reload_challenge(client: httpx.Client, csrf: str) -> dict[str, Any]:
    response = client.get(
        RELOAD_URL,
        headers={
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": LOGIN_URL,
        },
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("bg") or not payload.get("piece"):
        raise PuzzleError("Reload puzzle tidak mengembalikan gambar")
    payload["csrf"] = csrf
    return payload


def _verify(client: httpx.Client, csrf: str, x: float, trail: list[list[float]]) -> Optional[str]:
    response = client.post(
        VERIFY_URL,
        json={"x": x, "trail": trail},
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-CSRF-TOKEN": csrf,
            "Referer": LOGIN_URL,
        },
    )
    if response.status_code != 200:
        raise PuzzleError(f"Verify puzzle HTTP {response.status_code}")
    payload = response.json()
    if not payload.get("success") or not payload.get("token"):
        raise PuzzleError(str(payload.get("message") or "Verify puzzle ditolak"))
    return str(payload["token"])


def fetch_captcha_token_sync(host: str, nim: str, attempts: int = 3) -> tuple[dict[str, Any], str]:
    """Satu tantangan terselesaikan: `(session, captcha_token)` siap POST login.

    `session` berformat `{cookies, token}` — `token` adalah `_token` form login,
    cookie wajib dipakai ulang pada POST login karena token terikat sesi.
    """
    with httpx.Client(
        headers={"User-Agent": _UA},
        follow_redirects=True,
        timeout=25.0,
        proxy=get_proxy(seed=nim or host),
    ) as client:
        page = client.get(LOGIN_URL)
        page.raise_for_status()
        match = _TOKEN_RE.search(page.text)
        if not match:
            raise PuzzleError("Token _token tidak ditemukan pada halaman login MyBest")
        csrf = match.group(1)

        last_error: Optional[Exception] = None
        for attempt in range(max(1, attempts)):
            try:
                challenge = _reload_challenge(client, csrf)
                x, score = solve_puzzle(
                    challenge["bg"], challenge["piece"], challenge.get("y", 0), challenge.get("w") or 280
                )
                if score < MIN_MATCH_SCORE:
                    raise PuzzleError(f"Skor puzzle terlalu rendah ({score})")
                token = _verify(client, csrf, x, build_trail(x))
            except Exception as err:  # termasuk PuzzleError dan galat jaringan
                last_error = err
                logger.info("Puzzle MyBest percobaan %s/%s gagal: %s", attempt + 1, attempts, err)
                continue
            cookies = {cookie.name: cookie.value for cookie in client.cookies.jar}
            if not cookies:
                raise PuzzleError("Sesi login MyBest tidak mengembalikan cookie")
            return {"cookies": cookies, "token": csrf}, token
        raise PuzzleError(f"Puzzle MyBest tidak terselesaikan: {last_error}")


async def fetch_captcha_token(host: str, nim: str, attempts: int = 3) -> tuple[dict[str, Any], str]:
    """Versi async dari `fetch_captcha_token_sync`."""
    import asyncio

    return await asyncio.to_thread(fetch_captcha_token_sync, host, nim, attempts)
