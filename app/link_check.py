"""Pemeriksa link tugas (Google Drive, Google Docs, GitHub).

Mengurai struktur link (jenis, ID, link bersih, link pratinjau) dan memeriksa dari sisi server,
TANPA login, apakah orang lain bisa membukanya. Itu sama dengan yang dilihat dosen yang hanya
punya link: kalau Google mengarahkan ke halaman login, berarti link masih privat.

Keamanan (anti-SSRF): hanya host pada allowlist yang pernah diambil, termasuk setiap redirect.
Link ke domain lain hanya diurai, tidak pernah di-fetch.
"""
import asyncio
import hashlib
import html as html_lib
import json
import re
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

import httpx

_ID = r"[A-Za-z0-9_-]{10,}"
_DOC_TYPES = {
    "document": ("Dokumen Google Docs", "docs"),
    "spreadsheets": ("Spreadsheet Google Sheets", "sheets"),
    "presentation": ("Presentasi Google Slides", "slides"),
    "forms": ("Formulir Google Forms", "forms"),
}

# Hanya host ini yang boleh di-fetch (termasuk setiap lompatan redirect).
FETCH_HOSTS = {"drive.google.com", "docs.google.com", "github.com"}
_LOGIN_HOSTS = {"accounts.google.com", "accounts.youtube.com"}
_CONSENT_HOSTS = {"consent.google.com", "consent.youtube.com"}
_FOLLOW_HOSTS = {"drive.google.com", "docs.google.com", "drive.usercontent.google.com", "github.com"}

_PRIVATE_TITLE = re.compile(
    r"(sign in|login|masuk|access denied|akses ditolak|request access|minta akses|you need access|memerlukan akses|permission)",
    re.IGNORECASE,
)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)

