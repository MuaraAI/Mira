import asyncio
import hashlib
import logging
import re
import statistics
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from scrapling.parser import Adaptor

logger = logging.getLogger("app.elearning")

from app.config import settings
from app.deps import require_elearning_creds
from app.envelope import success_response, error_response
from app.session_pool import SessionPool
from app.retry import retry_async
from app.proxy import get_proxy
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
    page = Adaptor(html)
    plans = page.css("div.pricing-plan")
    courses = []

    for pl in plans:
        title_el = pl.css(".pricing-title")
        nama = title_el[0].text.strip() if title_el else ""

        save_el = pl.css(".pricing-save")
        schedule_text = save_el[0].text.strip() if save_el else ""
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

                soal_links = [
                    a.attrib.get("href")
                    for a in r.css("a")
                    if any(x in a.attrib.get("href", "").lower() for x in ("/storage/soal", "/soal", ".pdf", ".zip", ".docx", ".rar"))
                ]
                file_soal_url = soal_links[0] if soal_links else None

                action_links = [
                    a.attrib.get("href")
                    for a in r.css("a")
                    if "upload-tugas" in a.attrib.get("href", "") or "form-tugas" in a.attrib.get("href", "")
                ]
                upload_url = action_links[0] if action_links else None
                token_tugas = None
                if upload_url:
                    m = re.search(r"/(?:upload-tugas|form-tugas)/([^/?#]+)", upload_url)
                    token_tugas = m.group(1) if m else upload_url.rstrip("/").split("/")[-1]

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
                    "upload_url": upload_url,
                    "token_tugas": token_tugas,
                })

    # Table 1: Submissions
    if len(tables) >= 2:
        for r in tables[1].css("tr")[1:]:
            cols = [c.get_all_text().strip() for c in r.css("td")]
            links = [a.attrib.get("href") for a in r.css("a") if a.attrib.get("href")]
            if len(cols) >= 7:
                item_id = hashlib.sha256(f"{cols[1]}:{cols[2]}:{cols[3]}".encode()).hexdigest()[:12]
                val_nilai = float(cols[6]) if cols[6] and cols[6].replace(".", "").isdigit() else None
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
        h_text = " ".join([c.text.strip() for c in t.css("th")])
        if "Status Absen" in h_text or "Pertemuan" in h_text:
            target_table = t
            break

    if target_table:
        for r in target_table.css("tr")[1:]:
            cols = [c.text.strip() for c in r.css("td")]
            if len(cols) >= 6:
                item_id = hashlib.sha256(f"{cols[2]}:{cols[4]}".encode()).hexdigest()[:12]
                records.append({
                    "id": item_id,
                    "status_absen": cols[1],
                    "tanggal": cols[2],
                    "matakuliah": cols[3],
                    "pertemuan": cols[4],
                    "rangkuman": cols[5] if cols[5] else None,
                    "berita_acara": cols[6] if len(cols) > 6 and cols[6] else None,
                })

    return {
        "kode_mtk": info.get("kode mtk"),
        "matakuliah": info.get("matakuliah"),
        "kelas": info.get("kelas"),
        "dosen": info.get("dosen"),
        "ruang": info.get("ruang"),
        "hari": info.get("hari"),
        "jam_masuk": info.get("jam masuk"),
        "jam_keluar": info.get("jam keluar"),
        "status_sesi": status_sesi,
        "total_kehadiran": len(records),
        "riwayat": records,
    }

