# Model Context Protocol (MCP) Server Reference: Mira v2.5.0 (sebelumnya UBSI API)

Universal Model Context Protocol (MCP) Server untuk ekosistem akademik Universitas Bina Sarana Informatika (UBSI). Memungkinkan AI Coding Agent (**Claude Code**, **Cursor**, **Codex CLI**, **Hermes Agent**, **OpenCode**, dan **Claude Desktop**) berinteraksi secara aman dan terenkripsi dengan 6 layanan kampus UBSI.

---

## 1. Arsitektur & Spesifikasi Server

- **Protokol**: Model Context Protocol (MCP) Specification.
- **Transport**: **Streamable HTTP** (rekomendasi produksi), SSE (*Server-Sent Events*), dan Stdio (local debugging).
- **Endpoint URL Resmi**:
  ```text
  https://api.muaraai.com/v1/mira/mcp
  # Alias kompatibilitas mundur:
  https://api.muaraai.com/v1/ubsi-api/mcp
  ```
- **Port Produksi Lokal (VPS)**: `127.0.0.1:8350/mcp`
- **Total Tools Aktif**: **80 Tools** (40 fungsi akademik dalam 2 namespace: `mira_*` sebagai nama primer dan `ubsi_*` sebagai legacy alias).
- **Keamanan & Isolasi**:
  - Multi-tenant berbasis **Personal API Key** (`muara_mira_<hex>` atau legacy `muara_ubsi_<hex>`) atau **Session Token** (Redis AES-256-GCM).
  - Setiap agent hanya memiliki akses ke akun mahasiswa yang sesuai dengan key-nya.
  - Zero hardcoded passwords; kredensial kampus tidak pernah diekspos ke model AI.

---

## 2. Autentikasi Agent

Setiap permintaan ke endpoint MCP wajib menyertakan token autentikasi melalui header HTTP:

```http
Authorization: Bearer muara_..._KEY
```