_WEB_PROVIDERS = {
    "dropbox.com": "Dropbox",
    "onedrive.live.com": "OneDrive",
    "1drv.ms": "OneDrive",
    "sharepoint.com": "SharePoint",
    "mega.nz": "MEGA",
    "notion.so": "Notion",
    "notion.site": "Notion",
    "canva.com": "Canva",
    "figma.com": "Figma",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "gitlab.com": "GitLab",
    "bitbucket.org": "Bitbucket",
}


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def parse_share_link(raw_url: str) -> Optional[dict[str, Any]]:
    """Urai link jadi struktur rapi. None bila bukan URL http(s) yang valid."""
    url = (raw_url or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        return None
    host = _host(url)
    path = parsed.path or ""
    query = parse_qs(parsed.query)

    base: dict[str, Any] = {
        "url": url,
        "provider": "web",
        "kind": "web",
        "label": "Tautan web",
        "id": None,
        "normalized_url": url,
        "preview_url": None,
        "probe_url": None,
    }

    if host == "drive.google.com":
        folder = re.search(rf"/folders/({_ID})", path)
        file_ = re.search(rf"/file/d/({_ID})", path) or None
        open_id = (query.get("id") or [None])[0]
        if folder:
            fid = folder.group(1)
            normalized = f"https://drive.google.com/drive/folders/{fid}"
            return {**base, "provider": "google_drive", "kind": "folder", "label": "Folder Google Drive", "id": fid,
                    "normalized_url": normalized, "probe_url": normalized,
                    "preview_url": f"https://drive.google.com/embeddedfolderview?id={fid}#list"}
        fid = file_.group(1) if file_ else (open_id if open_id and re.fullmatch(_ID, open_id) else None)
        if fid:
            normalized = f"https://drive.google.com/file/d/{fid}/view"
            return {**base, "provider": "google_drive", "kind": "file", "label": "Berkas Google Drive", "id": fid,
                    "normalized_url": normalized, "probe_url": normalized,
                    "preview_url": f"https://drive.google.com/file/d/{fid}/preview"}
        return {**base, "provider": "google_drive", "label": "Google Drive (tautan tidak lengkap)"}

    if host == "docs.google.com":
        match = re.match(rf"/(document|spreadsheets|presentation|forms)/(?:u/\d+/)?d/(?:e/)?({_ID})", path)
        if match:
            label, short = _DOC_TYPES[match.group(1)]
            fid = match.group(2)
            if match.group(1) == "forms":
                return {**base, "provider": "google_docs", "kind": short, "label": label, "id": fid}
            normalized = f"https://docs.google.com/{match.group(1)}/d/{fid}/edit"
            return {**base, "provider": "google_docs", "kind": short, "label": label, "id": fid,
                    "normalized_url": normalized, "probe_url": normalized,
                    "preview_url": f"https://docs.google.com/{match.group(1)}/d/{fid}/preview"}
        return {**base, "provider": "google_docs", "label": "Google Docs (tautan tidak lengkap)"}

    if host == "github.com":
        parts = [p for p in path.split("/") if p]
        if len(parts) >= 2:
            owner, repo = parts[0], parts[1].removesuffix(".git")
            normalized = f"https://github.com/{owner}/{repo}"
            return {**base, "provider": "github", "kind": "repo", "label": "Repository GitHub", "id": f"{owner}/{repo}",
                    "normalized_url": normalized, "probe_url": normalized}
        return {**base, "provider": "github", "label": "GitHub"}

    for domain, name in _WEB_PROVIDERS.items():
        if host == domain or host.endswith("." + domain):
            return {**base, "provider": name.lower(), "label": f"Tautan {name}"}
    return base


def classify_response(status: int, final_host: str, body: str, via_login_redirect: bool) -> tuple[str, Optional[str], str]:
    """Return (access, title, pesan). access: public | private | missing | unknown."""
    if via_login_redirect:
        return "private", None, "Link masih privat: orang lain diminta login Google dulu."
    if status == 404:
        return "missing", None, "Berkas tidak ditemukan atau sudah dihapus."
    if status in (401, 403):
        return "private", None, "Link masih privat: orang lain tidak punya akses."
    if status == 200:
        match = _TITLE_RE.search(body or "")
        title = html_lib.unescape(re.sub(r"\s+", " ", match.group(1))).strip() if match else ""
        if title and _PRIVATE_TITLE.search(title):
            return "private", None, "Link masih privat: orang lain diminta login atau meminta akses."
        if final_host == "github.com":
            return "public", None, "Repository publik: semua orang bisa membukanya."
        clean = re.sub(r"\s*-\s*Google\s+(Drive|Docs|Sheets|Slides|Dokumen|Spreadsheet|Presentasi)\s*$", "", title, flags=re.IGNORECASE)
        return "public", clean or None, "Link publik: siapa pun yang punya link bisa membukanya."
    return "unknown", None, "Status link belum bisa dipastikan. Coba lagi sebentar."


async def probe(client: httpx.AsyncClient, url: str) -> tuple[str, Optional[str], str]:
    """Ambil link tanpa login, ikuti redirect secara manual dan hanya ke host allowlist."""
    current = url
    via_login = False
    for _ in range(5):
        host = _host(current)
        if host not in FETCH_HOSTS and host not in _FOLLOW_HOSTS:
            return "unknown", None, "Status link belum bisa dipastikan."
        try:
            response = await client.get(current, follow_redirects=False)
        except (httpx.HTTPError, OSError):
            return "unknown", None, "Tidak bisa menghubungi server link. Coba lagi sebentar."
        if response.status_code in (301, 302, 303, 307, 308):
            location = response.headers.get("location", "")
            target = httpx.URL(current).join(location)
            target_host = (target.host or "").lower()
            if target_host in _LOGIN_HOSTS:
                via_login = True
                break
            if target_host in _CONSENT_HOSTS:
                return "unknown", None, "Google meminta persetujuan cookie, status link belum bisa dipastikan."
            current = str(target)
            continue
        text = response.text[:200_000] if response.status_code == 200 else ""
        return classify_response(response.status_code, _host(current), text, False)
    return classify_response(0, "", "", via_login) if via_login else ("unknown", None, "Terlalu banyak pengalihan.")


def _cache_key(probe_url: str) -> str:
    return "ubsi:linkcheck:" + hashlib.sha1(probe_url.encode()).hexdigest()


async def check_link(
    raw_url: str, client: httpx.AsyncClient, redis: Any = None, refresh: bool = False
) -> dict[str, Any]:
    info = parse_share_link(raw_url)
    if info is None:
        return {
            "url": raw_url, "valid": False, "provider": None, "kind": None, "label": "Bukan link yang valid",
            "id": None, "normalized_url": None, "preview_url": None, "can_preview": False,
            "access": "invalid", "title": None, "message": "Masukkan URL lengkap diawali http:// atau https://",
        }
    result = {
        "url": info["url"], "valid": True, "provider": info["provider"], "kind": info["kind"], "label": info["label"],
        "id": info["id"], "normalized_url": info["normalized_url"], "preview_url": info["preview_url"],
        "can_preview": bool(info["preview_url"]), "access": "unknown", "title": None,
        "message": "Layanan ini tidak bisa diperiksa otomatis. Pastikan dosen bisa membukanya tanpa login.",
    }
    probe_url = info["probe_url"]
    if not probe_url:
        if info["provider"] in ("google_drive", "google_docs"):
            result["message"] = "Link belum lengkap atau bukan link berkas. Salin link dari tombol Bagikan di Google Drive."
        return result

    key = _cache_key(probe_url)
    if redis is not None and not refresh:
        try:
            cached = await redis.get(key)
            if cached:
                data = json.loads(cached)
                return {**result, **data}
        except Exception:
            pass

    access, title, message = await probe(client, probe_url)
    data = {"access": access, "title": title, "message": message}
    if access != "public":
        result["can_preview"] = False
    if redis is not None:
        try:
            await redis.set(key, json.dumps(data), ex=600 if access == "public" else 60)
        except Exception:
            pass
    return {**result, **data, "can_preview": result["can_preview"] and access == "public"}


async def check_links(urls: list[str], redis: Any = None, refresh: bool = False) -> list[dict[str, Any]]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "id,en;q=0.8",
    }
    semaphore = asyncio.Semaphore(5)
    async with httpx.AsyncClient(timeout=8, headers=headers) as client:

        async def one(url: str) -> dict[str, Any]:
            async with semaphore:
                return await check_link(url, client, redis, refresh)

        return list(await asyncio.gather(*(one(u) for u in urls)))
