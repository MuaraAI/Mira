import asyncio
from datetime import datetime
import hashlib
import json
import logging
import re
import statistics
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response, status
from pydantic import BaseModel, Field
from lxml import html as lxml_html
from scrapling.parser import Adaptor

logger = logging.getLogger("app.elearning")

_ASSIGNMENT_FETCH_CONCURRENCY = 4
_ASSIGNMENT_FETCH_ATTEMPTS = 2
_PRESENCE_REKAP_TTL = 30

from app.config import settings
from app.deps import require_elearning_creds
from app.envelope import success_response, error_response
from app.session_pool import SessionPool
from app.upstream_session import UpstreamSession, is_logged_out_response
from app.retry import retry_async
from app.proxy import get_proxy
from app.cache import WIB, cache
from app.file_cache import serve_cached
from app.router_helper import cached_endpoint

router = APIRouter(prefix="/v1/elearning", tags=["elearning"])

# Pure Parsers (Unit-tested against snapshot fixtures)

def solve_captcha(question_text: str) -> Any:
    # 1. New SVG text captcha (<text ...>X</text>)
    svg_texts = re.findall(r"<text[^>]*>([^<]+)</text>", question_text)
    if svg_texts:
        return "".join(svg_texts).strip()

    # 2. Legacy math pattern ("12 + 5")
    m = re.search(r"(\d+)\s*\+\s*(\d+)", question_text)
    if m:
        return int(m.group(1)) + int(m.group(2))

    raise ValueError(f"Tidak dapat menemukan pola captcha di: {question_text[:100]}")

def parse_courses(html: str) -> list[dict[str, Any]]:
    if "jadwal tidak tersedia" in html.lower():
        return []
    page = Adaptor(html)
    plans = page.css("div.pricing-plan")
    cards = page.css("div.jadwal-card")
    if not plans and not cards:
        raise ValueError("HTML_STRUCTURE_CHANGED: elearning course cards not found")
    courses = []

    for card in cards:
        # Layout MyBest baru (jadwal-card): title, pill kelas, info-row label/val, footer links.
        info: dict[str, str] = {}
        for row in card.css(".jadwal-info-row"):
            lab = row.css(".jadwal-info-label")
            val = row.css(".jadwal-info-val")
            if lab and val:
                key = lab[0].get_all_text().strip().strip(":").strip().lower()
                info[key] = val[0].get_all_text().strip()

        title_el = card.css(".jadwal-title")
        nama = title_el[0].get_all_text().strip() if title_el else ""

        # "Hari & Jam: Selasa, 09:10-10:50" -> hari + jam; fallback badge hari di header.
        hari, jam = "", ""
        schedule_text = info.get("hari & jam", "")
        if ", " in schedule_text:
            hari, jam = (p.strip() for p in schedule_text.split(", ", 1))
        else:
            hari = schedule_text
        if not hari:
            hdr = card.css(".jadwal-header")
            if hdr:
                parts = hdr[0].get_all_text().split()
                hari = parts[1] if len(parts) > 1 else ""

        pill_el = card.css(".jadwal-kelas-pill")
        pill = pill_el[0].get_all_text().split(":")[-1].strip() if pill_el else ""

        card_text = " ".join(card.get_all_text().split())
        header_text = " ".join((card.css(".jadwal-header")[0].get_all_text().split()) if card.css(".jadwal-header") else [])

        m_sks = re.search(r"(\d+)", info.get("sks", ""))
        sks = int(m_sks.group(1)) if m_sks else 0

        kel_praktek = info.get("kel praktek", "").strip() or None
        kode_gabung = info.get("kode gabung", "").strip() or (pill if "gabung" in header_text.lower() else None)
        if not kode_gabung and pill.startswith(("KG.", "DG.")):
            kode_gabung = pill

        def extract_token(pattern: str) -> Optional[str]:
            for a in card.css("a"):
                href = a.attrib.get("href", "")
                if pattern in href:
                    return href.split(pattern)[-1]
            return None

        token_absen = extract_token("/absen-mhs/")
        token_diskusi = extract_token("/form-diskusimhs/")
        token_learning = extract_token("/learning/")
        token_assignment = extract_token("/assignment/")

        kode_mtk = info.get("kode mtk", "")
        item_id = hashlib.sha256(f"{kode_mtk}:{hari}:{jam}:{info.get('ruang', '')}".encode()).hexdigest()[:12]

        courses.append({
            "id": item_id,
            "kode": kode_mtk,
            "nama": nama,
            "sks": sks,
            "hari": hari,
            "jam": jam,
            "ruang": info.get("ruang", ""),
            "kode_dosen": info.get("dosen", "-"),
            "kelompok_praktek": kel_praktek,
            "kode_gabung": kode_gabung,
            "jadwal": {
                "hari": hari,
                "jam": jam,
                "ruang": info.get("ruang", ""),
            },
            "tokens": {
                "absen": token_absen,
                "diskusi": token_diskusi,
                "learning": token_learning,
                "assignment": token_assignment,
            },
            "token_absen": token_absen,
            "token_diskusi": token_diskusi,
            "token_learning": token_learning,
            "token_assignment": token_assignment,
        })

    for pl in plans:
        title_el = pl.css(".pricing-title")
        nama = title_el[0].get_all_text().strip() if title_el else ""

        save_el = pl.css(".pricing-save")
        schedule_text = save_el[0].get_all_text().strip() if save_el else ""
        hari, jam = "", ""
        if " - " in schedule_text:
            parts = schedule_text.split(" - ", 1)
            hari, jam = parts[0].strip(), parts[1].strip()
        else:
            hari = schedule_text

        card_text = " ".join(pl.get_all_text().split())
        
        m_dosen = re.search(r"Kode Dosen\s*:\s*([A-Za-z0-9]+)", card_text)
        dosen_code = m_dosen.group(1).strip() if m_dosen else "-"

        m_mtk = re.search(r"Kode MTK\s*:\s*([A-Za-z0-9]+)", card_text)
        kode_mtk = m_mtk.group(1).strip() if m_mtk else ""

        m_sks = re.search(r"SKS\s*:\s*(\d+)", card_text)
        sks = int(m_sks.group(1)) if m_sks else 0

        m_ruang = re.search(r"No Ruang\s*:\s*([A-Za-z0-9\-]+)", card_text)
        ruang = m_ruang.group(1).strip() if m_ruang else ""

        m_kel = re.search(r"Kel Praktek\s*:\s*(?!Kode\b)([A-Za-z0-9\.\-]+)", card_text)
        kel_praktek = m_kel.group(1).strip() if m_kel else None

        m_gabung = re.search(r"Kode Gabung\s*:\s*([A-Za-z0-9\.\-]+)", card_text)
        kode_gabung = m_gabung.group(1).strip() if m_gabung else None

        # Extract encrypted tokens
        def extract_token(pattern: str) -> Optional[str]:
            for a in pl.css("a"):
                href = a.attrib.get("href", "")
                if pattern in href:
                    return href.split(pattern)[-1]
            return None

        token_absen = extract_token("/absen-mhs/")
        token_diskusi = extract_token("/form-diskusimhs/")
        token_learning = extract_token("/learning/")
        token_assignment = extract_token("/assignment/")

        item_id = hashlib.sha256(f"{kode_mtk}:{hari}:{jam}:{ruang}".encode()).hexdigest()[:12]

        courses.append({
            "id": item_id,
            "kode": kode_mtk,
            "nama": nama,
            "sks": sks,
            "hari": hari,
            "jam": jam,
            "ruang": ruang,
            "kode_dosen": dosen_code,
            "kelompok_praktek": kel_praktek,
            "kode_gabung": kode_gabung,
            "jadwal": {
                "hari": hari,
                "jam": jam,
                "ruang": ruang,
            },
            "tokens": {
                "absen": token_absen,
                "diskusi": token_diskusi,
                "learning": token_learning,
                "assignment": token_assignment,
            },
            "token_absen": token_absen,
            "token_diskusi": token_diskusi,
            "token_learning": token_learning,
            "token_assignment": token_assignment,
        })

    return courses

def parse_assignments(html: str) -> dict[str, list[dict[str, Any]]]:
    page = Adaptor(html)
    tables = page.css("table")
    tasks = []
    submissions = []

    # Table 0: Tasks
    if len(tables) >= 1:
        for r in tables[0].css("tr")[1:]:
            cols = [c.get_all_text().strip() for c in r.css("td")]
            if len(cols) >= 8:
                item_id = hashlib.sha256(f"{cols[1]}:{cols[3]}:{cols[5]}".encode()).hexdigest()[:12]

                # 1. Direct download links
                soal_links = [
                    a.attrib.get("href")
                    for a in r.css("a")
                    if any(x in a.attrib.get("href", "").lower() for x in ("/storage/soal", "/soal", ".pdf", ".zip", ".docx", ".rar"))
                ]
                file_soal_url = soal_links[0] if soal_links else None

                # 2. Form download (POST /download-file-tugas with id & file)
                file_soal_id = None
                file_soal_name = None
                dl_forms = r.css("form[action*='download-file-tugas']")
                if dl_forms:
                    inp_id = dl_forms[0].css("input[name='id']")
                    inp_file = dl_forms[0].css("input[name='file']")
                    if inp_id and inp_id[0].attrib.get("value"):
                        file_soal_id = inp_id[0].attrib["value"]
                    if inp_file and inp_file[0].attrib.get("value"):
                        file_soal_name = inp_file[0].attrib["value"]
                    if not file_soal_url and file_soal_id and file_soal_name:
                        file_soal_url = f"/v1/elearning/assignments/download?id={file_soal_id}&file={file_soal_name}"

                # 3. Upload & send links (/assignment/send/ or /upload-tugas/)
                action_links = [
                    a.attrib.get("href")
                    for a in r.css("a")
                    if any(k in a.attrib.get("href", "") for k in ("upload-tugas", "form-tugas", "/assignment/send/"))
                ]
                upload_url = action_links[0] if action_links else None
                token_tugas = None
                token_send = None
                if upload_url:
                    m = re.search(r"/(?:upload-tugas|form-tugas|assignment/send)/([^/?#]+)", upload_url)
                    extracted = m.group(1) if m else upload_url.rstrip("/").split("/")[-1]
                    token_tugas = extracted
                    token_send = extracted

                tasks.append({
                    "id": item_id,
                    "kode": cols[1],
                    "kelas": cols[2],
                    "judul": cols[3],
                    "deskripsi": cols[4],
                    "pertemuan": cols[5],
                    "mulai": cols[6],
                    "selesai": cols[7],
                    "file_soal_url": file_soal_url,
                    "file_soal_id": file_soal_id,
                    "file_soal_name": file_soal_name,
                    "upload_url": upload_url,
                    "send_url": upload_url,
                    "token_tugas": token_tugas,
                    "token_send": token_send,
                })

    # Table 1: Submissions
    if len(tables) >= 2:
        for r in tables[1].css("tr")[1:]:
            cols = [c.get_all_text().strip() for c in r.css("td")]
            links = [a.attrib.get("href") for a in r.css("a") if a.attrib.get("href")]
            if len(cols) >= 7:
                item_id = hashlib.sha256(f"{cols[1]}:{cols[2]}:{cols[3]}".encode()).hexdigest()[:12]
                val_nilai = float(cols[6]) if cols[6] and cols[6].replace(".", "").isdigit() else None
                # MyBest menampilkan 0 untuk tugas yang belum diperiksa dosen: bukan nilai sungguhan,
                # jangan dihitung sebagai "sudah dinilai" maupun menurunkan rata-rata.
                if val_nilai is not None and val_nilai <= 0:
                    val_nilai = None
                submissions.append({
                    "id": item_id,
                    "kode": cols[1],
                    "judul": cols[2],
                    "pertemuan": cols[3],
                    "link_tugas": links[0] if links else cols[4],
                    "komentar_dosen": cols[5] if cols[5] else None,
                    "nilai": val_nilai,
                    "status_penilaian": "Sudah Dinilai" if val_nilai is not None else "Menunggu Penilaian",
                    "created": cols[7] if len(cols) > 7 else None,
                    "updated": cols[8] if len(cols) > 8 else None,
                })

    return {"tasks": tasks, "submissions": submissions}

