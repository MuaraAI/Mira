import asyncio
import hashlib
import logging
import re
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from scrapling.parser import Adaptor

logger = logging.getLogger("app.studentv2")

from app.config import settings
from app.deps import require_studentv2_creds
from app.envelope import success_response, error_response
from app.cache import cache
from app.retry import retry_async
from app.session_pool import SessionPool
from app.proxy import get_proxy
from app.router_helper import cached_endpoint

router = APIRouter(prefix="/v1/studentv2", tags=["studentv2"])

# Pure Parsers (Unit-tested against snapshot fixtures)

def parse_schedule(html: str) -> list[dict[str, Any]]:
    page = Adaptor(html)
    rows = page.css("table tr")
    results = []
    for row in rows[1:]:
        cols = [c.get_all_text().strip() for c in row.css("td")]
        if len(cols) >= 9:
            raw_dosen = cols[3].replace("\n", " ").strip()
            dosen_code = raw_dosen.split("/")[0].strip() if "/" in raw_dosen else (raw_dosen.split()[0] if raw_dosen.split() else "-")
            item_id = hashlib.sha256(f"{cols[4]}:{cols[1]}:{cols[2]}".encode()).hexdigest()[:12]
            results.append({
                "id": item_id,
                "kode": cols[4],
                "nama": cols[5],
                "hari": cols[1],
                "jam": cols[2],
                "sks": int(cols[6]) if cols[6].isdigit() else 0,
                "kelompok_praktek": cols[7] if cols[7] else None,
                "ruang": cols[8],
                "kode_dosen": dosen_code,
            })
    return results

def parse_grades(html: str) -> list[dict[str, Any]]:
    page = Adaptor(html)
    rows = page.css("table tr")
    results = []
    for row in rows[1:]:
        cols = [c.get_all_text().strip() for c in row.css("td")]
        if len(cols) >= 10:
            item_id = hashlib.sha256(cols[1].encode()).hexdigest()[:12]
            
            def to_float(val: str) -> Optional[float]:
                if not val or val == "-":
                    return None
                try:
                    return float(val)
                except ValueError:
                    return None

            results.append({
                "id": item_id,
                "kode": cols[1],
                "nama": cols[2],
                "sks": int(cols[3]) if cols[3].isdigit() else 0,
                "uts": to_float(cols[4]),
                "uas": to_float(cols[5]),
                "tugas": to_float(cols[6]),
                "absen": to_float(cols[7]),
                "total": to_float(cols[8]),
                "grade": cols[9] if cols[9] else None,
            })
    return results

def parse_news(html: str, limit: int = 100) -> list[dict[str, Any]]:
    page = Adaptor(html)
    rows = page.css("table tr")
    results = []
    for row in rows[1:]:
        cols = [c.get_all_text().strip() for c in row.css("td")]
        links = [a.attrib.get("href") for a in row.css("a") if a.attrib.get("href")]
        if len(cols) >= 4 and links:
            item_id = hashlib.sha256(cols[1].encode()).hexdigest()[:12]
            results.append({
                "id": item_id,
                "title": cols[1],
                "pdf_url": links[0],
                "date": cols[3],
            })
            if len(results) >= limit:
                break
    return results

def parse_announcements(html: str) -> list[dict[str, Any]]:
    page = Adaptor(html)
    results = []
    links = page.css('a[href*="pengumuman_dalam_"]')
    seen_urls = set()
    for a in links:
        title = " ".join(a.get_all_text().split()).strip()
        url = a.attrib.get("href", "").strip()
        if title and url and url not in seen_urls:
            seen_urls.add(url)
            item_id = hashlib.sha256(url.encode()).hexdigest()[:12]
            results.append({
                "id": item_id,
                "title": title,
                "pdf_url": url,
            })
    return results

