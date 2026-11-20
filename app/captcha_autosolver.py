"""Kandidat jawaban CAPTCHA gambar SIAKAD dari OCR.

MyBest tidak lagi lewat modul ini: sejak Nov 2026 login MyBest memakai puzzle
geser yang diselesaikan `app/elearning_captcha.py`.

Kampus membakar CAPTCHA setiap POST: satu kode hanya berlaku untuk satu
percobaan login, termasuk percobaan yang kodenya salah. Karena itu modul ini
TIDAK memvalidasi kode lebih dulu (probe); ia hanya mengambil tantangan baru
dan mengembalikan kandidat teratas untuk langsung dipakai pada login asli.
Pemanggil yang mengulang dengan tantangan baru saat kampus menolak kode.
"""
import asyncio
import base64
import subprocess
import tempfile
from collections import Counter
from pathlib import Path
from typing import Optional

from app.captcha_relay import HOSTS, _fetch_challenge_sync

MAX_CAPTCHA_ATTEMPTS = 3
MAX_CANDIDATES_PER_CHALLENGE = 4


def ocr_candidates(png_bytes: bytes) -> list[str]:
    """Kandidat jawaban CAPTCHA, ddddocr lebih dulu.

    ddddocr (ONNX) akurat dan cepat (~20 ms). Tesseract hanya dijalankan kalau
    ddddocr tidak tersedia atau tidak menghasilkan kandidat: 28 pemanggilan
    convert+tesseract dulu memakan ~4,5 detik per tantangan, padahal
    `_ocr_login` hanya memakai kandidat pertama.
    """
    primary = _ddddocr_candidate(png_bytes)
    if primary:
        return primary[:MAX_CANDIDATES_PER_CHALLENGE]
    return _tesseract_candidates(png_bytes)[:MAX_CANDIDATES_PER_CHALLENGE]


def _tesseract_candidates(png_bytes: bytes) -> list[str]:
    """Cadangan: voting beberapa varian preprocessing lewat ImageMagick + tesseract."""
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


async def candidate_session(host: str, nim: str) -> Optional[tuple[dict, list[str]]]:
    """Tantangan baru + kandidat OCR teratas, siap dipakai satu kali login.

    `session` berformat sama dengan tantangan captcha_relay (cookies + token).
    Return None bila host tidak dikenal; list kandidat bisa kosong bila OCR
    gagal membaca gambar, dan pemanggil boleh minta tantangan baru.
    """
    if host not in HOSTS:
        raise ValueError(f"Host CAPTCHA tidak dikenal: {host}")
    return await fetch_candidates(host, nim)


async def fetch_candidates(host: str, nim: str) -> tuple[dict, list[str]]:
    """Ambil satu tantangan kampus lalu OCR gambarnya."""
    data = await asyncio.to_thread(_fetch_challenge_sync, host, nim)
    session = {"cookies": data["cookies"], "token": data["token"]}
    png = base64.b64decode(data["image"].split(",", 1)[1])
    candidates = await asyncio.to_thread(ocr_candidates, png)
    return session, candidates[:MAX_CANDIDATES_PER_CHALLENGE]


def candidate_session_sync(host: str, nim: str) -> Optional[tuple[dict, list[str]]]:
    """Versi sinkron `candidate_session` untuk jalur login latar (thread/httpx)."""
    if host not in HOSTS:
        raise ValueError(f"Host CAPTCHA tidak dikenal: {host}")
    data = _fetch_challenge_sync(host, nim)
    session = {"cookies": data["cookies"], "token": data["token"]}
    png = base64.b64decode(data["image"].split(",", 1)[1])
    return session, ocr_candidates(png)[:MAX_CANDIDATES_PER_CHALLENGE]


_DDDDOCR = None


def _ddddocr_candidate(png_bytes: bytes) -> list[str]:
    """Kandidat dari ddddocr (model ONNX, akurasi jauh di atas tesseract untuk CAPTCHA).

    Import dilakukan malas: kalau paket belum terpasang, jalur OCR tesseract tetap jalan.
    """
    global _DDDDOCR
    try:
        import ddddocr
    except Exception:
        return []
    try:
        if _DDDDOCR is None:
            _DDDDOCR = ddddocr.DdddOcr(show_ad=False)
        text = _DDDDOCR.classification(png_bytes) or ""
    except Exception:
        return []
    code = "".join(ch for ch in str(text).upper() if ch.isalnum())
    return [code] if 2 <= len(code) <= 8 else []