def parse_presence(html: str) -> dict[str, Any]:
    page = Adaptor(html)
    tiles = page.css("div.info-tiles")
    info: dict[str, str] = {}
    for t in tiles:
        detail = t.css(".stats-detail")
        if detail:
            val = detail[0].css("h5")
            label = detail[0].css("p")
            if val and label:
                info[label[0].text.strip().lower()] = val[0].text.strip()

    btn = page.css("div.col-xl-3 button, button.btn-warning, button.btn-success, button.btn-info, button.btn-danger")
    status_sesi = btn[0].text.strip() if btn else None

    tables = page.css("table")
    records = []

    target_table = None
    for t in tables:
        h_text = " ".join([c.get_all_text().strip() for c in t.css("th")])
        rows_text = " ".join(r.get_all_text().lower() for r in t.css("tr")[1:])
        if (
            "status absen" in h_text.lower()
            or "pertemuan" in h_text.lower()
            or any(marker in rows_text for marker in ("hadir", "tidak hadir", "alpa", "izin", "sakit"))
        ):
            target_table = t
            break
    if target_table is None and tables:
        candidates = [t for t in tables if len(t.css("tr")) > 1]
        target_table = candidates[-1] if candidates else None

    if target_table:
        h_text = " ".join([c.get_all_text().strip() for c in target_table.css("th")])
        if not h_text and len(target_table.css("tr")) <= 1:
            target_table = None

    if target_table:
        headers = [" ".join(th.get_all_text().split()).lower() for th in target_table.css("th")]
        def value(cols: list[str], *names: str, fallback: int = 0) -> str:
            for name in names:
                if name in headers:
                    idx = headers.index(name)
                    if idx < len(cols):
                        return cols[idx]
            return cols[fallback] if fallback < len(cols) else ""

        for r in target_table.css("tr"):
            cells = r.css("td, th")
            cols = [" ".join(c.get_all_text().split()) for c in cells]
            row_text = " ".join(cols).lower()
            if not cols or "status absen" in row_text or len(cols) < 5:
                continue
            header_offset = 1 if len(headers) == len(cols) + 1 else 0
            row_headers = headers[header_offset:]
            def row_value(*names: str, fallback: int = 0) -> str:
                for name in names:
                    if name in row_headers:
                        idx = row_headers.index(name)
                        return cols[idx] if idx < len(cols) else ""
                return cols[fallback] if fallback < len(cols) else ""

            status = row_value("status absen", "status", fallback=0)
            tanggal = row_value("tanggal", "date", fallback=1)
            matakuliah = row_value("matakuliah", "mata kuliah", fallback=2)
            pertemuan = row_value("pertemuan", fallback=3)
            rangkuman = row_value("rangkuman", "materi", fallback=4)
            berita_acara = row_value("berita acara", "bap", fallback=5)
            item_id = hashlib.sha256(f"{tanggal}:{pertemuan}".encode()).hexdigest()[:12]
            records.append({
                "id": item_id,
                "status_absen": status,
                "tanggal": tanggal,
                "matakuliah": matakuliah,
                "pertemuan": pertemuan,
                "rangkuman": rangkuman or None,
                "berita_acara": berita_acara or None,
            })

    can_submit = bool(status_sesi) and (
        "absen" in status_sesi.lower() or "masuk" in status_sesi.lower()
    ) and not any(
        marker in status_sesi.lower() for marker in ("selesai", "belum", "tutup", "sudah", "telah", "hadir")
    )

    return {
        "kode_mtk": info.get("kode mtk"),
        "matakuliah": info.get("matakuliah") or info.get("mata kuliah"),
        "kelas": info.get("kelas"),
        "dosen": info.get("dosen"),
        "ruang": info.get("ruang"),
        "hari": info.get("hari"),
        "jam_masuk": info.get("jam masuk"),
        "jam_keluar": info.get("jam keluar"),
        "status_sesi": status_sesi,
        "can_submit": can_submit,
        "total_kehadiran": len(records),
        "riwayat": records,
    }


_PRESENCE_DATE = re.compile(r"(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[-/](\d{1,2})[-/](\d{4})")


def _record_date(value: str) -> Optional[tuple[int, int, int]]:
    m = _PRESENCE_DATE.search(value or "")
    if not m:
        return None
    if m.group(1):
        return int(m.group(1)), int(m.group(2)), int(m.group(3))
    return int(m.group(6)), int(m.group(5)), int(m.group(4))


def annotate_presence(presence: dict[str, Any], now: Optional[datetime] = None) -> dict[str, Any]:
    """Tandai apakah mahasiswa sudah absen hari ini (dari rekap) supaya UI tidak menyebutnya "belum dibuka"."""

    now = now or datetime.now(WIB)
    today = (now.year, now.month, now.day)
    present_today = any(
        _record_date(r.get("tanggal", "")) == today and "hadir" in (r.get("status_absen") or "").lower()
        and "tidak" not in (r.get("status_absen") or "").lower()
        for r in presence.get("riwayat") or []
    )
    status = (presence.get("status_sesi") or "").lower()
    if not present_today and any(k in status for k in ("sudah absen", "sudah hadir", "telah absen", "telah hadir")):
        present_today = True
    presence["present_today"] = present_today
    if present_today:
        presence["can_submit"] = False
        presence["status_sesi"] = "Sudah Absen"
    presence["server_time"] = now.isoformat()
    return presence


def parse_presence_rekap(raw_json: str | bytes) -> list[dict[str, Any]]:
    """Parse DataTables server-side JSON dari /rekap-side/{token}."""
    text = raw_json.decode("utf-8", "ignore") if isinstance(raw_json, bytes) else str(raw_json)
    try:
        obj = json.loads(text)
    except Exception:
        return []

    items = obj.get("data") or []
    records = []
    for it in items:
        raw_sts = it.get("status_hadir") or ""
        clean_sts = re.sub(r"<[^>]+>", "", str(raw_sts)).strip() or "Hadir"
        tgl = str(it.get("tgl_ajar_masuk") or "")
        pertemuan = str(it.get("pertemuan") or "")
        item_id = str(it.get("id") or hashlib.sha256(f"{tgl}:{pertemuan}".encode()).hexdigest()[:12])
        records.append({
            "id": item_id,
            "status_absen": clean_sts,
            "tanggal": tgl,
            "matakuliah": str(it.get("nm_mtk") or ""),
            "pertemuan": pertemuan,
            "rangkuman": it.get("rangkuman"),
            "berita_acara": it.get("berita_acara"),
            "dosen": it.get("kd_dosen"),
            "ruang": it.get("no_ruang"),
        })
    return records

def parse_materials(html: str) -> list[dict[str, Any]]:
    page = Adaptor(html)
    materials = []

    # 1. Materi Tambahan / Tatap Muka Dosen dari Tabel
    tables = page.css("table")
    if tables:
        for r in tables[0].css("tr")[1:]:
            cols = [c.get_all_text().strip() for c in r.css("td")]
            if len(cols) >= 5:
                item_id = hashlib.sha256(f"{cols[1]}:{cols[3]}".encode()).hexdigest()[:12]

                # Cek form POST download-file-materi
                file_id = None
                file_name = None
                forms = r.css("form[action*='download-file-materi']")
                if forms:
                    inp_id = forms[0].css("input[name='id']")
                    inp_file = forms[0].css("input[name='file']")
                    if inp_id and inp_id[0].attrib.get("value"):
                        file_id = inp_id[0].attrib["value"]
                    if inp_file and inp_file[0].attrib.get("value"):
                        file_name = inp_file[0].attrib["value"]

                # Cek anchor tag
                links = [a.attrib.get("href") for a in r.css("a") if a.attrib.get("href")]
                file_url = links[0] if links else None
                if not file_url and file_id and file_name:
                    file_url = f"/v1/elearning/materials/download?id={file_id}&file={file_name}"

                materials.append({
                    "id": item_id,
                    "kode": cols[1],
                    "kelas": cols[2],
                    "judul": cols[3],
                    "deskripsi": cols[4],
                    "file_url": file_url,
                    "file_id": file_id,
                    "file_name": file_name,
                    "kategori": "materi_dosen",
                    "update": cols[6] if len(cols) > 6 else None,
                })

    # 2. Paket Berkas Standar Resmi Kampus (Silabus, RPS, Slide, Modul, RTM)
    seen_urls = {m["file_url"] for m in materials if m.get("file_url")}
    for a in page.css("a"):
        h = a.attrib.get("href", "").strip()
        if h and any(ext in h.lower() for ext in [".zip", ".pdf", ".rar", "silabus", "bahan_ajar"]):
            if h not in seen_urls:
                seen_urls.add(h)
                cat = "bahan_ajar"
                title = "Bahan Ajar"
                desc = "Berkas resmi perkuliahan"
                if "/silabus/" in h.lower():
                    cat = "silabus"
                    title = "Silabus Mata Kuliah (ZIP)"
                    desc = "Garis besar pokok bahasan mata kuliah satu semester"
                elif "/rps/" in h.lower():
                    cat = "rps"
                    title = "Rencana Pembelajaran Semester / RPS (ZIP)"
                    desc = "Capaian pembelajaran lulusan (CPL) dan referensi dosen"
                elif "/slide/" in h.lower():
                    cat = "slide"
                    title = "Slide Presentasi Dosen P1-P14 (ZIP)"
                    desc = "Kumpulan slide materi tatap muka mingguan dosen"
                elif "/modul/" in h.lower():
                    cat = "modul"
                    title = "Modul Praktikum & Teori (ZIP)"
                    desc = "Panduan praktikum laboratorium dan studi kasus"
                elif "/rtm/" in h.lower():
                    cat = "rtm"
                    title = "Rencana Tugas Mahasiswa / RTM (ZIP)"
                    desc = "Pedoman tugas dan rubrik penilaian resmi"

                item_id = hashlib.sha256(h.encode()).hexdigest()[:12]
                materials.append({
                    "id": item_id,
                    "kode": None,
                    "kelas": None,
                    "judul": title,
                    "deskripsi": desc,
                    "file_url": h,
                    "file_id": None,
                    "file_name": None,
                    "kategori": cat,
                    "update": None,
                })

    return materials

def parse_discussions(html: str) -> dict[str, Any]:
    """Ekstraksi daftar topik forum diskusi perkuliahan MyBest."""
    page = Adaptor(html)
    threads = []

    # Meta form create new task
    form_create = page.css("form[action*='tambah-diskusimhs']")
    meta = {}
    if form_create:
        for inp in form_create[0].css("input"):
            name = inp.attrib.get("name")
            val = inp.attrib.get("value", "")
            if name in ("kd_lokal", "kd_mtk"):
                meta[name] = val

    for block in page.css("div.task-block"):
        name_el = block.css("div.task-name")
        judul = name_el[0].get_all_text().strip() if name_el else ""

        desc_el = block.css("div.task-desc")
        isi = desc_el[0].get_all_text().strip() if desc_el else ""

        author_badge = block.css("span.badge-info")
        penulis = author_badge[0].get_all_text().strip() if author_badge else ""

        date_badge = block.css("span.badge-primary")
        tanggal = date_badge[0].get_all_text().strip() if date_badge else ""

        del_inp = block.css("input[name='id_chat']")
        id_chat = del_inp[0].attrib.get("value") if del_inp else None

        kom_link_el = block.css("a[href*='/form-komentarmhs/']")
        kom_href = kom_link_el[0].attrib.get("href") if kom_link_el else None
        token_komentar = None
        if kom_href:
            m_kom = re.search(r"/form-komentarmhs/([^/?#]+)", kom_href)
            token_komentar = m_kom.group(1) if m_kom else kom_href.rstrip("/").split("/")[-1]

        count_badge = block.css("a[href*='/form-komentarmhs/'] span.badge")
        count_raw = count_badge[0].get_all_text().strip() if count_badge else "0"
        total_komentar = int(count_raw) if count_raw.isdigit() else 0

        threads.append({
            "id_chat": id_chat,
            "judul": judul,
            "isi": isi,
            "penulis": penulis,
            "tanggal": tanggal,
            "token_komentar": token_komentar,
            "total_komentar": total_komentar,
        })

    return {
        "meta": meta,
        "threads": threads,
    }

