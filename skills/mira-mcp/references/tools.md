# Katalog 42 Tools MCP Mira & Konfigurasi Klien

Endpoint resmi: `https://api.muaraai.com/v1/mira/mcp`
Autentikasi: `Authorization: Bearer muara_mira_YOUR_KEY`

---

## Konfigurasi Klien Agent

### Claude Code CLI
```bash
claude mcp add --transport http mira-academic \
  https://api.muaraai.com/v1/mira/mcp \
  --header "Authorization: Bearer muara_mira_YOUR_KEY"
```

### Cursor IDE (`.cursor/mcp.json`)
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

### Codex CLI (`~/.codex/config.toml`)
```toml
[mcp_servers.mira-academic]
url = "https://api.muaraai.com/v1/mira/mcp"
http_headers = { "Authorization" = "Bearer muara_mira_YOUR_KEY" }
```

### Hermes Agent (`~/.hermes/config.yaml`)
```yaml
mcp_servers:
  mira-academic:
    url: https://api.muaraai.com/v1/mira/mcp
    headers:
      Authorization: "Bearer muara_mira_YOUR_KEY"
```

### Claude Desktop (`claude_desktop_config.json`)
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

## Katalog 42 Tool Akademik (`mira_*`)

### Kategori A: SIAKAD (`students.bsi.ac.id`) — 12 Tools
Membutuhkan tautan SIAKAD aktif di dashboard (`/dashboard/sesi`).

| Nama Tool | Parameter | Kegunaan |
|---|---|---|
| `mira_get_profile` | `session_token?`, `api_key?` | Biodata akademik (NIM, nama, prodi, kelas, semester, kampus, dosen PA) |
| `mira_get_schedule` | `session_token?`, `api_key?` | Jadwal kuliah berjalan (hari, jam, ruang, SKS, kode dosen, praktikum) |
| `mira_get_grades` | `session_token?`, `api_key?` | Transkrip nilai murni SIAKAD (Absen 20%, Tugas 25%, UTS 25%, UAS 30%) |
| `mira_get_khs` | `session_token?`, `api_key?` | Kartu Hasil Studi per semester, IPK kumulatif, mutu poin, SKS lulus |
| `mira_get_krs` | `session_token?`, `api_key?` | Kartu Rencana Studi aktif dan kelompok ujian |
| `mira_get_uts` | `session_token?`, `api_key?` | Jadwal ruang UTS online & tautan Google Drive soal offline |
| `mira_get_uas` | `session_token?`, `api_key?` | Jadwal ruang UAS online & tautan Google Drive soal offline |
| `mira_get_academic_calendar` | `session_token?`, `api_key?` | Tautan resmi PDF Kalender Akademik tahun ajaran berjalan |
| `mira_get_prodi_contacts` | `session_token?`, `api_key?` | Direktori 51 kontak email resmi Dekan dan Kaprodi UBSI |
| `mira_get_certificates` | `session_token?`, `api_key?` | Sertifikat pelatihan, kegiatan, Course, dan TOEFL mahasiswa |
| `mira_get_lecturers` | `search?`, `session_token?`, `api_key?` | Cari direktori 1.350+ dosen UBSI berdasarkan inisial kode atau nama |
| `mira_get_dashboard` | `session_token?`, `api_key?` | Agregasi paralel jadwal, nilai, berita, dan pengumuman SIAKAD |

### Kategori B: Elearning MyBest (`elearning.bsi.ac.id`) — 23 Tools
Token `eyJ...` diambil otomatis dari `mira_get_courses`.

