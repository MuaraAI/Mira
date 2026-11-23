# AGENT.md: AI Coding Agent Guide & Project Manual

Selamat datang di repositori **Mira** (`MuaraAI/Mira`, sebelumnya UBSI API). Dokumen ini adalah panduan resmi operasional, arsitektur, dan konvensi kerja bagi seluruh AI Coding Agent (Hermes, Claude Code, Cursor, Codex, Copilot, dll.) dan pengembang yang berkontribusi pada proyek ini.

---

## 1. Project Overview & Authors

* **Nama Proyek:** Mira (Platform Akademik Modern & REST API Aggregator UBSI)
* **Deskripsi:** Unofficial Academic Operating System untuk 6 layanan kampus Universitas Bina Sarana Informatika (SIAKAD, Elearning MyBest, Ujian Online, Perpustakaan OPAC, Berita Resmi, dan Repository Riset).
* **Repositori Resmi:** [https://github.com/MuaraAI/Mira](https://github.com/MuaraAI/Mira) (Organisasi: `MuaraAI`, Public)
* **Domain Produksi:** [https://mira.muaraai.com](https://mira.muaraai.com) (Redirect: `ubsi-api.muaraai.com`)
* **Lisensi:** MIT License
* **Core Team & Maintainers:**
  - **Yuken Velino** ([@Curzyori](https://github.com/Curzyori)) — Founder | Backend (Informatika, FTI UBSI)
  - **Verzio Yamanansyah** ([@MyKineID](https://github.com/MyKineID)) — Co-Founder | Frontend (Informatika, FTI UBSI)
  - **Muhammad Raffli Aldiansyah** ([@Seeyaa77](https://github.com/Seeyaa77)) — Co-Founder | Hacker (Informatika, FTI UBSI)

---

## 2. Monorepo Architecture & Codebase Map

Proyek ini menggunakan arsitektur monorepo dengan pemisahan tegas antara backend Python dan frontend Next.js:

```text
UBSI-API/
├── app/                       # [BACKEND] Core FastAPI Application (Python 3.12+)
│   ├── config.py              # Pydantic BaseSettings, manajemen environment, TTL cache
│   ├── cache.py               # Redis Two-Tier Cache (Fresh + Last-Known-Good SWR)
│   ├── session_pool.py        # Multi-tenant SessionPool per-NIM (5-min idle eviction)
│   ├── limiter.py             # Sliding-window rate limiter (60 req/menit per client IP)
│   ├── login_guard.py         # Proteksi login: 10x/menit per IP, blacklist bertingkat, log login harian
│   ├── password_change.py     # Ganti password SIAKAD/MyBest + deteksi password default
│   ├── password_reset.py      # Lupa password: link reset dikirim kampus ke email + cek NIM-email (HMAC)
│   ├── deps.py                # Credential dependency injection (Header > .env fallback)
│   ├── envelope.py            # Standard clean JSON envelope format
│   ├── router_helper.py       # Helper cached_endpoint (caching, single-flight mutex, SWR)
│   ├── retry.py               # Exponential backoff scraper retry dengan jitter
│   ├── main.py                # Server entrypoint, middleware auth & proxy, health, metrics
│   └── modules/               # Scraper & Parser tiap domain kampus
│       ├── studentv2.py       # SIAKAD (students.bsi.ac.id): Jadwal, Nilai, Berita, Dashboard
│       ├── elearning.py       # MyBest (elearning.bsi.ac.id): Matkul, Tugas, Presensi, Modul, Kuis
│       ├── elibrary.py        # Perpustakaan (elibrary.bsi.ac.id): OPAC search, stok buku
│       ├── news.py            # Portal Berita (news.bsi.ac.id) & Multi-Channel Webhook Broadcaster
│       ├── repository.py      # EPrints Publikasi (repository.bsi.ac.id): Riset & skripsi terbaru
│       └── ejournal.py        # E-Journal (ejournal.bsi.ac.id): 23 jurnal aktif via OAI bypass
│
├── landing-page/              # [FRONTEND] Landing Page & Documentation (Next.js 15)
│   ├── src/app/               # App Router, layout, globals.css, open-graph image, SEO
│   ├── src/components/        # Komponen UI Deep Water (Navbar, Hero, CodeShowcase, dll.)
│   ├── src/data/              # Dataset statis modul kampus, kontributor, dan contoh payload
│   ├── public/fonts/          # Self-hosted woff2 Google Fonts (Space Grotesk, Inter, JetBrains Mono)
│   └── DESIGN.md              # Token desain resmi Fluid Currents Light (canvas terang, tinta riverbed, accent biru arus)
│
├── tests/                     # [TEST SUITE] Pytest 100% Offline (78+ Passing Tests)
│   ├── fixtures/              # Snapshot HTML statis kampus (sv2_*.html, el_*.html)
│   ├── test_studentv2_*.py    # Parser & router tests untuk SIAKAD
│   ├── test_elearning_*.py    # Parser & router tests untuk MyBest
│   ├── test_elibrary_*.py     # Parser & router tests untuk perpustakaan
│   ├── test_public_*.py       # Parser & router tests untuk News, Repo, E-Journal
│   └── test_integration.py    # Pipeline integration test
│
├── docs/                      # Dokumentasi teknis, arsitektur, anti-ban, dan deploy
├── skills/                    # Agent skills & workflows lokal (SKILL.md)
└── .gitignore                 # Exclusion rules (.env, data/, anti-slop/, graphify-out/)
```

---

## 3. Git Workflow & Contribution Rules (WAJIB DIIKUTI AGENT)

Dilarang keras melakukan direct commit dan direct push ke branch `main`! Setiap agen wajib mengikuti salah satu dari dua alur di bawah:

### Alur A: Anggota Tim / Internal Komunitas (Akses Push Langsung)
1. **Buat Feature Branch Baru:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <type>/<deskripsi-singkat>
   # Contoh: feat/ical-calendar, fix/captcha-solver, docs/api-update
   ```
2. **Kembangkan Fitur & Lakukan Pengujian Lokal:**
   Pastikan seluruh test lokal lulus tanpa error.
3. **Commit dengan Format Conventional Commits:**
   ```bash
   git add <file-terkait>
   git commit -m "<type>(<scope>): <pesan jelas dan ringkas>"
   # Contoh: feat(elearning): add endpoint for quiz submission list
   ```
4. **Push Branch ke Remote Repo:**
   ```bash
   git push -u origin <nama-branch>
   ```
5. **Buat Pull Request (PR) ke `main`:**
   Gunakan GitHub CLI (`gh pr create`) atau web GitHub untuk membuka PR, sertakan ringkasan perubahan dan bukti pengujian. Tunggu review/konfirmasi sebelum merge.

### Alur B: Kontributor Eksternal (Open Source)
1. **Fork Repositori:** Fork `MuaraAI/Mira` ke akun personal GitHub kontributor.
2. **Kembangkan di Branch Fork:** Kerjakan perubahan pada branch di repositori fork.
3. **Buka Cross-Repo Pull Request:** Buat PR dari branch fork ke `MuaraAI/Mira:main`.

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
| Akun, personal API key, sesi login dashboard, channel webhook user | **SQLite** (`data/ubsi.db`) | `SQLITE_DB_PATH` |
| Cache hasil scraping, sesi kampus MyBest/SIAKAD, stats publik, rate-limit, dedup notifikasi | **Redis** (db 2) | `REDIS_URL` |
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
* **Sesi kampus jauh lebih pendek dan dikelola terpisah**: cookie MyBest ~45 menit (sliding), SIAKAD ~2 jam. Kalau cookie kampus mati, backend login ulang otomatis memakai password tersimpan; CAPTCHA diselesaikan `app/captcha_autosolver.py` (ddddocr, ~20 ms). User tidak perlu melakukan apa pun.
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