def parse_discussion_comments(html: str) -> list[dict[str, Any]]:
    """Ekstraksi thread komentar pada topik forum diskusi perkuliahan MyBest."""
    page = Adaptor(html)
    comments = []

    for li in page.css("li.chat-left, li.chat-right"):
        is_me = "chat-right" in li.attrib.get("class", "")

        avatar_name = li.css(".chat-avatar .chat-name")
        nim_user = avatar_name[0].get_all_text().strip() if avatar_name else None

        text_name = li.css(".chat-text .chat-name")
        nama = text_name[0].get_all_text().strip() if text_name else None

        p_el = li.css(".chat-text p")
        komentar = p_el[0].get_all_text().strip() if p_el else ""

        time_el = li.css(".chat-hour")
        tanggal = time_el[0].get_all_text().strip() if time_el else ""

        comments.append({
            "nim": nim_user,
            "nama": nama,
            "komentar": komentar,
            "tanggal": tanggal,
            "is_self": is_me,
        })

    return comments

def parse_elearning_profile(html: str) -> dict[str, Any]:
    """Ekstraksi informasi profil dan kontak akun MyBest."""
    page = Adaptor(html)
    name_inp = page.css("input[name='name']")
    name = name_inp[0].attrib.get("value", "").strip() if name_inp else ""
    email_inp = page.css("input[name='email']")
    email = email_inp[0].attrib.get("value", "").strip() if email_inp else ""
    return {
        "nama": name,
        "email": email,
    }

def parse_makeup_classes(html: str) -> list[dict[str, Any]]:
    """Ekstraksi jadwal kuliah pengganti (make-up classes) dari MyBest."""
    page = Adaptor(html)
    records = []
    tables = page.css("table")
    for t in tables:
        for r in t.css("tr")[1:]:
            cols = [c.get_all_text().strip() for c in r.css("td")]
            if len(cols) >= 3:
                records.append({
                    "kode": cols[0] if len(cols) > 0 else "-",
                    "mata_kuliah": cols[1] if len(cols) > 1 else "-",
                    "jadwal": cols[2] if len(cols) > 2 else "-",
                    "keterangan": cols[3] if len(cols) > 3 else "",
                })
    return records

def get_official_guides() -> list[dict[str, str]]:
    """Daftar buku panduan resmi MyBest perkuliahan mahasiswa UBSI."""
    return [
        {
            "judul": "Buku Panduan MyBest Mahasiswa",
            "kategori": "Panduan Umum",
            "url": "https://elearning.bsi.ac.id/storage/Panduan%20MyBest%20Mahasiswa.pdf",
            "format": "PDF",
        },
        {
            "judul": "Panduan Ujian Online Mahasiswa UBSI",
            "kategori": "Ujian Online",
            "url": "https://elearning.bsi.ac.id/storage/PANDUAN_UJIAN_ONLINE_MHS_UBSI.pdf",
            "format": "PDF",
        },
        {
            "judul": "Panduan Kuis MyBest Mahasiswa",
            "kategori": "Kuis Perkuliahan",
            "url": "https://elearning.bsi.ac.id/storage/Panduan%20Kuis%20MyBest%20Mahasiswa.pdf",
            "format": "PDF",
        },
    ]

def parse_quiz(html: str) -> list[dict[str, Any]]:
    page = Adaptor(html)
    quizzes = []
    rows = page.css("table tr")
    for r in rows[1:]:
        cols = [c.get_all_text().strip() for c in r.css("td")]
        if len(cols) >= 7:
            item_id = hashlib.sha256(f"{cols[2]}:{cols[5]}".encode()).hexdigest()[:12]
            action_btn = r.css("td:last-child a, td:last-child button")
            status_aksi = action_btn[0].get_all_text().strip() if action_btn else (cols[7] if len(cols) >= 8 else None)
            action_url = action_btn[0].attrib.get("href") if action_btn and action_btn[0].attrib.get("href") not in (None, "", "#") else None

            token_ujian = None
            if action_url:
                m_tok = re.search(r"/(?:halaman-ujian|mulai-ujian|ujian)/([^/?#]+)", action_url)
                token_ujian = m_tok.group(1) if m_tok else action_url.rstrip("/").split("/")[-1]

            quizzes.append({
                "id": item_id,
                "kode_mtk": cols[1] if cols[1] else None,
                "paket": cols[2],
                "dosen": cols[3] if cols[3] else None,
                "waktu": cols[4] if cols[4] else None,
                "ujian_mulai": cols[5],
                "ujian_selesai": cols[6],
                "status_aksi": status_aksi,
                "action_url": action_url,
                "token_ujian": token_ujian,
            })
    return quizzes

def parse_exam_types(html: str) -> dict[str, Any]:
    """Peta jenis ujian dari dashboard ujiankampusa (halaman /halaman-ujian MyBest).

    Sidebar dan Quick Timetable memuat set link yang sama -> dedupe by token.
    Token Laravel encrypted dirender fresh per halaman; simpan apa adanya.
    """
    page = Adaptor(html)
    seen: dict[str, dict[str, Any]] = {}
    for a in page.css('a[href*="/jadwal/"]'):
        href = a.attrib.get("href", "")
        # Ambil substring setelah /jadwal/ (bukan regex charclass): token upstream
        # bisa ter-encode dengan karakter seperti % yang memotong charclass.
        if "/jadwal/" not in href:
            continue
        token = href.split("/jadwal/", 1)[1].split("?", 1)[0].rstrip("/")
        if not token:
            continue
        label = " ".join((a.get_all_text() or "").split())
        if not label:
            continue
        key = _exam_type_key(label)
        # Token dirender berbeda per lokasi link (sidebar vs quick-tile), jadi
        # dedupe by KEY dan ambil token kemunculan pertama.
        if not key or key in seen:
            continue
        seen[key] = {"key": key, "label": label, "token": token}
    if not seen:
        # Halaman login / struktur berubah: bukan empty state yang valid.
        raise ValueError("exam dashboard marker missing: tidak ada link /jadwal/")
    # Token dipakai internal oleh fetch_exam_schedule; endpoint /exams
    # membuangnya sebelum menulis response (lihat get_exams).
    return {"types": list(seen.values())}


_EXAM_TYPE_KEYS = {
    "latihan": "latihan",
    "uts": "uts",
    "uas": "uas",
    "uts pengganti": "uts-pengganti",
    "uas pengganti": "uas-pengganti",
    "her": "her",
    "her pengganti": "her-pengganti",
    "her khusus": "her-khusus",
}


def _exam_type_key(label: str) -> Optional[str]:
    norm = label.lower().replace("jadwal", "").strip()
    return _EXAM_TYPE_KEYS.get(norm)


def parse_exam_schedule(html: str) -> dict[str, Any]:
    """Jadwal ujian satu jenis dari halaman /jadwal/{token} ujiankampusa.

    Kartu ujian (div.pricing-plan) hanya dirender saat ada jadwal; di luar itu
    halaman tetap valid dengan identitas mahasiswa (marker empty-state).
    URL masuk ujian SENGAJA tidak diekspos: verifikasi geolocation/IP hanya
    jalan di browser resmi, dan kita tidak ingin jadi pintu otomatisasi ujian.
    """
    page = Adaptor(html)
    ident = [a.get_all_text().strip() for a in page.css("ul.app-actions li a")]
    ident = [x for x in ident if x]
    if len(ident) < 2:
        raise ValueError("exam schedule marker missing: identitas mahasiswa tidak ditemukan")

    exams: list[dict[str, Any]] = []
    for plan in page.css("div.pricing-plan"):
        titles = plan.css(".pricing-title")
        saves = plan.css(".pricing-save")
        title = titles[0] if titles else None
        save = saves[0] if saves else None
        fields: dict[str, str] = {}
        for h5 in plan.css("h5"):
            text = " ".join((h5.get_all_text() or "").split())
            if ":" in text:
                k, _, v = text.partition(":")
                fields[k.replace("icon", "").strip().lower()] = v.strip()

        # Pintu masuk ujian identik dengan link /exercise-show/ (bukan gaya tombol:
        # restyle upstream tidak boleh mengubah arti status).
        enter_link = plan.css('a[href^="/exercise-show/"]')
        status_text = " ".join((enter_link[0].get_all_text() or "").split()) if enter_link else None
        cetak = plan.css('a[href*="/cetak-ujian-pdf/"]')

        def _digits(value: Optional[str]) -> Optional[str]:
            if not value:
                return value
            m = re.match(r"\s*(\d+)", value)
            return m.group(1) if m else value

        exams.append({
            "mata_kuliah": title.get_all_text().strip() if title else None,
            "waktu": " ".join((save.get_all_text() or "").split()) if save else None,
            "kode_dosen": fields.get("kode dosen"),
            "kode_mtk": fields.get("kode mtk"),
            "jenis_mtk": fields.get("jenis mtk"),
            "sks": fields.get("sks"),
            "no_ruang": fields.get("no ruang"),
            "tanggal_ujian": fields.get("tanggal ujian"),
            "durasi_menit": _digits(fields.get("waktu ujian")),
            "soal_pg": _digits(fields.get("jumlah soal pg")),
            "soal_essay": _digits(fields.get("jumlah soal essay")),
            "status": status_text,
            "can_enter": bool(enter_link),
        })

    # Empty-state valid HARUS terdeteksi positif: halaman kosong menampilkan
    # "Jadwal Ujian Tidak Tersedia". Markup berubah -> error, bukan cache kosong.
    page_text = page.get_all_text() or ""
    valid_empty = "Jadwal Ujian Tidak Tersedia" in page_text
    if not exams and not valid_empty:
        raise ValueError("exam schedule marker missing: kartu dan empty-state tidak ditemukan")

    return {
        "identity": {
            "nim": ident[0] if len(ident) > 0 else None,
            "nama": ident[1] if len(ident) > 1 else None,
        },
        "exams": exams,
        "empty_marker": True,  # lolos pengecekan marker di atas
    }


def inspect_session_status(html: str) -> dict[str, Any]:
    """Inspeksi status kelas dan informasi ruang dari halaman /absen-mhs/{token}."""
    page = Adaptor(html)
    tiles = page.css("div.info-tiles")
    info: dict[str, str] = {}
    for t in tiles:
        detail = t.css(".stats-detail")
        if detail:
            val = detail[0].css("h5")
            label = detail[0].css("p")
            if val and label:
                info[" ".join(label[0].get_all_text().split()).lower()] = " ".join(val[0].get_all_text().split())

    # In MyBest (2026 revamp), attendance check-in works via TWO possible forms:
    # 1. Legacy form: <form action="simpan-absen|absen"> (older MyBest layout)
    # 2. New form:    <form action="komentar-mhs">  (feedback-based form on /absen-mhs)
    # Both trigger presence update on upstream. Prefer komentar-mhs if present, else legacy.
    komentar_form = page.css("form[action*='komentar-mhs']")
    absen_form = page.css("form[action*='simpan-absen'], form[action*='absen']")
    target_form = komentar_form[0] if komentar_form else (absen_form[0] if absen_form else None)
    can_submit = bool(target_form)

    btn = page.css("div.col-xl-3 button, button.btn-warning, button.btn-success, button.btn-info, button.btn-danger, center button")
    status_raw = btn[0].get_all_text().strip() if btn else ("Absen Masuk" if can_submit else "Tidak Diketahui")

    form_action = None
    form_inputs: dict[str, str] = {}
    if target_form is not None:
        form_action = target_form.attrib.get("action", "/komentar-mhs")
        if form_action and form_action.startswith("https://"):
            # Normalize absolute action URL to relative path
            from urllib.parse import urlparse
            parsed = urlparse(form_action)
            form_action = parsed.path or form_action
        elif form_action and not form_action.startswith("/"):
            form_action = f"/{form_action}"
        form_inputs = {
            inp.attrib.get("name"): inp.attrib.get("value", "")
            for inp in target_form.css("input")
            if inp.attrib.get("name")
        }

    return {
        "status_raw": status_raw,
        "can_submit": can_submit,
        "kode_mtk": info.get("kode mtk"),
        "matakuliah": info.get("mata kuliah") or info.get("matakuliah"),
        "kelas": info.get("kelas"),
        "dosen": info.get("dosen"),
        "ruang": info.get("ruang"),
        "hari": info.get("hari"),
        "jam_masuk": info.get("jam masuk"),
        "jam_keluar": info.get("jam keluar"),
        "form_action": form_action,
        "form_inputs": form_inputs,
    }

