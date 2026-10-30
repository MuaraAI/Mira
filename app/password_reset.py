"""Lupa password akun kampus (SIAKAD / MyBest) lewat Mira.

Kampus hanya meminta email untuk mengirim link reset (berlaku 60 menit, bawaan Laravel).
Password baru disetel mahasiswa sendiri lewat link di email itu, langsung di situs kampus.
Mira menambahkan pengecekan NIM <-> email sebelum meneruskan permintaan:
- Email kampus `<NIM>@bsi.ac.id` harus sama persis dengan NIM.
- Email yang pernah terbaca dari profil SIAKAD/MyBest disimpan sebagai HMAC (bukan teks asli)
  sehingga NIM dan email yang tidak cocok bisa ditolak tanpa menyimpan alamat email.
"""
import hashlib
import hmac
import logging
import re
from dataclasses import dataclass
from typing import Optional

from lxml import html as lxml_html

from app.config import settings
from app.modules.elearning import ElearningClient
from app.modules.studentv2 import StudentV2Client
from app.proxy import get_proxy

logger = logging.getLogger("app.password_reset")

RESET_LINK_TTL_MINUTES = 60
EMAIL_LINK_TTL_SECONDS = 365 * 24 * 3600
_LINK_PREFIX = "ubsi:nim_email:"
_REVERSE_PREFIX = "ubsi:email_nim:"

RESET_SYSTEMS = {
    "siakad": {"label": "SIAKAD", "client": StudentV2Client, "host": "students.bsi.ac.id"},
    "mybest": {"label": "MyBest", "client": ElearningClient, "host": "elearning.bsi.ac.id"},
}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ERROR_HINT_RE = re.compile(r"red|danger|error|invalid", re.I)
_SUCCESS_HINT_RE = re.compile(r"green|success|status", re.I)
_NOT_FOUND_RE = re.compile(r"tidak (dapat )?(me|di)?n?emukan|tidak ditemukan|tidak terdaftar|can't find|cannot find|not found|no user", re.I)
_THROTTLE_RE = re.compile(r"tunggu|wait|throttle|terlalu banyak|too many", re.I)


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _email_hmac(email: str) -> str:
    if not settings.API_KEY:
        raise RuntimeError("API_KEY wajib disetel di file .env server!")
    return hmac.new(
        settings.API_KEY.encode("utf-8"), b"mira_nim_email_v1:" + normalize_email(email).encode("utf-8"), hashlib.sha256
    ).hexdigest()


async def remember_nim_email(redis_client, nim: str, email: Optional[str]) -> None:
    """Catat pasangan NIM-email (HMAC) dari profil kampus untuk validasi lupa password."""
    email = normalize_email(email or "")
    if not nim or not EMAIL_RE.match(email):
        return
    digest = _email_hmac(email)
    try:
        await redis_client.sadd(_LINK_PREFIX + nim, digest)
        await redis_client.expire(_LINK_PREFIX + nim, EMAIL_LINK_TTL_SECONDS)
        await redis_client.set(_REVERSE_PREFIX + digest, nim, ex=EMAIL_LINK_TTL_SECONDS)
    except Exception as err:
        logger.warning("Gagal mencatat NIM-email: %s", err)


async def nim_email_mismatch(redis_client, nim: str, email: str) -> bool:
    """True bila Mira yakin email bukan milik NIM ini. Tanpa data, kembalikan False (biarkan kampus memutuskan)."""
    email = normalize_email(email)
    local, _, domain = email.partition("@")
    if domain in ("bsi.ac.id", "students.bsi.ac.id") and local.isdigit():
        return local != nim
    digest = _email_hmac(email)
    try:
        owner = await redis_client.get(_REVERSE_PREFIX + digest)
        if owner and owner != nim:
            return True
        known = await redis_client.smembers(_LINK_PREFIX + nim)
        return bool(known) and digest not in known
    except Exception as err:
        logger.warning("Cek NIM-email dilewati (Redis error): %s", err)
        return False


