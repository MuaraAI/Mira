"""Penjaga sesi upstream BSI (SIAKAD students.bsi.ac.id dan MyBest elearning.bsi.ac.id).

Sesi Laravel di server kampus kedaluwarsa sekitar 15 menit. Kredensial user
sudah tersimpan terenkripsi di session dashboard, jadi client upstream bisa
login ulang sendiri tanpa user harus relogin di UBSI API:

1. Proaktif: sesi yang umurnya mendekati batas upstream diperbarui sebelum
   request dikirim, jadi user tidak pernah kena halaman login kampus.
2. Reaktif: response yang ternyata halaman login / 401 / 419 (CSRF page
   expired) memicu satu kali login ulang lalu request diulang.
3. Thread-safe: request paralel (dashboard memanggil banyak section sekaligus)
   berbagi satu login ulang, bukan login bersamaan yang saling membatalkan
   token CSRF dan captcha satu sama lain.
"""
import hashlib
import re
import ssl
import threading
import time
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.envelope import error_response

SHARED_SSL_CONTEXT = ssl.create_default_context()
SHARED_HTTP_LIMITS = httpx.Limits(
    max_connections=6,
    max_keepalive_connections=2,
    keepalive_expiry=30.0,
)

# Perbarui sesi sedikit sebelum batas 15 menit upstream.
DEFAULT_MAX_SESSION_AGE = 13 * 60

_LOGIN_FORM_RE = re.compile(r"""<form[^>]+action=["'][^"']*/login["']""", re.IGNORECASE)
_PASSWORD_INPUT_RE = re.compile(r"""name=["']password["']""", re.IGNORECASE)


def max_session_age() -> int:
    return int(getattr(settings, "UPSTREAM_SESSION_MAX_AGE", DEFAULT_MAX_SESSION_AGE) or DEFAULT_MAX_SESSION_AGE)


def is_logged_out_response(resp: Any) -> bool:
    """True jika response upstream menandakan sesi sudah tidak berlaku."""
    status_code = getattr(resp, "status_code", 200)
    if status_code in (401, 419):
        return True
    url = str(getattr(resp, "url", "") or "")
    if "/login" in (urlparse(url).path or url):
        return True
    headers = getattr(resp, "headers", None) or {}
    content_type = str(headers.get("content-type", "")) if hasattr(headers, "get") else ""
    if content_type and "html" not in content_type:
        return False
    try:
        text = resp.text
    except Exception:
        return False
    if not isinstance(text, str) or len(text) > 400_000:
        return False
    return bool(_LOGIN_FORM_RE.search(text) and _PASSWORD_INPUT_RE.search(text))


class UpstreamSession:
    """Mixin untuk client upstream yang punya `login()`, `get_client()`, dan `_logged_in`."""

    BASE_URL = ""
    MODULE = "upstream"
    HOST_LABEL = "server kampus"

    def get_client(self) -> httpx.Client:
        raise NotImplementedError

    def login(self, nim: str, password: str) -> bool:
        raise NotImplementedError

    @staticmethod
    def _hash_creds(nim: str, password: str) -> str:
        return hashlib.sha256(f"{nim}:{password}".encode("utf-8")).hexdigest()

    def _init_upstream_session(self) -> None:
        self._session_lock = threading.RLock()
        self._login_at = 0.0
        self._cred_hash: Optional[str] = None

    def _mark_logged_in(self) -> None:
        self._logged_in = True
        self._login_at = time.monotonic()

    def _session_is_fresh(self) -> bool:
        return bool(self._logged_in) and (time.monotonic() - self._login_at) < max_session_age()

    def ensure_session(self, nim: str, password: str, *, stale_since: Optional[float] = None) -> bool:
        """Pastikan sesi upstream hidup dan terikat pada kredensial yang sama; login ulang bila perlu.

        `stale_since` dipakai saat sebuah response terdeteksi logout: jika thread
        lain sudah login ulang setelah waktu itu, sesi barunya dipakai bersama.
        """
        cred_hash = self._hash_creds(nim, password)
        with self._session_lock:
            if (
                self._session_is_fresh()
                and self._cred_hash == cred_hash
                and (stale_since is None or self._login_at > stale_since)
            ):
                return True
            self._logged_in = False
            self._cred_hash = None
            self.get_client().cookies.clear()
            ok = bool(self.login(nim, password))
            if ok:
                self._cred_hash = cred_hash
                self._mark_logged_in()
            return ok

    def _auth_error(self, code: str, message: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(code=code, message=message, module=self.MODULE),
        )

    def resolve_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self.BASE_URL}{path}" if path.startswith("/") else f"{self.BASE_URL}/{path}"

    def authed_request(self, method: str, path: str, nim: str, password: str, **kwargs: Any) -> httpx.Response:
        """Kirim request dengan sesi yang dijamin hidup, login ulang otomatis sekali bila kedaluwarsa."""
        if not self.ensure_session(nim, password):
            raise self._auth_error("AUTH_FAILED", f"Gagal login ke {self.HOST_LABEL}")
        url = self.resolve_url(path)
        sent_at = time.monotonic()
        resp = self.get_client().request(method, url, **kwargs)
        if not is_logged_out_response(resp):
            return resp
        if not self.ensure_session(nim, password, stale_since=sent_at):
            raise self._auth_error(
                "AUTH_EXPIRED", f"Sesi {self.HOST_LABEL} kedaluwarsa dan gagal login ulang otomatis"
            )
        return self.get_client().request(method, url, **kwargs)
