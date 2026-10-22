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
    "gitlab.com": "GitLab",
    "bitbucket.org": "Bitbucket",
}


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def clean_url(raw: str) -> str:
    """Rapikan input mentah: buang kutip/kurung sudut, ambil URL dari teks bebas, tambah https:// bila hilang."""
    text = (raw or "").strip().strip("<>\"'")
    found = re.search(r"https?://[^\s<>\"']+", text)
    if found:
        return found.group(0).rstrip(".,;)")
    parts = text.split()
    first = parts[0] if parts else ""
    if first and not re.match(r"^[a-z][a-z0-9+.-]*:", first, re.IGNORECASE) and re.match(r"^(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:[/?#]|$)", first):
        return "https://" + first
    return text


_PUBLISHED = {
    # jenis -> (label, singkatan, ekor path publikasi, parameter embed)
    "document": ("Dokumen Google Docs", "docs", "pub", "embedded=true"),
    "spreadsheets": ("Spreadsheet Google Sheets", "sheets", "pubhtml", "widget=true&headers=false"),
    "presentation": ("Presentasi Google Slides", "slides", "embed", "start=false&loop=false"),
}


def parse_share_link(raw_url: str) -> Optional[dict[str, Any]]:
    """Urai link jadi struktur rapi. None bila bukan URL http(s) yang valid."""
    url = clean_url(raw_url)
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        return None
    host = _host(url)
    path = parsed.path or ""
    query = parse_qs(parsed.query)
    query_id = (query.get("id") or [None])[0]
    query_id = query_id if query_id and re.fullmatch(_ID, query_id) else None

    base: dict[str, Any] = {
        "url": url,
        "provider": "web",
        "kind": "web",
        "label": "Tautan web",
        "id": None,
        "normalized_url": url,
        "preview_url": None,
        "probe_url": None,
        "ambiguous": False,
    }

    def folder_info(fid: str) -> dict[str, Any]:
        normalized = f"https://drive.google.com/drive/folders/{fid}"
        return {**base, "provider": "google_drive", "kind": "folder", "label": "Folder Google Drive", "id": fid,
                "normalized_url": normalized, "probe_url": normalized,
                "preview_url": f"https://drive.google.com/embeddedfolderview?id={fid}#list"}

    def file_info(fid: str, ambiguous: bool = False) -> dict[str, Any]:
        normalized = f"https://drive.google.com/file/d/{fid}/view"
        return {**base, "provider": "google_drive", "kind": "file", "label": "Berkas Google Drive", "id": fid,
                "normalized_url": normalized, "probe_url": normalized, "ambiguous": ambiguous,
                "preview_url": f"https://drive.google.com/file/d/{fid}/preview"}

    if host in ("drive.google.com", "drive.usercontent.google.com"):
        folder = re.search(rf"/folders/({_ID})", path)
        if folder:
            return folder_info(folder.group(1))
        if path.rstrip("/").endswith("/folderview") and query_id:
            return folder_info(query_id)
        file_ = re.search(rf"/file/(?:u/\d+/)?d/({_ID})", path)
        if file_:
            return file_info(file_.group(1))
        if query_id:
            # open?id=... bisa berkas atau folder; jenis pastinya ditentukan dari pengalihan Google saat dicek.
            return file_info(query_id, ambiguous=path.rstrip("/").endswith("/open"))
        return {**base, "provider": "google_drive", "label": "Google Drive (tautan tidak lengkap)"}

    if host == "docs.google.com":
        published = re.match(rf"/(document|spreadsheets|presentation)/d/e/({_ID})", path)
        if published:
            label, short, tail, embed = _PUBLISHED[published.group(1)]
            clean = f"https://docs.google.com/{published.group(1)}/d/e/{published.group(2)}/{tail if tail != 'embed' else 'pub'}"
            preview = f"https://docs.google.com/{published.group(1)}/d/e/{published.group(2)}/{tail}?{embed}"
            return {**base, "provider": "google_docs", "kind": short, "label": f"{label} (dipublikasikan)", "id": published.group(2),
                    "normalized_url": clean, "probe_url": clean, "preview_url": preview}
        match = re.match(rf"/(document|spreadsheets|presentation|forms)/(?:u/\d+/)?d/({_ID})", path)
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

    if host in ("youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"):
        vid = None
        if host == "youtu.be":
            vid = path.strip("/").split("/")[0]
        elif path.startswith(("/shorts/", "/embed/", "/live/")):
            vid = path.split("/")[2] if len(path.split("/")) > 2 else None
        else:
            vid = (query.get("v") or [None])[0]
        if vid and re.fullmatch(r"[A-Za-z0-9_-]{11}", vid):
            return {**base, "provider": "youtube", "kind": "video", "label": "Video YouTube", "id": vid,
                    "normalized_url": f"https://www.youtube.com/watch?v={vid}",
                    "preview_url": f"https://www.youtube-nocookie.com/embed/{vid}"}
        return {**base, "provider": "youtube", "label": "Tautan YouTube"}

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
    access, title, message, _ = await probe_full(client, url)
    return access, title, message