def parse_quiz_questions(html: str) -> dict[str, Any]:
    """Ekstraksi daftar soal, sisa waktu, dan opsi jawaban dari halaman kuis/ujian."""
    page = Adaptor(html)
    csrf = page.css("meta[name='csrf-token']")
    csrf_token = csrf[0].attrib.get("content") if csrf else None

    waktu_akhir = page.css("#waktu-akhir")
    waktu_akhir_str = waktu_akhir[0].get_all_text().strip() if waktu_akhir else None

    timer_el = page.css("#demo, .timer")
    timer_str = timer_el[0].get_all_text().strip() if timer_el else None

    max_soal_el = page.css("#maxsoal")
    total_soal = (
        int(max_soal_el[0].attrib.get("data-max", 0))
        if max_soal_el and str(max_soal_el[0].attrib.get("data-max", "")).isdigit()
        else 0
    )

    spans = page.css("span.no_soal")
    soal_list = []
    for s in spans:
        no_str = s.attrib.get("data-no", "0")
        s_id = s.attrib.get("data-id", "")
        soal_list.append({
            "no": int(no_str) if no_str.isdigit() else 0,
            "id_soal": s_id,
        })

    if not total_soal and soal_list:
        total_soal = len(soal_list)

    # Question text
    soal_el = page.css(".soal")
    pertanyaan = soal_el[0].get_all_text().strip() if soal_el else ""

    # Options
    opsi_list = []
    for j in page.css(".jawab"):
        id_s = j.attrib.get("data-id")
        data_jawab = j.attrib.get("data-jawab", "")
        text = " ".join(j.get_all_text().split())
        key = text[:2].strip().rstrip(".")
        opsi_list.append({
            "key": key if key in ("A", "B", "C", "D", "E") else str(len(opsi_list) + 1),
            "text": text,
            "id_soal": id_s,
            "data_jawab": data_jawab,
        })

    nomer_urut_el = page.css("#nomerurut")
    current_soal_id = (
        nomer_urut_el[0].attrib.get("data-id")
        if nomer_urut_el
        else (soal_list[0]["id_soal"] if soal_list else None)
    )

    return {
        "csrf_token": csrf_token,
        "waktu_akhir": waktu_akhir_str,
        "sisa_waktu": timer_str,
        "total_soal": total_soal,
        "daftar_soal": soal_list,
        "current_soal": {
            "id_soal": current_soal_id,
            "pertanyaan": pertanyaan,
            "opsi": opsi_list,
        } if pertanyaan or opsi_list else None,
    }

# Rekap Nilai (Per Pertemuan)

def _pertemuan_sort_key(pertemuan: str) -> int:
    digits = [int(n) for n in re.findall(r"\d+", str(pertemuan))]
    return digits[0] if digits else 999