> **Cara Mendapatkan Personal API Key**:
> 1. Masuk ke dashboard resmi di [mira.muaraai.com](https://mira.muaraai.com).
> 2. Buka menu **Personal API Keys** (`/dashboard/keys`).
> 3. Klik tombol **Buat API Key Baru** (format `muara_mira_***`). Kunci ini berlaku mandiri tanpa mengekspos kata sandi kampus. Kunci lama (`muara_ubsi_***`) tetap didukung sepenuhnya.

---

## 3. Konfigurasi Klien Agent

### 1. Claude Code CLI
Tambahkan server akademik langsung via terminal:
```bash
claude mcp add --transport http mira-academic \
  https://api.muaraai.com/v1/mira/mcp \
  --header "Authorization: Bearer muara_mira_YOUR_KEY"
```

### 2. Cursor IDE (`.cursor/mcp.json`)
Tambahkan ke konfigurasi proyek atau global Cursor:
```json
{
  "mcpServers": {
    "mira-academic": {
      "url": "https://api.muaraai.com/v1/mira/mcp",
      "headers": {
        "Authorization": "Bearer muara_mira_YOUR_KEY"
      }
    }
  }
}
```

### 3. Hermes Agent (`~/.hermes/config.yaml`)
Tambahkan blok server di konfigurasi Hermes:
```yaml
mcp_servers:
  mira-academic:
    url: https://api.muaraai.com/v1/mira/mcp
    headers:
      Authorization: "Bearer muara_mira_YOUR_KEY"
```

### 4. Codex CLI (`~/.codex/config.toml`)
```toml
[mcp_servers.mira-academic]
url = "https://api.muaraai.com/v1/mira/mcp"
http_headers = { "Authorization" = "Bearer muara_mira_YOUR_KEY" }
```

### 5. Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "mira-academic": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://api.muaraai.com/v1/mira/mcp",
        "--header",
        "Authorization: Bearer muara_mira_YOUR_KEY"
      ]
    }
  }
}
```

---

## 4. Katalog Lengkap 80 Tools Akademik (40 Fungsi Primer & 40 Alias)

Setiap tool akademik didaftarkan dalam dua nama: nama primer `mira_*` (rekomendasi baru) dan alias `ubsi_*` (kompatibilitas mundur). Parameter dan perilaku keduanya identik.

### Kategori A: SIAKAD (students.bsi.ac.id) — 12 Fungsi

| Nama Tool Primer | Alias Legacy | Parameter | Deskripsi & Kegunaan |
|---|---|---|---|
| `mira_get_profile` | `ubsi_get_profile` | `session_token?`, `api_key?` | Biodata lengkap mahasiswa: NIM, nama, prodi, kelas, semester aktif, kampus cabang, dosen PA. |
| `mira_get_schedule` | `ubsi_get_schedule` | `session_token?`, `api_key?` | Jadwal kuliah semester berjalan: hari, jam, ruang, SKS, kode dosen, kelompok praktikum. |
| `mira_get_grades` | `ubsi_get_grades` | `session_token?`, `api_key?` | Transkrip Nilai Murni SIAKAD: Absen 20%, Tugas 25%, UTS 25%, UAS 30%, Total, dan Grade huruf. |
| `mira_get_khs` | `ubsi_get_khs` | `session_token?`, `api_key?` | Kartu Hasil Studi per semester: IPK kumulatif, total mutu poin, total SKS lulus. |
| `mira_get_krs` | `ubsi_get_krs` | `session_token?`, `api_key?` | Kartu Rencana Studi aktif: daftar mata kuliah terdaftar dan kelompok ujian. |
| `mira_get_uts` | `ubsi_get_uts` | `session_token?`, `api_key?` | Jadwal ruang UTS online dan tautan Google Drive soal ujian offline UTS. |
| `mira_get_uas` | `ubsi_get_uas` | `session_token?`, `api_key?` | Jadwal ruang UAS online dan tautan Google Drive soal ujian offline UAS. |
| `mira_get_academic_calendar` | `ubsi_get_academic_calendar` | `session_token?`, `api_key?` | Tautan berkas resmi PDF Kalender Akademik tahun ajaran berjalan. |
| `mira_get_prodi_contacts` | `ubsi_get_prodi_contacts` | `session_token?`, `api_key?` | Direktori 51 kontak email resmi Dekan Fakultas dan Ketua Program Studi (Kaprodi) seluruh kampus UBSI. |
| `mira_get_certificates` | `ubsi_get_certificates` | `session_token?`, `api_key?` | Data sertifikat resmi kegiatan, pelatihan, Course, dan TOEFL mahasiswa. |
| `mira_get_lecturers` | `ubsi_get_lecturers` | `search?`, `session_token?`, `api_key?` | Cari direktori 1.350+ dosen BSI berdasarkan inisial kode dosen atau nama pengampu. |
| `mira_get_dashboard` | `ubsi_get_dashboard` | `session_token?`, `api_key?` | Agregasi paralel 3 modul SIAKAD (Jadwal + Nilai + Berita) dalam satu panggilan cepat. |

---

### Kategori B: Elearning MyBest (elearning.bsi.ac.id) — 21 Fungsi

Seluruh modul mata kuliah di MyBest diidentifikasi menggunakan **token terenkripsi Laravel** yang selalu diawali dengan `eyJ...`. Token ini didapatkan secara otomatis dari tool `mira_get_courses` / `ubsi_get_courses`.

| Nama Tool Primer | Alias Legacy | Parameter | Deskripsi & Kegunaan |
|---|---|---|---|
| `mira_get_courses` | `ubsi_get_courses` | `session_token?`, `api_key?` | Daftar kartu mata kuliah aktif beserta token aksi: `token_absen`, `token_learning`, `token_assignment`, dan `token_diskusi`. |
| `mira_get_assignments` | `ubsi_get_assignments` | `token?`, `session_token?`, `api_key?` | Daftar tugas aktif dan riwayat submission. Parameter `token` (opsional) menggunakan `token_assignment` (`eyJ...`). |
| `mira_submit_assignment` | `ubsi_submit_assignment` | `token_send`, `link_tugas`, `session_token?`, `api_key?` | **[WRITE]** Kumpulkan / perbarui link tugas (Google Drive / GitHub) ke lembar pengerjaan MyBest. `token_send` diawali `eyJ...`. |
| `mira_upload_assignment` | `ubsi_upload_assignment` | `token_tugas`, `filename`, `file_base64`, `catatan?`, `session_token?`, `api_key?` | **[WRITE]** Unggah berkas tugas mandiri dalam format base64 (maks 10MB decoded). |
| `mira_get_presence` | `ubsi_get_presence` | `token?`, `session_token?`, `api_key?` | Rekap kehadiran real-time dan riwayat presensi DataTables AJAX (tanggal, BAP, dosen, rangkuman materi). |
| `mira_submit_presence` | `ubsi_submit_presence` | `token?`, `session_token?`, `api_key?` | **[WRITE]** Kirim presensi kehadiran (*Absen Masuk*) pada sesi kelas yang sedang membuka presensi. |
| `mira_get_materials` | `ubsi_get_materials` | `token?`, `session_token?`, `api_key?` | Unduh berkas materi resmi: paket arsip ZIP Silabus, RPS, RTM, Slide, dan Modul Lab per mata kuliah. |
| `mira_get_quiz` | `ubsi_get_quiz` | `session_token?`, `api_key?` | Jadwal kuis latihan dan ujian online MyBest (paket, periode mulai/selesai, status aksi). |
| `mira_get_quiz_questions` | `ubsi_get_quiz_questions` | `token?`, `quiz_url?`, `session_token?`, `api_key?` | Pratinjau butir soal kuis pilihan ganda, sisa waktu hitung mundur, dan opsi jawaban (A, B, C, D). |
| `mira_get_exams` | `ubsi_get_exams` | `session_token?`, `api_key?` | Daftar jenis ujian semester Ujian Online BSI (latihan, UTS, UAS, pengganti, HER). |
| `mira_get_exam_schedule` | `ubsi_get_exam_schedule` | `exam_type`, `session_token?`, `api_key?` | Jadwal ujian satu jenis dari Ujian Online BSI: mata kuliah, ruang, tanggal, durasi, jumlah soal, status berlangsung. |
| `mira_submit_quiz_answer` | `ubsi_submit_quiz_answer` | `id_soal`, `data_jawab`, `csrf_token?`, `session_token?`, `api_key?` | **[WRITE]** Kirim pilihan jawaban satu butir soal kuis secara aman. |
| `mira_get_grades_recap` | `ubsi_get_grades_recap` | `token?`, `session_token?`, `api_key?` | Rekapitulasi nilai tugas & kuis per pertemuan dosen beserta catatan komentar feedback. |
| `mira_get_course_grades` | `ubsi_get_course_grades` | `course_id`, `session_token?`, `api_key?` | Rincian nilai tugas satu mata kuliah spesifik. |
| `mira_get_discussions` | `ubsi_get_discussions` | `token`, `session_token?`, `api_key?` | Daftar topik forum diskusi per mata kuliah (judul, instruksi tugas dosen, tanggal, jumlah balasan). `token` adalah `token_diskusi` (`eyJ...`). |
| `mira_get_discussion_comments` | `ubsi_get_discussion_comments` | `token`, `session_token?`, `api_key?` | Baca thread seluruh komentar dan tanggapan mahasiswa/dosen. `token` adalah `token_komentar` (`eyJ...`). |
| `mira_submit_discussion_comment` | `ubsi_submit_discussion_comment` | `token_komentar`, `id_chat`, `komentar`, `session_token?`, `api_key?` | **[WRITE]** Balas atau jawab diskusi forum dosen langsung dari AI Agent atas nama mahasiswa. |
| `mira_create_discussion` | `ubsi_create_discussion` | `token_course`, `judul`, `chat`, `session_token?`, `api_key?` | **[WRITE]** Buat topik forum diskusi baru pada mata kuliah. |
| `mira_get_elearning_profile` | `ubsi_get_elearning_profile` | `session_token?`, `api_key?` | Data profil dan kontak email akun MyBest mahasiswa. |
| `mira_get_makeup_classes` | `ubsi_get_makeup_classes` | `session_token?`, `api_key?` | Jadwal kuliah pengganti (make-up classes) yang terdaftar di MyBest. |
| `mira_get_elearning_guides` | `ubsi_get_elearning_guides` | `session_token?`, `api_key?` | Tautan berkas PDF buku panduan resmi MyBest, Ujian Online, dan Kuis Mahasiswa. |

---

### Kategori C: Publikasi, Perpustakaan, & Berita — 3 Fungsi

| Nama Tool Primer | Alias Legacy | Parameter | Deskripsi & Kegunaan |
|---|---|---|---|
| `mira_search_library` | `ubsi_search_library` | `query?`, `category?`, `page?` | Cari buku di katalog OPAC perpustakaan UBSI (cek stok fisik & nomor rak cabang). |
| `mira_get_news` | `ubsi_get_news` | `search?`, `page?`, `per_page?` | Berita resmi kampus real-time via WordPress JSON REST API. |
| `mira_get_repository` | `ubsi_get_repository` | `query?`, `page?` | Riset, skripsi, dan publikasi ilmiah EPrints UBSI terbaru. |

---

### Kategori D: Notifikasi & Sistem — 4 Fungsi

| Nama Tool Primer | Alias Legacy | Parameter | Deskripsi & Kegunaan |
|---|---|---|---|
| `mira_list_channels` | `ubsi_list_channels` | `session_token?`, `api_key?` | Daftar channel notifikasi webhook aktif milik mahasiswa (Discord/Telegram). |
| `mira_trigger_reminder` | `ubsi_trigger_reminder` | `category`, `session_token?`, `api_key?` | Memicu pengiriman pengingat manual (`matkul-besok` atau `quiz-tugas`). |
| `mira_whoami` | `ubsi_whoami` | `session_token?`, `api_key?` | Cek status identitas kredensial API Key yang sedang aktif digunakan. |
| `mira_get_api_docs` | `ubsi_get_api_docs` | `category?`, `session_token?`, `api_key?` | Ambil kamus dokumentasi lengkap endpoint REST API dan MCP tools. |

---

## 5. Rekomendasi System Prompt untuk AI Agent

Salin panduan berikut ke prompt asisten Anda agar agent memahami kapabilitas alat secara optimal:

```text
Server MCP Akademik UBSI: https://api.muaraai.com/v1/mira/mcp
Autentikasi: Authorization: Bearer <PERSONAL_API_KEY_MIRA_ANDA>

