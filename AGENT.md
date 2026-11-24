# AGENT.md: AI Coding Agent Guide & Project Manual

Selamat datang di repositori **Mira** (`MuaraAI/Mira`, sebelumnya UBSI API). Dokumen ini adalah panduan resmi operasional, arsitektur, dan konvensi kerja bagi seluruh AI Coding Agent (Hermes, Claude Code, Cursor, Codex, Copilot, dll.) dan pengembang yang berkontribusi pada proyek ini.

---

## 1. Project Overview & Authors

* **Nama Proyek:** Mira (Platform Akademik Modern & REST API Aggregator UBSI)
* **Deskripsi:** Unofficial Academic Operating System untuk 6 layanan kampus Universitas Bina Sarana Informatika (SIAKAD, Elearning MyBest, Ujian Online, Perpustakaan OPAC, Berita Resmi, dan Repository Riset).
* **Repositori Resmi:** [https://github.com/MuaraAI/Mira](https://github.com/MuaraAI/Mira) (Organisasi: `MuaraAI`, Public)
* **Domain Produksi:** [https://mira.muaraai.com](https://mira.muaraai.com) (Redirect: `ubsi-api.muaraai.com`)
* **Lisensi:** MIT License
* **Organisasi & Maintainer:** [Muara AI](https://github.com/MuaraAI) (Informatika, FTI UBSI Kampus Pontianak) · `admin@muaraai.com`

---

## 2. Monorepo Architecture & Codebase Map

Proyek ini menggunakan arsitektur monorepo dengan pemisahan tegas antara backend Python dan frontend Next.js:

```text
UBSI-API/ (Repo: MuaraAI/Mira)
├── app/                       # [BACKEND] Core FastAPI & MCP Application (Python 3.12+)
│   ├── config.py              # Pydantic BaseSettings, manajemen environment, TTL cache, saklar SIAKAD/Maintenance
│   ├── cache.py               # Redis Two-Tier Cache (Fresh + Last-Known-Good SWR)
│   ├── session_store.py       # Sesi dashboard Redis (AES-256-GCM, 7 hari sliding)
│   ├── session_pool.py        # Multi-tenant SessionPool per-NIM (idle TTL 10 menit, LRU maks 150)
│   ├── campus_session_store.py# Persistensi cookie sesi kampus di Redis
│   ├── upstream_session.py    # Cooldown login CAPTCHA/429 & pemulihan sesi kampus reaktif
│   ├── account_links.py       # Store kanonis tautan kredensial per NIM (SQLite, terenkripsi Fernet)
│   ├── account_devices.py     # Izin per perangkat (trusted/pending/revoked, idle revoke 30 hari)
│   ├── device_identity.py     # Cookie perangkat HttpOnly `mira_device` (180 hari)
│   ├── api_keys_db.py         # Personal API Key (`muara_mira_*` & legacy `muara_ubsi_*`), hash BLAKE2b + Fernet
│   ├── channels_db.py         # Webhook channel user di SQLite WAL (config terenkripsi Fernet at-rest)
│   ├── channel_validation.py  # Validasi payload & proteksi anti-SSRF webhook
│   ├── pwa_push_db.py         # Subscription & preferensi kategori PWA Web Push (SQLite)
│   ├── pwa_webpush.py         # Pengiriman RFC 8291 VAPID Web Push & broadcast maintenance
│   ├── captcha_autosolver.py  # Auto-solve CAPTCHA gambar SIAKAD (ddddocr utama, tesseract fallback)
│   ├── captcha_relay.py       # Helper tantangan sesi CAPTCHA per percobaan
│   ├── elearning_captcha.py   # Solver puzzle geser MyBest 2026 (OpenCV template matching + /verify-captcha)
│   ├── limiter.py             # Sliding-window rate limiter (60 req/menit per client IP/identity)
│   ├── login_guard.py         # Proteksi login: 10x/menit per IP, blacklist bertingkat, log login harian
│   ├── maintenance.py         # Saklar maintenance mode (503 MAINTENANCE + whitelist NIM)
│   ├── notifier.py            # Worker notifikasi terjadwal & pengingat event akademik
│   ├── password_change.py     # Ganti password SIAKAD/MyBest + deteksi password default
│   ├── password_reset.py      # Lupa password: link reset dikirim kampus ke email + cek NIM-email (HMAC)
│   ├── deps.py                # Credential dependency injection (Session/API Key/Account Links/Header > .env)
│   ├── envelope.py            # Standard clean JSON envelope format
│   ├── router_helper.py       # Helper cached_endpoint (caching, single-flight mutex, SWR)
│   ├── retry.py               # Exponential backoff scraper retry dengan jitter
│   ├── stats.py               # Analitik penggunaan anonim (HMAC-SHA256 NIM)
│   ├── mcp_server.py          # MCP Server (42 tool `mira_*`, Streamable HTTP port 8350)
│   ├── main.py                # Server entrypoint, middleware auth & CIDR proxy, health, metrics
│   ├── social/                # Engine Mira Komunitas (dual driver SQLite + Supabase Postgres, SSE events, media)
│   └── modules/               # Router & Parser tiap domain
│       ├── auth.py            # Login MyBest-only, sesi, devices, keys, credentials, password, forgot-password
│       ├── capabilities.py    # Status fitur publik (`GET /v1/capabilities`)
│       ├── studentv2.py       # SIAKAD (students.bsi.ac.id): Profil akademik, KHS/KHS-semester, KRS+cetak, UTS/UAS
│       ├── elearning.py       # MyBest (elearning.bsi.ac.id): Matkul, Jadwal, Tugas, Presensi, Modul, Kuis CBT, TOEFL, Ujian
│       ├── elibrary.py        # Perpustakaan (elibrary.bsi.ac.id): OPAC search, stok buku
│       ├── news.py            # Portal Berita (news.bsi.ac.id) & Multi-Channel Webhook Broadcaster
│       ├── repository.py      # EPrints Publikasi (repository.bsi.ac.id): Riset & skripsi terbaru
│       ├── ejournal.py        # E-Journal (ejournal.bsi.ac.id): 23 jurnal aktif via OAI bypass
│       ├── academic_events.py # Kalender kegiatan akademik publik (`staffv2.bsi.ac.id`)
│       ├── lecturers.py       # Jadwal mengajar dosen per kode inisial
│       ├── channels.py        # CRUD & test webhook notifikasi personal
│       ├── pwa_push.py        # Endpoint langganan & preferensi PWA Web Push
│       ├── social.py          # Router HTTP tipis + SSE stream Mira Komunitas (`/v1/social/*`)
│       ├── links.py           # Pemeriksa keamanan tautan tugas/materi
│       └── stats.py           # Endpoint statistik penggunaan publik (`/v1/stats`)
│
├── landing-page/              # [FRONTEND] Landing Page & Student PWA Dashboard (Next.js 15)
│   ├── src/app/               # App Router (landing, /login, /dashboard/*, /recap, SEO, OG)
│   ├── src/components/        # Komponen UI Semi Pixel-Art Light (Navbar, Hero, CBT Room, Social, dll.)
│   ├── src/data/              # Dataset statis modul kampus, kontributor, dan contoh payload
│   ├── public/fonts/          # Self-hosted woff2 Google Fonts (Space Grotesk, Inter, JetBrains Mono, Pixelify Sans)
│   └── DESIGN.md              # Token desain resmi Semi Pixel-Art Light (canvas terang, tinta riverbed, accent biru arus)
│
├── tests/                     # [TEST SUITE] Pytest 100% Offline (677+ Passing Tests)
│   ├── fixtures/              # Snapshot HTML statis kampus anonim (sv2_*.html, el_*.html)
│   └── test_*.py              # Unit, parser, router, auth/device, MCP, social, dan integration tests
│
├── supabase/                  # Cermin resmi SQL migrations Supabase Postgres (`Mira Social`)
├── docs/                      # Dokumentasi teknis, API, arsitektur, MCP, anti-ban, remote access, dan deploy
├── skills/                    # Agent skills lokal (`SKILL.md`)
└── .gitignore                 # Exclusion rules (.env, data/, anti-slop/, graphify-out/)
```

---

## 3. Git Workflow & Contribution Rules (WAJIB DIIKUTI AGENT)

### Syarat Kontributor (Eksklusif)
Kontribusi ke repositori ini **hanya dibuka untuk Anggota Muara AI** yang berstatus **mahasiswa aktif Universitas Bina Sarana Informatika (UBSI)**. Kontribusi eksternal dari luar Muara AI / non-mahasiswa aktif UBSI tidak diterima.

### Alur Wajib Branch Baru & Pull Request
**Dilarang keras melakukan direct commit dan direct push ke branch `main`!** Setiap perubahan (kode, perbaikan bug, maupun dokumentasi) **wajib menggunakan branch baru** melalui alur berikut:

1. **Buat Feature Branch Baru dari `main`:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <type>/<deskripsi-singkat>
   # Contoh: feat/ical-calendar, fix/captcha-solver, docs/api-update
   ```
2. **Kembangkan Fitur & Lakukan Pengujian Lokal:**
   Pastikan seluruh test lokal lulus tanpa error (`.venv/bin/pytest -q`).
3. **Commit dengan Format Conventional Commits:**
   ```bash
   git add <file-terkait>
   git commit -m "<type>(<scope>): <pesan jelas dan ringkas>"
   # Contoh: feat(elearning): add endpoint for quiz submission list
   ```
4. **Push Branch Baru ke Remote Repo:**
   ```bash
   git push -u origin <nama-branch>
   ```
5. **Buat Pull Request (PR) ke `main`:**
   Gunakan GitHub CLI (`gh pr create`) atau web GitHub untuk membuka PR, sertakan ringkasan perubahan dan bukti pengujian. Tunggu review/konfirmasi sebelum merge.

---

## 4. Aturan Ketat untuk AI Agent (Iron Rules)

### 1. Zero Secrets Rule (Keamanan Kredensial)
* **JANGAN PERNAH PUSH KEY/PASSWORD/TOKEN.** Satu kali masuk git history = harus dianggap bocor dan wajib dirotasi. Tidak ada pengecualian untuk "cuma di PR body", "cuma di komentar", "cuma di fixture", atau "cuma contoh".
* Jangan membaca, mencetak ke chat, meng-hardcode, atau men-stage kredensial ke git. Saat perlu memeriksa kelengkapan `.env`, tampilkan **nama variabel + panjang nilai** saja (`grep -o '^KEY='`), tidak pernah nilainya.
* Semua rahasia (`API_KEY`, `STUDENTV2_NIM`, `STUDENTV2_PASS`, `ELEARNING_PASS`, dll.) hanya dari `.env` lokal (terdaftar di `.gitignore`). Nama variabel kredensial mahasiswa di repo ini: `USERNAME_NIM`, `ELEARNING_PW`, `STUDENTS_PW` (file `example/.env`).
* Dilarang hardcoded fallback pada environment variable (`os.getenv("KEY", "default_secret")`). Env yang hilang harus gagal cepat dengan pesan jelas.
* Kalau butuh kredensial untuk uji manual (bukan test suite), baca dari `.env` ke variabel proses, jangan pernah ditulis ke file repo, ke argumen CLI, atau ke log. Hapus file sementara setelah selesai.

### 1b. Wajib Data Dummy untuk Test Suite
* Test **tidak boleh** memakai NIM, password, token, atau email asli. Pakai nilai dummy yang jelas: `12345678`, `99999999`, `password-dummy`, `test@example.com`.
* Fixture HTML di `tests/fixtures/` juga wajib dianonimkan: ganti nama/NIM/email mahasiswa asli sebelum di-commit.
* Kalau butuh verifikasi live (cek perilaku kampus sungguhan), itu **bukan test**; jalankan sebagai skrip ad-hoc di luar `tests/`, dengan kredensial dari env, dan hapus setelah selesai.
* Sebelum commit, jalankan pemeriksaan cepat: `git diff --cached | grep -nE '(nim|password|token|pass)\s*[:=]\s*[\"'"'"'][^\"'"'"']{6,}'` dan pastikan hasilnya hanya dummy.

### 2. Strict Offline TDD (Dilarang Live Hit di Test Suite)
* Seluruh unit dan integration test di `tests/` **HARUS 100% OFFLINE**.
* Dilarang mengirim request HTTP langsung ke server kampus BSI (`*.bsi.ac.id`) di dalam test suite pytest.
* Setiap parser baru atau perbaikan parser wajib menggunakan file snapshot HTML statis di `tests/fixtures/`.
* Redis, SQLite, dan Supabase juga wajib di-mock atau in-memory. Jika sebuah tes butuh Redis, pakai fake client di `tests/`; jangan menyentuh instance nyata.
* Verifikasi perilaku kampus (CAPTCHA, sesi, rate limit) dilakukan manual di luar suite, lalu **hasilnya** dikunci sebagai tes offline dengan respons tiruan.

### 3. Anti-Slop & Frontend Design Standards (Direktori `/landing-page`)
* **Zero Em-Dash:** Dilarang menggunakan karakter em dash (`—`) pada copy/metadata antarmuka; gunakan titik dua (`:`) atau titik (`.`).
* **Zero CDN Fonts:** Semua font wajib self-hosted `.woff2` di `landing-page/public/fonts/`. Dilarang menggunakan `<link>` Google Fonts eksternal.
* **Zero Decorative Emojis:** Dilarang menggunakan emoji sebagai ikon UI atau dekorasi; gunakan ikon SVG atau Material glyphs.
* **Mobile Floor 360px:** Seluruh tampilan antarmuka wajib responsif dan bebas overflow horizontal (`scrollWidth <= clientWidth`) hingga lebar layar minimum 360px.
* **Aksesibilitas (WCAG AAA):** Rasio kontras teks utama minimal 7:1 (saat ini Deep Water mencapai 15.8:1), tombol drawer mobile wajib merespons tombol keyboard `Escape`, dan sertakan skip-link ke `#main-content`.

### 3b. Zero Internal Planning / Scratch Docs di Git
* **DILARANG meng-commit dokumen planning, design spec, catatan insiden/debug sementara, atau draft release hasil kerja AI agent** ke repositori GitHub (contoh: `docs/specs/`, `docs/superpowers/`, `docs/prd/`, `docs/releases/`, `docs/*-plan.md`, `docs/*-design.md`, `docs/login-captcha-recovery.md`, `h.md`, dll.).
* Semua file rencana/desain internal agen wajib tetap lokal (di-ignore lewat `.gitignore`) atau disimpan di direktori artifact lokal agen.
* Folder `docs/` di git **hanya** boleh berisi dokumentasi produk & operasional resmi (`api.md`, `architecture.md`, `anti-ban.md`, `mcp.md`, `deploy.md`, `remote-access.md`).

### 4. Verification Gate Before Claiming Completion
Sebelum menyatakan tugas selesai, agen **WAJIB** menjalankan pengujian nyata:
1. **Backend Tests:**
   ```bash
   .venv/bin/pytest -q
   # Wajib 100% lulus
   ```
2. **Frontend Build Check (jika memodifikasi `/landing-page`):**
   ```bash
   cd landing-page && npm run build
   # Wajib compiled successfully tanpa type error
   ```
3. **Knowledge Graph Sync:**
   ```bash
   graphify update .
   ```

---

## 5. Cheatsheet Perintah Pengembangan

### Menyiapkan Environment Lokal (Python)
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### Menjalankan Backend FastAPI (Localhost Port 8300)
```bash
uvicorn app.main:app --port 8300 --reload
# Dokumentasi Swagger UI: http://127.0.0.1:8300/docs
```

### Menjalankan Frontend Next.js 15
```bash
cd landing-page
npm install
npm run dev
# Buka di browser: http://localhost:3000
```

### Menjalankan Smoke Test Lengkap
```bash
.venv/bin/python scripts/smoke.py --base-url http://127.0.0.1:8300
```

---

## 6. Aturan Workflow Kode & Database Ganda (WAJIB — dipelajari dari insiden produksi)

### 0. Peta Database — siapa nyimpen apa (JANGAN TERTUKAR)
| Data | Penyimpanan | Konfigurasi |
|---|---|---|
| Akun, tautan SIAKAD (`account_links`, Fernet), izin perangkat (`account_devices`), personal API key (`api_keys`, BLAKE2b + Fernet), channel webhook user (`webhook_channels`, Fernet at-rest), langganan PWA Web Push | **SQLite** (`data/ubsi.db`, WAL) | `SQLITE_DB_PATH` |
| Sesi login dashboard (`ubsi_session`, AES-256-GCM, 7 hari sliding), cache hasil scraping, sesi kampus MyBest/SIAKAD, stats publik, rate-limit, dedup notifikasi | **Redis** (db 2) | `REDIS_URL` |
| Social v3: profil komunitas, chat, spaces, mention, reaksi, persahabatan | **Supabase Postgres** — fallback SQLite (tabel `social_*`) saat `SUPABASE_DB_URL` kosong | `SUPABASE_DB_URL` |
| Upload media avatar/banner komunitas | Disk lokal | `data/social_media/` |
| Backup harian | VPS `/home/ubuntu/backups/mira` + Google Drive `cg:MuaraAI/backups/mira` | cron `backup_db.sh` |

* Pemilih driver social ada di `app/social/db.py` → `using_postgres()`. Kode social HARUS lewat `transaction()`/`connect()` dari modul itu — dilarang bikin koneksi psycopg/sqlite sendiri.
* `social_*` di SQLite = fallback/offline (test suite & dev). Produksi = Supabase.

### 1. Pahami dulu, baru ubah (Graphify wajib)
* Jika tersedia, gunakan skill **graphify** untuk memahami arsitektur project sebelum menulis kode.
* Jika `graphify-out/graph.json` sudah ada dan terbaru, **wajib** mulai dari `graphify query "<pertanyaan>"` untuk mencari kode yang berhubungan — jangan langsung grep tebakan.

### 2. Zero hardcoded key, zero fallback key
* Kredensial HANYA dari `.env` (lihat Iron Rule #1). Contoh yang **DILARANG**:
  * `os.getenv("API_KEY", "default-rahasia")` — fallback value = celah keamanan.
  * Menulis URL/token langsung di kode.
* Env yang hilang harus **gagal cepat dengan pesan jelas**, bukan diam-diam pakai default.

### 3. Skema ganda: SQLite + Supabase Postgres (SUMBER INSIDEN 500 BERULANG)
* Fitur social berjalan di dua driver (`app/social/db.py`): SQLite saat `SUPABASE_DB_URL` kosong, Postgres saat terisi.
* **Setiap tabel/kolom baru WAJIB ada di dua jalur:**
  1. SQLite: `CREATE TABLE` (blok `_CREATE`) atau `_ADDED_COLUMNS`;
  2. Postgres: `_PG_EXTRA_TABLES` (tabel baru) atau `_ADDED_COLUMNS` (kolom baru) — `init_social_db()` otomatis menyembuhkan Supabase saat startup.
* Lupa salah satu sisi = `500 UndefinedTable/UndefinedColumn` di produksi (sudah terjadi 2x: `position`, `social_mentions`). **Cek dua jalur ini saat review setiap PR yang menyentuh skema.**
* Perubahan skema Supabase WAJIB disertai file baru di `supabase/migrations/` (lihat `supabase/README.md`) + dijalankan via MCP `apply_migration`.

### 4. Jangan fix gejala — fix akar masalah
* Sebelum mengubah kode, **telusuri penyebab aslinya** (log, query, jalur pemanggil). Perbaikan yang hanya menutup gejala = hutang bug baru.
* Perbaiki di **satu titik yang dilalui semua pemanggil** (contoh: fold cabang di `get_public_stats`, bukan di setiap pemanggil record).

### 5. Dokumentasi ikut kode
* Setiap perubahan perilaku/endpoint/skema WAJIB memperbarui dokumen terkait (`AGENT.md`, `docs/*.md`, `supabase/README.md`) di **PR yang sama**. Docs kuno = bug.

### 6. Branch + PR, selalu
* Semua perubahan lewat feature branch → PR → merge (detail di Seksi 3). **Dilarang direct push `main`**, termasuk perubahan "kecil".

### 7. Arsitektur sesi & kredensial (WAJIB dipahami sebelum menyentuh auth)

Satu login Mira menampung **dua kredensial kampus** dalam satu sesi:

```
ubsi_session (Redis, 7 hari SLIDING)
  ├── nim
  ├── elearning_pass   (wajib, MyBest)
  └── studentv2_pass   (opsional, SIAKAD)
```

* **Sesi Mira 7 hari dan sliding**: setiap resolve sukses me-reset TTL (`app/session_store.py`). User yang membuka Mira sekali seminggu tetap masuk. Jangan menambahkan countdown/expiry kedua di lapisan lain.
* **Sesi kampus jauh lebih pendek dan dikelola terpisah**: cookie MyBest ~45 menit (sliding), SIAKAD ~2 jam. Kalau cookie kampus mati, backend login ulang otomatis memakai password tersimpan; CAPTCHA SIAKAD diselesaikan OCR `app/captcha_autosolver.py` (ddddocr, ~20 ms), sedangkan puzzle geser MyBest 2026 diselesaikan `app/elearning_captcha.py` (template matching OpenCV + `/verify-captcha`). User tidak perlu melakukan apa pun.
* Yang memaksa user login ulang **hanya** perubahan password kampus.
* `SIAKAD_ENABLED=true` di produksi sejak 2026-11-19, tapi **login tetap MyBest-only**. `studentv2_pass` kosong berarti SIAKAD tidak disentuh; password SIAKAD **tidak diwarisi** dari password MyBest (dua sistem kampus punya password sendiri). User menautkan SIAKAD manual di Sesi & Keamanan lewat `POST /v1/auth/credentials`. Lihat `app/modules/auth.py` (blok `raw_sv_pass`).
* `GET /v1/auth/me` mengembalikan `systems` (boolean, untuk gerbang UI), `session` (countdown dari TTL Redis), dan `links` (`linked_password`: `mybest` / `separate` / `null`). **Jangan mengubah bentuk `systems`** tanpa memperbarui `useRequireSession`, `ChangePasswordCard`, `AuthPortal`, dan `lib/security.ts`.
* **Tautan kredensial milik NIM, bukan sesi.** Sejak 2026-11-23 password SIAKAD disimpan kanonis di SQLite `account_links` (terenkripsi Fernet), sehingga pindah device tidak perlu menautkan ulang. Sesi Redis hanya menyimpan `device_id`, bukan salinan SIAKAD yang otoritatif. API key juga membaca SIAKAD dari store ini.
* **Izin per perangkat.** `account_devices` menyimpan device (`trusted`/`pending`/`revoked`) dengan aturan: device pertama untuk sebuah NIM otomatis `trusted`; device berikutnya `pending` sampai diizinkan device tepercaya; izin dicabut setelah 30 hari tanpa aktivitas. Device `pending` bebas memakai MyBest, tetapi semua jalur SIAKAD (baca maupun tulis) dibalas `403 SIAKAD_DEVICE_PENDING`, dan kredensial tersimpan yang ditolak kampus menjadi `409 SIAKAD_RELINK_REQUIRED`.
* **Cookie perangkat** `mira_device` (HttpOnly, 180 hari) adalah satu-satunya bukti device; `device_id` dari payload sesi hanya untuk tampilan. Jalur tulis persisten (API key, langganan PWA, channel webhook) wajib device `trusted` supaya data SIAKAD tidak bisa dibawa keluar lewat jalur itu.
* **`GET /v1/auth/me`** menambah `device: {status}` dan `links.siakad.status`; `GET /v1/auth/devices`, `POST /v1/auth/devices/{id}/approve`, dan `DELETE /v1/auth/devices/{id}` mengelola izin. Mencabut device tepercaya terakhir ditolak `409 LAST_TRUSTED_DEVICE`, dan `logout_all` tidak mencabut izin device.
* CAPTCHA kampus diselesaikan server. Form login **tidak** menampilkan CAPTCHA. Endpoint `POST /v1/auth/captcha` sudah dihapus; jangan dihidupkan lagi.
* Data pribadi SIAKAD **tidak diambil**. `parse_profile` memakai allowlist akademik; tempat/tanggal lahir, alamat, telepon, agama, jenis kelamin, dan kondisi biaya sengaja ditolak di parser. Menambah field ke allowlist = keputusan produk, bukan teknis.

---

*Disusun dengan disiplin tinggi oleh Muara AI. Setiap agen yang bekerja di repo ini diharapkan menjunjung tinggi integritas kode, kebersihan git history, dan etika keamanan data kampus.*