def parse_profile(html: str) -> dict[str, Any]:
    """Parse biodata dan status akademik mahasiswa dari /mahasiswa/data-pribadi."""
    page = Adaptor(html)
    profile: dict[str, Any] = {}
    key_map = {
        "nim": "nim",
        "nama": "nama",
        "tempat_lahir": "tempat_lahir",
        "tanggal_lahir": "tanggal_lahir",
        "alamat": "alamat",
        "rt_rw": "rt_rw",
        "desa_kelurahan": "desa_kelurahan",
        "kecamatan": "kecamatan",
        "kota": "kota",
        "kode_pos": "kode_pos",
        "telepon": "telepon",
        "email": "email",
        "jenis_kelamin": "jenis_kelamin",
        "agama": "agama",
        "program_studi": "program_studi",
        "tahun_masuk": "tahun_masuk",
        "pilihan_waktu": "pilihan_waktu",
        "lokasi_cabang": "lokasi_cabang",
        "kelas": "kelas",
        "lokal": "lokal",
        "semester_aktif": "semester_aktif",
        "kondisi_aktif": "status_aktif",
        "kondisi_biaya_kuliah": "kondisi_biaya_kuliah",
    }
    for row in page.css("form .row"):
        label = row.css("label")
        input_el = row.css("input")
        if label and input_el:
            raw_k = re.sub(r"[\s/]+", "_", label[0].get_all_text().strip().lower()).strip("_")
            val = input_el[0].attrib.get("value", "").strip()
            mapped = key_map.get(raw_k, raw_k)
            profile[mapped] = val

    return profile

def parse_khs(html: str) -> dict[str, Any]:
    """Parse Kartu Hasil Studi (KHS) dan kumulatif IPK dari /mahasiswa/khs."""
    page = Adaptor(html)
    khs: dict[str, Any] = {"items": [], "total_mutu": 0.0, "total_sks": 0, "ipk": 0.0}
    tables = page.css("table")
    if tables:
        t = tables[0]
        for r in t.css("tr"):
            cols = [c.get_all_text().strip() for c in r.css("td")]
            if len(cols) >= 6 and cols[0].isdigit():
                khs["items"].append({
                    "no": int(cols[0]),
                    "kode": cols[1],
                    "mata_kuliah": cols[2],
                    "sks": int(cols[3]) if cols[3].isdigit() else 0,
                    "nilai": cols[4],
                    "mutu": float(cols[5]) if cols[5].replace(".", "").isdigit() else 0.0,
                    "keterangan": cols[6] if len(cols) > 6 else "",
                })
            elif "TOTAL MUTU" in r.get_all_text():
                tds = r.css("td")
                for j, td in enumerate(tds):
                    if "TOTAL MUTU" in td.get_all_text() and j + 1 < len(tds):
                        val_text = tds[j + 1].get_all_text().strip()
                        nums = re.findall(r"(\d+(?:\.\d+)?)", val_text)
                        if len(nums) >= 3:
                            khs["total_mutu"] = float(nums[0])
                            khs["total_sks"] = int(float(nums[1]))
                            khs["ipk"] = float(nums[2])
                        elif len(nums) == 2:
                            khs["total_sks"] = int(float(nums[0]))
                            khs["ipk"] = float(nums[1])
                        elif len(nums) == 1:
                            khs["ipk"] = float(nums[0])

    return khs

def parse_krs(html: str) -> dict[str, Any]:
    """Parse Kartu Rencana Studi (KRS) aktif dari /mahasiswa/krs."""
    page = Adaptor(html)
    krs: dict[str, Any] = {"items": [], "total_sks": 0, "semester": 1, "kelompok_ujian": None}
    k_text = page.get_all_text()
    m_sem = re.search(r"Semester\s*(\d+)", k_text)
    if m_sem:
        krs["semester"] = int(m_sem.group(1))
    m_kel = re.search(r"Kelompok Ujian\s*([A-Za-z0-9\.]+)", k_text)
    if m_kel:
        krs["kelompok_ujian"] = m_kel.group(1)

    tables = page.css("table")
    if tables:
        for r in tables[0].css("tr"):
            cols = [c.get_all_text().strip() for c in r.css("td")]
            if len(cols) >= 4 and cols[0].isdigit():
                krs["items"].append({
                    "no": int(cols[0]),
                    "kode": cols[1],
                    "mata_kuliah": cols[2],
                    "sks": int(cols[3]) if cols[3].isdigit() else 0,
                })
            elif len(cols) >= 2 and "Total SKS" in cols[0]:
                krs["total_sks"] = int(cols[1]) if cols[1].isdigit() else 0

    return krs

def parse_uts(html: str) -> dict[str, Any]:
    """Parse informasi jadwal & tautan soal ruang UTS dari /mahasiswa/uts."""
    page = Adaptor(html)
    uts: dict[str, Any] = {
        "title": "Ruang Ujian Tengah Semester",
        "jadwal_online_url": None,
        "soal_offline_url": None,
    }
    for a in page.css("a"):
        h = a.attrib.get("href", "")
        t = a.get_all_text().strip().lower()
        if "drive.google.com" in h or ("offline" in t and "soal" in t):
            uts["soal_offline_url"] = h
        elif "uts-jadwal" in h or ("online" in t and ("jadwal" in t or "lihat" in t)):
            uts["jadwal_online_url"] = h
    return uts

