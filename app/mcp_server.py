"""UBSI API — Model Context Protocol (MCP) Server.

Menghubungkan layanan akademik UBSI (SIAKAD, Elearning MyBest, Perpustakaan,
Repository, Berita) sebagai first-class tools untuk AI Agent (Hermes, Claude, Cursor).

Mendukung isolasi kredensial per akun / per session via:
- Environment variables: UBSI_API_URL, UBSI_API_KEY, UBSI_SESSION_TOKEN
- Parameter per-call: token / session_token / api_key pada setiap pemanggilan tool.
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional
import httpx
from mcp.server.mcpserver import MCPServer

server = MCPServer(
    name="ubsi-mcp",
    version="1.3.0",
    description="Universal API aggregator dan otomasi akademik untuk 6 layanan digital Universitas Bina Sarana Informatika (UBSI).",
)


def _get_base_url() -> str:
    url = os.getenv("UBSI_API_URL", "https://api.muaraai.com/v1/ubsi-api")
    return url.rstrip("/")


def _build_headers(
    api_key: Optional[str] = None,
    session_token: Optional[str] = None,
) -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    k = api_key or os.getenv("UBSI_API_KEY", "")
    s = session_token or os.getenv("UBSI_SESSION_TOKEN", "")

    # Abaikan literal template yang belum diekspansi (misal: ${UBSI_API_KEY})
    if k.startswith("${") and k.endswith("}"):
        k = ""
    if s.startswith("${") and s.endswith("}"):
        s = ""

    if s:
        headers["Authorization"] = f"Bearer {s}"
        headers["Cookie"] = f"ubsi_session={s}"
    elif k:
        headers["Authorization"] = f"Bearer {k}"
        headers["X-API-Key"] = k

    return headers


async def _api_get(
    path: str,
    params: Optional[dict[str, Any]] = None,
    api_key: Optional[str] = None,
    session_token: Optional[str] = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    url = f"{_get_base_url()}{path}"
    headers = _build_headers(api_key=api_key, session_token=session_token)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, params=params, headers=headers)
            try:
                return resp.json()
            except Exception:
                return {
                    "success": False,
                    "error": {
                        "code": f"HTTP_{resp.status_code}",
                        "message": resp.text[:300],
                    },
                }
    except Exception as exc:
        return {
            "success": False,
            "error": {"code": "NETWORK_ERROR", "message": str(exc)},
        }


async def _api_post(
    path: str,
    json_data: Optional[dict[str, Any]] = None,
    params: Optional[dict[str, Any]] = None,
    api_key: Optional[str] = None,
    session_token: Optional[str] = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    url = f"{_get_base_url()}{path}"
    headers = _build_headers(api_key=api_key, session_token=session_token)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=json_data, params=params, headers=headers)
            try:
                return resp.json()
            except Exception:
                return {
                    "success": False,
                    "error": {
                        "code": f"HTTP_{resp.status_code}",
                        "message": resp.text[:300],
                    },
                }
    except Exception as exc:
        return {
            "success": False,
            "error": {"code": "NETWORK_ERROR", "message": str(exc)},
        }


# ============================================================================
# Tools: Sistem & Autentikasi
# ============================================================================

@server.tool(
    name="ubsi_whoami",
    description="Periksa status sesi login dan identitas mahasiswa (NIM) yang aktif.",
)
async def ubsi_whoami(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/auth/me", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


# ============================================================================
# Tools: StudentV2 (SIAKAD)
# ============================================================================

@server.tool(
    name="ubsi_get_schedule",
    description="Ambil jadwal kuliah semester aktif dari SIAKAD (hari, jam, ruang, SKS, dosen).",
)
async def ubsi_get_schedule(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/studentv2/schedule", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_grades",
    description="Ambil rekapitulasi nilai murni lengkap (UTS, UAS, Tugas, Absen, Total, Grade) dari SIAKAD.",
)
async def ubsi_get_grades(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/studentv2/grades", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_profile",
    description="Ambil biodata mahasiswa lengkap dari SIAKAD: NIM, nama, prodi, kelas, lokal, semester aktif, dll.",
)
async def ubsi_get_profile(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/studentv2/profile", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_khs",
    description="Ambil Kartu Hasil Studi (KHS), kumulatif IPK, dan total mutu dari SIAKAD.",
)
async def ubsi_get_khs(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/studentv2/khs", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_krs",
    description="Ambil Kartu Rencana Studi (KRS) aktif, daftar 6 mata kuliah, dan kelompok ujian dari SIAKAD.",
)
async def ubsi_get_krs(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/studentv2/krs", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_uts",
    description="Ambil jadwal ujian online dan tautan soal ruang UTS/UAS dari SIAKAD.",
)
async def ubsi_get_uts(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/studentv2/uts", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_dashboard",
    description="Ambil seluruh ringkasan akademik paralel sekaligus: jadwal + nilai murni + berita + pengumuman.",
)
async def ubsi_get_dashboard(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/studentv2/dashboard", session_token=session_token, api_key=api_key, timeout=45.0)
    return json.dumps(res, ensure_ascii=False, indent=2)


# ============================================================================
# Tools: Elearning (MyBest LMS) — Read & Write
# ============================================================================

@server.tool(
    name="ubsi_get_courses",
    description="Ambil daftar mata kuliah aktif di LMS MyBest beserta token aksi presensi, tugas, dan materi.",
)
async def ubsi_get_courses(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/elearning/courses", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_assignments",
    description="Ambil daftar tugas aktif (judul, tenggat, instruksi deskripsi, link soal) dan riwayat nilai submission (komentar dosen dan nilai angka).",
)
async def ubsi_get_assignments(
    token: Optional[str] = None, session_token: Optional[str] = None, api_key: Optional[str] = None
) -> str:
    params = {"token": token} if token else None
    res = await _api_get("/v1/elearning/assignments", params=params, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_upload_assignment",
    description="Upload berkas submission tugas mahasiswa (file_base64 + filename) ke portal MyBest LMS.",
)
async def ubsi_upload_assignment(
    token_tugas: str,
    filename: str,
    file_base64: str,
    catatan: Optional[str] = None,
    session_token: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    body = {
        "token_tugas": token_tugas,
        "filename": filename,
        "file_base64": file_base64,
        "catatan": catatan,
    }
    res = await _api_post("/v1/elearning/assignments/upload", json_data=body, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_submit_assignment",
    description="Kirim atau kumpulkan tugas kuliah MyBest dengan memasukkan URL link tugas (misal Google Drive, GitHub repository, atau link dokumen tugas).",
)
async def ubsi_submit_assignment(
    token_send: str,
    link_tugas: str,
    session_token: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    body = {
        "token_send": token_send,
        "link_tugas": link_tugas,
    }
    res = await _api_post("/v1/elearning/assignments/submit", json_data=body, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_course_grades",
    description="Ambil rekap nilai tugas & kuis spesifik satu mata kuliah beserta rincian komentar dosen per pertemuan.",
)
async def ubsi_get_course_grades(
    course_id: str,
    session_token: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    res = await _api_get(f"/v1/elearning/courses/{course_id}/grades", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_presence",
    description="Cek riwayat kehadiran dan status sesi presensi kelas (Sudah Selesai / Absen Masuk / Belum Mulai).",
)
async def ubsi_get_presence(
    token: Optional[str] = None, session_token: Optional[str] = None, api_key: Optional[str] = None
) -> str:
    params = {"token": token} if token else None
    res = await _api_get("/v1/elearning/presence", params=params, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_submit_presence",
    description="Pencet / kirim presensi kehadiran ('Absen Masuk') pada kelas perkuliahan yang sedang berlangsung.",
)
async def ubsi_submit_presence(
    token: Optional[str] = None, session_token: Optional[str] = None, api_key: Optional[str] = None
) -> str:
    params = {"token": token} if token else None
    res = await _api_post("/v1/elearning/presence", params=params, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_materials",
    description="Ambil tautan unduh modul, slide PDF, dan silabus perkuliahan.",
)
async def ubsi_get_materials(
    token: Optional[str] = None, session_token: Optional[str] = None, api_key: Optional[str] = None
) -> str:
    params = {"token": token} if token else None
    res = await _api_get("/v1/elearning/materials", params=params, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_grades_recap",
    description="Ambil rekapitulasi nilai tugas & kuis seluruh mata kuliah per pertemuan (rata-rata, max, min).",
)
async def ubsi_get_grades_recap(
    token: Optional[str] = None, session_token: Optional[str] = None, api_key: Optional[str] = None
) -> str:
    params = {"token": token} if token else None
    res = await _api_get("/v1/elearning/grades", params=params, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_quiz",
    description="Ambil jadwal dan daftar kuis/ujian online aktif di portal MyBest.",
)
async def ubsi_get_quiz(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/elearning/quiz", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_quiz_questions",
    description="Ambil daftar soal kuis, hitung mundur waktu ujian, dan opsi pilihan ganda A, B, C, D.",
)
async def ubsi_get_quiz_questions(
    token: Optional[str] = None,
    quiz_url: Optional[str] = None,
    session_token: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    params = {}
    if token:
        params["token"] = token
    if quiz_url:
        params["quiz_url"] = quiz_url
    res = await _api_get("/v1/elearning/quiz/questions", params=params or None, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_submit_quiz_answer",
    description="Kirim / simpan pilihan jawaban (opsi A/B/C/D) untuk satu nomor soal kuis di portal MyBest.",
)
async def ubsi_submit_quiz_answer(
    id_soal: str,
    data_jawab: str,
    csrf_token: Optional[str] = None,
    session_token: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    body = {"id_soal": id_soal, "data_jawab": data_jawab}
    if csrf_token:
        body["csrf_token"] = csrf_token
    res = await _api_post("/v1/elearning/quiz/answer", json_data=body, session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


# ============================================================================
# Tools: Perpustakaan, Berita, & Publikasi Ilmiah
# ============================================================================

@server.tool(
    name="ubsi_get_news",
    description="Ambil artikel berita kampus resmi dari portal berita UBSI (author, banner, excerpt, tanggal).",
)
async def ubsi_get_news(
    search: Optional[str] = None, page: int = 1, per_page: int = 10, api_key: Optional[str] = None
) -> str:
    params: dict[str, Any] = {"page": page, "per_page": per_page}
    if search:
        params["search"] = search
    res = await _api_get("/v1/news", params=params, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_search_library",
    description="Cari buku pada katalog OPAC perpustakaan UBSI dan periksa ketersediaan stok fisik rak.",
)
async def ubsi_search_library(
    query: str, category: str = "buku", page: int = 1, api_key: Optional[str] = None
) -> str:
    params = {"q": query, "opsi": category, "page": page}
    res = await _api_get("/v1/elibrary/search", params=params, api_key=api_key, timeout=60.0)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_get_repository",
    description="Ambil publikasi karya ilmiah, jurnal, dan skripsi mahasiswa terbaru dari repositori EPrints.",
)
async def ubsi_get_repository(query: Optional[str] = None, api_key: Optional[str] = None) -> str:
    path = "/v1/repository/search" if query else "/v1/repository/recent"
    params = {"q": query} if query else None
    res = await _api_get(path, params=params, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


# ============================================================================
# Tools: Webhook Notifikasi & Pengingat Kuliah
# ============================================================================

@server.tool(
    name="ubsi_list_channels",
    description="Daftar channel webhook notifikasi (Discord / Telegram) yang terpasang untuk akun mahasiswa ini.",
)
async def ubsi_list_channels(session_token: Optional[str] = None, api_key: Optional[str] = None) -> str:
    res = await _api_get("/v1/channels", session_token=session_token, api_key=api_key)
    return json.dumps(res, ensure_ascii=False, indent=2)


@server.tool(
    name="ubsi_trigger_reminder",
    description="Kirim pengingat event langsung (kategori: 'matkul-besok' atau 'quiz-tugas') ke seluruh channel aktif mahasiswa.",
)
async def ubsi_trigger_reminder(
    category: str = "matkul-besok",
    session_token: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    res = await _api_post(
        "/v1/channels/trigger-reminder",
        json_data={"category": category},
        session_token=session_token,
        api_key=api_key,
    )
    return json.dumps(res, ensure_ascii=False, indent=2)


def main():
    """Jalankan server MCP melalui transport stdio, streamable-http, atau sse."""
    import argparse
    parser = argparse.ArgumentParser(description="UBSI API MCP Server")
    parser.add_argument("--transport", choices=["stdio", "streamable-http", "sse"], default="stdio")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8350)
    parser.add_argument("--path", default="/mcp")
    args = parser.parse_args()

    if args.transport == "streamable-http":
        from mcp.server.transport_security import TransportSecuritySettings
        sec = TransportSecuritySettings(
            enable_dns_rebinding_protection=False,
            allowed_hosts=["*"],
            allowed_origins=["*"],
        )
        server.run(
            transport="streamable-http",
            host=args.host,
            port=args.port,
            streamable_http_path=args.path,
            transport_security=sec,
        )
    elif args.transport == "sse":
        server.run(transport="sse", host=args.host, port=args.port)
    else:
        server.run(transport="stdio")


if __name__ == "__main__":
    main()
