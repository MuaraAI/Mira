import logging
import re
from typing import Any, Optional
import httpx
from fastapi import APIRouter
from scrapling.parser import Adaptor

from app.config import settings
from app.router_helper import cached_endpoint

logger = logging.getLogger("app.academic_events")

router = APIRouter(prefix="/v1/academic", tags=["academic"])

ACADEMIC_EVENTS_URL = "https://staffv2.bsi.ac.id/kegiatan-akademik"

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "mei": 5, "may": 5, "jun": 6,
    "jul": 7, "agu": 8, "aug": 8, "sep": 9, "okt": 10, "oct": 10, "nov": 11, "des": 12, "dec": 12,
}


def _parse_date(date_str: str) -> Optional[str]:
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})", date_str or "")
    if not m:
        return None
    day = int(m.group(1))
    mon = m.group(2).lower()[:3]
    yr = int(m.group(3))
    mon_num = _MONTH_MAP.get(mon)
    if not mon_num:
        return None
    return f"{yr:04d}-{mon_num:02d}-{day:02d}"


def _infer_category(nama: str) -> str:
    nama_l = nama.lower()
    if any(k in nama_l for k in ("uts", "uas", "ujian")):
        return "ujian"
    if "nilai" in nama_l:
        return "nilai"
    if any(k in nama_l for k in ("wisuda", "toga")):
        return "wisuda"
    if "libur" in nama_l:
        return "libur"
    if any(k in nama_l for k in ("krs", "daftar", "registrasi")):
        return "registrasi"
    return "akademik"


def parse_academic_events(html: str) -> list[dict[str, Any]]:
    """Ekstraksi tabel kegiatan & kalender akademik resmi UBSI dari staffv2.bsi.ac.id."""
    page = Adaptor(html)
    rows = page.css("table tr")
    events: list[dict[str, Any]] = []

    for r in rows:
        cols = r.css("td")
        if len(cols) >= 5:
            no = cols[0].get_all_text().strip()
            nama = cols[1].get_all_text().strip()
            if not nama:
                continue
            tgl_mulai_raw = cols[2].get_all_text().strip()
            tgl_selesai_raw = cols[3].get_all_text().strip()

            status_td = cols[4]
            badge = status_td.css(".badge")
            status_text = badge[0].get_all_text().strip() if badge else "Akan Datang"
            full_status = " ".join(status_td.get_all_text().split())

            m_days = re.search(r"(\d+)\s+hari\s+lagi", full_status, re.I)
            days_left = int(m_days.group(1)) if m_days else (0 if "hari ini" in full_status.lower() else None)
            countdown = f"{days_left} hari lagi" if days_left is not None else (status_text if status_text else None)

            slug = re.sub(r"[^a-z0-9]+", "-", nama.lower()).strip("-")
            events.append({
                "id": f"{slug}-{no}" if slug else f"event-{no}",
                "nama": nama,
                "tanggal_mulai": _parse_date(tgl_mulai_raw),
                "tanggal_selesai": _parse_date(tgl_selesai_raw),
                "tanggal_mulai_raw": tgl_mulai_raw,
                "tanggal_selesai_raw": tgl_selesai_raw,
                "status": status_text,
                "countdown": countdown,
                "days_left": days_left,
                "kategori": _infer_category(nama),
            })

    return events


async def fetch_academic_events_html() -> str:
    """Ambil halaman publik kegiatan akademik dari staffv2.bsi.ac.id."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.get(ACADEMIC_EVENTS_URL, headers=headers)
        resp.raise_for_status()
        return resp.text


@router.get("/events")
async def get_academic_events():
    """Jadwal agenda & kalender kegiatan akademik resmi UBSI (UTS, UAS, wisuda, libur)."""
    return await cached_endpoint(
        module="academic",
        name="events",
        fetch=fetch_academic_events_html,
        parse=parse_academic_events,
        ttl=settings.TTL_NEWS,
        cache_params={},
    )
