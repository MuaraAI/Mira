# Katalog Endpoint REST API Mira

Base URL: `https://api.muaraai.com/v1/mira` (semua endpoint memakai prefix `/v1/` kecuali probe `/health` dan `/metrics`).

## Sistem & Publik (Tanpa Auth / Kredensial Kampus)

| Method & Path | Fungsi |
|---|---|
| `GET /health` | Status kesehatan server & koneksi Redis |
| `GET /metrics` | Metrik pool sesi aktif & scraper |
| `GET /v1/capabilities` | Flag fitur server aktif (mis. status `SIAKAD_ENABLED`) |
| `GET /v1/maintenance` | Status maintenance mode |
| `GET /v1/stats` | Statistik penggunaan publik anonim (cabang kampus & prodi) |
| `GET /v1/academic/events` | Kalender kegiatan akademik publik |
| `GET /v1/news` · `GET /v1/news/{post_id}` | Berita resmi `news.bsi.ac.id` · detail artikel |
| `POST /v1/news/webhook/test` | Uji kirim webhook berita |
| `GET /v1/elibrary/search` · `GET /v1/elibrary/book/{book_id}` | Pencarian katalog OPAC perpustakaan & stok/lokasi rak |
| `GET /v1/repository/recent` · `GET /v1/repository/search?q={query}` | Riset & skripsi terbaru di `repository.bsi.ac.id` |
| `GET /v1/ejournal/journals` | Direktori 23 jurnal ilmiah aktif (via OAI bypass) |
| `GET /v1/lecturers/{kode}/schedule` | Jadwal mengajar dosen berdasarkan kode inisial |

## Autentikasi, Kredensial & Personal API Keys

| Method & Path | Fungsi |
|---|---|
| `POST /v1/auth/login` | Login utama **MyBest-only** (menerbitkan cookie `ubsi_session` + bearer token) |
| `POST /v1/auth/verify` | Validasi kredensial kampus langsung (**Master Key only**) |
| `POST /v1/auth/credentials` | Tautkan password SIAKAD ke `account_links` kanonis |
| `GET /v1/auth/me` | Profil sesi aktif, flag `systems` (`siakad`, `mybest`), dan `links` |
| `GET /v1/auth/security` | Status keamanan & password default |
| `POST /v1/auth/password` · `POST /v1/auth/forgot-password` | Ganti password kampus · minta link reset ke email terdaftar |
| `POST /v1/auth/logout` · `POST /v1/auth/logout_all` | Hapus sesi aktif ini · cabut seluruh sesi NIM |
| `GET /v1/auth/keys` · `POST /v1/auth/keys` · `DELETE /v1/auth/keys/{key_id}` | Kelola Personal API Keys (`muara_mira_*`, maks 5 key aktif) |

## SIAKAD (`students.bsi.ac.id`)

Memerlukan akun SIAKAD tertaut (`POST /v1/auth/credentials`).

| Method & Path | Fungsi |
|---|---|
| `GET /v1/studentv2/dashboard` | Agregasi jadwal + nilai + berita + pengumuman SIAKAD |
| `GET /v1/studentv2/profile` | Profil akademik mahasiswa (allowlist ketat, tanpa PII sensitif) |
| `GET /v1/studentv2/schedule` | Jadwal kuliah berjalan |
| `GET /v1/studentv2/grades` | Transkrip nilai murni |
| `GET /v1/studentv2/khs` · `GET /v1/studentv2/khs-semester` | KHS kumulatif · rincian KHS/IPS per semester |
| `GET /v1/studentv2/krs` · `GET /v1/studentv2/krs/print` | Daftar matkul KRS · cetak kartu KRS |
| `GET /v1/studentv2/uts` · `GET /v1/studentv2/uas` | Ruang & berkas jadwal ujian UTS · UAS |
| `GET /v1/studentv2/calendar` | PDF Kalender Akademik resmi |
| `GET /v1/studentv2/prodi-contacts` | Direktori kontak resmi Dekan & Kaprodi |
| `GET /v1/studentv2/certificates` | Daftar sertifikat pelatihan & TOEFL |
| `GET /v1/studentv2/lecturers` | Direktori pencarian dosen |
| `GET /v1/studentv2/news` · `GET /v1/studentv2/announcements` | Berita & pengumuman internal SIAKAD |

## MyBest LMS & Ujian Online (`elearning.bsi.ac.id`, `ujiankampusa.bsi.ac.id`)

| Method & Path | Fungsi |
|---|---|
| `GET /v1/elearning/dashboard` · `/courses` · `/schedule` | Ringkasan MyBest, kartu matkul + token `eyJ...`, jadwal mingguan |
| `GET /v1/elearning/assignments` · `/download` | Daftar tugas aktif & unduh lampiran tugas |
| `POST /v1/elearning/assignments/submit` · `/upload` | **[WRITE]** Kumpulkan link tugas / unggah file tugas |
| `GET /v1/elearning/presence` · `POST /v1/elearning/presence` | Rekap presensi · **[WRITE]** kirim presensi masuk |
| `POST /v1/elearning/presence/feedback` | **[WRITE]** Kirim feedback pengajaran dosen |
| `GET /v1/elearning/materials` · `/learning-media` · `/materials/download` | Bahan ajar, video/slide pembelajaran, unduh ZIP paket materi |
| `GET /v1/elearning/quiz` · `/quiz/questions` · `/quiz/question` | Daftar kuis & pratinjau soal kuis |
| `POST /v1/elearning/quiz/answer` · `/quiz/finish` | **[WRITE]** Kirim jawaban soal · selesaikan kuis |
| `GET /v1/elearning/exams` · `/exams/{exam_type}` · `/exams/schedule` · `/exams/proof/download` | Jadwal & bukti PDF ujian MyBest |
| `GET /v1/ujian/jadwal` · `GET /v1/ujian/types` · `GET /v1/ujian/cetak-pdf` | Jadwal & cetak PDF bukti Ujian Online Kampus A |
| `GET /v1/elearning/grades` · `/courses/{course_id}/grades` | Rekap nilai tugas & kuis |
| `GET /v1/elearning/discussions` · `/discussions/comments` | Topik diskusi & utas komentar |
| `POST /v1/elearning/discussions` · `/discussions/comments` | **[WRITE]** Buat topik diskusi baru · balas komentar |
| `GET /v1/elearning/profile` · `/makeups` · `/toefl` · `/guides` | Profil MyBest, kuliah pengganti, skor TOEFL, PDF panduan |

## Webhook Notifikasi, PWA Push & Mira Komunitas

| Method & Path | Fungsi |
|---|---|
| `GET/POST /v1/channels` · `DELETE /v1/channels/{channel_id}` | CRUD webhook notifikasi personal (Discord / Telegram / Custom, maks 5) |
| `POST /v1/channels/{channel_id}/test` · `POST /v1/channels/trigger-reminder` | Uji kirim webhook · picu pengingat kelas/tugas |
| `/v1/notifications/pwa/vapid-key` · `/subscribe` · `/categories` | Langganan Web Push RFC 8291 VAPID & preferensi kategori |
| `/v1/social/me` · `/inbox` · `/spaces` · `/dms` · `/stream` | Ruang komunitas, DM, profil komunitas, & SSE realtime (khusus Session Token) |
