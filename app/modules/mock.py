"""Mock API untuk demo dashboard & onboarding (MOCK_MODE=1).

Data 100% PALSU dan deterministik: tidak pernah menyentuh server kampus,
Redis, atau database. Setiap payload menandai dirinya sendiri dengan
``"mock": True`` sehingga mustahil tertukar dengan data real.

Router ini hanya di-mount saat env MOCK_MODE=1 dan dibebaskan dari auth
middleware (GET) karena isinya aman publik: tidak ada NIM, nama, atau
kredensial siapa pun.
"""

from typing import Any

from fastapi import APIRouter

from app.envelope import success_response

router = APIRouter(prefix="/v1/mock", tags=["mock"])

_MOCK_TOKEN = "bW9ja3Rva2VuLWRlbW8tb25seQ"

_PROFILE: dict[str, Any] = {
    "mock": True,
    "nim": "00.0.0000",
    "nama": "Demo Mahasiswa",
    "tempat_lahir": "Kota Contoh",
    "tanggal_lahir": "2005-01-01",
    "alamat": "Jl. Pahlawan Demo No. 1",
    "kota": "Pontianak",
    "telepon": "081200000000",
    "email": "demo@example.com",
    "jenis_kelamin": "L",
    "program_studi": "Teknik Informatika",
    "tahun_masuk": "2026",
    "pilihan_waktu": "Reguler",
    "lokasi_cabang": "UBSI Pontianak",
    "kelas": "1C.30",
    "lokal": "1",
    "class_code": "15.1C.30.A",
    "campus_branch": "30",
    "major": "Teknik Informatika",
    "status": "Aktif",
    "semester": 1,
}

_SCHEDULE: list[dict[str, Any]] = [
    {"id": "mock01", "kode": "INF101", "nama": "Pemrograman Web", "hari": "Senin", "jam": "08:00-10:30", "sks": 3, "kelompok_praktek": None, "ruang": "LAB 1", "kode_dosen": "D001"},
    {"id": "mock02", "kode": "INF102", "nama": "Basis Data", "hari": "Senin", "jam": "10:30-13:00", "sks": 3, "kelompok_praktek": None, "ruang": "R. 202", "kode_dosen": "D002"},
    {"id": "mock03", "kode": "MKW103", "nama": "Pancasila", "hari": "Selasa", "jam": "08:00-10:30", "sks": 2, "kelompok_praktek": None, "ruang": "R. 105", "kode_dosen": "D003"},
    {"id": "mock04", "kode": "INF104", "nama": "Struktur Data", "hari": "Rabu", "jam": "13:00-15:30", "sks": 3, "kelompok_praktek": "A", "ruang": "LAB 2", "kode_dosen": "D004"},
]

_COURSES: list[dict[str, Any]] = [
    {"kode": "INF101", "nama": "PEMROGRAMAN WEB", "hari": "Senin", "jam": "08:00-10:30", "sks": 3, "token": _MOCK_TOKEN, "token_absen": _MOCK_TOKEN, "token_assignment": _MOCK_TOKEN, "token_diskusi": _MOCK_TOKEN, "token_learning": _MOCK_TOKEN},
    {"kode": "INF102", "nama": "BASIS DATA", "hari": "Senin", "jam": "10:30-13:00", "sks": 3, "token": _MOCK_TOKEN, "token_absen": _MOCK_TOKEN, "token_assignment": _MOCK_TOKEN, "token_diskusi": _MOCK_TOKEN, "token_learning": _MOCK_TOKEN},
]

_ASSIGNMENTS: dict[str, Any] = {
    "mock": True,
    "tasks": [
        {"id": "mocktask1", "kode": "INF101", "kelas": "1C.30", "judul": "Tugas 1: Layout HTML", "deskripsi": "Buat halaman profil pribadi.", "pertemuan": "3", "mulai": "2026-10-20 08:00", "selesai": "2026-10-30 23:59", "file_soal_url": None, "file_soal_id": None, "mata_kuliah": "PEMROGRAMAN WEB"},
        {"id": "mocktask2", "kode": "INF102", "kelas": "1C.30", "judul": "Tugas 1: ERD Perpustakaan", "deskripsi": "Rancang ERD sistem perpustakaan.", "pertemuan": "3", "mulai": "2026-10-21 08:00", "selesai": "2026-11-02 23:59", "file_soal_url": None, "file_soal_id": None, "mata_kuliah": "BASIS DATA"},
    ],
    "submissions": [
        {"id": "mocksub1", "kode": "INF101", "judul": "Tugas 0: Perkenalan", "selesai": "2026-10-15 21:04", "mata_kuliah": "PEMROGRAMAN WEB"},
    ],
}

_KHS: dict[str, Any] = {
    "mock": True,
    "items": [
        {"no": 1, "kode": "INF101", "mata_kuliah": "Pemrograman Web", "sks": 3, "nilai": "A", "mutu": 4.0, "keterangan": ""},
        {"no": 2, "kode": "INF102", "mata_kuliah": "Basis Data", "sks": 3, "nilai": "AB", "mutu": 3.5, "keterangan": ""},
    ],
    "total_mutu": 22.5,
    "total_sks": 6,
    "ipk": 3.75,
}

_PRESENCE: dict[str, Any] = {
    "mock": True,
    "status_sesi": "open",
    "can_submit": True,
    "present_today": False,
}


@router.get("/profile")
async def mock_profile() -> dict[str, Any]:
    """Profil mahasiswa demo (data palsu)."""
    return success_response(data=_PROFILE)


@router.get("/schedule")
async def mock_schedule() -> dict[str, Any]:
    """Jadwal kuliah demo (data palsu)."""
    return success_response(data={"items": _SCHEDULE, "mock": True})


@router.get("/courses")
async def mock_courses() -> dict[str, Any]:
    """Daftar mata kuliah MyBest demo (data palsu)."""
    return success_response(data=_COURSES)


@router.get("/assignments")
async def mock_assignments() -> dict[str, Any]:
    """Daftar tugas & pengumpulan demo (data palsu)."""
    return success_response(data=_ASSIGNMENTS)


@router.get("/khs")
async def mock_khs() -> dict[str, Any]:
    """KHS demo (data palsu)."""
    return success_response(data=_KHS)


@router.get("/presence")
async def mock_presence() -> dict[str, Any]:
    """Status presensi demo (data palsu)."""
    return success_response(data=_PRESENCE)
