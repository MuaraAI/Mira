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
import logging
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

logger = logging.getLogger("app.upstream_session")

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

# Cooldown mencegah penembakan login berulang saat kampus menolak (CAPTCHA baru,
# kredensial salah, atau 429). Tanpa ini, worker notifikasi + retry membuat IP
# server kena rate limit sehingga user yang sah ikut gagal login.
CAPTCHA_COOLDOWN_SECONDS = 20 * 60
CREDENTIAL_COOLDOWN_SECONDS = 10 * 60
THROTTLE_COOLDOWN_SECONDS = 5 * 60

_login_blocks: dict[tuple[str, str], tuple[float, str]] = {}
_host_blocks: dict[str, tuple[float, str]] = {}
_block_lock = threading.Lock()


def _monotonic() -> float:
    return time.monotonic()


def block_reason(module: str, nim: str = "") -> Optional[str]:
    """Alasan login diblokir sementara untuk host/NIM ini, atau None."""
    now = _monotonic()
    with _block_lock:
        host = _host_blocks.get(module)
        if host and host[0] > now:
            return host[1]
        entry = _login_blocks.get((module, nim))
        if entry and entry[0] > now:
            return entry[1]
    return None


def mark_login_blocked(module: str, nim: str, reason: str, seconds: int) -> None:
    with _block_lock:
        _login_blocks[(module, nim)] = (_monotonic() + seconds, reason)


def mark_host_blocked(module: str, reason: str, seconds: int) -> None:
    with _block_lock:
        _host_blocks[module] = (_monotonic() + seconds, reason)


def clear_login_block(module: str, nim: str) -> None:
    with _block_lock:
        _login_blocks.pop((module, nim), None)


