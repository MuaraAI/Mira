"""Ganti password akun kampus (SIAKAD / MyBest) langsung dari Mira.

Alur per sistem:
1. Login segar dengan password lama.
2. Buka halaman ganti password resmi, cari form yang berisi input password.
3. Isi field lama/baru/konfirmasi berdasarkan nama field, kirim ke action form.
4. Bukti nyata: login ulang dengan password baru. Hasil hanya "changed" bila login baru sukses.
"""
import logging
import re
from dataclasses import dataclass, field
from typing import Callable, Optional
from urllib.parse import urljoin, urlparse

from lxml import html as lxml_html

from app.modules.elearning import ElearningClient
from app.modules.studentv2 import StudentV2Client
from app.proxy import get_proxy

logger = logging.getLogger("app.password_change")

DEFAULT_PASSWORDS = frozenset({"Mhs-1945", "Mhs-2026"})

SYSTEMS = {
    "siakad": {"label": "SIAKAD", "client": StudentV2Client, "path": "/mahasiswa/password"},
    "mybest": {"label": "MyBest", "client": ElearningClient, "path": "/profil"},
}

_OLD_RE = re.compile(r"old|lama|current|sekarang|curr|existing", re.I)
_CONFIRM_RE = re.compile(r"confirm|konfirmasi|ulang|retype|repeat|verif|re_?pass|again|_2$", re.I)
_FLASH_XPATH = (
    "//*[contains(concat(' ', normalize-space(@class), ' '), ' alert ') "
    "or contains(@class, 'invalid-feedback') or contains(@class, 'text-danger') "
    "or contains(@class, 'swal') or contains(@class, 'toast')]"
)


def is_default_password(password: str) -> bool:
    return (password or "").strip() in DEFAULT_PASSWORDS


def validate_new_password(nim: str, current: str, new: str) -> Optional[str]:
    """Kembalikan pesan error (Bahasa Indonesia) atau None bila password baru layak."""
    if len(new) < 8:
        return "Password baru minimal 8 karakter."
    if len(new) > 64:
        return "Password baru maksimal 64 karakter."
    if new != new.strip():
        return "Password baru tidak boleh diawali atau diakhiri spasi."
    if not re.search(r"[A-Za-z]", new) or not re.search(r"\d", new):
        return "Password baru wajib berisi huruf dan angka."
    if is_default_password(new):
        return "Password baru tidak boleh sama dengan password default kampus."
    if new == current:
        return "Password baru harus berbeda dari password lama."
    if nim and nim in new:
        return "Password baru tidak boleh mengandung NIM."
    return None


@dataclass
class PasswordForm:
    action: str
    method: str
    fields: dict[str, str] = field(default_factory=dict)
    old_field: Optional[str] = None
    new_field: Optional[str] = None
    confirm_field: Optional[str] = None

    def payload(self, old: str, new: str) -> dict[str, str]:
        data = dict(self.fields)
        if self.old_field:
            data[self.old_field] = old
        if self.new_field:
            data[self.new_field] = new
        if self.confirm_field:
            data[self.confirm_field] = new
        return data


def _field_key(el) -> str:
    return " ".join(filter(None, [el.get("name"), el.get("id"), el.get("placeholder"), el.get("autocomplete")]))


