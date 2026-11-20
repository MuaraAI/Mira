"""Ambil tantangan CAPTCHA gambar SIAKAD untuk diselesaikan OCR.

`students.bsi.ac.id` mewajibkan CAPTCHA gambar pada form login. Mira tidak
menampilkan gambar ke user: modul ini membuka sesi login kampus (cookie +
`_token`) dan mengambil gambar, lalu `app/captcha_autosolver` membaca kodenya
untuk POST login yang sama. Kode kampus sekali pakai, jadi setiap percobaan
butuh tantangan baru.

MyBest (`elearning.bsi.ac.id`) TIDAK lagi memakai CAPTCHA gambar sejak
Nov 2026: form login memakai puzzle geser yang diselesaikan
`app/elearning_captcha.py` dan mengirim field `captcha_token`.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import httpx

from app.proxy import get_proxy

logger = logging.getLogger("app.captcha_relay")

HOSTS: dict[str, dict[str, str]] = {
    "siakad": {
        "login_url": "https://students.bsi.ac.id/login",
        "image_url": "https://students.bsi.ac.id/login/captcha/web",
        "field": "captcha",
        "module": "studentv2",
        "label": "SIAKAD",
    },
}

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_TOKEN_RE = re.compile(r"""name=["']_token["']\s+value=["']([^"']+)["']""")
_DATA_URI_RE = re.compile(r"""data:image/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+""")


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