def reset_blocks() -> None:
    """Hanya untuk test: kosongkan seluruh cooldown."""
    with _block_lock:
        _login_blocks.clear()
        _host_blocks.clear()


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
    # Halaman yang butuh sesi; dipakai memvalidasi cookie tersimpan tanpa login.
    PROBE_PATH = ""

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
        # Diisi oleh `login()` pada subclass: "captcha" | "credentials" | "throttled" | "unknown".
        self._login_failure: Optional[str] = None

    def _mark_logged_in(self, nim: Optional[str] = None) -> None:
        self._logged_in = True
        self._login_at = time.monotonic()
        self._login_failure = None
        if nim:
            # Simpan cookie agar NIM tidak perlu CAPTCHA lagi selama sesi masih hidup.
            self._persist_cookies(nim)

    def _session_is_fresh(self) -> bool:
        return bool(self._logged_in) and (time.monotonic() - self._login_at) < max_session_age()

    def _blocked_error(self, reason: str) -> HTTPException:
        """Terjemahkan cooldown aktif menjadi error yang bisa dibaca frontend."""
        if reason == "captcha":
            return self._auth_error(
                "AUTH_CAPTCHA_REQUIRED",
                f"{self.HOST_LABEL} kini mewajibkan CAPTCHA. Login ulang lewat situs kampus "
                f"lalu coba lagi beberapa menit kemudian.",
            )
        if reason == "throttled":
            return self._auth_error(
                "UPSTREAM_THROTTLED",
                f"{self.HOST_LABEL} membatasi jumlah permintaan. Coba lagi beberapa menit kemudian.",
            )
        return self._auth_error("AUTH_FAILED", f"Gagal login ke {self.HOST_LABEL}")

    def _record_login_failure(self, nim: str) -> None:
        """Simpan cooldown sesuai penyebab kegagalan login terakhir."""
        reason = self._login_failure or "unknown"
        if reason == "captcha":
            mark_login_blocked(self.MODULE, nim, "captcha", CAPTCHA_COOLDOWN_SECONDS)
        elif reason == "throttled":
            mark_host_blocked(self.MODULE, "throttled", THROTTLE_COOLDOWN_SECONDS)
        elif reason == "credentials":
            mark_login_blocked(self.MODULE, nim, "credentials", CREDENTIAL_COOLDOWN_SECONDS)

    def _persist_cookies(self, nim: str) -> None:
        """Simpan cookie sesi kampus agar NIM tidak perlu login ulang + CAPTCHA."""
        from app.campus_session_store import store_cookies

        try:
            store_cookies(self.MODULE, nim, dict(self.get_client().cookies))
        except Exception as err:
            logger.warning("Gagal mempersist cookie sesi %s/%s: %s", self.MODULE, nim, err)

    def _try_restore(self, nim: str) -> bool:
        """Pakai cookie tersimpan (dari relay CAPTCHA) tanpa login baru.

        Validasi dengan satu GET ke halaman yang butuh sesi. Return False bila
        cookie tidak ada/invalid supaya pemanggil lanjut ke jalur login.
        """
        from app.campus_session_store import drop_cookies, load_cookies

        if not self.PROBE_PATH:
            return False
        cookies = load_cookies(self.MODULE, nim)
        if not cookies:
            return False
        client = self.get_client()
        client.cookies.clear()
        for name, value in cookies.items():
            client.cookies.set(name, value)
        try:
            resp = client.get(f"{self.BASE_URL}{self.PROBE_PATH}", follow_redirects=True)
        except Exception as err:
            logger.warning("Probe restore sesi %s/%s gagal: %s", self.MODULE, nim, err)
            return False
        if resp.status_code >= 400 or is_logged_out_response(resp):
            drop_cookies(self.MODULE, nim)
            return False
        clear_login_block(self.MODULE, nim)
        self._mark_logged_in()
        self._persist_cookies(nim)
        return True


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
            # Cookie tersimpan lebih diutamakan daripada cooldown: sesi sah tidak butuh CAPTCHA.
            if self._try_restore(nim):
                self._cred_hash = cred_hash
                return True
            # Cooldown hanya menggerbang percobaan login baru, bukan request yang sesinya masih hidup.
            blocked = block_reason(self.MODULE, nim)
            if blocked:
                raise self._blocked_error(blocked)
            self._logged_in = False
            self._cred_hash = None
            self.get_client().cookies.clear()
            ok = bool(self.login(nim, password))
            if ok:
                clear_login_block(self.MODULE, nim)
                self._cred_hash = cred_hash
                self._mark_logged_in()
                self._persist_cookies(nim)
                return True
            self._record_login_failure(nim)
            return False

    def _auth_error(self, code: str, message: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(code=code, message=message, module=self.MODULE),
        )

    def resolve_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self.BASE_URL}{path}" if path.startswith("/") else f"{self.BASE_URL}/{path}"

    def _handle_throttle(self, resp: httpx.Response) -> None:
        """429 dari kampus: blok host sementara dan jangan menembak ulang."""
        if resp.status_code != 429:
            return
        retry_after = 0
        try:
            retry_after = int(resp.headers.get("Retry-After", "0") or 0)
        except (TypeError, ValueError):
            retry_after = 0
        seconds = min(max(retry_after, THROTTLE_COOLDOWN_SECONDS), 30 * 60)
        mark_host_blocked(self.MODULE, "throttled", seconds)
        raise self._blocked_error("throttled")

    def authed_request(self, method: str, path: str, nim: str, password: str, **kwargs: Any) -> httpx.Response:
        """Kirim request dengan sesi yang dijamin hidup, login ulang otomatis sekali bila kedaluwarsa."""
        if not self.ensure_session(nim, password):
            raise self._blocked_error(self._login_failure or "unknown")
        url = self.resolve_url(path)
        sent_at = time.monotonic()
        resp = self.get_client().request(method, url, **kwargs)
        self._handle_throttle(resp)
        if not is_logged_out_response(resp):
            return resp
        if not self.ensure_session(nim, password, stale_since=sent_at):
            reason = self._login_failure or "unknown"
            if reason in ("captcha", "throttled"):
                raise self._blocked_error(reason)
            raise self._auth_error(
                "AUTH_EXPIRED", f"Sesi {self.HOST_LABEL} kedaluwarsa dan gagal login ulang otomatis"
            )
        resp = self.get_client().request(method, url, **kwargs)
        self._handle_throttle(resp)
        return resp