def summarize_grades(
    submissions: list[dict[str, Any]],
    quizzes: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Rekap status & statistik nilai tugas (dan kuis) per pertemuan.

    submissions: hasil parse_assignments()["submissions"] (satu mata kuliah
    atau gabungan beberapa matkul, dibedakan lewat kolom "kode").
    quizzes: hasil parse_quiz() opsional untuk pelengkap status ujian.
    """
    quizzes = quizzes or []

    by_pertemuan: dict[str, list[dict[str, Any]]] = {}
    for s in submissions:
        by_pertemuan.setdefault(s.get("pertemuan") or "-", []).append(s)

    pertemuan_rows = []
    for pert, items in by_pertemuan.items():
        graded = [s["nilai"] for s in items if isinstance(s.get("nilai"), (int, float))]
        pertemuan_rows.append({
            "pertemuan": pert,
            "total_tugas": len(items),
            "sudah_dinilai": len(graded),
            "belum_dinilai": len(items) - len(graded),
            "rata_nilai": round(statistics.fmean(graded), 2) if graded else None,
            "nilai_max": max(graded) if graded else None,
            "nilai_min": min(graded) if graded else None,
            "items": items,
        })
    pertemuan_rows.sort(key=lambda r: _pertemuan_sort_key(r["pertemuan"]))

    all_graded = [s["nilai"] for s in submissions if isinstance(s.get("nilai"), (int, float))]
    by_course: dict[str, list[float]] = {}
    for s in submissions:
        nilai = s.get("nilai")
        if isinstance(nilai, (int, float)):
            by_course.setdefault(s.get("kode") or "-", []).append(nilai)

    return {
        "total_tugas": len(submissions),
        "sudah_dinilai": len(all_graded),
        "belum_dinilai": len(submissions) - len(all_graded),
        "rata_nilai": round(statistics.fmean(all_graded), 2) if all_graded else None,
        "nilai_max": max(all_graded) if all_graded else None,
        "nilai_min": min(all_graded) if all_graded else None,
        "per_matkul": {
            kode: {
                "total_tugas": len(nilais),
                "rata_nilai": round(statistics.fmean(nilais), 2),
            }
            for kode, nilais in sorted(by_course.items())
        },
        "per_pertemuan": pertemuan_rows,
        "kuis": [
            {
                "paket": q.get("paket"),
                "kode_mtk": q.get("kode_mtk"),
                "dosen": q.get("dosen"),
                "ujian_mulai": q.get("ujian_mulai"),
                "ujian_selesai": q.get("ujian_selesai"),
            }
            for q in quizzes
        ],
    }

# Authenticated Scrapling Client

class ElearningClient(UpstreamSession):
    BASE_URL = "https://elearning.bsi.ac.id"
    MODULE = "elearning"
    HOST_LABEL = "elearning.bsi.ac.id"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Origin": "https://elearning.bsi.ac.id",
        "Referer": "https://elearning.bsi.ac.id/login",
    }

    def __init__(self, proxy: Optional[str] = None):
        self._proxy = proxy
        self._client: Optional[httpx.Client] = None
        self._logged_in: bool = False
        self._init_upstream_session()

    def get_client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            from app.upstream_session import SHARED_HTTP_LIMITS, SHARED_SSL_CONTEXT

            self._client = httpx.Client(
                headers=self.HEADERS,
                follow_redirects=True,
                timeout=25.0,
                proxy=self._proxy,
                verify=SHARED_SSL_CONTEXT,
                limits=SHARED_HTTP_LIMITS,
            )
        return self._client

    def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
            self._logged_in = False

    def login(self, nim: str, password: str) -> bool:
        client = self.get_client()
        client.cookies.clear()
        login_url = f"{self.BASE_URL}/login"
        try:
            r1 = client.get(login_url)
            m = re.search(r'name=["\']_token["\']\s+value=["\']([^"\']+)["\']', r1.text)
            if not m:
                return False
            token = m.group(1)

            try:
                ans = solve_captcha(r1.text)
            except ValueError:
                return False

            payload = {
                "_token": token,
                "username": nim,
                "password": password,
                "captcha_answer": str(ans),
            }
            r2 = client.post(login_url, data=payload)
            final_url = str(r2.url)
            # Login sukses jika TIDAK lagi di halaman login dan status 200 (Laravel redirect ke intended page)
            is_login_page = "/login" in final_url and ("captcha_answer" in r2.text or "password" in r2.text)
            if not is_login_page and r2.status_code == 200:
                self._mark_logged_in()
                return True
            if "dashboard" in final_url or "elearning.bsi.ac.id/user" in final_url:
                self._mark_logged_in()
                return True
            logger.warning("Elearning login rejected for %s: ended at %s (status %s)", nim, r2.url, r2.status_code)
            return False
        except Exception as err:
            logger.error("Elearning login exception for %s: %s", nim, err)
            return False

    def _check_relative_path(self, path: str) -> None:
        if "://" in path or path.startswith("//"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="INVALID_PATH",
                    message="Path tidak valid (dilarang menggunakan URL absolut atau skema)",
                    module="elearning",
                ),
            )

    def fetch_page(self, path: str, nim: str, password: str) -> str:
        self._check_relative_path(path)
        # Sesi MyBest ~15 menit: diperbarui otomatis memakai kredensial session dashboard.
        return self.authed_request("GET", path, nim, password).text

    def post_page(
        self,
        path: str,
        nim: str,
        password: str,
        data: Optional[dict] = None,
        json_body: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        self._check_relative_path(path)
        req_headers = dict(self.HEADERS)
        if headers:
            req_headers.update(headers)
        return self.authed_request("POST", path, nim, password, data=data, json=json_body, headers=req_headers)

    def post_multipart(
        self,
        path: str,
        nim: str,
        password: str,
        data: Optional[dict] = None,
        files: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        self._check_relative_path(path)
        if not self.ensure_session(nim, password):
            raise self._auth_error("AUTH_FAILED", "Gagal login ke elearning.bsi.ac.id (captcha/kredensial salah)")

        req_headers = dict(self.HEADERS)
        if headers:
            req_headers.update(headers)

        # Upload tidak diulang otomatis (stream file sudah terpakai); sesi sudah dijamin segar di atas.
        return self.get_client().post(self.resolve_url(path), data=data, files=files, headers=req_headers)

    def download_file(self, url: str, nim: str, password: str) -> httpx.Response:
        return self.authed_request("GET", url, nim, password)

    def _csrf_from_sch(self, nim: str, password: str) -> str:
        sch_res = self.authed_request("GET", "/sch", nim, password)
        m = re.search(r'name=["\']_token["\']\s+value=["\']([^"\']+)["\']', sch_res.text)
        return m.group(1) if m else ""

    def _download_post(self, endpoint: str, token_id: str, filename: str, nim: str, password: str) -> httpx.Response:
        post_data = {
            "_token": self._csrf_from_sch(nim, password),
            "id": token_id,
            "file": filename,
        }
        resp = self.get_client().post(f"{self.BASE_URL}{endpoint}", data=post_data)
        if is_logged_out_response(resp):
            # Sesi habis di antara ambil CSRF dan download: login ulang + CSRF baru.
            post_data["_token"] = self._csrf_from_sch(nim, password)
            resp = self.get_client().post(f"{self.BASE_URL}{endpoint}", data=post_data)
        return resp

    def download_assignment_post(self, token_id: str, filename: str, nim: str, password: str) -> httpx.Response:
        return self._download_post("/download-file-tugas", token_id, filename, nim, password)

    def download_material_post(self, token_id: str, filename: str, nim: str, password: str) -> httpx.Response:
        return self._download_post("/download-file-materi", token_id, filename, nim, password)

    def submit_assignment_link(self, token_send: str, link_tugas: str, nim: str, password: str) -> dict[str, Any]:
        send_path = token_send if token_send.startswith("/assignment/send/") else f"/assignment/send/{token_send}"
        res_page = self.authed_request("GET", send_path, nim, password)
        client = self.get_client()
        if res_page.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(
                    code="FETCH_ASSIGNMENT_PAGE_FAILED",
                    message=f"Gagal membuka lembar pengumpulan tugas MyBest (status {res_page.status_code})",
                    module="elearning",
                ),
            )

        tree = lxml_html.fromstring(res_page.text)
        forms = tree.xpath(".//form[contains(@action, '/assignment')]")
        if not forms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="FORM_NOT_FOUND",
                    message="Form pengumpulan tugas tidak ditemukan pada halaman ini. Kemungkinan batas waktu sudah berakhir.",
                    module="elearning",
                ),
            )

        f = forms[0]
        fields = {inp.attrib.get("name"): inp.attrib.get("value", "") for inp in f.xpath(".//input") if inp.attrib.get("name")}
        csrf_token = fields.get("_token")
        kd_mtk = fields.get("kd_mtk")
        id_tugas = fields.get("id_tugas")
        kd_lokal = fields.get("kd_lokal")

        if not csrf_token or not id_tugas:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="INVALID_FORM_DATA",
                    message="Parameter form pengumpulan tugas tidak lengkap dari MyBest",
                    module="elearning",
                ),
            )

        payload = {
            "_token": csrf_token,
            "kd_mtk": kd_mtk,
            "id_tugas": id_tugas,
            "nim": nim,
            "kd_lokal": kd_lokal,
            "isi": link_tugas.strip(),
        }

        submit_res = client.post(f"{self.BASE_URL}/assignment", data=payload)
        loc = submit_res.headers.get("location", "")
        if submit_res.status_code not in (200, 302) or is_logged_out_response(submit_res) or "/login" in loc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(
                    code="SUBMIT_FAILED",
                    message=f"Gagal mengirimkan tugas ke MyBest (status {submit_res.status_code})",
                    module="elearning",
                ),
            )

        return {
            "status": "success",
            "message": "Tugas berhasil dikumpulkan ke MyBest",
            "id_tugas": id_tugas,
            "kd_mtk": kd_mtk,
            "link_tugas": link_tugas.strip(),
        }

    def post_discussion_comment(self, token_komentar: str, id_chat: str, komentar: str, nim: str, password: str) -> dict[str, Any]:
        kom_path = f"/form-komentarmhs/{token_komentar}"
        res_page = self.authed_request("GET", kom_path, nim, password)
        client = self.get_client()
        if res_page.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(code="FETCH_FAILED", message="Gagal membuka thread komentar diskusi", module="elearning"),
            )

        tree = lxml_html.fromstring(res_page.text)
        forms = tree.xpath(".//form[contains(@action, 'send-komentarmhs')]")
        if not forms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(code="FORM_NOT_FOUND", message="Form pengiriman komentar tidak ditemukan", module="elearning"),
            )

        f = forms[0]
        csrf_token = f.xpath(".//input[@name='_token']/@value")
        id_val = f.xpath(".//input[@name='id']/@value")

        payload = {
            "_token": csrf_token[0] if csrf_token else "",
            "komentar": komentar.strip(),
            "id_chat": id_chat,
            "id": id_val[0] if id_val else token_komentar,
        }

        submit_res = client.post(f"{self.BASE_URL}/send-komentarmhs", data=payload)
        loc = submit_res.headers.get("location", "")
        if submit_res.status_code not in (200, 302) or is_logged_out_response(submit_res) or "/login" in loc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(code="SEND_FAILED", message=f"Gagal mengirim komentar (status {submit_res.status_code})", module="elearning"),
            )

        return {"status": "success", "message": "Komentar berhasil dikirimkan ke forum MyBest"}

    def post_new_discussion(self, token_course: str, judul: str, chat: str, nim: str, password: str) -> dict[str, Any]:
        disc_path = f"/form-diskusimhs/{token_course}"
        res_page = self.authed_request("GET", disc_path, nim, password)
        client = self.get_client()
        if res_page.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(code="FETCH_FAILED", message="Gagal membuka form forum diskusi", module="elearning"),
            )

        tree = lxml_html.fromstring(res_page.text)
        forms = tree.xpath(".//form[contains(@action, 'tambah-diskusimhs')]")
        if not forms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(code="FORM_NOT_FOUND", message="Form pembuatan diskusi tidak ditemukan", module="elearning"),
            )

        f = forms[0]
        csrf_token = f.xpath(".//input[@name='_token']/@value")
        kd_lokal = f.xpath(".//input[@name='kd_lokal']/@value")
        kd_mtk = f.xpath(".//input[@name='kd_mtk']/@value")

        payload = {
            "_token": csrf_token[0] if csrf_token else "",
            "judul": judul.strip(),
            "chat": chat.strip(),
            "kd_lokal": kd_lokal[0] if kd_lokal else "",
            "kd_mtk": kd_mtk[0] if kd_mtk else "",
        }

        submit_res = client.post(f"{self.BASE_URL}/tambah-diskusimhs", data=payload)
        loc = submit_res.headers.get("location", "")
        if submit_res.status_code not in (200, 302) or is_logged_out_response(submit_res) or "/login" in loc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(code="CREATE_FAILED", message=f"Gagal membuat topik diskusi (status {submit_res.status_code})", module="elearning"),
            )

        return {"status": "success", "message": "Topik diskusi berhasil dibuat di forum MyBest"}

elearning_client = ElearningClient()


class PooledElearningClient:
    """Fasade client elearning dengan pool sesi per-NIM (pola sama studentv2)."""

    def __init__(self, ttl_seconds: int = 900):
        def _factory(nim=None):
            if hasattr(elearning_client, "fetch_page") and hasattr(elearning_client.fetch_page, "assert_called"):
                return elearning_client
            return ElearningClient(proxy=get_proxy(seed=nim))
        self._pool = SessionPool(_factory, ttl_seconds=ttl_seconds)

    async def fetch_page(self, path: str, nim: str, password: str) -> str:
        client = self._pool.get(nim)

        def _fetch_once() -> str:
            return client.fetch_page(path, nim, password)

        try:
            return await retry_async(_fetch_once, attempts=3, base_delay=1.0)
        except HTTPException as exc:
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict) and detail.get("code") == "AUTH_EXPIRED":
                self._pool.invalidate(nim)
            raise

    async def fetch_cross_host(self, url: str, nim: str, password: str) -> str:
        """Ambil halaman di host turunan MyBest (mis. ujiankampusa.bsi.ac.id).

        Sesi dashboard /halaman-ujian dipastikan hidup dulu supaya redirect chain
        SSO (/authenticate?token=...) menyetel cookie host tujuan; request berikutnya
        memakai httpx Client yang sama sehingga cookie ikut.

        Allowlist host wajib: request ini membawa cookie sesi login, jadi satu
        caller salah dengan URL bebas = SSRF + exfiltrasi cookie.
        """
        parsed = httpx.URL(url)
        if parsed.host not in ("ujiankampusa.bsi.ac.id",) or parsed.scheme != "https":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="INVALID_PATH",
                    message="URL host ujian tidak diizinkan",
                    module="elearning",
                ),
            )
        client = self._pool.get(nim)

        def _fetch_once() -> str:
            client.fetch_page("/halaman-ujian", nim, password)  # SSO handshake
            resp = client.get_client().get(url)
            text = resp.content.decode("utf-8", errors="replace")
            if resp.status_code != 200:
                # Tanpa URL di pesan: exception ini masuk response 502, jangan
                # bocorkan path + token jadwal ke klien.
                raise ValueError(f"upstream status {resp.status_code}")
            return text

        try:
            return await retry_async(_fetch_once, attempts=2, base_delay=1.0)
        except HTTPException as exc:
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict) and detail.get("code") == "AUTH_EXPIRED":
                self._pool.invalidate(nim)
            raise

    async def post_page(
        self,
        path: str,
        nim: str,
        password: str,
        data: Optional[dict] = None,
        json_body: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        client = self._pool.get(nim)

        def _post_once() -> httpx.Response:
            return client.post_page(path, nim, password, data=data, json_body=json_body, headers=headers)

        try:
            return await retry_async(_post_once, attempts=1, base_delay=1.0)
        except HTTPException as exc:
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict) and detail.get("code") == "AUTH_EXPIRED":
                self._pool.invalidate(nim)
            raise

    async def post_multipart(
        self,
        path: str,
        nim: str,
        password: str,
        data: Optional[dict] = None,
        files: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        client = self._pool.get(nim)

        def _post_once() -> httpx.Response:
            return client.post_multipart(path, nim, password, data=data, files=files, headers=headers)

        return await retry_async(_post_once, attempts=1, base_delay=1.0)

    async def download_file(self, url: str, nim: str, password: str) -> httpx.Response:
        client = self._pool.get(nim)

        def _get_once() -> httpx.Response:
            return client.download_file(url, nim, password)

        return await retry_async(_get_once, attempts=3, base_delay=1.0)

    async def download_assignment_post(self, token_id: str, filename: str, nim: str, password: str) -> httpx.Response:
        client = self._pool.get(nim)

        def _post_once() -> httpx.Response:
            return client.download_assignment_post(token_id, filename, nim, password)

        return await retry_async(_post_once, attempts=1, base_delay=1.0)

    async def download_material_post(self, token_id: str, filename: str, nim: str, password: str) -> httpx.Response:
        client = self._pool.get(nim)

        def _post_once() -> httpx.Response:
            return client.download_material_post(token_id, filename, nim, password)

        return await retry_async(_post_once, attempts=1, base_delay=1.0)

    async def submit_assignment_link(self, token_send: str, link_tugas: str, nim: str, password: str) -> dict[str, Any]:
        client = self._pool.get(nim)

        def _submit_once() -> dict[str, Any]:
            return client.submit_assignment_link(token_send, link_tugas, nim, password)

        return await retry_async(_submit_once, attempts=1, base_delay=1.0)

    async def post_discussion_comment(self, token_komentar: str, id_chat: str, komentar: str, nim: str, password: str) -> dict[str, Any]:
        client = self._pool.get(nim)

        def _post_once() -> dict[str, Any]:
            return client.post_discussion_comment(token_komentar, id_chat, komentar, nim, password)

        return await retry_async(_post_once, attempts=1, base_delay=1.0)

    async def post_new_discussion(self, token_course: str, judul: str, chat: str, nim: str, password: str) -> dict[str, Any]:
        client = self._pool.get(nim)

        def _post_once() -> dict[str, Any]:
            return client.post_new_discussion(token_course, judul, chat, nim, password)

        return await retry_async(_post_once, attempts=1, base_delay=1.0)

    async def evict_idle(self) -> int:
        return await self._pool.evict_idle()

    async def close(self) -> None:
        await self._pool.close()


pooled_elearning_client = PooledElearningClient()

def extract_clean_token(raw_input: Optional[str]) -> Optional[str]:
    """Ekstraksi token terenkripsi Laravel (selalu diawali 'eyJ...') dari token murni, URL path, atau URL absolut."""
    if not raw_input or not isinstance(raw_input, str):
        return None
    s = raw_input.strip()
    m = re.search(r"(eyJ[A-Za-z0-9+/=_-]+)", s)
    if m:
        return m.group(1).rstrip("/")
    for prefix in ("https://elearning.bsi.ac.id", "http://elearning.bsi.ac.id"):
        if s.startswith(prefix):
            s = s[len(prefix):]
    cleaned = s.strip("/").split("/")[-1]
    return cleaned if cleaned else None

# API Routes

@router.get("/courses")
async def get_courses(creds: tuple[str, str] = Depends(require_elearning_creds)):
    nim, password = creds
    return await cached_endpoint(
        module="elearning",
        name="courses",
        fetch=lambda: pooled_elearning_client.fetch_page("/sch", nim, password),
        parse=parse_courses,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"nim": nim},
    )

@router.get("/assignments")
async def get_assignments(
    token: Optional[str] = Query(default=None, description="Token terenkripsi mata kuliah dari /courses (diawali 'eyJ...')"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    nim, password = creds
    clean_token = extract_clean_token(token)

    if not clean_token:
        all_key = cache.make_key("elearning", "assignments", nim=nim, token="all")
        gate = asyncio.Semaphore(_ASSIGNMENT_FETCH_CONCURRENCY)

        async def _fetch_for(course: dict[str, Any]) -> Optional[dict[str, list[dict[str, Any]]]]:
            """Tugas satu mata kuliah. None bila gagal setelah retry (bukan "tidak ada tugas")."""
            t = course.get("token_assignment")
            if not t:
                return {"tasks": [], "submissions": []}
            clean_t = extract_clean_token(t) or t
            for attempt in range(_ASSIGNMENT_FETCH_ATTEMPTS):
                try:
                    async with gate:
                        html = await pooled_elearning_client.fetch_page(f"/assignment/{clean_t}", nim, password)
                    parsed = parse_assignments(html)
                except Exception as exc:
                    logger.warning(
                        "assignment fetch failed course=%s attempt=%d: %s", course.get("kode"), attempt + 1, exc
                    )
                    if attempt + 1 < _ASSIGNMENT_FETCH_ATTEMPTS:
                        await asyncio.sleep(0.4 * (attempt + 1))
                    continue
                for item in parsed.get("tasks", []) + parsed.get("submissions", []):
                    item.setdefault("kode", course.get("kode") or "")
                    item["mata_kuliah"] = course.get("nama") or ""
                return parsed
            return None

        async def _fetch_all_assignments():
            courses_res = await get_courses(creds)
            courses = courses_res["data"]
            results = await asyncio.gather(*(_fetch_for(c) for c in courses))

            tasks_list: list[dict[str, Any]] = []
            submissions_list: list[dict[str, Any]] = []
            failed: list[dict[str, Any]] = []
            for course, result in zip(courses, results):
                if result is None:
                    failed.append(course)
                    continue
                tasks_list.extend(result.get("tasks", []))
                submissions_list.extend(result.get("submissions", []))

            if failed:
                # Mata kuliah yang gagal diambil: pakai data terakhir yang berhasil bila ada.
                previous = await cache.get_lgg(all_key)
                previous_data = previous[0] if previous and isinstance(previous[0], dict) else {}
                failed_codes = {c.get("kode") or "" for c in failed}
                failed_names = {c.get("nama") or "" for c in failed}

                def belongs(item: dict[str, Any]) -> bool:
                    return (item.get("kode") or "") in failed_codes or (item.get("mata_kuliah") or "") in failed_names

                tasks_list.extend(i for i in previous_data.get("tasks", []) if belongs(i))
                submissions_list.extend(i for i in previous_data.get("submissions", []) if belongs(i))

            return {
                # courses_count dipakai should_cache: daftar kosong karena get_courses
                # gagal sesaat TIDAK boleh ter-cache 10 menit (kelihatan seperti tugas hilang).
                "courses_count": len(courses),
                "tasks": tasks_list,
                "submissions": submissions_list,
                "failed_courses": [c.get("nama") or c.get("kode") or "" for c in failed],
            }

        return await cached_endpoint(
            module="elearning",
            name="assignments",
            fetch=_fetch_all_assignments,
            parse=lambda data: data,
            ttl=settings.TTL_ASSIGNMENTS,
            cache_params={"nim": nim, "token": "all"},
            should_cache=lambda data: not data.get("failed_courses") and data.get("courses_count", 1) > 0,
        )

    return await cached_endpoint(
        module="elearning",
        name="assignments",
        fetch=lambda: pooled_elearning_client.fetch_page(f"/assignment/{clean_token}", nim, password),
        parse=parse_assignments,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"token": clean_token, "nim": nim},
    )

@router.get("/presence")
async def get_presence(
    token: Optional[str] = Query(default=None, description="Token terenkripsi presensi mata kuliah dari /courses (diawali 'eyJ...')"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    nim, password = creds
    clean_token = extract_clean_token(token)

    if not clean_token:
        courses_res = await get_courses(creds)
        courses = courses_res["data"]
        first_token = None
        for c in courses:
            t = extract_clean_token(c.get("token_absen"))
            if t:
                first_token = t
                break
        if not first_token:
            return success_response(data={}, cached=False)
        clean_token = first_token

    async def _fetch_presence():
        html = await pooled_elearning_client.fetch_page(f"/absen-mhs/{clean_token}", nim, password)
        presence = parse_presence(html)

        # Ambil riwayat presensi lengkap via DataTables AJAX (/rekap-side/{token}).
        # Rekap jarang berubah, jadi disimpan 30 detik: polling status sesi tiap beberapa detik
        # hanya memukul MyBest dengan satu request (halaman absen), bukan dua.
        m = re.findall(r"rekap-side/([^\"'\s]+)", html)
        rekap_tok = extract_clean_token(m[0]) if m else clean_token
        rekap_key = cache.make_key("elearning", "presence_rekap", nim=nim, token=clean_token)
        records = await cache.get_fresh(rekap_key)
        if records is None:
            try:
                rekap_raw = await pooled_elearning_client.fetch_page(f"/rekap-side/{rekap_tok}", nim, password)
                records = parse_presence_rekap(rekap_raw)
                if records:
                    await cache.set(rekap_key, records, ttl=_PRESENCE_REKAP_TTL)
            except Exception as err:
                logger.warning("Gagal fetch rekap-side presence: %s", err)
                records = None
        if records:
            presence["riwayat"] = records
            presence["total_kehadiran"] = len(records)
        return annotate_presence(presence)

    return await cached_endpoint(
        module="elearning",
        name="presence",
        fetch=_fetch_presence,
        parse=lambda data: data,
        ttl=settings.TTL_PRESENCE,
        cache_params={"token": clean_token, "nim": nim},
        allow_stale=False,
    )

@router.get("/materials")
async def get_materials(
    token: Optional[str] = Query(default=None, description="Token terenkripsi bahan ajar mata kuliah dari /courses (diawali 'eyJ...')"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    nim, password = creds
    clean_token = extract_clean_token(token)

    if not clean_token:
        courses_res = await get_courses(creds)
        courses = courses_res["data"]
        first_token = None
        for c in courses:
            t = extract_clean_token(c.get("token_learning"))
            if t:
                first_token = t
                break
        if not first_token:
            return success_response(data=[], cached=False)
        clean_token = first_token

    return await cached_endpoint(
        module="elearning",
        name="materials",
        fetch=lambda: pooled_elearning_client.fetch_page(f"/learning/{clean_token}", nim, password),
        parse=parse_materials,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"token": clean_token, "nim": nim},
    )

@router.get("/quiz")
async def get_quiz(creds: tuple[str, str] = Depends(require_elearning_creds)):
    nim, password = creds
    return await cached_endpoint(
        module="elearning",
        name="quiz",
        fetch=lambda: pooled_elearning_client.fetch_page("/exercise", nim, password),
        parse=parse_quiz,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"nim": nim},
    )


# Ujian Semester (ujiankampusa.bsi.ac.id via SSO /halaman-ujian)

async def fetch_exam_schedule(nim: str, password: str, exam_type: str) -> str:
    """SSO ke ujiankampusa lalu ambil halaman /jadwal/{token} untuk satu jenis ujian."""
    dash = await pooled_elearning_client.fetch_page("/halaman-ujian", nim, password)
    types = parse_exam_types(dash)
    token = next((t["token"] for t in types["types"] if t["key"] == exam_type), None)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="EXAM_TYPE_NOT_FOUND",
                message=f"Jenis ujian '{exam_type}' tidak tersedia.",
                module="elearning",
            ),
        )
    return await pooled_elearning_client.fetch_cross_host(
        f"https://ujiankampusa.bsi.ac.id/jadwal/{token}", nim, password
    )


@router.get("/exams")
async def get_exams(creds: tuple[str, str] = Depends(require_elearning_creds)):
    """Daftar jenis ujian semester yang tersedia (token SSO dipakai internal saja)."""
    nim, password = creds
    res = await cached_endpoint(
        module="elearning",
        name="exams",
        fetch=lambda: pooled_elearning_client.fetch_page("/halaman-ujian", nim, password),
        parse=parse_exam_types,
        ttl=120,  # token encrypted berumur pendek: jangan disajikan basi
        cache_params={"nim": nim},
    )
    # Token SSO internal: klien cukup tahu key + label untuk memilih jenis.
    res["data"]["types"] = [
        {"key": t["key"], "label": t["label"]} for t in res["data"]["types"]
    ]
    return res


@router.get("/exams/{exam_type}")
async def get_exam_schedule(
    exam_type: str = Path(pattern=r"^(latihan|uts|uas|uts-pengganti|uas-pengganti|her|her-pengganti|her-khusus)$"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Jadwal ujian satu jenis dari ujiankampusa (kartu muncul saat ada jadwal)."""
    nim, password = creds
    return await cached_endpoint(
        module="elearning",
        name="exam_schedule",
        fetch=lambda: fetch_exam_schedule(nim, password, exam_type),
        parse=parse_exam_schedule,
        ttl=60,
        cache_params={"nim": nim, "type": exam_type},
    )

# Rekap Nilai Tugas & Kuis (Per Pertemuan)

async def _build_grades(
    nim: str,
    password: str,
    token: Optional[str],
) -> dict[str, Any]:
    """Kumpulkan submissions (opsional per-token) + daftar kuis, lalu rekap.

    Tanpa token: submissions digabung dari seluruh mata kuliah aktif
    (halaman /assignment/{token_assignment} per kursus dari /sch).
    """
    quiz_res = await get_quiz((nim, password))
    quizzes = quiz_res["data"]

    if token:
        assignment_res = await get_assignments(token=token, creds=(nim, password))
        submissions = assignment_res["data"]["submissions"]
    else:
        assignment_res = await get_assignments(token=None, creds=(nim, password))
        submissions = assignment_res["data"]["submissions"]

    return summarize_grades(submissions, quizzes)


@router.get("/grades")
async def get_grades(
    token: Optional[str] = Query(default=None, pattern=r"^[A-Za-z0-9+/=_-]+$", description="Encrypted course token from /courses (opsional, tanpa token = semua matkul)"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Rekap nilai tugas & kuis seluruh mata kuliah aktif, per pertemuan."""
    nim, password = creds
    clean_token = token if isinstance(token, str) else None

    return await cached_endpoint(
        module="elearning",
        name="grades",
        fetch=lambda: _build_grades(nim, password, clean_token),
        parse=lambda data: data,
        ttl=settings.TTL_GRADES,
        cache_params={"nim": nim, "token": clean_token or "all"},
    )


@router.get("/courses/{course_id}/grades")
async def get_course_grades(
    course_id: str = Path(..., pattern=r"^[A-Za-z0-9_-]+$", max_length=64, description="ID / kode mata kuliah"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Rekap nilai tugas & kuis satu mata kuliah (id dari /v1/elearning/courses)."""
    nim, password = creds

    courses_res = await get_courses(creds)
    courses = courses_res["data"]
    course = next((c for c in courses if c.get("id") == course_id or c.get("kode") == course_id), None)
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="COURSE_NOT_FOUND",
                message=f"Mata kuliah dengan id '{course_id}' tidak ditemukan di daftar kursus aktif",
                module="elearning",
            ),
        )

    token = course.get("token_assignment")
    if not token:
        return success_response(data=summarize_grades([], []), cached=False)

    return await cached_endpoint(
        module="elearning",
        name="course_grades",
        fetch=lambda: _build_grades(nim, password, token),
        parse=lambda data: data,
        ttl=settings.TTL_GRADES,
        cache_params={"nim": nim, "course_id": course_id},
    )

# Write Operations & Interactive Quiz

async def invalidate_elearning_user_cache(nim: str, token: Optional[str] = None) -> None:
    """Invalidasi cache elearning khusus untuk NIM ini tanpa mengganggu mahasiswa lain."""
    from app.cache import cache
    try:
        keys_to_del = [
            f"{cache.make_key('elearning', 'presence', nim=nim)}:fresh",
            f"{cache.make_key('elearning', 'presence', nim=nim)}:lgg",
            f"{cache.make_key('elearning', 'courses', nim=nim)}:fresh",
            f"{cache.make_key('elearning', 'courses', nim=nim)}:lgg",
            f"{cache.make_key('elearning', 'assignments', nim=nim, token='all')}:fresh",
            f"{cache.make_key('elearning', 'assignments', nim=nim, token='all')}:lgg",
            f"{cache.make_key('elearning', 'grades', nim=nim, token='all')}:fresh",
            f"{cache.make_key('elearning', 'grades', nim=nim, token='all')}:lgg",
        ]
        if token:
            for endpoint in ("presence", "presence_rekap", "assignments", "materials", "discussions", "grades"):
                keys_to_del.extend([
                    f"{cache.make_key('elearning', endpoint, nim=nim, token=token)}:fresh",
                    f"{cache.make_key('elearning', endpoint, nim=nim, token=token)}:lgg",
                ])
        client = await cache.get_client()
        await client.delete(*keys_to_del)
    except Exception as exc:
        logger.warning("Gagal membersihkan cache elearning untuk NIM %s: %s", nim, exc)


async def submit_presence(
    nim: str, password: str, token: Optional[str] = None
) -> dict[str, Any]:
    """Eksekusi presensi (pencet tombol absen) pada sesi kuliah yang aktif."""
    target_token = token
    info = None

    if not target_token:
        courses_res = await get_courses((nim, password))
        courses = courses_res.get("data") or []
        for c in courses:
            t = c.get("token_absen")
            if not t:
                continue
            try:
                h = await pooled_elearning_client.fetch_page(f"/absen-mhs/{t}", nim, password)
                st = inspect_session_status(h)
                if st["can_submit"]:
                    target_token = t
                    info = st
                    break
            except Exception:
                continue

        if not target_token or not info:
            return {
                "success": False,
                "status": "Tidak Ada Sesi Aktif",
                "message": "Tidak ditemukan sesi mata kuliah yang sedang membuka presensi saat ini.",
            }
    else:
        html = await pooled_elearning_client.fetch_page(f"/absen-mhs/{target_token}", nim, password)
        info = inspect_session_status(html)

    if not info["can_submit"]:
        return {
            "success": False,
            "status": info["status_raw"],
            "matakuliah": info["matakuliah"],
            "dosen": info["dosen"],
            "message": f"Presensi tidak dapat dilakukan karena status sesi: {info['status_raw']}",
        }

    action_url = info.get("form_action") or f"/absen-mhs/{target_token}"
    inputs = dict(info.get("form_inputs") or {})
    # Force nilai=1 (Pengajaran Sesuai) — the dict comprehension in
    # inspect_session_status picks the LAST input value, which is "0" (Tidak Sesuai).
    # Presence submission should always send nilai=1 so attendance is recorded positively.
    inputs["nilai"] = "1"
    inputs.setdefault("komentar", "")
    try:
        resp = await pooled_elearning_client.post_page(action_url, nim, password, data=inputs)
        status_code = getattr(resp, "status_code", 200)
        headers = getattr(resp, "headers", {})
        loc = str(headers.get("location", "") if hasattr(headers, "get") else "")
        if status_code not in (200, 302) or is_logged_out_response(resp) or "/login" in loc:
            return {
                "success": False,
                "status": "ERROR",
                "message": "Gagal mencatat presensi: sesi MyBest kedaluwarsa atau upstream menolak.",
            }

        await invalidate_elearning_user_cache(nim, target_token)

        return {
            "success": True,
            "status": "Hadir",
            "matakuliah": info["matakuliah"],
            "dosen": info["dosen"],
            "ruang": info["ruang"],
            "message": f"Presensi mata kuliah {info['matakuliah']} berhasil dicatat.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Error saat submit presence: %s", exc)
        return {
            "success": False,
            "status": "ERROR",
            "message": "Gagal mengirim presensi ke upstream. Silakan coba beberapa saat lagi.",
        }

async def fetch_quiz_questions(
    nim: str, password: str, token: Optional[str] = None, quiz_url: Optional[str] = None
) -> dict[str, Any]:
    """Ambil daftar soal, sisa waktu, dan opsi jawaban kuis/ujian."""
    if quiz_url:
        # ponytail: whitelist bentuk path kampus; upgrade ke registry route jika MyBest menambah bentuk baru
        if not re.fullmatch(r"/[A-Za-z0-9/_.=%+-]+", quiz_url) or ".." in quiz_url or quiz_url.startswith("//"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="INVALID_PATH",
                    message="quiz_url tidak valid: hanya path relatif halaman ujian MyBest yang diizinkan",
                    module="elearning",
                ),
            )
        target_path = quiz_url
    else:
        target_path = f"/halaman-ujian/{token}" if token else "/exercise"
    html = await pooled_elearning_client.fetch_page(target_path, nim, password)
    return parse_quiz_questions(html)