def find_password_form(page_html: str, page_url: str) -> Optional[PasswordForm]:
    """Cari form ganti password di halaman dan petakan field lama/baru/konfirmasi.

    Action form wajib berada di host yang sama dengan halaman (anti kebocoran kredensial).
    """
    if not page_html:
        return None
    try:
        doc = lxml_html.fromstring(page_html)
    except (ValueError, lxml_html.etree.ParserError):
        return None

    best = None
    for form in doc.xpath("//form"):
        pw_inputs = [i for i in form.xpath(".//input") if (i.get("type") or "").lower() == "password" and i.get("name")]
        if len(pw_inputs) >= 2 and (best is None or len(pw_inputs) > len(best[1])):
            best = (form, pw_inputs)
    if best is None:
        return None
    form, pw_inputs = best

    action = urljoin(page_url, form.get("action") or page_url)
    if urlparse(action).netloc != urlparse(page_url).netloc or urlparse(action).scheme not in ("http", "https"):
        logger.warning("Form password menunjuk host lain (%s), dibatalkan", action)
        return None

    fields: dict[str, str] = {}
    for el in form.xpath(".//input[@name]"):
        typ = (el.get("type") or "text").lower()
        if typ in ("password", "file", "button", "image", "reset"):
            continue
        if typ in ("checkbox", "radio") and el.get("checked") is None:
            continue
        if typ == "submit":
            continue
        fields[el.get("name")] = el.get("value") or ""
    for sel in form.xpath(".//select[@name]"):
        chosen = sel.xpath(".//option[@selected]") or sel.xpath(".//option")
        if chosen:
            fields[sel.get("name")] = chosen[0].get("value") or (chosen[0].text or "").strip()
    for ta in form.xpath(".//textarea[@name]"):
        fields[ta.get("name")] = ta.text or ""

    old_f = new_f = confirm_f = None
    rest = []
    for el in pw_inputs:
        key = _field_key(el)
        if old_f is None and _OLD_RE.search(key):
            old_f = el.get("name")
        elif confirm_f is None and _CONFIRM_RE.search(key):
            confirm_f = el.get("name")
        else:
            rest.append(el.get("name"))
    if new_f is None and rest:
        new_f = rest.pop(0)
    # Tanpa nama yang jelas: 3 field = lama, baru, konfirmasi (urutan umum form Laravel).
    if old_f is None and confirm_f is None and len(pw_inputs) >= 3:
        names = [el.get("name") for el in pw_inputs]
        old_f, new_f, confirm_f = names[0], names[1], names[2]
    elif confirm_f is None and rest:
        confirm_f = rest.pop(0)
    if not new_f:
        return None

    return PasswordForm(
        action=action,
        method=(form.get("method") or "post").lower(),
        fields=fields,
        old_field=old_f,
        new_field=new_f,
        confirm_field=confirm_f,
    )


def extract_flash_message(page_html: str) -> Optional[str]:
    try:
        doc = lxml_html.fromstring(page_html or "<html></html>")
    except (ValueError, lxml_html.etree.ParserError):
        return None
    for el in doc.xpath(_FLASH_XPATH):
        text = re.sub(r"\s+", " ", el.text_content() or "").strip(" ×x\n")
        if 3 < len(text) < 240:
            return text
    return None


@dataclass
class ChangeResult:
    status: str  # "changed" | "rejected" | "unknown" | "form_missing" | "login_failed"
    message: str


def _login_ok(client_factory: Callable, nim: str, password: str, attempts: int = 2) -> bool:
    for _ in range(attempts):
        client = client_factory()
        try:
            if client.login(nim, password):
                return True
        except Exception as err:
            logger.warning("Verifikasi login gagal untuk %s: %s", nim, err)
        finally:
            client.close()
    return False


def change_upstream_password(system: str, nim: str, old: str, new: str) -> ChangeResult:
    """Jalankan alur ganti password secara sinkron (panggil via run_in_executor)."""
    spec = SYSTEMS[system]
    label = spec["label"]

    def factory():
        return spec["client"](proxy=get_proxy(seed=nim))

    client = factory()
    try:
        if not client.login(nim, old):
            return ChangeResult("login_failed", f"Password {label} saat ini ditolak server kampus.")
        page_url = f"{client.BASE_URL}{spec['path']}"
        page = client.get_client().get(page_url)
        form = find_password_form(page.text, str(page.url))
        if form is None:
            return ChangeResult(
                "form_missing",
                f"Form ganti password {label} tidak ditemukan. Ganti lewat situs resmi: {page_url}",
            )
        http = client.get_client()
        payload = form.payload(old, new)
        if form.method == "get":
            resp = http.get(form.action, params=payload, headers={"Referer": page_url})
        else:
            resp = http.post(form.action, data=payload, headers={"Referer": page_url})
        flash = extract_flash_message(resp.text)
    except Exception as err:
        logger.error("Ganti password %s gagal untuk %s: %s", label, nim, err)
        return ChangeResult("unknown", f"Koneksi ke {label} terputus. Cek dengan login ulang sebelum mencoba lagi.")
    finally:
        client.close()

    # Bukti akhir: hanya login nyata yang menentukan berhasil atau tidak.
    if _login_ok(factory, nim, new):
        return ChangeResult("changed", f"Password {label} berhasil diganti dan sudah dicek dengan login ulang.")
    if _login_ok(factory, nim, old, attempts=1):
        return ChangeResult("rejected", flash or f"{label} menolak password baru. Coba kombinasi lain.")
    return ChangeResult(
        "unknown",
        f"Status password {label} belum pasti. Coba login ke {label} memakai password baru.",
    )
