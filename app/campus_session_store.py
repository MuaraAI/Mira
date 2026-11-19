"""Penyimpanan cookie sesi kampus per NIM (terenkripsi AES-GCM).

Masalah yang diselesaikan: sejak kampus mewajibkan CAPTCHA gambar, login ulang
otomatis mustahil tanpa manusia. Cookie sesi kampus yang sah (dibuat lewat relay
CAPTCHA saat login Mira) kini dipersist ke Redis supaya pool upstream bisa
memakainya kembali tanpa login baru.

Rotasi: `store_cookies()` dipanggil setiap login relay sukses dan setiap probe
restore berhasil, sehingga cookie tetap hangat selama NIM aktif.

Fallback: bila Redis tidak tersedia (mis. Windows tanpa Redis), gunakan file JSON
lokal di `%TEMP%/mira_campus_sessions/` sebagai cadangan.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional

from app.config import settings
from app.session_store import _decrypt_payload, _encrypt_payload

logger = logging.getLogger("app.campus_session_store")

CAMPUS_SESSION_TTL_SECONDS = 24 * 60 * 60

_KEY_PREFIX = "ubsi:campus_sess:"
_sync_client = None

# File-based fallback storage
_FALLBACK_DIR = Path(os.environ.get("TEMP", "/tmp")) / "mira_campus_sessions"
_FALLBACK_DIR.mkdir(parents=True, exist_ok=True)

def _fallback_path(module: str, nim: str) -> Path:
    safe_nim = nim.replace("/", "_").replace("\\", "_")
    return _FALLBACK_DIR / f"{module}_{safe_nim}.json"

def _client():
    """Client Redis sinkron: pemakai modul ini berjalan di thread executor."""
    global _sync_client
    if _sync_client is None:
        import redis as redis_sync

        _sync_client = redis_sync.from_url(settings.REDIS_URL, decode_responses=True)
    return _sync_client


def _key(module: str, nim: str) -> str:
    return f"{_KEY_PREFIX}{module}:{nim}"


def _store_fallback(module: str, nim: str, cookies: dict[str, str]) -> None:
    """Simpan ke file JSON sebagai fallback bila Redis gagal."""
    if not cookies:
        return
    try:
        blob = _encrypt_payload({"cookies": cookies}, settings.API_KEY)
        _fallback_path(module, nim).write_text(blob)
    except Exception as err:
        logger.warning("Gagal menyimpan fallback sesi kampus %s/%s: %s", module, nim, err)


def _load_fallback(module: str, nim: str) -> Optional[dict[str, str]]:
    """Baca dari file JSON fallback."""
    path = _fallback_path(module, nim)
    if not path.exists():
        return None
    try:
        blob = path.read_text()
        data = _decrypt_payload(blob, settings.API_KEY)
        cookies = (data or {}).get("cookies")
        return cookies if isinstance(cookies, dict) and cookies else None
    except Exception as err:
        logger.warning("Gagal membaca fallback sesi kampus %s/%s: %s", module, nim, err)
        return None


def _drop_fallback(module: str, nim: str) -> None:
    """Hapus file fallback."""
    try:
        _fallback_path(module, nim).unlink(missing_ok=True)
    except Exception as err:
        logger.warning("Gagal menghapus fallback sesi kampus %s/%s: %s", module, nim, err)


def store_cookies(module: str, nim: str, cookies: dict[str, str]) -> None:
    """Simpan cookie sesi kampus (overwrite). Diam bila gagal: cooldown tetap jalan."""
    if not cookies:
        return
    # Selalu tulis ke file fallback terlebih dahulu (Redis tidak terpercaya di Windows)
    _store_fallback(module, nim, cookies)
    # Coba Redis sebagai tambahan (bisa gagal bila Redis versi lama tidak support HELLO)
    try:
        blob = _encrypt_payload({"cookies": cookies}, settings.API_KEY)
        _client().set(_key(module, nim), blob, ex=CAMPUS_SESSION_TTL_SECONDS)
    except Exception as err:
        logger.warning("Redis gagal, fallback file sudah digunakan: %s", err)


def load_cookies(module: str, nim: str) -> Optional[dict[str, str]]:
    # Coba file fallback terlebih dahulu (Redis tidak terpercaya di Windows)
    result = _load_fallback(module, nim)
    if result:
        return result
    # Coba Redis sebagai tambahan (bisa gagal bila Redis versi lama tidak support HELLO)
    try:
        blob = _client().get(_key(module, nim))
        if blob:
            data = _decrypt_payload(blob, settings.API_KEY)
            cookies = (data or {}).get("cookies")
            if isinstance(cookies, dict) and cookies:
                return cookies
    except Exception as err:
        logger.warning("Redis gagal, fallback file sudah digunakan: %s", err)
    return None


def drop_cookies(module: str, nim: str) -> None:
    # Try Redis
    try:
        _client().delete(_key(module, nim))
    except Exception as err:
        logger.warning("Redis gagal: %s", err)
    # Fallback
    _drop_fallback(module, nim)