class QuizAnswerPayload(BaseModel):
    id_soal: str = Field(..., pattern=r"^[0-9]+$", description="ID Soal Kuis (angka)")
    data_jawab: str = Field(..., pattern=r"^[A-Za-z0-9_.-]+$", description="Payload data-jawab atau kode opsi (misal: 501_A atau A)")
    csrf_token: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9+/=_-]+$", description="CSRF Token dari halaman ujian")

async def submit_quiz_answer(
    nim: str,
    password: str,
    id_soal: str,
    data_jawab: str,
    csrf_token: Optional[str] = None,
) -> dict[str, Any]:
    """Kirim pilihan jawaban kuis (A/B/C/D) ke MyBest."""
    token = csrf_token
    if not token:
        try:
            h = await pooled_elearning_client.fetch_page("/exercise", nim, password)
            token = parse_quiz_questions(h).get("csrf_token")
        except Exception:
            token = None

    headers = {"X-CSRF-TOKEN": token} if token else {}
    try:
        resp = await pooled_elearning_client.post_page(
            "/jawaban", nim, password, data={"get_jawab": data_jawab}, headers=headers
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(
                code="UPSTREAM_ERROR",
                message=f"Gagal mengirim jawaban ke MyBest: {exc}",
                module="elearning",
            ),
        )

    raw_res = resp.text.strip() if hasattr(resp, "text") else ""
    return {
        "success": True,
        "id_soal": id_soal,
        "data_jawab": data_jawab,
        "raw_response": raw_res,
        "message": f"Jawaban untuk soal ID {id_soal} berhasil dikirim ke sistem MyBest.",
    }