async def probe_full(client: httpx.AsyncClient, url: str) -> tuple[str, Optional[str], str, Optional[str]]:
    """Ambil link tanpa login, ikuti redirect secara manual dan hanya ke host allowlist.

    Return (access, title, pesan, url akhir setelah pengalihan).
    """
    current = url
    via_login = False
    for _ in range(5):
        host = _host(current)
        if host not in FETCH_HOSTS and host not in _FOLLOW_HOSTS:
            return "unknown", None, "Status link belum bisa dipastikan.", None
        try:
            # Stream + cap body: jangan download file ratusan MB ke RAM
            async with client.stream("GET", current, follow_redirects=False) as response:
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("location", "")
                    try:
                        target = httpx.URL(current).join(location)
                    except httpx.InvalidURL:
                        return "unknown", None, "Redirect link tidak valid."
                    target_host = (target.host or "").lower()
                    if target_host in _LOGIN_HOSTS:
                        via_login = True
                        break
                    if target_host in _CONSENT_HOSTS:
                        return "unknown", None, "Google meminta persetujuan cookie, status link belum bisa dipastikan.", None
                    current = str(target)
                    continue
                chunks: list[bytes] = []
                total = 0
                if response.status_code == 200:
                    async for chunk in response.aiter_bytes(65536):
                        chunks.append(chunk)
                        total += len(chunk)
                        if total >= 256_000:
                            break
                text = b"".join(chunks).decode("utf-8", errors="replace")[:200_000]
                return (*classify_response(response.status_code, _host(current), text, False), current)
        except (httpx.HTTPError, OSError):
            return "unknown", None, "Tidak bisa menghubungi server link. Coba lagi sebentar.", None
    return (*classify_response(0, "", "", via_login), None) if via_login else ("unknown", None, "Terlalu banyak pengalihan.", None)


def _cache_key(probe_url: str) -> str:
    return "ubsi:linkcheck:" + hashlib.sha1(probe_url.encode()).hexdigest()


def _result_from(info: dict[str, Any]) -> dict[str, Any]:
    return {
        "url": info["url"], "valid": True, "provider": info["provider"], "kind": info["kind"], "label": info["label"],
        "id": info["id"], "normalized_url": info["normalized_url"], "preview_url": info["preview_url"],
        "can_preview": bool(info["preview_url"]), "access": "unknown", "title": None,
        "message": "Layanan ini tidak bisa diperiksa otomatis. Pastikan dosen bisa membukanya tanpa login.",
    }


_STRUCTURE_KEYS = ("provider", "kind", "label", "id", "normalized_url", "preview_url")


async def check_link(
    raw_url: str, client: httpx.AsyncClient, redis: Any = None, refresh: bool = False
) -> dict[str, Any]:
    info = parse_share_link(raw_url)
    if info is None:
        return {
            "url": raw_url, "valid": False, "provider": None, "kind": None, "label": "Bukan link yang valid",
            "id": None, "normalized_url": None, "preview_url": None, "can_preview": False,
            "access": "invalid", "title": None, "message": "Masukkan URL lengkap, misalnya https://drive.google.com/...",
        }
    result = _result_from(info)
    probe_url = info["probe_url"]
    if not probe_url:
        if info["provider"] in ("google_drive", "google_docs"):
            result["message"] = "Link belum lengkap atau bukan link berkas. Salin link dari tombol Bagikan di Google Drive."
        return result

    # open?id=... bisa folder atau berkas: ikuti pengalihan Google untuk tahu jenisnya.
    ambiguous = bool(info.get("ambiguous"))
    fetch_url = f"https://drive.google.com/open?id={info['id']}" if ambiguous else probe_url

    key = _cache_key(fetch_url)
    if redis is not None and not refresh:
        try:
            cached = await redis.get(key)
            if cached:
                data = json.loads(cached)
                return {**result, **data}
        except Exception:
            pass

    access, title, message, final_url = await probe_full(client, fetch_url)
    if ambiguous and final_url:
        resolved = parse_share_link(final_url)
        if resolved and resolved["provider"] == "google_drive" and resolved["id"] == info["id"]:
            result.update(_result_from({**resolved, "url": info["url"]}))
    if access != "public":
        result["can_preview"] = False
    data = {k: result[k] for k in _STRUCTURE_KEYS}
    data.update({"access": access, "title": title, "message": message, "can_preview": result["can_preview"] and access == "public"})
    if redis is not None:
        try:
            await redis.set(key, json.dumps(data), ex=600 if access == "public" else 60)
        except Exception:
            pass
    return {**result, **data}


async def check_links(urls: list[str], redis: Any = None, refresh: bool = False) -> list[dict[str, Any]]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "id,en;q=0.8",
    }
    semaphore = asyncio.Semaphore(5)
    async with httpx.AsyncClient(timeout=8, headers=headers) as client:

        async def one(url: str) -> dict[str, Any]:
            async with semaphore:
                try:
                    return await check_link(url, client, redis, refresh)
                except httpx.InvalidURL:
                    return {
                        "url": url, "valid": True, "provider": None, "kind": None, "label": "Link tidak valid",
                        "id": None, "normalized_url": None, "preview_url": None, "can_preview": False,
                        "access": "unknown", "title": None, "message": "Redirect link tidak valid.",
                    }

        # return_exceptions=True: 1 link jelek tidak boleh menggugurkan batch 20 link
        results = await asyncio.gather(*(one(u) for u in urls), return_exceptions=True)
        return [r if isinstance(r, dict) else {
            "url": u, "valid": True, "provider": None, "kind": None, "label": "Gagal diperiksa",
            "id": None, "normalized_url": None, "preview_url": None, "can_preview": False,
            "access": "unknown", "title": None, "message": "Pemeriksaan link gagal. Coba lagi sebentar.",
        } for u, r in zip(urls, results)]
