"""Identitas perangkat: cookie mira_device dan label dari User-Agent."""
import re
import secrets
from typing import Optional

from fastapi import Request, Response

DEVICE_COOKIE = "mira_device"
DEVICE_COOKIE_MAX_AGE = 180 * 24 * 3600

_BROWSER_LABELS = {
    "edg/": "Edge",
    "chrome": "Chrome",
    "firefox": "Firefox",
    "safari": "Safari",
}
_PLATFORM_LABELS = {
    "android": "Android",
    "iphone": "iOS",
    "ipad": "iOS",
    "windows": "Windows",
    "mac os": "macOS",
    "linux": "Linux",
}


def new_device_id() -> str:
    """Buat id perangkat baru: 32 byte acak dalam heksadesimal (64 karakter)."""
    return secrets.token_hex(32)


_DEVICE_ID_RE = re.compile(r"[0-9a-f]{64}")


def read_device_id(request: Request) -> str:
    """Ambil id perangkat dari cookie, atau string kosong bila tidak valid.

    Cookie adalah satu-satunya bukti perangkat, jadi nilainya wajib berbentuk
    64 karakter heksadesimal. Nilai lain dianggap tidak ada.
    """
    value = request.cookies.get(DEVICE_COOKIE) or ""
    return value if _DEVICE_ID_RE.fullmatch(value) else ""


def issue_device_cookie(
    response: Response,
    device_id: str,
    *,
    is_https: bool,
    domain: Optional[str],
) -> None:
    """Pasang cookie identitas perangkat pada Response yang sudah ada."""
    response.set_cookie(
        key=DEVICE_COOKIE,
        value=device_id,
        max_age=DEVICE_COOKIE_MAX_AGE,
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
        domain=domain,
    )


def device_label(user_agent: str) -> str:
    """Ringkas User-Agent menjadi pasangan browser dan platform, mis. ``Chrome · Linux``."""
    agent = (user_agent or "").lower()
    if not agent:
        return "Browser"

    browser = next(
        (label for needle, label in _BROWSER_LABELS.items() if needle in agent),
        "Browser",
    )
    platform = next(
        (label for needle, label in _PLATFORM_LABELS.items() if needle in agent),
        "",
    )
    return f"{browser} · {platform}" if platform else browser
