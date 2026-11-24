---
name: mira
version: 3.5.0
description: Agent skill for consuming, extending, and operating Mira (Academic Operating System, REST API Aggregator, & MCP Server for UBSI Services).
metadata:
  repository: https://github.com/MuaraAI/Mira
  author: Yuken Velino (@Curzyori)
  program: Informatika
  faculty: Teknik & Informatika
  institution: Universitas Bina Sarana Informatika (UBSI) Kampus Kota Pontianak
  license: MIT
  tags: [mira, ubsi, api, mcp, studentv2, mybest, scraping, redis, fastapi]
---

# Mira Agent Skill

Panduan operasional dan referensi teknis bagi AI Coding Agent dan pengembang yang berinteraksi dengan, mengembangkan, atau mengonsumsi layanan **Mira** (`127.0.0.1:8300` REST API & `127.0.0.1:8350/mcp` MCP Server).

---

## 1. Project & Core Team Overview

- **Repository**: [https://github.com/MuaraAI/Mira](https://github.com/MuaraAI/Mira) (Public)
- **Domain Produksi**: [https://mira.muaraai.com](https://mira.muaraai.com) · API Gateway: `https://api.muaraai.com/v1/mira`
- **Core Team (Muara AI — Informatika, FTI UBSI Pontianak)**:
  - **Yuken Velino** ([@Curzyori](https://github.com/Curzyori)) — Founder, Backend
  - **Verzio Yamanansyah** ([@MyKineID](https://github.com/MyKineID)) — Co-Founder, Frontend
  - **Muhammad Raffli Aldiansyah** ([@Seeyaa77](https://github.com/Seeyaa77)) — Co-Founder, Hacker
- **Syarat Kontribusi**: Hanya dibuka untuk **Anggota Muara AI** yang berstatus **mahasiswa aktif UBSI**, dan **wajib menggunakan branch baru + Pull Request** ke `main` (tanpa direct push). Lihat [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- **Dokumentasi Lengkap**:
  - [`README.md`](../README.md) — Gambaran umum produk, keamanan, dan quickstart.
  - [`AGENT.md`](../AGENT.md) — Panduan operasional AI agent, peta database ganda, dan arsitektur sesi/perangkat.
  - [`CONTRIBUTING.md`](../CONTRIBUTING.md) — Syarat kontributor, wajib branch baru, alur PR, dan aturan pengujian.
  - [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — Norma komunitas & etika rekayasa perangkat lunak Muara AI.
  - [`SECURITY.md`](../SECURITY.md) — Kebijakan keamanan, enkripsi at-rest, dan izin perangkat.
  - [`PRIVACY.md`](../PRIVACY.md) — Kebijakan privasi, allowlist profil akademik, dan retensi data.
  - [`DMCA.md`](../DMCA.md) — Hak cipta kampus, landasan *Fair Use*, dan permohonan takedown resmi.
  - [`docs/api.md`](../docs/api.md) — Kamus lengkap endpoint REST API beserta contoh payload JSON.
  - [`docs/mcp.md`](../docs/mcp.md) — Referensi MCP Server (40 tool `mira_*`) dan integrasi klien agent.
  - [`docs/architecture.md`](../docs/architecture.md) — Diagram siklus request, two-tier cache, mutex, session pool, dan layout repo.
  - [`docs/anti-ban.md`](../docs/anti-ban.md) — Protokol proteksi akun kampus (TLS impersonation, cooldown CAPTCHA/429, auto-solve).
  - [`docs/deploy.md`](../docs/deploy.md) — Panduan operasi dan pemeliharaan server production via PM2 (`ubsi-api` + `ubsi-mcp`).
  - [`docs/remote-access.md`](../docs/remote-access.md) — Panduan setup reverse proxy (Caddy/Nginx), Cloudflare Tunnel, dan `TRUSTED_PROXIES` CIDR.

---

## 2. Kemampuan & Endpoint Utama (`/v1/`)

| Domain | Key Endpoints | Deskripsi & Scope |
|---|---|---|
| **Sistem** | `GET /health`<br>`GET /metrics`<br>`GET /v1/capabilities`<br>`GET /v1/maintenance`<br>`GET /v1/stats` | Status server & Redis, metrik session pool, feature flags (`SIAKAD_ENABLED`), maintenance gate, dan statistik publik anonim |
| **Autentikasi & Perangkat** | `POST /v1/auth/login`<br>`POST /v1/auth/logout` · `/logout_all`<br>`POST /v1/auth/verify`<br>`GET /v1/auth/me`<br>`GET /v1/auth/devices`<br>`POST /v1/auth/devices/{handle}/approve`<br>`DELETE /v1/auth/devices/{handle}`<br>`GET/POST/DELETE /v1/auth/keys`<br>`POST /v1/auth/credentials`<br>`DELETE /v1/auth/credentials/siakad`<br>`POST /v1/auth/password`<br>`POST /v1/auth/forgot-password` | Login **MyBest-only** (puzzle geser MyBest diselesaikan OpenCV di server; SIAKAD OCR ddddocr), sesi Redis AES-256-GCM 7 hari sliding, tautan SIAKAD kanonis per NIM (`account_links`, Fernet), izin per perangkat (`mira_device`, HttpOnly 180 hari), Personal API Keys (`muara_mira_*`), ganti & reset password kampus |
| **Notifikasi & PWA Push** | `GET/POST/DELETE /v1/channels`<br>`POST /v1/channels/{id}/test`<br>`POST /v1/channels/trigger-reminder`<br>`GET /v1/notifications/pwa/vapid-key`<br>`POST /v1/notifications/pwa/subscribe`<br>`GET/POST /v1/notifications/pwa/categories` | Webhook personal (Discord, Telegram, Custom; config terenkripsi Fernet at-rest + masked di UI, anti-SSRF) dan RFC 8291 VAPID Web Push (9 kategori; mutasi wajib perangkat `trusted`) |
| **SIAKAD** (opsional, tautkan manual) | `GET /v1/studentv2/dashboard`<br>`GET /v1/studentv2/profile`<br>`GET /v1/studentv2/schedule`<br>`GET /v1/studentv2/grades`<br>`GET /v1/studentv2/khs`<br>`GET /v1/studentv2/khs-semester?semester={n}`<br>`GET /v1/studentv2/krs` · `/krs/print`<br>`GET /v1/studentv2/uts` · `/uas`<br>`GET /v1/studentv2/announcements`<br>`GET /v1/lecturers/{kode}/schedule` | Dashboard paralel, profil allowlist akademik (tanpa PII), jadwal, nilai murni, KHS kumulatif & per semester (IPS), KRS + cetak kartu, ruang ujian UTS/UAS, direktori dosen & prodi. Wajib perangkat `trusted` (`403 SIAKAD_DEVICE_PENDING` bila `pending`) |
| **MyBest LMS & Ujian** | `GET /v1/elearning/dashboard` · `/courses` · `/schedule`<br>`GET/POST /v1/elearning/assignments` (upload/submit/download)<br>`GET /v1/elearning/grades`<br>`GET/POST /v1/elearning/presence`<br>`GET /v1/elearning/materials` (download)<br>`GET/POST /v1/elearning/quiz` (questions/question/answer/finish)<br>`GET /v1/elearning/discussions` (comments)<br>`GET /v1/elearning/makeups` · `/toefl`<br>`GET /v1/elearning/exams/{type}` · `/proof/download` | Kartu matkul & token, jadwal kuliah & pengganti, tugas, rekap nilai, presensi hadir, materi ZIP/PDF, ruang kuis CBT (`/exercise-show`), diskusi, TOEFL, dan jadwal/bukti PDF Ujian Online |
| **Mira Komunitas** | `/v1/social/me` · `/inbox` · `/spaces` · `/dms`<br>`/v1/social/conversations/{id}/messages`<br>`GET /v1/social/stream` (SSE) | Chat ruang + channel & DM (dual driver: Supabase Postgres di produksi, SQLite fallback di dev/test), realtime SSE Redis pub/sub, khusus Session Token dashboard |
| **Publik & Perpustakaan** | `GET /v1/elibrary/search` · `/book/{id}`<br>`GET /v1/academic/events`<br>`GET /v1/news` · `/{id}`<br>`GET /v1/repository/recent` · `/search`<br>`GET /v1/ejournal/journals` | Katalog OPAC perpustakaan, kalender kegiatan akademik publik, berita resmi WP REST API, EPrints publikasi, dan 23 jurnal ilmiah UBSI |
| **MCP Server** | `POST https://api.muaraai.com/v1/mira/mcp` | 40 tool AI agent dalam satu namespace `mira_*` (Streamable HTTP, port lokal `127.0.0.1:8350/mcp`) |

---

## 3. Standar Format Respons (Clean Minimalist JSON)

Setiap endpoint mengembalikan format envelope standar:

```json
{
  "success": true,
  "data": [...],
  "cached": false
}
```

Format respons kesalahan:
```json
{
  "success": false,
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "Deskripsi kesalahan",
    "module": "elibrary"
  }
}
```

---

## 4. Aturan Penting & Skenario "Jika Ini, Maka Itu" (Rules & Scenarios)

### Skenario 1: Kredensial Kosong di `.env`
- **Aturan**: Modul publik (`/health`, `/v1/capabilities`, `/v1/maintenance`, `/v1/academic/events`, `/v1/news`, `/v1/elibrary`, `/v1/repository`, `/v1/ejournal`) harus tetap berjalan normal 100%.
- **Jika** endpoint privat (`/v1/studentv2/*` atau `/v1/elearning/*`) dipanggil saat kredensial kosong:
  - Kembalikan HTTP 400 dengan error code `CONFIG_MISSING` (jangan sampai server crash atau melempar 500).

### Skenario 2: Server Kampus Sedang Down / Maintenance
- **Aturan**: Jangan biarkan bot atau script consumer mengalami blank/crash.
- **Jika** upstream kampus timeout atau gagal dihubungi:
  - Cek cache **Last-Known-Good (LGG)** di Redis.
  - Jika ada data tersimpan, sajikan data tersebut dengan penanda `"stale": true` dan `"cached": true`.
  - Hanya lemparkan HTTP 502 `UPSTREAM_ERROR` jika data LGG sama sekali belum pernah tersimpan.

### Skenario 3: Sesi Cookie Kampus Kedaluwarsa
- **Aturan**: Jangan mengirim request login berulang kali jika sesi masih valid; login ulang dilakukan reaktif.
- **Jika** response dari kampus mengarah kembali ke URL `/login`:
  - Lakukan re-login otomatis di latar belakang (puzzle geser OpenCV untuk MyBest, OCR ddddocr untuk SIAKAD, maksimal 3 percobaan, hormati cooldown `app/upstream_session.py`).
  - Ulangi request ke URL tujuan secara transparan bagi consumer.

### Skenario 4: Menambah atau Mengubah Scraper/Parser
- **Aturan**: Pengujian wajib menerapkan TDD dan berjalan 100% offline dengan data dummy saja.
- **Jika** membuat parser baru atau memperbarui parser yang rusak:
  - Simpan snapshot HTML anonim ke dalam folder `tests/fixtures/`.
  - Unit test pytest (`.venv/bin/pytest -q`) harus membaca dari fixture tersebut tanpa melakukan live hit ke server kampus.

### Skenario 5: Permohonan Takedown Otoritas Kampus
- **Aturan**: Mengedepankan itikad baik (*good faith*) dan kepatuhan akademik.
- **Jika** pihak berwenang kampus mengajukan keberatan:
  - Ikuti prosedur di [`DMCA.md`](../DMCA.md) untuk menonaktifkan endpoint atau mengarsipkan repositori secara kooperatif.

### Skenario 6: Konfigurasi Middleware Autentikasi & Proxy Whitelist
- **Aturan**: Jangan bypass auth berdasarkan `request.client.host == '127.0.0.1'` karena reverse proxy pada mesin yang sama meneruskan request dari localhost.
- **Jika** menambahkan whitelist probe kesehatan (seperti `/health`):
  - Selalu normalisasi path menggunakan `request.url.path.rstrip("/") == "/health"` agar request dengan trailing slash tidak tertolak 401 sebelum handler redirect Starlette berjalan.
  - Untuk penentuan real IP, jangan percaya `X-Forwarded-For` atau `CF-Connecting-IP` kecuali koneksi socket berasal dari IP/CIDR yang terdaftar di `TRUSTED_PROXIES`.

### Skenario 7: Penggunaan Helper `cached_endpoint` & Pembersihan Sesi
- **Aturan**: Gunakan `inspect.isawaitable()` (bukan `asyncio.iscoroutine()`) saat membungkus fungsi scraper yang dijalankan via `loop.run_in_executor()`, agar instance `Future` ter-await sempurna sebelum diparsing.
- **Jika** menggunakan `SessionPool`:
  - Pasang background worker di `lifespan` yang memanggil `await pool.evict_idle()` secara periodik untuk membuang sesi idle (TTL 10 menit, LRU maks 150) dan mencegah kebocoran memori.

---

## 5. Deployment & Operasional Lingkungan (VPS / Server)

Setiap pengguna atau server memiliki konfigurasi path, user, dan port yang berbeda-beda. **Jangan berasumsi menggunakan path hardcoded.**

- Untuk setup dan konfigurasi production, rujuk selalu ke:
  - [`docs/deploy.md`](../docs/deploy.md) — Panduan konfigurasi PM2 (`ubsi-api` + `ubsi-mcp`), environment variables, dan pemeliharaan server.
  - [`ecosystem.config.cjs`](../ecosystem.config.cjs) — Contoh konfigurasi PM2.
  - [`scripts/deploy.sh`](../scripts/deploy.sh) — Script deployment otomatis yang dapat disesuaikan per variabel `VPS_HOST`, `REMOTE_DIR`, dan `REMOTE_VENV`.
- Untuk pengujian kesehatan live setelah deploy:
  ```bash
  .venv/bin/python scripts/smoke.py --base-url http://127.0.0.1:8300
  ```
