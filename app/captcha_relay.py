"""Relay CAPTCHA login kampus.

Sejak Nov 2026, `students.bsi.ac.id` dan `elearning.bsi.ac.id` mewajibkan
CAPTCHA gambar pada form login. Backend tidak bisa membaca gambar itu, jadi
Mira menampilkan gambar aslinya ke user, lalu mengirim jawabannya bersama
kredensial pada permintaan yang sama-sama terikat sesi (cookie + `_token`).

Alur:
1. `POST /v1/auth/captcha` -> server membuka sesi login kampus, mengambil
   gambar CAPTCHA, menyimpan cookie + token di Redis (TTL 5 menit), lalu
   mengembalikan id + gambar.
2. `POST /v1/auth/login` dengan `{id, code}` -> server memakai cookie + token
   tersimpan untuk mengirim kredensial + kode CAPTCHA.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from typing import Any, Optional

import httpx

from app.cache import cache
from app.proxy import get_proxy

logger = logging.getLogger("app.captcha_relay")

CAPTCHA_TTL_SECONDS = 300  # kampus: kode berlaku 5 menit, sekali pakai

HOSTS: dict[str, dict[str, str]] = {
    "siakad": {
        "login_url": "https://students.bsi.ac.id/login",
        "image_url": "https://students.bsi.ac.id/login/captcha/web",
        "field": "captcha",
        "module": "studentv2",
        "label": "SIAKAD",
    },
    "elearning": {
        "login_url": "https://elearning.bsi.ac.id/login",
        "image_url": "https://elearning.bsi.ac.id/reload-captcha",
        "field": "captcha_answer",
        "module": "elearning",
        "label": "MyBest",
    },
}

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_TOKEN_RE = re.compile(r"""name=["']_token["']\s+value=["']([^"']+)["']""")
_DATA_URI_RE = re.compile(r"""data:image/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+""")


def _key(captcha_id: str) -> str:
    return f"ubsi:captcha:{captcha_id}"


def _extract_data_uri(payload: dict[str, Any]) -> str:
    """Ambil data URI gambar dari berbagai bentuk respons kampus."""
    image = payload.get("image")
    if isinstance(image, str) and image.startswith("data:image"):
        return image
    for value in payload.values():
        if isinstance(value, str):
            match = _DATA_URI_RE.search(value)
            if match:
                return match.group(0)
    raise ValueError("Respons CAPTCHA kampus tidak memuat gambar base64")


def _fetch_challenge_sync(host: str, nim: str) -> dict[str, Any]:
    spec = HOSTS[host]
    headers = {"User-Agent": _UA, "Referer": spec["login_url"]}
    if host == "elearning":
        headers["X-Requested-With"] = "XMLHttpRequest"

    with httpx.Client(
        headers={"User-Agent": _UA},
        follow_redirects=True,
        timeout=20.0,
        proxy=get_proxy(seed=nim or host),
    ) as client:
        page = client.get(spec["login_url"])
        page.raise_for_status()
        token_match = _TOKEN_RE.search(page.text)
        if not token_match:
            raise ValueError("Token _token tidak ditemukan pada halaman login kampus")

        image_resp = client.get(spec["image_url"], headers=headers)
        image_resp.raise_for_status()
        image = _extract_data_uri(image_resp.json())

        cookies = {cookie.name: cookie.value for cookie in client.cookies.jar}
        if not cookies:
            raise ValueError("Sesi login kampus tidak mengembalikan cookie")

        return {
            "host": host,
            "nim": nim,
            "token": token_match.group(1),
            "cookies": cookies,
            "image": image,
        }


async def create_challenge(host: str, nim: str) -> dict[str, Any]:
    """Buat tantangan CAPTCHA baru untuk host tertentu. Raises ValueError bila gagal."""
    if host not in HOSTS:
        raise ValueError(f"Host CAPTCHA tidak dikenal: {host}")

    data = await asyncio.to_thread(_fetch_challenge_sync, host, nim)
    captcha_id = uuid.uuid4().hex
    stored = {
        "host": data["host"],
        "nim": data["nim"],
        "token": data["token"],
        "cookies": data["cookies"],
    }
    redis = await cache.get_client()
    await redis.setex(_key(captcha_id), CAPTCHA_TTL_SECONDS, json.dumps(stored))

    return {
        "id": captcha_id,
        "host": host,
        "label": HOSTS[host]["label"],
        "image": data["image"],
        "expires_in": CAPTCHA_TTL_SECONDS,
    }


async def consume_challenge(captcha_id: str, host: str, nim: str) -> Optional[dict[str, Any]]:
    """Ambil dan hapus tantangan (sekali pakai). None bila kedaluwarsa/tidak cocok."""
    redis = await cache.get_client()
    key = _key(captcha_id)
    raw = await redis.get(key)
    if not raw:
        return None
    await redis.delete(key)
    try:
        stored = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if stored.get("host") != host or stored.get("nim") != nim:
        return None
    return stored
