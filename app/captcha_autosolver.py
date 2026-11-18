"""Auto-solver CAPTCHA kampus: OCR kandidat + validasi probe ke server kampus.

Alur per tantangan:
1. Ambil challenge kampus (cookie + _token + gambar) via captcha_relay.
2. OCR gambar menjadi daftar kandidat terurut (tesseract voting).
3. Tiap kandidat diprobe ke endpoint login kampus memakai PASSWORD DUMMY
   (bukan password user). Kampus membalas:
   - alasan "credentials" (password ditolak) -> kode CAPTCHA BENAR:
     tantangan tervalidasi, siap dipakai login sungguhan.
   - alasan "captcha" (kode salah) -> kandidat berikutnya.
   - alasan lain (throttled/unknown) -> kandidat berikutnya; "throttled"
     menghentikan seluruh loop.

Semua kandidat salah -> tantangan baru (maks MAX_CHALLENGES). Gagal total ->
None; pemanggil jatuh ke fallback CAPTCHA manusia.
"""
import asyncio
import base64
import subprocess
import tempfile
from collections import Counter
from pathlib import Path
from typing import Optional

import httpx

from app.captcha_relay import HOSTS, _fetch_challenge_sync
from app.modules.elearning import classify_login_failure, _elearning_image_captcha
from app.modules.studentv2 import _siakad_captcha_required

MAX_CHALLENGES = 5
MAX_CANDIDATES_PER_CHALLENGE = 4
DUMMY_PASSWORD = "MiraProbe#2026"
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def ocr_candidates(png_bytes: bytes) -> list[str]:
    """OCR voting: beberapa varian preprocessing, kandidat unik urut jumlah suara."""
    votes: Counter = Counter()
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "cap.png"
        src.write_bytes(png_bytes)
        variant = Path(tmp) / "v.png"
        preprocesses = (
            [],
            ["-colorspace", "Gray"],
            ["-colorspace", "Gray", "-threshold", "55%"],
            ["-colorspace", "Gray", "-threshold", "70%"],
            ["-colorspace", "Gray", "-lat", "25x25+10%"],
            ["-colorspace", "Gray", "-median", "3", "-threshold", "60%"],
            ["-colorspace", "Gray", "-morphology", "Open", "Disk:1.5"],
        )
        for scale in (250, 400):
            for extra in preprocesses:
                try:
                    subprocess.run(
                        ["convert", str(src), "-resize", f"{scale}%", *extra, str(variant)],
                        check=True, capture_output=True, timeout=20,
                    )
                except Exception:
                    continue
                for psm in ("7", "8"):
                    try:
                        result = subprocess.run(
                            ["tesseract", str(variant), "stdout", "--psm", psm],
                            capture_output=True, text=True, timeout=20,
                        )
                    except Exception:
                        continue
                    code = "".join(
                        ch for ch in result.stdout.strip().upper() if ch.isalnum()
                    )
                    if 2 <= len(code) <= 6:
                        votes[code] += 1
    return [code for code, _ in votes.most_common(MAX_CANDIDATES_PER_CHALLENGE)]


def _probe_elearning(nim: str, session: dict, code: str) -> tuple[bool, str]:
    """Probe login MyBest dengan password dummy. Return (captcha_valid, reason)."""
    with httpx.Client(headers={"User-Agent": _UA}, follow_redirects=True, timeout=20.0) as client:
        for name, value in (session.get("cookies") or {}).items():
            client.cookies.set(name, value)
        response = client.post(
            "https://elearning.bsi.ac.id/login",
            data={
                "_token": str(session.get("token") or ""),
                "username": nim,
                "password": DUMMY_PASSWORD,
                "captcha_answer": code,
            },
        )
        if response.status_code == 429:
            return False, "throttled"
        reason, _errors = classify_login_failure(response.text, _elearning_image_captcha(response.text))
        if reason == "credentials":
            return True, "credentials"
        return False, reason


def _probe_siakad(nim: str, session: dict, code: str) -> tuple[bool, str]:
    """Probe login SIAKAD dengan password dummy.

    Kode salah: kampus melempar 302 ke /login/captcha/web (terukur pada
    investigasi 2026-11-18). Selain itu dianggap kode diterima kampus.
    """
    with httpx.Client(headers={"User-Agent": _UA}, follow_redirects=False, timeout=20.0) as client:
        for name, value in (session.get("cookies") or {}).items():
            client.cookies.set(name, value)
        response = client.post(
            HOSTS["siakad"]["login_url"],
            data={
                "_token": str(session.get("token") or ""),
                "username": nim,
                "password": DUMMY_PASSWORD,
                "remember": "0",
                "captcha": code,
            },
        )
        if response.status_code == 429:
            return False, "throttled"
        location = response.headers.get("location", "")
        if response.status_code in (301, 302, 303, 307) and "captcha" in location:
            return False, "captcha"
        if response.status_code in (301, 302, 303, 307):
            return True, "credentials"
        if _siakad_captcha_required(response.text):
            return False, "captcha"
        return True, "credentials"


async def solve_campus_captcha(host: str, nim: str) -> Optional[tuple[dict, str]]:
    """Kembalikan (session, code) tervalidasi untuk host, atau None bila gagal.

    `session` berformat sama dengan tantangan captcha_relay (cookies + token)
    dan siap dipakai login sungguhan dengan kode yang sudah diterima kampus.
    """
    if host not in HOSTS:
        raise ValueError(f"Host CAPTCHA tidak dikenal: {host}")
    probe = _probe_elearning if host == "elearning" else _probe_siakad
    for _ in range(MAX_CHALLENGES):
        data = await asyncio.to_thread(_fetch_challenge_sync, host, nim)
        session = {"cookies": data["cookies"], "token": data["token"]}
        png = base64.b64decode(data["image"].split(",", 1)[1])
        candidates = await asyncio.to_thread(ocr_candidates, png)
        for code in candidates[:MAX_CANDIDATES_PER_CHALLENGE]:
            valid, reason = await asyncio.to_thread(probe, nim, session, code)
            if valid:
                return session, code
            if reason == "throttled":
                return None
            # reason "captcha"/"unknown": kandidat salah, coba kandidat berikutnya.
    return None