def parse_uas(html: str) -> dict[str, Any]:
    """Parse informasi jadwal & tautan soal ruang UAS dari /mahasiswa/uas."""
    page = Adaptor(html)
    uas: dict[str, Any] = {
        "title": "Ruang Ujian Akhir Semester",
        "jadwal_online_url": None,
        "soal_offline_url": None,
    }
    for a in page.css("a"):
        h = a.attrib.get("href", "")
        t = a.get_all_text().strip().lower()
        if "drive.google.com" in h or ("offline" in t and "soal" in t):
            uas["soal_offline_url"] = h
        elif "uas-jadwal" in h or ("online" in t and ("jadwal" in t or "lihat" in t)):
            uas["jadwal_online_url"] = h
    return uas

def parse_calendar(html: str) -> dict[str, Any]:
    """Parse tautan berkas resmi kalender akademik dari /mahasiswa/kalender."""
    page = Adaptor(html)
    pdf_url = None
    for a in page.css("a"):
        h = a.attrib.get("href", "").strip()
        if ".pdf" in h.lower() and ("kalender" in h.lower() or "upload_file" in h.lower()):
            pdf_url = h
            break
    return {
        "title": "Kalender Akademik Universitas Bina Sarana Informatika",
        "pdf_url": pdf_url,
    }

def parse_prodi_contacts(html: str) -> list[dict[str, Any]]:
    """Parse daftar kontak email resmi Dekan dan Kaprodi dari /mahasiswa/email-prodi."""
    page = Adaptor(html)
    contacts = []
    tables = page.css("table")
    if tables:
        for r in tables[0].css("tr")[1:]:
            cols = [c.get_all_text().strip() for c in r.css("td")]
            if len(cols) >= 5:
                contacts.append({
                    "no": int(cols[0]) if cols[0].isdigit() else cols[0],
                    "prodi": cols[1],
                    "jenjang": cols[2],
                    "kaprodi": cols[3],
                    "email": cols[4],
                })
    return contacts

def parse_certificates(html: str) -> list[dict[str, Any]]:
    """Parse data sertifikat kegiatan mahasiswa dari /mahasiswa/dokumen-saya."""
    page = Adaptor(html)
    certificates = []
    tables = page.css("table")
    for t in tables:
        for r in t.css("tr")[1:]:
            cols = [c.get_all_text().strip() for c in r.css("td")]
            links = [a.attrib.get("href") for a in r.css("a") if a.attrib.get("href")]
            if len(cols) >= 3 and not any("belum memiliki" in c.lower() for c in cols):
                certificates.append({
                    "nama_kegiatan": cols[1],
                    "tanggal": cols[2] if len(cols) > 2 else "",
                    "file_url": links[0] if links else (cols[3] if len(cols) > 3 else None),
                })
    return certificates

def parse_lecturers(html: str, search: Optional[str] = None) -> list[dict[str, Any]]:
    """Parse direktori kode dan nama dosen dari /mahasiswa/jadwal-mengajar."""
    page = Adaptor(html)
    lecturers = []
    tables = page.css("table")
    if tables:
        for r in tables[0].css("tr")[1:]:
            cols = [c.get_all_text().strip() for c in r.css("td")]
            if len(cols) >= 3:
                kode = cols[1]
                nama = cols[2]
                if search:
                    q = search.lower().strip()
                    if q not in kode.lower() and q not in nama.lower():
                        continue
                lecturers.append({
                    "kode": kode,
                    "nama": nama,
                })
    return lecturers

# Authenticated Client Session

