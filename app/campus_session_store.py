"""Penyimpanan cookie sesi kampus per NIM (terenkripsi AES-GCM).

Masalah yang diselesaikan: sejak kampus mewajibkan CAPTCHA gambar, login ulang
otomatis mustahil tanpa manusia. Cookie sesi kampus yang sah (dibuat lewat relay
CAPTCHA saat login Mira) kini dipersist ke Redis supaya pool upstream bisa
memakainya kembali tanpa login baru.

Rotasi: `store_cookies()` dipanggil setiap login relay sukses dan setiap probe
restore berhasil, sehingga cookie tetap hangat selama NIM aktif.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from app.config import settings
from app.session_store import _decrypt_payload, _encrypt_payload

logger = logging.getLogger("app.campus_session_store")

CAMPUS_SESSION_TTL_SECONDS = 24 * 60 * 60

_KEY_PREFIX = "ubsi:campus_sess:"
_sync_client = None


def _client():
    """Client Redis sinkron: pemakai modul ini berjalan di thread executor."""
    global _sync_client
    if _sync_client is None:
        import redis as redis_sync

        _sync_client = redis_sync.from_url(settings.REDIS_URL, decode_responses=True)
    return _sync_client


def _key(module: str, nim: str) -> str:
    return f"{_KEY_PREFIX}{module}:{nim}"


def store_cookies(module: str, nim: str, cookies: dict[str, str]) -> None:
    """Simpan cookie sesi kampus (overwrite). Diam bila gagal: cooldown tetap jalan."""
    if not cookies:
        return
    try:
        blob = _encrypt_payload({"cookies": cookies}, settings.API_KEY)
        _client().set(_key(module, nim), blob, ex=CAMPUS_SESSION_TTL_SECONDS)
    except Exception as err:
        logger.warning("Gagal menyimpan sesi kampus %s/%s: %s", module, nim, err)


def load_cookies(module: str, nim: str) -> Optional[dict[str, str]]:
    try:
        blob = _client().get(_key(module, nim))
    except Exception as err:
        logger.warning("Gagal membaca sesi kampus %s/%s: %s", module, nim, err)
        return None
    if not blob:
        return None
    data = _decrypt_payload(blob, settings.API_KEY)
    cookies = (data or {}).get("cookies")
    return cookies if isinstance(cookies, dict) and cookies else None


def drop_cookies(module: str, nim: str) -> None:
    try:
        _client().delete(_key(module, nim))
    except Exception as err:
        logger.warning("Gagal menghapus sesi kampus %s/%s: %s", module, nim, err)