@router.post("/presence")
async def post_presence(
    token: Optional[str] = Query(default=None, description="Token terenkripsi presensi mata kuliah dari /courses (diawali 'eyJ...')"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    """Pencet / submit presensi perkuliahan pada kelas aktif."""
    nim, password = creds
    clean_token = extract_clean_token(token)
    result = await submit_presence(nim, password, clean_token)
    return success_response(data=result)

@router.get("/quiz/questions")
async def get_quiz_questions(
    token: Optional[str] = Query(default=None, description="Token ujian / kuis (diawali 'eyJ...')"),
    quiz_url: Optional[str] = Query(default=None, description="Path relatif halaman ujian"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    """Ambil daftar pertanyaan dan opsi kuis/ujian."""
    nim, password = creds
    clean_token = extract_clean_token(token)
    clean_quiz_url = quiz_url if isinstance(quiz_url, str) else None
    result = await fetch_quiz_questions(nim, password, token=clean_token, quiz_url=clean_quiz_url)
    return success_response(data=result)

@router.post("/quiz/answer")
async def post_quiz_answer(
    body: QuizAnswerPayload,
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    """Pilih / kirim jawaban untuk satu soal kuis."""
    nim, password = creds
    result = await submit_quiz_answer(
        nim, password, id_soal=body.id_soal, data_jawab=body.data_jawab, csrf_token=body.csrf_token
    )
    return success_response(data=result)


# Assignment File Upload & Download Operations

def is_safe_bsi_storage_url(url_str: str) -> bool:
    """Validasi URL file agar hanya mengunduh dari storage resmi kampus BSI via HTTPS (anti-SSRF)."""
    import urllib.parse
    try:
        p = urllib.parse.urlparse(url_str)
        if p.scheme != "https":
            return False
        hostname = (p.hostname or "").lower()
        if hostname not in ("elearning.bsi.ac.id", "students.bsi.ac.id", "news.bsi.ac.id", "repository.bsi.ac.id"):
            return False
        if ".." in p.path or not p.path.startswith(("/storage/soal/", "/storage/tugas/", "/storage/", "/mhs_download/")):
            return False
        return not p.query and not p.fragment
    except Exception:
        return False


def _safe_header_filename(raw: Optional[str], fallback: str) -> str:
    cleaned = re.sub(r'[\x00-\x1f\x7f"\\]+', "_", (raw or "").strip())
    return cleaned[:180] or fallback


async def submit_assignment_file(
    nim: str,
    password: str,
    token_tugas: str,
    filename: str,
    file_bytes: bytes,
    catatan: Optional[str] = None,
) -> dict[str, Any]:
    """Upload berkas tugas mahasiswa (PDF, DOCX, ZIP, dll) ke portal MyBest."""
    target_path = f"/upload-tugas/{token_tugas}"
    html = await pooled_elearning_client.fetch_page(target_path, nim, password)
    page = Adaptor(html)
    csrf = page.css("meta[name='csrf-token'], input[name='_token']")
    csrf_token = csrf[0].attrib.get("content") or csrf[0].attrib.get("value") if csrf else None

    form = page.css("form[action*='tugas'], form[enctype*='multipart']")
    action_url = form[0].attrib.get("action") if form else "/simpan-tugas"

    headers = {"X-CSRF-TOKEN": csrf_token} if csrf_token else {}
    data = {"keterangan": catatan or ""}
    if csrf_token:
        data["_token"] = csrf_token

    files = {"file": (filename, file_bytes)}
    resp = await pooled_elearning_client.post_multipart(
        action_url, nim, password, data=data, files=files, headers=headers
    )
    is_ok = resp.status_code in (200, 302)
    return {
        "success": is_ok,
        "filename": filename,
        "token_tugas": token_tugas,
        "status_code": resp.status_code,
        "message": f"Berkas {filename} berhasil diunggah ke MyBest." if is_ok else "Gagal mengunggah berkas ke MyBest.",
    }


_UPLOAD_SEMAPHORE = asyncio.Semaphore(2)
_MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024


def _ensure_download_within_limit(resp: Any) -> None:
    content = getattr(resp, "content", b"")
    if isinstance(content, (bytes, bytearray)) and len(content) > _MAX_DOWNLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=error_response(
                code="FILE_TOO_LARGE",
                message="Ukuran berkas melampaui batas maksimum 20 MB",
                module="elearning",
            ),
        )


class UploadAssignmentPayload(BaseModel):
    token_tugas: str = Field(..., pattern=r"^[A-Za-z0-9+/=_-]+$", description="Token tugas dari /assignments atau /courses")
    filename: str = Field(..., pattern=r"^[A-Za-z0-9_.-]+$", description="Nama file (contoh: tugas_p5_15260767.zip / .pdf)")
    file_base64: str = Field(..., min_length=1, max_length=14_000_000, description="Isi file yang di-encode base64, maksimum 10 MB decoded")
    catatan: Optional[str] = Field(default=None, max_length=1000, description="Keterangan atau catatan tambahan untuk dosen")


@router.post("/assignments/upload")
async def post_upload_assignment(
    body: UploadAssignmentPayload,
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Upload berkas submission tugas mahasiswa ke portal MyBest."""
    import base64
    nim, password = creds
    clean_token = extract_clean_token(body.token_tugas) or body.token_tugas.strip("/")
    async with _UPLOAD_SEMAPHORE:
        try:
            file_bytes = base64.b64decode(body.file_base64, validate=True)
            body.file_base64 = ""
            if len(file_bytes) > 10 * 1024 * 1024:
                raise ValueError("file too large")
        except Exception:
            body.file_base64 = ""
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="INVALID_BASE64",
                    message="Format file_base64 tidak valid",
                    module="elearning",
                ),
            )

        result = await submit_assignment_file(
            nim=nim,
            password=password,
            token_tugas=clean_token,
            filename=body.filename,
            file_bytes=file_bytes,
            catatan=body.catatan,
        )
        del file_bytes

    # Invalidate cache assignments di Redis agar data tugas langsung up-to-date
    await invalidate_elearning_user_cache(nim, clean_token)

    return success_response(data=result)


class SubmitAssignmentLinkPayload(BaseModel):
    token_send: str = Field(..., description="Token pengerjaan dari /assignment/send/{token} atau token_tugas (diawali 'eyJ...')")
    link_tugas: str = Field(..., description="Link URL pengumpulan tugas (Google Drive, GitHub, dll.)")


@router.post("/assignments/submit")
async def post_submit_assignment_link(
    body: SubmitAssignmentLinkPayload,
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Kirim / kumpulkan tugas kuliah MyBest dengan memasukkan URL link tugas (Google Drive / GitHub)."""
    nim, password = creds
    clean_token = extract_clean_token(body.token_send) or body.token_send.strip("/")
    link = body.link_tugas.strip()
    # Validasi ketat: scheme http(s), host ada, tanpa userinfo, bukan target privat/localhost
    import ipaddress
    import urllib.parse

    parsed_link = urllib.parse.urlparse(link)
    link_error: Optional[str] = None
    if parsed_link.scheme not in ("http", "https") or not parsed_link.netloc:
        link_error = "link_tugas harus URL valid dengan awalan http:// atau https://"
    elif parsed_link.username or parsed_link.password:
        link_error = "link_tugas tidak boleh mengandung userinfo (user:pass@host)"
    else:
        hostname = (parsed_link.hostname or "").lower()
        try:
            is_private_ip = bool(ipaddress.ip_address(hostname).is_private)
        except ValueError:
            is_private_ip = False
        if not hostname or hostname == "localhost" or hostname.endswith(".local") or is_private_ip:
            link_error = "link_tugas tidak boleh mengarah ke localhost atau alamat jaringan privat"
    if link_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="INVALID_URL",
                message=link_error,
                module="elearning",
            ),
        )

    result = await pooled_elearning_client.submit_assignment_link(
        token_send=clean_token,
        link_tugas=link,
        nim=nim,
        password=password,
    )

    # Invalidate cache assignments di Redis agar data tugas langsung up-to-date
    await invalidate_elearning_user_cache(nim, clean_token)

    return success_response(data=result)


@router.get("/assignments/download")
async def download_assignment_file(
    request: Request,
    file_url: Optional[str] = Query(default=None, description="URL file tugas dari MyBest (storage/soal/... atau storage/tugas/...)"),
    id: Optional[str] = Query(default=None, description="ID token dari form download-file-tugas MyBest"),
    file: Optional[str] = Query(default=None, description="Nama file dari form download-file-tugas MyBest"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Download berkas soal atau submission tugas dari storage MyBest secara aman (cache singkat + ETag)."""
    key = f"assignment:{creds[0]}:{id}:{file}:{file_url}"
    return await serve_cached(request, key, lambda: _fetch_assignment_file(file_url, id, file, creds))


async def _fetch_assignment_file(
    file_url: Optional[str], id: Optional[str], file: Optional[str], creds: tuple[str, str]
) -> Response:
    nim, password = creds

    # Mode 1: Download via MyBest POST /download-file-tugas
    if id and file:
        clean_id = extract_clean_token(id) or id.strip("/")
        resp = await pooled_elearning_client.download_assignment_post(
            token_id=clean_id,
            filename=file,
            nim=nim,
            password=password,
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(
                    code="DOWNLOAD_FAILED",
                    message=f"Gagal mengunduh berkas soal dari MyBest (status {resp.status_code})",
                    module="elearning",
                ),
            )
        _ensure_download_within_limit(resp)
        filename = _safe_header_filename(file, "soal_tugas.pdf")
        content_type = resp.headers.get("content-type", "application/pdf")
        return Response(
            content=resp.content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
                "X-Content-Type-Options": "nosniff",
            },
        )

    # Mode 2: Download via direct file_url
    if not file_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="MISSING_PARAMS",
                message="Wajib menyertakan parameter 'id' & 'file' atau 'file_url'",
                module="elearning",
            ),
        )

    # Check if file_url encodes ?id=...&file=...
    if "id=" in file_url and "file=" in file_url:
        import urllib.parse
        parsed = urllib.parse.urlparse(file_url)
        q_params = urllib.parse.parse_qs(parsed.query)
        p_id = q_params.get("id", [None])[0]
        p_file = q_params.get("file", [None])[0]
        if p_id and p_file:
            clean_pid = extract_clean_token(p_id) or p_id.strip("/")
            resp = await pooled_elearning_client.download_assignment_post(
                token_id=clean_pid,
                filename=p_file,
                nim=nim,
                password=password,
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_response(
                        code="DOWNLOAD_FAILED",
                        message=f"Gagal mengunduh berkas soal dari MyBest (status {resp.status_code})",
                        module="elearning",
                    ),
                )
            filename = _safe_header_filename(p_file, "soal_tugas.pdf")
            content_type = resp.headers.get("content-type", "application/pdf")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Access-Control-Expose-Headers": "Content-Disposition",
                    "X-Content-Type-Options": "nosniff",
                },
            )

    if not is_safe_bsi_storage_url(file_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="INVALID_URL",
                message="file_url tidak valid atau bukan berasal dari domain storage resmi BSI (anti-SSRF)",
                module="elearning",
            ),
        )

    try:
        resp = await pooled_elearning_client.download_file(file_url, nim, password)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(
                    code="DOWNLOAD_FAILED",
                    message=f"Gagal mengunduh file dari storage kampus (status {resp.status_code})",
                    module="elearning",
                ),
            )
        _ensure_download_within_limit(resp)
        filename = _safe_header_filename(file_url.rstrip("/").split("/")[-1], "berkas_tugas.pdf")
        content_type = resp.headers.get("content-type", "application/octet-stream")
        return Response(
            content=resp.content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Download tugas gagal: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(
                code="DOWNLOAD_ERROR",
                message="Terjadi kesalahan saat mengunduh file. Silakan coba beberapa saat lagi.",
                module="elearning",
            ),
        )


@router.get("/materials/download")
async def download_material_file(
    request: Request,
    id: Optional[str] = Query(default=None, description="ID token dari form download-file-materi MyBest"),
    file: Optional[str] = Query(default=None, description="Nama file dari form download-file-materi MyBest"),
    file_url: Optional[str] = Query(default=None, description="Direct URL berkas bahan ajar"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Download berkas materi tatap muka dosen atau paket bahan ajar resmi MyBest secara aman (cache singkat + ETag)."""
    key = f"material:{creds[0]}:{id}:{file}:{file_url}"
    return await serve_cached(request, key, lambda: _fetch_material_file(file_url, id, file, creds))


async def _fetch_material_file(
    file_url: Optional[str], id: Optional[str], file: Optional[str], creds: tuple[str, str]
) -> Response:
    nim, password = creds

    # Mode 1: Download via form POST /download-file-materi
    if id and file:
        clean_id = extract_clean_token(id) or id.strip("/")
        resp = await pooled_elearning_client.download_material_post(
            token_id=clean_id,
            filename=file,
            nim=nim,
            password=password,
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(
                    code="DOWNLOAD_FAILED",
                    message=f"Gagal mengunduh berkas materi dari MyBest (status {resp.status_code})",
                    module="elearning",
                ),
            )
        _ensure_download_within_limit(resp)
        filename = _safe_header_filename(file, "materi_kuliah.pdf")
        content_type = resp.headers.get("content-type", "application/pdf")
        return Response(
            content=resp.content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
                "X-Content-Type-Options": "nosniff",
            },
        )

    # Mode 2: Download via direct file_url
    if not file_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="MISSING_PARAMS",
                message="Wajib menyertakan parameter 'id' & 'file' atau 'file_url'",
                module="elearning",
            ),
        )

    # Check if file_url encodes ?id=...&file=...
    if "id=" in file_url and "file=" in file_url:
        import urllib.parse
        parsed = urllib.parse.urlparse(file_url)
        q_params = urllib.parse.parse_qs(parsed.query)
        p_id = q_params.get("id", [None])[0]
        p_file = q_params.get("file", [None])[0]
        if p_id and p_file:
            clean_pid = extract_clean_token(p_id) or p_id.strip("/")
            resp = await pooled_elearning_client.download_material_post(
                token_id=clean_pid,
                filename=p_file,
                nim=nim,
                password=password,
            )
            if resp.status_code == 200:
                filename = _safe_header_filename(p_file, "materi_kuliah.pdf")
                content_type = resp.headers.get("content-type", "application/pdf")
                return Response(
                    content=resp.content,
                    media_type=content_type,
                    headers={
                        "Content-Disposition": f'attachment; filename="{filename}"',
                        "Access-Control-Expose-Headers": "Content-Disposition",
                        "X-Content-Type-Options": "nosniff",
                    },
                )

    if not is_safe_bsi_storage_url(file_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="INVALID_URL",
                message="file_url tidak valid atau bukan berasal dari domain storage resmi BSI (anti-SSRF)",
                module="elearning",
            ),
        )

    try:
        resp = await pooled_elearning_client.download_file(file_url, nim, password)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(
                    code="DOWNLOAD_FAILED",
                    message=f"Gagal mengunduh file materi dari storage kampus (status {resp.status_code})",
                    module="elearning",
                ),
            )
        _ensure_download_within_limit(resp)
        filename = _safe_header_filename(file_url.rstrip("/").split("/")[-1], "materi_kuliah.zip")
        content_type = resp.headers.get("content-type", "application/octet-stream")
        return Response(
            content=resp.content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Download materi gagal: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(
                code="DOWNLOAD_ERROR",
                message="Terjadi kesalahan saat mengunduh materi. Silakan coba beberapa saat lagi.",
                module="elearning",
            ),
        )