class StudentV2Client:
    BASE_URL = "https://students.bsi.ac.id"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Origin": "https://students.bsi.ac.id",
        "Referer": "https://students.bsi.ac.id/login",
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

            payload = {
                "_token": token,
                "username": nim,
                "password": password,
                "remember": "on"
            }
            r2 = client.post(login_url, data=payload)
            if "mahasiswa/beranda" in str(r2.url) or "students.bsi.ac.id/mahasiswa" in str(r2.url) or "studentv2.bsi.ac.id/mahasiswa" in str(r2.url):
                self._logged_in = True
                return True
            logger.warning("SIAKAD login rejected for %s: ended at %s (status %s)", nim, r2.url, r2.status_code)
            return False
        except Exception as err:
            logger.error("SIAKAD login exception for %s: %s", nim, err)
            return False

    def fetch_page(self, path: str, nim: str, password: str) -> str:
        client = self.get_client()
        target_url = f"{self.BASE_URL}{path}"
        
        if not self._logged_in:
            ok = self.login(nim, password)
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_response(
                        code="AUTH_FAILED",
                        message="Gagal login ke students.bsi.ac.id",
                        module="studentv2"
                    )
                )

        r = client.get(target_url)
        
        # Check if redirected to login (expired session)
        if "/login" in str(r.url):
            ok = self.login(nim, password)
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_response(
                        code="AUTH_EXPIRED",
                        message="Sesi login studentv2 kedaluwarsa dan gagal login ulang",
                        module="studentv2"
                    )
                )
            r = client.get(target_url)

        return r.text

class PooledStudentV2Client:
    """Fasade client dengan pool sesi per-NIM.

    Dua NIM berbeda yang memanggil bersamaan tidak lagi saling menimpa sesi:
    setiap NIM mendapat instance StudentV2Client sendiri di dalam pool, dan
    sesi idle ditutup oleh evict_idle.
    """

    def __init__(self, ttl_seconds: int = 900):
        self._pool = SessionPool(lambda nim=None: StudentV2Client(proxy=get_proxy(seed=nim)), ttl_seconds=ttl_seconds)

    async def fetch_page(self, path: str, nim: str, password: str) -> str:
        client = self._pool.get(nim)

        def _fetch_once() -> str:
            return client.fetch_page(path, nim, password)

        try:
            return await retry_async(_fetch_once, attempts=3, base_delay=1.0)
        except HTTPException as exc:
            # Login expired → buang sesi supaya request berikutnya login ulang
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict) and detail.get("code") == "AUTH_EXPIRED":
                self._pool.invalidate(nim)
            raise

    async def evict_idle(self) -> int:
        return await self._pool.evict_idle()

    async def close(self) -> None:
        await self._pool.close()


studentv2_client = PooledStudentV2Client()

# API Routes

@router.get("/schedule")
async def get_schedule(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="schedule",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/jadwal-kuliah", nim, password),
        parse=parse_schedule,
        ttl=settings.TTL_SCHEDULE,
        cache_params={"nim": nim},
    )

@router.get("/grades")
async def get_grades(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="grades",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/nilai-murni", nim, password),
        parse=parse_grades,
        ttl=settings.TTL_GRADES,
        cache_params={"nim": nim},
    )

@router.get("/news")
async def get_news(
    limit: int = Query(default=50, ge=1, le=200),
    creds: tuple[str, str] = Depends(require_studentv2_creds)
):
    nim, password = creds

    def _parse(html: str):
        return parse_news(html, limit=limit)

    return await cached_endpoint(
        module="studentv2",
        name="news",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/berita", nim, password),
        parse=_parse,
        ttl=settings.TTL_NEWS,
        cache_params={"limit": limit},
    )

@router.get("/announcements")
async def get_announcements(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="announcements",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/beranda", nim, password),
        parse=parse_announcements,
        ttl=settings.TTL_NEWS,
    )