@dataclass
class CampusResult:
    status: str  # "sent" | "not_found" | "throttled" | "rejected" | "unknown"
    message: str


def _page_messages(page_html: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    successes: list[str] = []
    try:
        doc = lxml_html.fromstring(page_html or "<html></html>")
    except (ValueError, lxml_html.etree.ParserError):
        return errors, successes
    for el in doc.xpath("//*[@class]"):
        if el.tag in ("input", "button", "form", "script", "style", "a", "label"):
            continue
        text = re.sub(r"\s+", " ", el.text_content() or "").strip()
        if not (3 < len(text) < 240) or len(el.xpath(".//*[@class]")) > 3:
            continue
        cls = el.get("class") or ""
        if _ERROR_HINT_RE.search(cls):
            errors.append(text)
        elif _SUCCESS_HINT_RE.search(cls) and re.search(r"link|email|kirim|reset|sent", text, re.I):
            successes.append(text)
    return errors, successes


def _classify_forgot(errors: list[str], label: str) -> CampusResult:
    text = " ".join(errors)
    if _NOT_FOUND_RE.search(text):
        return CampusResult("not_found", f"Email ini tidak terdaftar di {label}.")
    if _THROTTLE_RE.search(text):
        return CampusResult("throttled", "Link baru saja dikirim. Tunggu 1 menit sebelum minta lagi.")
    return CampusResult("rejected", errors[0] if errors else f"{label} menolak permintaan reset.")


def request_reset_link(system: str, email: str) -> CampusResult:
    """Minta kampus mengirim link reset ke email (sinkron, jalankan via executor)."""
    spec = RESET_SYSTEMS[system]
    label = spec["label"]
    client = spec["client"](proxy=get_proxy(seed=email))
    base = client.BASE_URL
    try:
        http = client.get_client()
        page = http.get(f"{base}/forgot-password")
        csrf = re.search(r'name=["\']_token["\']\s+value=["\']([^"\']+)', page.text) or re.search(
            r"X-CSRF-TOKEN['\"]\s*:\s*['\"]([^'\"]+)", page.text
        ) or re.search(r'name=["\']csrf-token["\']\s+content=["\']([^"\']+)', page.text)
        if not csrf:
            return CampusResult("unknown", f"Halaman lupa password {label} sedang tidak bisa dibuka.")
        if system == "siakad":
            resp = http.post(
                f"{base}/forgot-password",
                json={"email": email},
                headers={"X-CSRF-TOKEN": csrf.group(1), "Accept": "application/json", "Referer": f"{base}/forgot-password"},
            )
            try:
                data = resp.json()
            except ValueError:
                data = {}
            if resp.is_success and data.get("status") == "success":
                return CampusResult("sent", data.get("message") or "Link reset dikirim ke email.")
            email_errors = (data.get("errors") or {}).get("email") or []
            return _classify_forgot(list(email_errors) or [data.get("message") or ""], label)

        resp = http.post(
            f"{base}/forgot-password",
            data={"_token": csrf.group(1), "email": email},
            headers={"Referer": f"{base}/forgot-password"},
        )
        # Hanya pesan yang BARU muncul setelah submit (flash) yang dihitung, bukan teks statis halaman.
        base_err, base_ok = _page_messages(page.text)
        errors, successes = _page_messages(resp.text)
        errors = [e for e in errors if e not in base_err]
        successes = [m for m in successes if m not in base_ok]
        if errors:
            return _classify_forgot(errors, label)
        if successes:
            return CampusResult("sent", successes[0])
        return CampusResult("unknown", f"{label} tidak memberi konfirmasi. Cek email kamu dalam beberapa menit.")
    except Exception as err:
        logger.error("Lupa password %s gagal: %s", label, err)
        return CampusResult("unknown", f"Koneksi ke {label} terputus. Coba lagi sebentar.")
    finally:
        client.close()

