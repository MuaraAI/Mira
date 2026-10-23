from typing import Any, Optional

API_DOCS_DATA: dict[str, Any] = {
    "info": {
        "title": "Mira API & Universal MCP Server (sebelumnya UBSI-API)",
        "version": "2.0.0",
        "description": "Unified Unofficial REST API Aggregator & Model Context Protocol (MCP) Server for Universitas Bina Sarana Informatika digital services.",
        "base_url": "https://api.muaraai.com/v1/mira",
        "legacy_base_url": "https://api.muaraai.com/v1/ubsi-api",
        "mcp_url": "https://api.muaraai.com/v1/mira/mcp",
        "web_dashboard": "https://mira.muaraai.com",
        "auth_methods": [
            {
                "type": "Personal API Key",
                "header": "Authorization: Bearer muara_ubsi_<your_key> or X-API-Key: muara_ubsi_<your_key>",
                "description": "Multi-tenant API key generated from dashboard (/dashboard/keys) for AI Agents (Claude, Cursor, Codex, Hermes) and custom scripts.",
            },
            {
                "type": "Dashboard Session Token",
                "header": "Authorization: Bearer <session_token> (with X-Requested-With: dashboard)",
                "description": "AES-256-GCM encrypted Redis session token obtained from POST /v1/auth/login.",
            },
        ],
    },
    "endpoints": {
        "auth": [
            {
                "path": "/v1/auth/login",
                "method": "POST",
                "auth": "Public",
                "description": "Login mandiri menggunakan NIM dan password SIAKAD & MyBest. Mengembalikan session token AES-256-GCM (sliding 7 hari).",
                "payload": {"nim": "string", "studentv2_pass": "string", "elearning_pass": "string"},
            },
            {
                "path": "/v1/auth/me",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Cek identitas dan status login aktif mahasiswa.",
            },
            {
                "path": "/v1/auth/keys",
                "method": "GET",
                "auth": "Session Token",
                "description": "Daftar Personal API Key aktif milik mahasiswa.",
            },
            {
                "path": "/v1/auth/keys",
                "method": "POST",
                "auth": "Session Token",
                "description": "Terbitkan Personal API Key baru (format muara_mira_*** atau legacy muara_ubsi_***) untuk AI Agent.",
                "payload": {"name": "string"},
            },
            {
                "path": "/v1/auth/keys/{key_id}",
                "method": "DELETE",
                "auth": "Session Token",
                "description": "Cabut / nonaktifkan Personal API Key.",
            },
            {
                "path": "/v1/auth/logout",
                "method": "POST",
                "auth": "Session Token",
                "description": "Akhiri sesi login perangkat saat ini dan bersihkan token dari Redis.",
            },
            {
                "path": "/v1/auth/logout_all",
                "method": "POST",
                "auth": "Session Token",
                "description": "Akhiri seluruh sesi aktif untuk NIM terkait di semua perangkat.",
            },
        ],
        "studentv2": [
            {
                "path": "/v1/studentv2/profile",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Biodata lengkap mahasiswa, prodi, kelas, semester aktif, dan dosen PA dari SIAKAD.",
            },
            {
                "path": "/v1/studentv2/schedule",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Jadwal kuliah semester aktif: hari, jam, ruang, SKS, dan kode dosen.",
            },
            {
                "path": "/v1/studentv2/grades",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Transkrip Nilai Murni SIAKAD: Absen 20%, Tugas 25%, UTS 25%, UAS 30%, Total, dan Grade.",
            },
            {
                "path": "/v1/studentv2/khs",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Kartu Hasil Studi (KHS): IPK kumulatif, total mutu poin, dan total SKS lulus.",
            },
            {
                "path": "/v1/studentv2/krs",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Kartu Rencana Studi (KRS) aktif dan kelompok ujian semester berjalan.",
            },
            {
                "path": "/v1/studentv2/uts",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Ruang UTS: tautan jadwal ujian online UTS dan unduhan soal ujian offline.",
            },
            {
                "path": "/v1/studentv2/uas",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Ruang UAS: tautan jadwal ujian online UAS dan unduhan soal ujian offline.",
            },
            {
                "path": "/v1/studentv2/calendar",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Tautan berkas resmi PDF Kalender Akademik UBSI tahun ajaran berjalan.",
            },
            {
                "path": "/v1/studentv2/prodi-contacts",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Direktori 51 kontak email resmi Dekan Fakultas dan Ketua Program Studi (Kaprodi) seluruh kampus UBSI.",
            },
            {
                "path": "/v1/studentv2/certificates",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Daftar sertifikat resmi kegiatan, pelatihan, Course, dan TOEFL mahasiswa.",
            },
            {
                "path": "/v1/studentv2/lecturers",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"search": "Pencarian kode atau nama dosen (opsional)"},
                "description": "Direktori 1.350+ dosen BSI beserta kode inisial pengampu.",
            },
            {
                "path": "/v1/studentv2/announcements",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "10 surat edaran resmi Rektorat/Dekanat terbaru dalam format PDF.",
            },
            {
                "path": "/v1/studentv2/news",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"limit": "Batas jumlah berita (default 50, max 200)"},
                "description": "Arsip berita dan warta internal akademik mahasiswa.",
            },
            {
                "path": "/v1/studentv2/dashboard",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Agregasi paralel cepat: jadwal + nilai murni + berita + pengumuman.",
            },
        ],
        "elearning": [
            {
                "path": "/v1/elearning/courses",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Daftar mata kuliah aktif MyBest beserta token terenkripsi (diawali 'eyJ...'): token_absen, token_learning, token_assignment, token_diskusi.",
            },
            {
                "path": "/v1/elearning/assignments",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"token": "Token terenkripsi dari /courses (opsional, tanpa token = semua matkul)"},
                "description": "Daftar tugas aktif dan riwayat submission (nilai & komentar dosen).",
            },
            {
                "path": "/v1/elearning/assignments/submit",
                "method": "POST",
                "auth": "Session / API Key",
                "description": "Kirim / kumpulkan link tugas (Google Drive / GitHub) ke lembar pengerjaan MyBest.",
                "payload": {"token_send": "string (diawali 'eyJ...')", "link_tugas": "string URL"},
            },
            {
                "path": "/v1/elearning/assignments/upload",
                "method": "POST",
                "auth": "Session / API Key",
                "description": "Unggah berkas tugas mandiri dalam format base64 (maks 10MB decoded).",
                "payload": {"token_tugas": "string", "filename": "string", "file_base64": "string", "catatan": "string (opsional)"},
            },
            {
                "path": "/v1/elearning/assignments/download",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"id": "Token id form MyBest", "file": "Nama berkas form MyBest", "file_url": "Direct storage URL (fallback)"},
                "description": "Unduh berkas soal tugas resmi dari MyBest secara aman (anti-SSRF).",
            },
            {
                "path": "/v1/elearning/presence",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"token": "Token presensi mata kuliah (diawali 'eyJ...')"},
                "description": "Rekap kehadiran real-time dan riwayat pertemuan DataTables AJAX (BAP, dosen, rangkuman materi).",
            },
            {
                "path": "/v1/elearning/presence",
                "method": "POST",
                "auth": "Session / API Key",
                "params": {"token": "Token presensi mata kuliah (opsional)"},
                "description": "Pencet presensi perkuliahan ('Absen Masuk') pada kelas aktif.",
            },
            {
                "path": "/v1/elearning/materials",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"token": "Token bahan ajar mata kuliah (diawali 'eyJ...')"},
                "description": "Daftar berkas materi tatap muka dosen dan paket arsip ZIP: Silabus, RPS, RTM, Slide, dan Modul Lab.",
            },
            {
                "path": "/v1/elearning/materials/download",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"id": "ID token form download MyBest", "file": "Nama file materi", "file_url": "Direct storage URL (fallback)"},
                "description": "Unduh berkas materi modul atau slide tatap muka dosen dari MyBest secara aman (anti-SSRF).",
            },
            {
                "path": "/v1/elearning/quiz",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Jadwal kuis latihan dan ujian online MyBest aktif (paket, periode, status).",
            },
            {
                "path": "/v1/elearning/exams",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Daftar jenis ujian semester Ujian Online BSI (latihan, UTS, UAS, pengganti, HER).",
            },
            {
                "path": "/v1/elearning/exams/{exam_type}",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"exam_type": "latihan | uts | uas | uts-pengganti | uas-pengganti | her | her-pengganti | her-khusus"},
                "description": "Jadwal ujian satu jenis dari Ujian Online BSI: mata kuliah, ruang, tanggal, durasi, jumlah soal, dan status berlangsung. URL masuk ujian sengaja tidak diekspos.",
            },
            {
                "path": "/v1/elearning/quiz/questions",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"token": "Token ujian / kuis (diawali 'eyJ...')", "quiz_url": "Path relatif ujian (opsional)"},
                "description": "Pratinjau butir soal kuis pilihan ganda, sisa waktu, dan opsi jawaban (A, B, C, D).",
            },
            {
                "path": "/v1/elearning/quiz/answer",
                "method": "POST",
                "auth": "Session / API Key",
                "description": "Kirim pilihan jawaban satu butir soal kuis ke sistem MyBest.",
                "payload": {"id_soal": "string", "data_jawab": "string (misal: 501_A)", "csrf_token": "string (opsional)"},
            },
            {
                "path": "/v1/elearning/grades",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"token": "Token mata kuliah (opsional, tanpa token = semua matkul)"},
                "description": "Rekapitulasi nilai tugas & kuis per pertemuan dosen beserta catatan feedback dosen.",
            },
            {
                "path": "/v1/elearning/courses/{course_id}/grades",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Rincian nilai tugas satu mata kuliah spesifik (berdasarkan kode atau id).",
            },
            {
                "path": "/v1/elearning/discussions",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"token": "Token diskusi mata kuliah (diawali 'eyJ...')"},
                "description": "Daftar topik forum diskusi kelas (instruksi tugas dosen, tanggal, jumlah balasan).",
            },
            {
                "path": "/v1/elearning/discussions/comments",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"token": "Token komentar thread diskusi (diawali 'eyJ...')"},
                "description": "Baca seluruh thread balasan komentar mahasiswa dan dosen pada topik diskusi.",
            },
            {
                "path": "/v1/elearning/discussions/comments",
                "method": "POST",
                "auth": "Session / API Key",
                "description": "Kirim balasan komentar pada topik forum diskusi MyBest.",
                "payload": {"token_komentar": "string", "id_chat": "string", "komentar": "string"},
            },
            {
                "path": "/v1/elearning/discussions",
                "method": "POST",
                "auth": "Session / API Key",
                "description": "Buat topik forum diskusi baru pada mata kuliah MyBest.",
                "payload": {"token_course": "string", "judul": "string", "chat": "string"},
            },
            {
                "path": "/v1/elearning/profile",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Profil nama dan alamat email akun MyBest mahasiswa.",
            },
            {
                "path": "/v1/elearning/makeups",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Jadwal kuliah pengganti (make-up classes) yang terdaftar di MyBest.",
            },
            {
                "path": "/v1/elearning/guides",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Daftar tautan berkas PDF buku panduan resmi MyBest, Ujian Online, dan Kuis.",
            },
        ],
        "library": [
            {
                "path": "/v1/elibrary/search",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"q": "Kata kunci pencarian", "opsi": "Kategori (buku, ta, skripsi, ebook)", "page": "Nomor halaman"},
                "description": "Pencarian katalog OPAC perpustakaan UBSI.",
            },
            {
                "path": "/v1/elibrary/book/{book_id}",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Detail metadata buku, nomor klasifikasi, penerbit, dan ketersediaan stok fisik rak cabang.",
            },
        ],
        "news": [
            {
                "path": "/v1/news",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"search": "Filter kata kunci", "page": "Halaman", "per_page": "Item per halaman (max 50)"},
                "description": "Berita resmi kampus UBSI via native WordPress REST API JSON.",
            },
            {
                "path": "/v1/news/{post_id}",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Detail isi artikel berita lengkap.",
            },
        ],
        "repository": [
            {
                "path": "/v1/repository/recent",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Publikasi karya ilmiah, tugas akhir, dan skripsi terbaru di EPrints UBSI.",
            },
            {
                "path": "/v1/repository/search",
                "method": "GET",
                "auth": "Session / API Key",
                "params": {"q": "Kata kunci pencarian riset"},
                "description": "Pencarian repositori karya ilmiah institusi.",
            },
        ],
        "ejournal": [
            {
                "path": "/v1/ejournal/journals",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Katalog lengkap 23 jurnal ilmiah resmi UBSI via jalur bypass OAI.",
            },
        ],
        "channels": [
            {
                "path": "/v1/channels",
                "method": "GET",
                "auth": "Session Token",
                "description": "Daftar channel webhook notifikasi milik mahasiswa (maks 5 channel per NIM).",
            },
            {
                "path": "/v1/channels",
                "method": "POST",
                "auth": "Session Token",
                "description": "Pendaftaran channel notifikasi webhook baru (Discord, Telegram, Custom HTTP).",
                "payload": {"type": "discord | telegram | custom", "categories": ["array of category"], "config": "object"},
            },
            {
                "path": "/v1/channels/{channel_id}",
                "method": "DELETE",
                "auth": "Session Token",
                "description": "Hapus channel notifikasi webhook.",
            },
            {
                "path": "/v1/channels/{channel_id}/test",
                "method": "POST",
                "auth": "Session Token",
                "description": "Uji kirim notifikasi dan aktivasi channel webhook.",
            },
            {
                "path": "/v1/channels/trigger-reminder",
                "method": "POST",
                "auth": "Session Token",
                "description": "Trigger pengingat kuliah instan ('matkul-besok', 'quiz-tugas', 'tugas-baru', 'absen-kuliah', 'nilai-keluar', 'jadwal-ujian').",
                "payload": {"category": "matkul-besok | kelas-mulai | quiz-tugas | tugas-baru | pengumuman-siakad | absen-kuliah | nilai-keluar | jadwal-ujian"},
            },
        ],
        "tools": [
            {
                "path": "/v1/tools/link-check",
                "method": "POST",
                "auth": "Session Token / Personal API Key",
                "description": "Urai link tugas (Google Drive, Docs, GitHub) dan cek tanpa login apakah orang lain bisa membukanya. Mengembalikan jenis, ID, link bersih, link pratinjau, dan status akses (public/private/missing/unknown).",
                "payload": {"urls": ["array maks 20 URL"], "refresh": "boolean opsional, abaikan cache"},
            },
        ],
        "stats": [
            {
                "path": "/v1/stats",
                "method": "GET",
                "auth": "Public",
                "description": "Statistik penggunaan anonim (mahasiswa aktif 24h/7d/30d via HMAC, total request, dan agregat kampus cabang).",
            },
        ],
        "system": [
            {
                "path": "/health",
                "method": "GET",
                "auth": "Public",
                "description": "Status kesehatan server dan konektivitas Redis.",
            },
            {
                "path": "/metrics",
                "method": "GET",
                "auth": "Session / API Key",
                "description": "Metrik operasional pool koneksi dan sesi aktif.",
            },
        ],
    },
    "mcp": {
        "server_url": "https://api.muaraai.com/v1/mira/mcp",
        "legacy_server_url": "https://api.muaraai.com/v1/ubsi-api/mcp",
        "transport": "streamable-http",
        "total_tools": 40,
        "tools": [
            # SIAKAD
            {"name": "ubsi_get_profile", "category": "siakad", "description": "Biodata lengkap mahasiswa, kelas, prodi, dan status akademik."},
            {"name": "ubsi_get_schedule", "category": "siakad", "description": "Jadwal kuliah semester berjalan (hari, jam, ruang, dosen)."},
            {"name": "ubsi_get_grades", "category": "siakad", "description": "Rekap Nilai Murni SIAKAD (absen, tugas, UTS, UAS, total)."},
            {"name": "ubsi_get_khs", "category": "siakad", "description": "Kartu Hasil Studi (KHS) dan IPK kumulatif semester."},
            {"name": "ubsi_get_krs", "category": "siakad", "description": "Kartu Rencana Studi (KRS) aktif dan kelompok ujian."},
            {"name": "ubsi_get_uts", "category": "siakad", "description": "Jadwal online dan unduhan soal ruang UTS."},
            {"name": "ubsi_get_uas", "category": "siakad", "description": "Jadwal online dan unduhan soal ruang UAS."},
            {"name": "ubsi_get_academic_calendar", "category": "siakad", "description": "Tautan berkas resmi PDF Kalender Akademik UBSI."},
            {"name": "ubsi_get_prodi_contacts", "category": "siakad", "description": "51 kontak email resmi Dekan dan Kaprodi seluruh kampus UBSI."},
            {"name": "ubsi_get_certificates", "category": "siakad", "description": "Daftar sertifikat Course, TOEFL, dan kegiatan mahasiswa."},
            {"name": "ubsi_get_lecturers", "category": "siakad", "description": "Direktori 1.350+ dosen BSI dan inisial kode dosen."},
            {"name": "ubsi_get_announcements", "category": "siakad", "description": "10 surat edaran resmi Rektorat terbaru (format PDF)."},
            {"name": "ubsi_get_dashboard", "category": "siakad", "description": "Ringkasan paralel cepat: jadwal + nilai + berita + pengumuman."},
            # ELEARNING
            {"name": "ubsi_get_courses", "category": "elearning", "description": "Daftar mata kuliah aktif dan token aksi 'eyJ...'."},
            {"name": "ubsi_get_assignments", "category": "elearning", "description": "Daftar tugas aktif dan riwayat nilai submission."},
            {"name": "ubsi_submit_assignment", "category": "elearning", "description": "Kirim link tugas mahasiswa (Google Drive/GitHub) ke MyBest."},
            {"name": "ubsi_upload_assignment", "category": "elearning", "description": "Upload berkas tugas mahasiswa format base64."},
            {"name": "ubsi_get_presence", "category": "elearning", "description": "Rekap kehadiran dan riwayat presensi DataTables AJAX."},
            {"name": "ubsi_submit_presence", "category": "elearning", "description": "Pencet presensi kehadiran ('Absen Masuk') pada kelas aktif."},
            {"name": "ubsi_get_materials", "category": "elearning", "description": "Unduh berkas arsip ZIP silabus, modul, slide, RPS, RTM."},
            {"name": "ubsi_get_quiz", "category": "elearning", "description": "Jadwal kuis latihan dan ujian online MyBest."},
            {"name": "ubsi_get_quiz_questions", "category": "elearning", "description": "Pratinjau butir soal kuis pilihan ganda dan opsi jawaban."},
            {"name": "ubsi_get_exams", "category": "elearning", "description": "Daftar jenis ujian semester Ujian Online BSI (latihan, UTS, UAS, pengganti, HER)."},
            {"name": "ubsi_get_exam_schedule", "category": "elearning", "description": "Jadwal ujian satu jenis dari Ujian Online BSI: mata kuliah, ruang, tanggal, durasi, jumlah soal, status berlangsung."},
            {"name": "ubsi_submit_quiz_answer", "category": "elearning", "description": "Kirim jawaban butir soal kuis ke MyBest."},
            {"name": "ubsi_get_grades_recap", "category": "elearning", "description": "Rekap nilai tugas & kuis per pertemuan dosen."},
            {"name": "ubsi_get_course_grades", "category": "elearning", "description": "Rincian nilai tugas satu mata kuliah spesifik."},
            {"name": "ubsi_get_discussions", "category": "elearning", "description": "Daftar topik forum diskusi kelas dan instruksi dosen."},
            {"name": "ubsi_get_discussion_comments", "category": "elearning", "description": "Baca thread komentar mahasiswa dan dosen pada topik diskusi."},
            {"name": "ubsi_submit_discussion_comment", "category": "elearning", "description": "Balas atau jawab diskusi forum dosen dari AI Agent."},
            {"name": "ubsi_create_discussion", "category": "elearning", "description": "Buat topik forum diskusi baru pada mata kuliah."},
            {"name": "ubsi_get_elearning_profile", "category": "elearning", "description": "Profil nama dan alamat email akun MyBest mahasiswa."},
            {"name": "ubsi_get_makeup_classes", "category": "elearning", "description": "Jadwal kuliah pengganti (make-up classes) di MyBest."},
            {"name": "ubsi_get_elearning_guides", "category": "elearning", "description": "Tautan berkas PDF buku panduan MyBest, Ujian, dan Kuis."},
            # LIBRARY & PUBLIKASI
            {"name": "ubsi_search_library", "category": "library", "description": "Pencarian katalog OPAC perpustakaan UBSI dan stok rak."},
            {"name": "ubsi_get_news", "category": "news", "description": "Berita resmi kampus UBSI via WordPress REST API."},
            {"name": "ubsi_get_repository", "category": "repository", "description": "Publikasi karya ilmiah dan skripsi EPrints UBSI."},
            {"name": "ubsi_get_ejournal", "category": "ejournal", "description": "Katalog 23 jurnal ilmiah resmi UBSI via OAI."},
            # NOTIFIKASI & SISTEM
            {"name": "ubsi_list_channels", "category": "channels", "description": "Daftar channel webhook notifikasi Discord/Telegram."},
            {"name": "ubsi_trigger_reminder", "category": "channels", "description": "Trigger pengingat jadwal kuliah atau tugas instan."},
            {"name": "ubsi_whoami", "category": "system", "description": "Cek identitas kredensial API Key yang sedang aktif."},
            {"name": "ubsi_get_api_docs", "category": "system", "description": "Kamus dokumentasi lengkap endpoint REST API dan MCP tools UBSI API."},
        ],
    },
}

def get_api_docs(category: Optional[str] = None) -> dict[str, Any]:
    """Mengembalikan data dokumentasi API & MCP yang dapat difilter berdasarkan kategori."""
    if not category or category.lower() in ("all", "semua"):
        return API_DOCS_DATA

    cat = category.lower().strip()
    result: dict[str, Any] = {
        "info": API_DOCS_DATA["info"],
    }

    if cat == "mcp":
        result["mcp"] = API_DOCS_DATA["mcp"]
        return result

    if cat in API_DOCS_DATA["endpoints"]:
        result["endpoints"] = {cat: API_DOCS_DATA["endpoints"][cat]}
        # Also include matching MCP tools
        result["matching_mcp_tools"] = [
            t for t in API_DOCS_DATA["mcp"]["tools"] if t["category"] == cat
        ]
        return result

    # Return full data if category not specifically found
    return API_DOCS_DATA