@router.get("/dashboard")
async def get_dashboard(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Ambil jadwal + nilai + berita + pengumuman sekaligus secara paralel.

    Total waktu respons = halaman upstream paling lambat, bukan jumlah
    keempatnya. Data yang sudah ada di cache tidak memicu fetch ulang.
    """
    nim, password = creds

    async def _section(name: str, path: str, parser, ttl: int):
        cache_key = cache.make_key("studentv2", name, nim=nim)
        fresh = await cache.get_fresh(cache_key)
        if fresh is not None:
            return name, success_response(data=fresh, cached=True), cache_key
        try:
            html = await studentv2_client.fetch_page(
                path,
                nim,
                password,
            )
            data = parser(html)
            await cache.set(cache_key, data, ttl=ttl)
            return name, success_response(data=data, cached=False), cache_key
        except Exception as e:
            lgg_result = await cache.get_lgg(cache_key)
            if lgg_result:
                lgg_data, _ = lgg_result
                return name, success_response(data=lgg_data, cached=True, stale=True), cache_key
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(code="UPSTREAM_ERROR", message=str(e), module="studentv2")
            )

    results = await asyncio.gather(
        _section("schedule", "/mahasiswa/jadwal-kuliah", parse_schedule, settings.TTL_SCHEDULE),
        _section("grades", "/mahasiswa/nilai-murni", parse_grades, settings.TTL_GRADES),
        _section("news", "/mahasiswa/berita", parse_news, settings.TTL_NEWS),
        _section("announcements", "/mahasiswa/beranda", parse_announcements, settings.TTL_NEWS),
        return_exceptions=True,
    )

    dashboard: dict[str, Any] = {}
    all_cached = True
    errors: list[str] = []
    for item in results:
        if isinstance(item, Exception):
            errors.append(str(item))
            continue
        name, response, _ = item
        dashboard[name] = response["data"]
        if not response.get("cached"):
            all_cached = False

    if not dashboard and errors:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(code="UPSTREAM_ERROR", message="; ".join(errors), module="studentv2")
        )

    return success_response(data=dashboard, cached=all_cached)

@router.get("/profile")
async def get_profile(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Biodata lengkap dan status akademik mahasiswa dari SIAKAD."""
    nim, password = creds
    res = await cached_endpoint(
        module="studentv2",
        name="profile",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/data-pribadi", nim, password),
        parse=parse_profile,
        ttl=settings.TTL_LIBRARY,
        cache_params={"nim": nim},
    )
    # Record branch & program for public stats (privacy-preserving HMAC hash)
    try:
        from app.stats import record_profile
        data = res.get("data") or {}
        await record_profile(
            nim=nim,
            branch=data.get("lokasi_cabang"),
            program=data.get("program_studi"),
        )
    except Exception:
        pass
    return res

@router.get("/khs")
async def get_khs(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Kartu Hasil Studi (KHS) dan kumulatif IPK semester."""
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="khs",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/khs", nim, password),
        parse=parse_khs,
        ttl=settings.TTL_GRADES,
        cache_params={"nim": nim},
    )

@router.get("/krs")
async def get_krs(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Kartu Rencana Studi (KRS) aktif dan kelompok ujian."""
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="krs",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/krs", nim, password),
        parse=parse_krs,
        ttl=settings.TTL_SCHEDULE,
        cache_params={"nim": nim},
    )

@router.get("/uts")
async def get_uts(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Informasi jadwal ujian online dan unduhan soal ruang UTS."""
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="uts",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/uts", nim, password),
        parse=parse_uts,
        ttl=settings.TTL_SCHEDULE,
        cache_params={"nim": nim},
    )


@router.get("/uas")
async def get_uas(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Informasi jadwal ujian online dan unduhan soal ruang UAS (Ujian Akhir Semester)."""
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="uas",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/uas", nim, password),
        parse=parse_uas,
        ttl=settings.TTL_SCHEDULE,
        cache_params={"nim": nim},
    )


@router.get("/calendar")
async def get_calendar(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Unduh dan cek berkas PDF Kalender Akademik resmi BSI."""
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="calendar",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/kalender", nim, password),
        parse=parse_calendar,
        ttl=settings.TTL_LIBRARY,
        cache_params={"nim": nim},
    )


@router.get("/prodi-contacts")
async def get_prodi_contacts(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Daftar kontak email resmi Dekanat Fakultas dan Ketua Program Studi (Kaprodi) seluruh kampus UBSI."""
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="prodi_contacts",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/email-prodi", nim, password),
        parse=parse_prodi_contacts,
        ttl=settings.TTL_LIBRARY,
        cache_params={"nim": nim},
    )


@router.get("/certificates")
async def get_certificates(creds: tuple[str, str] = Depends(require_studentv2_creds)):
    """Daftar sertifikat kegiatan, course, dan TOEFL mahasiswa yang tercatat di SIAKAD."""
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="certificates",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/dokumen-saya", nim, password),
        parse=parse_certificates,
        ttl=settings.TTL_LIBRARY,
        cache_params={"nim": nim},
    )


@router.get("/lecturers")
async def get_lecturers(
    search: Optional[str] = Query(default=None, description="Pencarian kode atau nama dosen"),
    creds: tuple[str, str] = Depends(require_studentv2_creds),
):
    """Direktori seluruh dosen BSI beserta kode inisial dosen."""
    nim, password = creds
    return await cached_endpoint(
        module="studentv2",
        name="lecturers",
        fetch=lambda: studentv2_client.fetch_page("/mahasiswa/jadwal-mengajar", nim, password),
        parse=lambda html: parse_lecturers(html, search=search),
        ttl=settings.TTL_LIBRARY,
        cache_params={"search": search or ""},
    )