| Nama Tool | Parameter | Kegunaan |
|---|---|---|
| `mira_get_courses` | `session_token?`, `api_key?` | Kartu matkul aktif beserta `token_absen`, `token_learning`, `token_assignment`, `token_diskusi` |
| `mira_get_assignments` | `token?`, `session_token?`, `api_key?` | Daftar tugas aktif & riwayat submission (`token` = `token_assignment`) |
| `mira_submit_assignment` | `token_send`, `link_tugas`, `session_token?`, `api_key?` | **[WRITE]** Kumpulkan/perbarui link tugas (Google Drive / GitHub) |
| `mira_upload_assignment` | `token_tugas`, `filename`, `file_base64`, `catatan?`, `session_token?`, `api_key?` | **[WRITE]** Unggah file tugas base64 (maks 10MB decoded) |
| `mira_get_presence` | `token?`, `session_token?`, `api_key?` | Rekap kehadiran & riwayat BAP perkuliahan |
| `mira_submit_presence` | `token?`, `session_token?`, `api_key?` | **[WRITE]** Kirim presensi masuk saat sesi absen dibuka dosen |
| `mira_get_materials` | `token?`, `session_token?`, `api_key?` | Unduh paket arsip ZIP Silabus, RPS, RTM, Slide, dan Modul |
| `mira_get_learning_media` | `token?`, `session_token?`, `api_key?` | Video pembelajaran & dokumen slide dari `/learning` MyBest |
| `mira_submit_teaching_feedback` | `token`, `komentar`, `nilai?`, `absen_path?`, `session_token?`, `api_key?` | **[WRITE]** Kirim komentar pengajaran dosen pada sesi absen |
| `mira_get_quiz` | `session_token?`, `api_key?` | Jadwal kuis latihan dan ujian online MyBest |
| `mira_get_quiz_questions` | `token?`, `quiz_url?`, `session_token?`, `api_key?` | Pratinjau soal pilihan ganda kuis & sisa waktu hitung mundur |
| `mira_get_exams` | `session_token?`, `api_key?` | Jenis ujian Ujian Online BSI (latihan, UTS, UAS, pengganti, HER) |
| `mira_get_exam_schedule` | `exam_type`, `session_token?`, `api_key?` | Jadwal ujian (matkul, ruang, tanggal, durasi, jumlah soal, status) |
| `mira_submit_quiz_answer` | `id_soal`, `data_jawab`, `csrf_token?`, `session_token?`, `api_key?` | **[WRITE]** Kirim jawaban satu butir soal kuis |
| `mira_get_grades_recap` | `token?`, `session_token?`, `api_key?` | Rekap nilai tugas & kuis per pertemuan beserta catatan dosen |
| `mira_get_course_grades` | `course_id`, `session_token?`, `api_key?` | Rincian nilai tugas satu mata kuliah |
| `mira_get_discussions` | `token`, `session_token?`, `api_key?` | Daftar topik forum diskusi per matkul (`token` = `token_diskusi`) |
| `mira_get_discussion_comments` | `token`, `session_token?`, `api_key?` | Utas komentar mahasiswa & dosen (`token` = `token_komentar`) |
| `mira_submit_discussion_comment` | `token_komentar`, `id_chat`, `komentar`, `session_token?`, `api_key?` | **[WRITE]** Balas/jawab diskusi forum atas nama mahasiswa |
| `mira_create_discussion` | `token_course`, `judul`, `chat`, `session_token?`, `api_key?` | **[WRITE]** Buat topik diskusi baru pada mata kuliah |
| `mira_get_elearning_profile` | `session_token?`, `api_key?` | Data profil & alamat email akun MyBest |
| `mira_get_makeup_classes` | `session_token?`, `api_key?` | Jadwal kuliah pengganti terdaftar di MyBest |
| `mira_get_elearning_guides` | `session_token?`, `api_key?` | Tautan PDF buku panduan resmi MyBest, Ujian Online, & Kuis |

### Kategori C: Publikasi, Perpustakaan & Berita — 3 Tools

| Nama Tool | Parameter | Kegunaan |
|---|---|---|
| `mira_search_library` | `query?`, `category?`, `page?` | Cari buku katalog OPAC perpustakaan UBSI (stok fisik & nomor rak) |
| `mira_get_news` | `search?`, `page?`, `per_page?` | Berita resmi kampus `news.bsi.ac.id` via WP JSON REST API |
| `mira_get_repository` | `query?`, `page?` | Riset, skripsi, dan publikasi ilmiah EPrints `repository.bsi.ac.id` |

### Kategori D: Notifikasi & Sistem — 4 Tools

| Nama Tool | Parameter | Kegunaan |
|---|---|---|
| `mira_list_channels` | `session_token?`, `api_key?` | Daftar channel notifikasi webhook aktif (Discord / Telegram) |
| `mira_trigger_reminder` | `category`, `session_token?`, `api_key?` | Picu pengingat manual (`matkul-besok` atau `quiz-tugas`) |
| `mira_whoami` | `session_token?`, `api_key?` | Cek identitas mahasiswa & status Personal API Key |
| `mira_get_api_docs` | `category?`, `session_token?`, `api_key?` | Ambil kamus lengkap endpoint REST API dan MCP tools |