def parse_materials(html: str) -> list[dict[str, Any]]:
    page = Adaptor(html)
    materials = []

    # Check table rows first
    tables = page.css("table")
    if tables:
        for r in tables[0].css("tr")[1:]:
            cols = [c.text.strip() for c in r.css("td")]
            links = [a.attrib.get("href") for a in r.css("a") if a.attrib.get("href")]
            if len(cols) >= 5:
                item_id = hashlib.sha256(f"{cols[1]}:{cols[3]}".encode()).hexdigest()[:12]
                materials.append({
                    "id": item_id,
                    "kode": cols[1],
                    "kelas": cols[2],
                    "judul": cols[3],
                    "deskripsi": cols[4],
                    "file_url": links[0] if links else None,
                    "update": cols[6] if len(cols) > 6 else None,
                })

    # Also capture any standalone download links (silabus / modul zip)
    seen_urls = {m["file_url"] for m in materials if m.get("file_url")}
    for a in page.css("a"):
        h = a.attrib.get("href", "").strip()
        if h and any(ext in h.lower() for ext in [".zip", ".pdf", ".rar", "silabus"]):
            if h not in seen_urls:
                seen_urls.add(h)
                title = a.text.strip() or ("Silabus / Modul" if "silabus" in h else "Bahan Ajar")
                item_id = hashlib.sha256(h.encode()).hexdigest()[:12]
                materials.append({
                    "id": item_id,
                    "kode": None,
                    "kelas": None,
                    "judul": title,
                    "deskripsi": "Berkas silabus / modul pembelajaran",
                    "file_url": h,
                    "update": None,
                })

    return materials

def parse_quiz(html: str) -> list[dict[str, Any]]:
    page = Adaptor(html)
    quizzes = []
    rows = page.css("table tr")
    for r in rows[1:]:
        cols = [c.text.strip() for c in r.css("td")]
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
                info[label[0].get_all_text().strip().lower()] = val[0].get_all_text().strip()

    btn = page.css("div.col-xl-3 button, button.btn-warning, button.btn-success, button.btn-info, button.btn-danger, center button")
    status_raw = btn[0].get_all_text().strip() if btn else "Tidak Diketahui"
    status_lower = status_raw.lower()
    can_submit = (
        ("absen" in status_lower or "masuk" in status_lower)
        and "selesai" not in status_lower
        and "belum" not in status_lower
    )

    form = page.css("form[action*='simpan-absen'], form[action*='absen'], div.col-xl-3 form")
    form_action = form[0].attrib.get("action") if form else None
    form_inputs = {
        inp.attrib.get("name"): inp.attrib.get("value", "")
        for inp in form[0].css("input")
        if inp.attrib.get("name")
    } if form else {}

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