# Forum Diskusi Perkuliahan

class PostDiscussionCommentPayload(BaseModel):
    token_komentar: str = Field(..., description="Token komentar dari thread diskusi (/form-komentarmhs/...)")
    id_chat: str = Field(..., description="ID chat topik diskusi")
    komentar: str = Field(..., min_length=1, max_length=5000, description="Isi pesan balasan komentar forum")


class CreateDiscussionPayload(BaseModel):
    token_course: str = Field(..., description="Token diskusi mata kuliah dari /courses (/form-diskusimhs/...)")
    judul: str = Field(..., min_length=1, max_length=255, description="Judul topik diskusi baru")
    chat: str = Field(..., min_length=1, max_length=5000, description="Isi penjelasan atau pertanyaan forum diskusi")


@router.get("/discussions")
async def get_discussions(
    token: str = Query(..., description="Token terenkripsi diskusi mata kuliah dari /courses (diawali 'eyJ...')"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Ambil daftar topik forum diskusi perkuliahan MyBest per mata kuliah."""
    nim, password = creds
    clean_token = extract_clean_token(token) or token.strip("/")
    path = f"/form-diskusimhs/{clean_token}"

    return await cached_endpoint(
        module="elearning",
        name="discussions",
        fetch=lambda: pooled_elearning_client.fetch_page(path, nim, password),
        parse=parse_discussions,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"token": clean_token, "nim": nim},
    )


@router.get("/discussions/comments")
async def get_discussion_comments(
    token: str = Query(..., description="Token terenkripsi komentar thread diskusi (diawali 'eyJ...')"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Ambil thread komentar dan tanggapan pada topik forum diskusi perkuliahan MyBest."""
    nim, password = creds
    clean_token = extract_clean_token(token) or token.strip("/")
    path = f"/form-komentarmhs/{clean_token}"

    return await cached_endpoint(
        module="elearning",
        name="discussion_comments",
        fetch=lambda: pooled_elearning_client.fetch_page(path, nim, password),
        parse=parse_discussion_comments,
        ttl=300,  # 5 menit
        cache_params={"token": clean_token, "nim": nim},
    )


@router.post("/discussions/comments")
async def post_discussion_comment(
    body: PostDiscussionCommentPayload,
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Kirim komentar atau tanggapan pada thread forum diskusi perkuliahan MyBest."""
    nim, password = creds
    clean_token = extract_clean_token(body.token_komentar) or body.token_komentar.strip("/")

    result = await pooled_elearning_client.post_discussion_comment(
        token_komentar=clean_token,
        id_chat=body.id_chat,
        komentar=body.komentar,
        nim=nim,
        password=password,
    )

    # Invalidate cache comments agar balasan langsung terlihat
    await invalidate_elearning_user_cache(nim, clean_token)

    return success_response(data=result)


@router.post("/discussions")
async def post_new_discussion(
    body: CreateDiscussionPayload,
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Buat topik forum diskusi baru pada mata kuliah MyBest."""
    nim, password = creds
    clean_token = extract_clean_token(body.token_course) or body.token_course.strip("/")

    result = await pooled_elearning_client.post_new_discussion(
        token_course=clean_token,
        judul=body.judul,
        chat=body.chat,
        nim=nim,
        password=password,
    )

    # Invalidate cache discussions
    await invalidate_elearning_user_cache(nim, clean_token)

    return success_response(data=result)


@router.get("/profile")
async def get_elearning_profile(creds: tuple[str, str] = Depends(require_elearning_creds)):
    """Ambil data profil dan kontak akun MyBest LMS mahasiswa."""
    nim, password = creds
    return await cached_endpoint(
        module="elearning",
        name="profile",
        fetch=lambda: pooled_elearning_client.fetch_page("/profil", nim, password),
        parse=parse_elearning_profile,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"nim": nim},
    )


@router.get("/makeups")
async def get_makeup_classes(creds: tuple[str, str] = Depends(require_elearning_creds)):
    """Cek jadwal kuliah pengganti (make-up classes) yang terdaftar di MyBest."""
    nim, password = creds
    return await cached_endpoint(
        module="elearning",
        name="makeups",
        fetch=lambda: pooled_elearning_client.fetch_page("/kuliah-pengganti", nim, password),
        parse=parse_makeup_classes,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"nim": nim},
    )


@router.get("/guides")
async def get_guides(creds: tuple[str, str] = Depends(require_elearning_creds)):
    """Daftar tautan berkas buku panduan resmi perkuliahan & ujian MyBest."""
    return success_response(data=get_official_guides())
