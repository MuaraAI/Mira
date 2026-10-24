"""Ambil berkas Google Drive / Docs yang sudah publik supaya bisa dipratinjau di aplikasi sendiri.

Iframe pratinjau Google punya pengalaman buruk di HP (zoom melompat, lambat, minta login).
Dengan mengambil berkasnya (PDF atau gambar) dari server, aplikasi bisa memakai penampil sendiri.

Keamanan (anti-SSRF): hanya URL yang dibangun dari ID tervalidasi ke host Google yang di-fetch,
setiap pengalihan diperiksa ulang, ukuran dibatasi, dan hanya PDF/gambar yang diteruskan.
Berkas privat tidak pernah diteruskan: pengalihan ke halaman login berarti ditolak.
"""
import re
from typing import Any, Optional
from urllib.parse import quote, unquote

import httpx

MAX_BYTES = 25 * 1024 * 1024
_FIXED_HOSTS = {"drive.google.com", "docs.google.com", "drive.usercontent.google.com"}
_LOGIN_HOSTS = {"accounts.google.com", "accounts.youtube.com"}
_ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"}


class ProxyError(Exception):
    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _allowed_host(host: str) -> bool:
    host = (host or "").lower()
    return host in _FIXED_HOSTS or host.endswith(".googleusercontent.com")


def source_url(info: dict[str, Any]) -> Optional[str]:
    """URL unduhan/ekspor untuk berkas yang dikenali, atau None bila jenisnya tidak didukung."""
    fid = info.get("id")
    if not fid:
        return None
    if info.get("provider") == "google_drive" and info.get("kind") == "file":
        return f"https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t"
    if info.get("provider") == "google_docs" and "/d/e/" not in (info.get("normalized_url") or ""):
        kind = info.get("kind")
        if kind == "docs":
            return f"https://docs.google.com/document/d/{fid}/export?format=pdf"
        if kind == "sheets":
            return f"https://docs.google.com/spreadsheets/d/{fid}/export?format=pdf"
        if kind == "slides":
            return f"https://docs.google.com/presentation/d/{fid}/export/pdf"
    return None


def _filename(headers: httpx.Headers, fallback: str) -> str:
    disposition = headers.get("content-disposition", "")
    star = re.search(r"filename\*\s*=\s*[\w-]+''([^;]+)", disposition, re.IGNORECASE)
    if star:
        return unquote(star.group(1)).strip() or fallback
    plain = re.search(r'filename\s*=\s*"?([^";]+)"?', disposition, re.IGNORECASE)
    if plain:
        return plain.group(1).strip() or fallback
    return fallback


def content_disposition(filename: str) -> str:
    safe = re.sub(r'[\r\n"\\]', "_", filename) or "berkas"
    ascii_name = safe.encode("ascii", "ignore").decode() or "berkas"
    return f"inline; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(safe)}"


async def fetch_public_file(info: dict[str, Any], client: httpx.AsyncClient) -> tuple[bytes, str, str]:
    """Return (isi, content-type, nama berkas). Raise ProxyError bila tidak bisa/tidak boleh."""
    url = source_url(info)
    if not url:
        raise ProxyError("UNSUPPORTED_LINK", "Jenis link ini tidak bisa dipratinjau di aplikasi.", 400)

    fallback_name = {"docs": "dokumen.pdf", "sheets": "spreadsheet.pdf", "slides": "presentasi.pdf"}.get(info.get("kind") or "", "berkas")
    for _ in range(6):
        host = httpx.URL(url).host
        if not _allowed_host(host) or not url.startswith("https://"):
            raise ProxyError("UNSUPPORTED_LINK", "Berkas dialihkan ke alamat yang tidak diizinkan.", 400)
        try:
            async with client.stream("GET", url, follow_redirects=False) as response:
                if response.status_code in (301, 302, 303, 307, 308):
                    target = httpx.URL(url).join(response.headers.get("location", ""))
                    if (target.host or "").lower() in _LOGIN_HOSTS:
                        raise ProxyError("NOT_PUBLIC", "Berkas masih privat, jadi tidak bisa ditampilkan.", 403)
                    url = str(target)
                    continue
                if response.status_code == 404:
                    raise ProxyError("NOT_FOUND", "Berkas tidak ditemukan atau sudah dihapus.", 404)
                if response.status_code in (401, 403):
                    raise ProxyError("NOT_PUBLIC", "Berkas masih privat, jadi tidak bisa ditampilkan.", 403)
                if response.status_code != 200:
                    raise ProxyError("UPSTREAM_ERROR", "Google belum bisa dihubungi. Coba lagi sebentar.", 502)

                content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                if content_type not in _ALLOWED_TYPES:
                    if content_type == "text/html":
                        raise ProxyError("NOT_PUBLIC", "Berkas masih privat atau meminta konfirmasi, jadi tidak bisa ditampilkan.", 403)
                    raise ProxyError("UNSUPPORTED_TYPE", "Jenis berkas ini belum bisa dipratinjau. Buka lewat Google Drive.", 415)
                declared = int(response.headers.get("content-length", "0") or 0)
                if declared > MAX_BYTES:
                    raise ProxyError("TOO_LARGE", "Berkas terlalu besar untuk dipratinjau (maksimal 25 MB).", 413)
                buf = bytearray()
                async for chunk in response.aiter_bytes():
                    if len(buf) + len(chunk) > MAX_BYTES:
                        raise ProxyError("TOO_LARGE", "Berkas terlalu besar untuk dipratinjau (maksimal 25 MB).", 413)
                    buf.extend(chunk)
                return bytes(buf), content_type, _filename(response.headers, fallback_name)
        except httpx.HTTPError:
            raise ProxyError("UPSTREAM_ERROR", "Google belum bisa dihubungi. Coba lagi sebentar.", 502)
    raise ProxyError("UPSTREAM_ERROR", "Terlalu banyak pengalihan.", 502)