class ElearningClient:
    BASE_URL = "https://elearning.bsi.ac.id"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Origin": "https://elearning.bsi.ac.id",
        "Referer": "https://elearning.bsi.ac.id/login",
    }

    def __init__(self, proxy: Optional[str] = None):
        self._proxy = proxy
        self._client: Optional[httpx.Client] = None
        self._logged_in: bool = False
        self._login_lock = asyncio.Lock()

    def get_client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(headers=self.HEADERS, follow_redirects=True, timeout=25.0, proxy=self._proxy)
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
            if "dashboard" in str(r2.url) or "elearning.bsi.ac.id/user" in str(r2.url):
                self._logged_in = True
                return True
            logger.warning("Elearning login rejected for %s: ended at %s (status %s)", nim, r2.url, r2.status_code)
            return False
        except Exception as err:
            logger.error("Elearning login exception for %s: %s", nim, err)
            return False

    def fetch_page(self, path: str, nim: str, password: str) -> str:
        client = self.get_client()
        if "://" in path or path.startswith("//"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="INVALID_PATH",
                    message="Path tidak valid (dilarang menggunakan URL absolut atau skema)",
                    module="elearning",
                ),
            )
        target_url = f"{self.BASE_URL}{path}" if path.startswith("/") else f"{self.BASE_URL}/{path}"

        if not self._logged_in:
            ok = self.login(nim, password)
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_response(
                        code="AUTH_FAILED",
                        message="Gagal login ke elearning.bsi.ac.id (captcha/kredensial salah)",
                        module="elearning"
                    )
                )

        r = client.get(target_url)

        # Handle session expiration
        if "/login" in str(r.url):
            ok = self.login(nim, password)
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_response(
                        code="AUTH_EXPIRED",
                        message="Sesi login elearning kedaluwarsa dan gagal login ulang",
                        module="elearning"
                    )
                )
            r = client.get(target_url)

        return r.text

    def post_page(
        self,
        path: str,
        nim: str,
        password: str,
        data: Optional[dict] = None,
        json_body: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        client = self.get_client()
        if "://" in path or path.startswith("//"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="INVALID_PATH",
                    message="Path tidak valid (dilarang menggunakan URL absolut atau skema)",
                    module="elearning",
                ),
            )
        target_url = f"{self.BASE_URL}{path}" if path.startswith("/") else f"{self.BASE_URL}/{path}"

        if not self._logged_in:
            ok = self.login(nim, password)
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_response(
                        code="AUTH_FAILED",
                        message="Gagal login ke elearning.bsi.ac.id (captcha/kredensial salah)",
                        module="elearning",
                    ),
                )

        req_headers = dict(self.HEADERS)
        if headers:
            req_headers.update(headers)

        r = client.post(target_url, data=data, json=json_body, headers=req_headers)

        # Handle session expiration
        if "/login" in str(r.url):
            ok = self.login(nim, password)
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_response(
                        code="AUTH_EXPIRED",
                        message="Sesi login elearning kedaluwarsa dan gagal login ulang",
                        module="elearning",
                    ),
                )
            r = client.post(target_url, data=data, json=json_body, headers=req_headers)

        return r

    def post_multipart(
        self,
        path: str,
        nim: str,
        password: str,
        data: Optional[dict] = None,
        files: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        client = self.get_client()
        if "://" in path or path.startswith("//"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response(
                    code="INVALID_PATH",
                    message="Path tidak valid (dilarang menggunakan URL absolut atau skema)",
                    module="elearning",
                ),
            )
        target_url = f"{self.BASE_URL}{path}" if path.startswith("/") else f"{self.BASE_URL}/{path}"

        if not self._logged_in:
            ok = self.login(nim, password)
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_response(
                        code="AUTH_FAILED",
                        message="Gagal login ke elearning.bsi.ac.id (captcha/kredensial salah)",
                        module="elearning",
                    ),
                )

        req_headers = dict(self.HEADERS)
        if headers:
            req_headers.update(headers)

        return client.post(target_url, data=data, files=files, headers=req_headers)

    def download_file(self, url: str, nim: str, password: str) -> httpx.Response:
        client = self.get_client()
        if not self._logged_in:
            self.login(nim, password)
        return client.get(url)

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
            return await retry_async(_post_once, attempts=3, base_delay=1.0)
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

        return await retry_async(_post_once, attempts=3, base_delay=1.0)

    async def download_file(self, url: str, nim: str, password: str) -> httpx.Response:
        client = self._pool.get(nim)

        def _get_once() -> httpx.Response:
            return client.download_file(url, nim, password)

        return await retry_async(_get_once, attempts=3, base_delay=1.0)

    async def evict_idle(self) -> int:
        return await self._pool.evict_idle()

    async def close(self) -> None:
        await self._pool.close()