Kamu adalah asisten akademik mahasiswa UBSI yang terhubung ke server MCP di atas.
Anda memiliki akses ke 80 tools MCP ("mira_*" primer dan "ubsi_*" legacy alias) untuk membantu perkuliahan harian.

Aturan Kerja & Alur Pemanggilan Tools:
1. Jadwal & Kelas:
   - Cek jadwal kuliah hari ini via `ubsi_get_schedule` atau status sesi via `ubsi_get_presence`.
   - Aksi presensi kehadiran (`ubsi_submit_presence`) hanya dipanggil atas persetujuan eksplisit mahasiswa.
2. Tugas & Elearning:
   - Pantau tugas aktif dan batas tenggat via `ubsi_get_assignments`.
   - Untuk mengumpulkan tugas, gunakan `ubsi_submit_assignment` dengan memasukkan URL Google Drive atau GitHub.
3. Forum Diskusi & Kuis:
   - Ambil daftar matkul via `ubsi_get_courses` untuk mendapatkan token `eyJ...`.
   - Pantau instruksi diskusi dosen via `ubsi_get_discussions(token=token_diskusi)`.
   - Baca dan kirim jawaban diskusi via `ubsi_get_discussion_comments` dan `ubsi_submit_discussion_comment`.
   - Pantau kuis aktif via `ubsi_get_quiz` dan tinjau soal via `ubsi_get_quiz_questions`.
4. Transkrip & Ujian:
   - Pantau KHS semester dan IPK via `ubsi_get_khs`, nilai harian tugas via `ubsi_get_grades_recap`, dan ruang ujian via `ubsi_get_uts` & `ubsi_get_uas`.
```

---

## 6. Penanganan Galat (Error Handling)

Setiap tool mengembalikan format JSON standar:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Akses ditolak: API Key tidak valid atau telah dinonaktifkan.",
    "module": "auth"
  }
}
```

Kode galat umum yang perlu diperhatikan:
- `UNAUTHORIZED`: Header `Authorization: Bearer muara_ubsi_***` tidak disertakan atau salah.
- `SESSION_EXPIRED`: Sesi akun kampus di Redis telah berakhir; login kembali melalui web dashboard untuk memperbarui sesi.
- `INVALID_PATH` / `INVALID_URL`: Format URL atau token mengandung skema terlarang (proteksi anti-SSRF).
- `UPSTREAM_TIMEOUT`: Portal kampus sedang dalam masa pemeliharaan (server akan otomatis melayani data dari *Last-Known-Good cache* dengan status `"stale": true`).