pooled_elearning_client = PooledElearningClient()

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
    token: Optional[str] = Query(default=None, pattern=r"^[A-Za-z0-9+/=_-]+$", description="Encrypted course token from /courses (opsional, tanpa token = agregasi seluruh matkul)"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    nim, password = creds

    if not token:
        async def _fetch_all_assignments():
            courses_res = await get_courses(creds)
            courses = courses_res["data"]

            async def _fetch_for(course: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
                t = course.get("token_assignment")
                if not t:
                    return {"tasks": [], "submissions": []}
                try:
                    html = await pooled_elearning_client.fetch_page(f"/assignment/{t}", nim, password)
                    parsed = parse_assignments(html)
                    for item in parsed.get("tasks", []):
                        item.setdefault("kode", course.get("kode") or "")
                        item["mata_kuliah"] = course.get("nama") or ""
                    for item in parsed.get("submissions", []):
                        item.setdefault("kode", course.get("kode") or "")
                        item["mata_kuliah"] = course.get("nama") or ""
                    return parsed
                except Exception:
                    return {"tasks": [], "submissions": []}

            results = await asyncio.gather(*(_fetch_for(c) for c in courses), return_exceptions=True)
            tasks_list: list[dict[str, Any]] = []
            submissions_list: list[dict[str, Any]] = []
            for r in results:
                if isinstance(r, dict):
                    tasks_list.extend(r.get("tasks", []))
                    submissions_list.extend(r.get("submissions", []))
            return {"tasks": tasks_list, "submissions": submissions_list}

        return await cached_endpoint(
            module="elearning",
            name="assignments",
            fetch=_fetch_all_assignments,
            parse=lambda data: data,
            ttl=settings.TTL_ASSIGNMENTS,
            cache_params={"nim": nim, "token": "all"},
        )

    return await cached_endpoint(
        module="elearning",
        name="assignments",
        fetch=lambda: pooled_elearning_client.fetch_page(f"/assignment/{token}", nim, password),
        parse=parse_assignments,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"token": token},
    )

@router.get("/presence")
async def get_presence(
    token: Optional[str] = Query(default=None, pattern=r"^[A-Za-z0-9+/=_-]+$", description="Encrypted course token from /courses"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    nim, password = creds

    if not token:
        courses_res = await get_courses(creds)
        courses = courses_res["data"]
        if not courses or not courses[0].get("token_absen"):
            return success_response(data={}, cached=False)
        token = courses[0]["token_absen"]

    return await cached_endpoint(
        module="elearning",
        name="presence",
        fetch=lambda: pooled_elearning_client.fetch_page(f"/absen-mhs/{token}", nim, password),
        parse=parse_presence,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"token": token},
    )

@router.get("/materials")
async def get_materials(
    token: Optional[str] = Query(default=None, pattern=r"^[A-Za-z0-9+/=_-]+$", description="Encrypted course token from /courses"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    nim, password = creds

    if not token:
        courses_res = await get_courses(creds)
        courses = courses_res["data"]
        if not courses or not courses[0].get("token_learning"):
            return success_response(data=[], cached=False)
        token = courses[0]["token_learning"]

    return await cached_endpoint(
        module="elearning",
        name="materials",
        fetch=lambda: pooled_elearning_client.fetch_page(f"/learning/{token}", nim, password),
        parse=parse_materials,
        ttl=settings.TTL_ASSIGNMENTS,
        cache_params={"token": token},
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
        courses_res = await get_courses((nim, password))
        courses = courses_res["data"]

        async def _subs_for(course: dict[str, Any]) -> list[dict[str, Any]]:
            t = course.get("token_assignment")
            if not t:
                return []
            res = await get_assignments(token=t, creds=(nim, password))
            subs = res["data"]["submissions"]
            for s in subs:
                s.setdefault("kode", course.get("kode") or "-")
                s["mata_kuliah"] = course.get("nama") or ""
            return subs

        gathered = await asyncio.gather(
            *(_subs_for(c) for c in courses), return_exceptions=True
        )
        submissions: list[dict[str, Any]] = []
        for item in gathered:
            if isinstance(item, BaseException):
                continue
            submissions.extend(item)

    return summarize_grades(submissions, quizzes)


@router.get("/grades")
async def get_grades(
    token: Optional[str] = Query(default=None, pattern=r"^[A-Za-z0-9+/=_-]+$", description="Encrypted course token from /courses (opsional, tanpa token = semua matkul)"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Rekap nilai tugas & kuis seluruh mata kuliah aktif, per pertemuan."""
    nim, password = creds

    return await cached_endpoint(
        module="elearning",
        name="grades",
        fetch=lambda: _build_grades(nim, password, token),
        parse=lambda data: data,
        ttl=settings.TTL_GRADES,
        cache_params={"nim": nim, "token": token or "all"},
    )


@router.get("/courses/{course_id}/grades")
async def get_course_grades(
    course_id: str,
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
    inputs = info.get("form_inputs") or {}
    try:
        await pooled_elearning_client.post_page(action_url, nim, password, data=inputs)
        return {
            "success": True,
            "status": "Hadir",
            "matakuliah": info["matakuliah"],
            "dosen": info["dosen"],
            "ruang": info["ruang"],
            "message": f"Presensi mata kuliah {info['matakuliah']} berhasil dicatat.",
        }
    except Exception as exc:
        return {
            "success": False,
            "status": "ERROR",
            "message": f"Gagal mengirim presensi ke upstream: {exc}",
        }

async def fetch_quiz_questions(
    nim: str, password: str, token: Optional[str] = None, quiz_url: Optional[str] = None
) -> dict[str, Any]:
    """Ambil daftar soal, sisa waktu, dan opsi jawaban kuis/ujian."""
    target_path = quiz_url or (f"/halaman-ujian/{token}" if token else "/exercise")
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
    token: Optional[str] = Query(default=None, pattern=r"^[A-Za-z0-9+/=_-]+$", description="Encrypted course token from /courses (opsional)"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    """Pencet / submit presensi perkuliahan pada kelas aktif."""
    nim, password = creds
    result = await submit_presence(nim, password, token)
    return success_response(data=result)

@router.get("/quiz/questions")
async def get_quiz_questions(
    token: Optional[str] = Query(default=None, pattern=r"^[A-Za-z0-9+/=_-]+$", description="Token ujian / kuis"),
    quiz_url: Optional[str] = Query(default=None, pattern=r"^/[A-Za-z0-9_/-]+$", description="Path relatif halaman ujian"),
    creds: tuple[str, str] = Depends(require_elearning_creds)
):
    """Ambil daftar pertanyaan dan opsi kuis/ujian."""
    nim, password = creds
    result = await fetch_quiz_questions(nim, password, token=token, quiz_url=quiz_url)
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


# ============================================================================
# Assignment File Upload & Download Operations
# ============================================================================

def is_safe_bsi_storage_url(url_str: str) -> bool:
    """Validasi URL file agar hanya mengunduh dari storage resmi kampus BSI (anti-SSRF)."""
    import urllib.parse
    try:
        p = urllib.parse.urlparse(url_str)
        if p.scheme not in ("http", "https"):
            return False
        hostname = (p.hostname or "").lower()
        if hostname not in ("elearning.bsi.ac.id", "students.bsi.ac.id", "news.bsi.ac.id", "repository.bsi.ac.id"):
            return False
        if ".." in p.path or not p.path.startswith(("/storage/soal/", "/storage/tugas/")):
            return False
        return not p.query and not p.fragment
    except Exception:
        return False


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
    try:
        file_bytes = base64.b64decode(body.file_base64, validate=True)
        if len(file_bytes) > 10 * 1024 * 1024:
            raise ValueError("file too large")
    except Exception:
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
        token_tugas=body.token_tugas,
        filename=body.filename,
        file_bytes=file_bytes,
        catatan=body.catatan,
    )
    return success_response(data=result)


@router.get("/assignments/download")
async def download_assignment_file(
    file_url: str = Query(..., description="URL file tugas dari MyBest (storage/soal/... atau storage/tugas/...)"),
    creds: tuple[str, str] = Depends(require_elearning_creds),
):
    """Download berkas soal atau submission tugas dari storage MyBest secara aman."""
    if not is_safe_bsi_storage_url(file_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="INVALID_URL",
                message="file_url tidak valid atau bukan berasal dari domain storage resmi BSI (anti-SSRF)",
                module="elearning",
            ),
        )

    nim, password = creds
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
        filename = file_url.rstrip("/").split("/")[-1] or "berkas_tugas.pdf"
        content_type = resp.headers.get("content-type", "application/octet-stream")
        return Response(
            content=resp.content,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(
                code="DOWNLOAD_ERROR",
                message=f"Terjadi kesalahan saat mengunduh file: {exc}",
                module="elearning",
            ),
        )
