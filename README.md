<h1 align="center">UBSI API</h1>

<p align="center">
  <strong>REST API Aggregator &amp; Model Context Protocol (MCP) Server untuk Enam Layanan Digital Universitas Bina Sarana Informatika</strong><br />
  SIAKAD (students.bsi.ac.id) · MyBest LMS · Perpustakaan OPAC · Berita Resmi · Repository EPrints · E-Journal OJS
</p>

<div align="center">

  <a href="https://ubsi-api.muaraai.com"><img src="https://img.shields.io/badge/website-ubsi--api.muaraai.com-0369A1?style=flat-square" alt="Website" /></a>
  <a href="https://github.com/MuaraAI/UBSI-API/blob/main/LICENSE"><img src="https://img.shields.io/github/license/MuaraAI/UBSI-API?style=flat-square&color=374151" alt="License" /></a>
  <img src="https://img.shields.io/badge/python-3.12%2B-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Next.js-15%20App%20Router-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Redis-AES--256--GCM-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/tests-181%20lulus-0F766E?style=flat-square" alt="Tests" />
  <a href="https://github.com/MuaraAI/UBSI-API/releases"><img src="https://img.shields.io/badge/release-v2.0.0%20stable-0369A1?style=flat-square" alt="Release" /></a>

</div>

---

## Kontributor

Proyek ini dirintis, dibangun, dan dirawat secara independen oleh tiga mahasiswa Informatika UBSI Kampus Kota Pontianak. Seluruh dokumentasi di dalam repositori ini kami tulis dan perbarui sendiri secara manual — bukan hasil generator otomatis.

<table>
  <tr>
    <td align="center" width="33%">
      <a href="https://github.com/Curzyori">
        <img src="https://github.com/Curzyori.png" width="90" height="90" alt="Yuken Velino" style="border-radius:50%;" /><br />
        <b>Yuken Velino</b>
      </a>
      <br />
      <a href="https://github.com/Curzyori">@Curzyori</a>
      <br /><br />
      <a href="https://github.com/MuaraAI/UBSI-API/commits?author=Curzyori">
        <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FMuaraAI%2FUBSI-API%2Fcontributors&query=%24%5B0%5D.contributions&label=commits&color=2DD4BF&logo=git" alt="Commits" />
      </a>
      <br /><br />
      <sub><b>Lead Developer &amp; Creator</b><br />
      NIM 15260767 · Informatika (S1)<br />
      15.1C.30 · Semester 1<br />
      FTI · UBSI Kota Pontianak</sub>
    </td>
    <td align="center" width="33%">
      <a href="https://github.com/MyKineID">
        <img src="https://github.com/MyKineID.png" width="90" height="90" alt="Verzio Y." style="border-radius:50%;" /><br />
        <b>Verzio</b>
      </a>
      <br />
      <a href="https://github.com/MyKineID">@MyKineID</a>
      <br /><br />
      <a href="https://github.com/MuaraAI/UBSI-API/commits?author=MyKineID">
        <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FMuaraAI%2FUBSI-API%2Fcontributors&query=%24%5B1%5D.contributions&label=commits&color=2DD4BF&logo=git" alt="Commits" />
      </a>
      <br /><br />
      <sub><b>Core Contributor</b><br />
      NIM 15260225 · Informatika (S1)<br />
      15.1B.30 · Semester 1<br />
      FTI · UBSI Kota Pontianak</sub>
    </td>
    <td align="center" width="33%">
      <a href="https://github.com/Seeyaa77">
        <img src="https://github.com/Seeyaa77.png" width="90" height="90" alt="M Raffli Aldiansyah" style="border-radius:50%;" /><br />
        <b>M Raffli Aldiansyah</b>
      </a>
      <br />
      <a href="https://github.com/Seeyaa77">@Seeyaa77</a>
      <br /><br />
      <a href="https://github.com/MuaraAI/UBSI-API/commits?author=Seeyaa77">
        <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FMuaraAI%2FUBSI-API%2Fcontributors&query=%24%5B2%5D.contributions&label=commits&color=2DD4BF&logo=git" alt="Commits" />
      </a>
      <br /><br />
      <sub><b>Core Contributor</b><br />
      NIM 15260161 · Informatika (S1)<br />
      15.1A.30 · Semester 1<br />
      FTI · UBSI Kota Pontianak</sub>
    </td>
  </tr>
</table>

<p align="center">
  <a href="#disclaimer">Disclaimer</a> ·
  <a href="#latar-belakang">Latar Belakang</a> ·
  <a href="#arsitektur--keamanan">Arsitektur</a> ·
  <a href="#fitur">Fitur</a> ·
  <a href="#endpoint-api">Endpoint API</a> ·
  <a href="#mcp-server-untuk-ai-agent">MCP Server</a> ·
  <a href="#memulai">Memulai</a> ·
  <a href="#dokumentasi--legal">Dokumentasi</a> ·
  <a href="#lisensi">Lisensi</a>
</p>

---

## Disclaimer

> Proyek **UBSI API** adalah perangkat lunak tidak resmi (*unofficial*) yang dikembangkan secara independen oleh mahasiswa **Universitas Bina Sarana Informatika (UBSI)** untuk keperluan riset rekayasa perangkat lunak, otomatisasi personal, dan efisiensi waktu dalam mengakses jadwal, tugas, nilai, serta materi perkuliahan tanpa navigasi manual berulang.
>
> 1. Proyek ini **tidak berafiliasi resmi, tidak disponsori, dan tidak dikelola oleh pihak Universitas Bina Sarana Informatika (UBSI)**.
> 2. Pengembang **tidak bertanggung jawab** atas segala bentuk penyalahgunaan atau konsekuensi yang timbul dari penggunaan perangkat lunak ini. Seluruh risiko penggunaan berada pada pengguna masing-masing.
> 3. Seluruh merek dagang, nama sistem, materi silabus, dan data akademik adalah hak cipta dan hak milik sah dari **Universitas Bina Sarana Informatika** serta pemilik hak ciptanya masing-masing.
>
> **Permohonan Penghapusan / Pengarsipan (Takedown Notice)**: Jika pihak otoritas universitas atau pengelola sistem IT UBSI berkeberatan atas repositori ini, silakan hubungi pengelola langsung via GitHub ([@Curzyori](https://github.com/Curzyori)) atau email `admin@muaraai.com`. Repositori ini akan dengan senang hati **diarsipkan atau dihapus permanen secara kooperatif**.

---

## Latar Belakang

Layanan akademik UBSI tersebar di berbagai subdomain terpisah: `students.bsi.ac.id` (SIAKAD), `elearning.bsi.ac.id` (MyBest), `elibrary.bsi.ac.id` (OPAC), `ejournal.bsi.ac.id` (OJS), `repository.bsi.ac.id` (EPrints), dan `news.bsi.ac.id`. Mahasiswa harus masuk log dan membuka halaman yang berbeda-beda setiap hari sekadar memeriksa jam kuliah, batas waktu tugas, atau riwayat absensi.

UBSI API menyatukan seluruh layanan tersebut ke dalam satu antarmuka REST API dan antarmuka AI Agent (MCP Server) yang cepat, aman, dan berpusat pada kenyamanan mahasiswa.

---

## Arsitektur & Keamanan

| Komponen | Penjelasan Teknis |
|---|---|
| **Enkripsi Sesi AES-256-GCM** | Kredensial login mahasiswa disimpan di Redis dalam bentuk ciphertext terotentikasi **AES-256-GCM** (kunci 256-bit diturunkan via Keyed BLAKE2b KDF). Zero plaintext password di RAM maupun disk. |
| **Personal API Key Engine** | Mahasiswa dapat menerbitkan API Key mandiri berformat `muara_ubsi_<hex>` (terenkripsi di SQLite WAL, di-cache di Redis) untuk bot Discord, Telegram, atau skrip tanpa perlu memasukkan password kampus. |
| **Two-Tier Redis Cache & SWR** | Caching berjenjang (jadwal 2 jam, nilai 30 menit, tugas 10 menit) dengan fallback offline Last-Known-Good (LGG) dan single-flight mutex anti-stampede. |
| **Multi-Tenant SessionPool** | Setiap NIM memiliki pool koneksi HTTP terisolasi dengan auto-eviction idle (15 menit) dan proteksi sticky proxy per-NIM. |
| **Universal MCP Server** | Terhubung ke AI Agent (Hermes, Claude Code, Cursor, Codex) via transport Streamable HTTP (`/v1/ubsi-api/mcp`) dengan 38 tools akademik siap pakai (lihat [docs/mcp.md](docs/mcp.md)). |
| **Pertahanan Anti-SSRF** | Validasi IP Scheme dan resolusi DNS ketat untuk webhook custom dan pengunduhan berkas storage resmi kampus. |
| **Frontend Fluid Currents Light** | Dashboard App Shell Next.js 15: kanvas mist water `#F7FAFC`, teks riverbed `#072033`, aksen `#0369A1` (WCAG AAA), font woff2 lokal, responsif 360px+, dan cache SWR 0ms. |

---

## Fitur

| Modul | Sumber Kampus | Kemampuan Utama |
|---|---|---|
| **StudentV2 (SIAKAD)** | `students.bsi.ac.id` | Biodata profil, jadwal kuliah mingguan, rekap Nilai Murni, KHS semester, Kartu KRS, dan Kartu Ujian (UTS/UAS). |
| **MyBest Elearning** | `elearning.bsi.ac.id` | Daftar matkul, tugas & deadline tracker, riwayat presensi (DataTables AJAX), unduh 5 kategori berkas zip materi (Slide, Modul, Silabus, RPS, RTM), kuis aktif, dan aksi submit presensi terkonfirmasi. |
| **Perpustakaan OPAC** | `elibrary.bsi.ac.id` | Pencarian buku teks, skripsi, TA, e-book, beserta informasi ketersediaan stok fisik dan nomor rak cabang. |
| **Portal Berita** | `news.bsi.ac.id` | Berita kampus resmi real-time melalui integrasi native WordPress REST API JSON. |
| **Multi-Channel Webhook** | Internal Engine | Broadcast otomatis artikel berita kampus dan pengingat kuliah H-1 ke Discord, Telegram, dan custom HTTP. |
| **Repository EPrints** | `repository.bsi.ac.id` | Publikasi ilmiah terbaru mahasiswa & dosen serta pencarian riset kampus. |
| **E-Journal OJS** | `ejournal.bsi.ac.id` | Direktori lengkap 23 jurnal ilmiah resmi UBSI melalui jalur bypass OAI. |
| **Public Stats API** | Internal Engine | Statistik penggunaan anonim (mahasiswa aktif 24h/7d/30d, total request, dan agregat cabang UBSI). |

---

## Endpoint API

Semua endpoint bisnis menggunakan prefix `/v1/`:

### 1. Autentikasi & Sesi
- `POST /v1/auth/login` — Login mandiri NIM + password SIAKAD & MyBest (menghasilkan cookie HttpOnly dan token Redis AES-256-GCM sliding 7 hari).
- `GET /v1/auth/me` — Cek status sesi login aktif mahasiswa (baca langsung dari Redis RAM <1ms).
- `POST /v1/auth/logout` — Mengakhiri sesi perangkat saat ini dan membersihkan cache browser.
- `POST /v1/auth/logout_all` — Mengakhiri seluruh sesi aktif untuk NIM terkait di semua perangkat.
- `POST /v1/auth/verify` — Verifikasi kredensial live kampus (Master Key only).

### 2. Personal API Keys
- `GET /v1/auth/keys` — Daftar Personal API Key milik mahasiswa (maks 5 key).
- `POST /v1/auth/keys` — Terbitkan Personal API Key baru (`muara_ubsi_***`).
- `DELETE /v1/auth/keys/{id}` — Cabut (revoke) API Key.

### 3. StudentV2 (SIAKAD)
- `GET /v1/studentv2/profile` — Profil lengkap mahasiswa (Nama, Kelas, Prodi, Kampus, Dosen PA, Status).
- `GET /v1/studentv2/schedule` — Jadwal kuliah semester berjalan (Hari, Jam, Ruang, Dosen).
- `GET /v1/studentv2/khs` — Kartu Hasil Studi per semester, IPK kumulatif, total SKS lulus.
- `GET /v1/studentv2/grades` — Rincian bobot Nilai Murni (Kehadiran 20%, Tugas 25%, UTS 25%, UAS 30%).
- `GET /v1/studentv2/krs` — Kartu Rencana Studi aktif dan kelompok ujian.
- `GET /v1/studentv2/uts` — Ruang ujian UTS/UAS, tautan ujian online, dan unduh berkas soal.
- `GET /v1/studentv2/dashboard` — Agregasi paralel jadwal, nilai, berita, dan pengumuman.
- `GET /v1/studentv2/news` & `GET /v1/studentv2/announcements` — Arsip berita & pengumuman internal.

### 4. MyBest Elearning
- `GET /v1/elearning/courses` — Daftar mata kuliah aktif dan token pembelajaran.
- `GET /v1/elearning/assignments` — Agregasi tugas aktif & riwayat submission tugas.
- `POST /v1/elearning/assignments/upload` — Unggah submission berkas tugas (PDF/ZIP/DOCX max 10MB).
- `GET /v1/elearning/assignments/download?file_url=` — Unduh berkas soal tugas secara aman (anti-SSRF).
- `GET /v1/elearning/presence?token=` — Rekap riwayat presensi (DataTables AJAX) dan status sesi pertemuan.
- `POST /v1/elearning/presence?token=` — Aksi presensi perkuliahan pada kelas aktif.
- `GET /v1/elearning/materials?token=` — Daftar materi pertemuan dosen dan tautan berkas resmi.
- `GET /v1/elearning/grades` — Rekapitulasi nilai tugas & kuis per pertemuan.
- `GET /v1/elearning/quiz` & `GET /v1/elearning/quiz/questions` — Jadwal & soal kuis aktif.
- `POST /v1/elearning/quiz/answer` — Kirim jawaban kuis (A/B/C/D).

### 5. Perpustakaan & Publikasi Kampus
- `GET /v1/elibrary/search?q=&opsi=buku&page=1` — Pencarian katalog OPAC perpustakaan UBSI.
- `GET /v1/elibrary/book/{book_id}` — Rincian buku, edisi, nomor rak, dan ketersediaan stok fisik cabang.
- `GET /v1/news?search=&page=&per_page=` — Berita resmi UBSI via native WP REST API JSON.
- `GET /v1/news/{post_id}` — Detail artikel berita lengkap.
- `GET /v1/repository/recent` & `GET /v1/repository/search?q=` — Riset & skripsi EPrints UBSI.
- `GET /v1/ejournal/journals` — Direktori 23 jurnal ilmiah resmi UBSI via OAI.

### 6. Webhook Channels & Public Stats
- `GET /v1/channels`, `POST /v1/channels`, `DELETE /v1/channels/{id}`, `POST /v1/channels/{id}/test` — Manajemen webhook notifikasi (Discord/Telegram/Custom).
- `POST /v1/channels/trigger-reminder` — Pengiriman pengingat manual (`matkul-besok` / `quiz-tugas`).
- `GET /v1/stats` — Statistik penggunaan anonim (mahasiswa aktif, total request, dan agregat cabang UBSI).
- `GET /health` — Health check endpoint (publik, tanpa auth).
- `GET /metrics` — Metrik internal sesi aktif dan koneksi Redis (wajib auth).

---

## MCP Server untuk AI Agent

UBSI API menyediakan endpoint **Model Context Protocol (MCP)** siap pakai dengan **38 tools akademik**:
```text
https://api.muaraai.com/v1/ubsi-api/mcp
```
Dokumentasi lengkap, rincian parameter tools, dan rekomendasi prompt agen tersedia di **[Panduan MCP Server (docs/mcp.md)](docs/mcp.md)**.

### Konfigurasi Klien Agent

#### 1. Claude Code
```bash
claude mcp add --transport http ubsi-academic \
  https://api.muaraai.com/v1/ubsi-api/mcp \
  --header "Authorization: Bearer muara_ubsi_YOUR_KEY"
```

#### 2. Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "ubsi-academic": {
      "url": "https://api.muaraai.com/v1/ubsi-api/mcp",
      "headers": {
        "Authorization": "Bearer muara_ubsi_YOUR_KEY"
      }
    }
  }
}
```

#### 3. Hermes Agent (`~/.hermes/config.yaml`)
```yaml
mcp_servers:
  ubsi-academic:
    url: https://api.muaraai.com/v1/ubsi-api/mcp
    headers:
      Authorization: "Bearer muara_ubsi_YOUR_KEY"
```

#### 4. Codex CLI (`~/.codex/config.toml`)
```toml
[mcp_servers.ubsi-academic]
url = "https://api.muaraai.com/v1/ubsi-api/mcp"
http_headers = { "Authorization" = "Bearer muara_ubsi_YOUR_KEY" }
```

---

## Teknologi

- **Backend API** — Python 3.12+, FastAPI, Uvicorn (uvloop).
- **Frontend Dashboard & Web** — Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS (Fluid Currents Light).
- **Security & Enkripsi** — AES-256-GCM (Redis Session), Fernet (SQLite WAL Personal Keys), Keyed BLAKE2b KDF.
- **HTTP Client & Parsing** — Scrapling (FetcherSession), HTTPX (AsyncClient/Client), lxml.
- **Caching & Limiter** — Redis DB 2 (asyncio), single-flight mutex, sliding-window rate limiter.
- **Testing & Quality** — Pytest (181 pengujian 100% offline), Pytest-Asyncio, HTTPX ASGITransport.
- **Deployment & Hosting** — Vercel (`ubsi-api.muaraai.com`), Tencent Cloud VPS + PM2 (`/opt/ubsi-api`) + Caddy HTTPS.

---

## Struktur Proyek

```
UBSI-API/
├── app/                       # [BACKEND] Core FastAPI Application (127.0.0.1:8300)
│   ├── modules/
│   │   ├── studentv2.py       # SIAKAD: Profil, Jadwal, Nilai, KHS, KRS, UTS, Berita
│   │   ├── elearning.py       # MyBest: Matkul, Tugas, Presensi, Modul, Kuis
│   │   ├── elibrary.py        # Perpustakaan: OPAC search, Book detail, stok cabang
│   │   ├── news.py            # Portal Berita: Native WP REST API (/wp-json/wp/v2/posts)
│   │   ├── repository.py      # EPrints: Recent publications & search (/repo/{id}/)
│   │   ├── ejournal.py        # OJS: Direktori 23 jurnal aktif via OAI
│   │   ├── auth.py            # Autentikasi: Login BSI, Sesi, Personal Keys
│   │   ├── channels.py        # Webhook: CRUD Discord, Telegram, Custom HTTP
│   │   └── stats.py           # Public Stats: Agregasi anonim mahasiswa & request
│   ├── cache.py               # Redis 2-tier cache (fresh + LGG) & single-flight mutex
│   ├── config.py              # Pydantic Settings, environment, tiered TTLs
│   ├── deps.py                # Credential dependency injection (Session > Header > .env)
│   ├── envelope.py            # Standard clean JSON envelope format
│   ├── limiter.py             # Sliding-window rate limiter (60 req/menit per client IP)
│   ├── retry.py               # Exponential backoff retry dengan jeda adaptif
│   ├── router_helper.py       # Helper generik cache, lock, & SWR
│   ├── session_pool.py        # Pool sesi per-NIM dengan idle TTL (15 menit)
│   ├── session_store.py       # Enkripsi sesi Redis AES-256-GCM (sliding 7 hari)
│   ├── api_keys_db.py         # Personal API Keys engine (SQLite WAL + Fernet)
│   ├── channels_db.py         # Webhook channels storage (SQLite WAL)
│   ├── mcp_server.py          # Universal MCP Server (Streamable HTTP, 38 tools)
│   ├── stats.py               # Usage counter & privacy-preserving analytics
│   └── main.py                # Server entrypoint, middleware auth & proxy, health, metrics
├── landing-page/              # [FRONTEND] Landing Page & Dashboard (Next.js 15)
│   ├── public/                # Logo resmi, favicon, self-hosted fonts
│   ├── src/
│   │   ├── app/               # App Router: /dashboard/* (8 modul), /login, /privacy, /terms
│   │   ├── components/        # App Shell, Sidebar, MobileNav, UI widgets
│   │   └── lib/               # Client SWR RAM cache (0ms tab transitions), API fetcher
│   └── package.json
├── tests/                     # [TEST SUITE] Pytest 100% Offline (155 Passing Tests)
│   ├── fixtures/              # Snapshot HTML statis kampus
│   └── test_*.py              # Unit & integration tests
├── templates/                 # Template Caddy, Nginx, & Cloudflare Tunnel
├── scripts/
│   ├── deploy.sh              # Deploy otomatis ke /opt/ubsi-api via rsync & PM2
│   └── smoke.py               # CLI verifikasi live
├── docs/                      # Dokumentasi teknis & arsitektur
├── PRIVACY.md                 # Kebijakan privasi & penanganan data mahasiswa
├── SECURITY.md                # Kebijakan etika & pelaporan kerentanan
├── CODE_OF_CONDUCT.md         # Norma komunitas & etika rekayasa
├── DMCA.md                    # Kebijakan hak cipta & takedown notice
├── LICENSE                    # MIT License (c) 2026 Yuken Velino
└── requirements.txt           # Dependensi Python
```

---

## Cara Menggunakan

UBSI API mendukung dua model penggunaan:

### Opsi A: Mode Cloud / Hosted (Rekomendasi untuk Mahasiswa)

Jika Anda adalah mahasiswa UBSI dan hanya ingin mengakses dashboard, jadwal, tugas, bahan ajar, atau menyambungkan akun ke AI Agent:

1. Kunjungi platform resmi di **[ubsi-api.muaraai.com](https://ubsi-api.muaraai.com)**.
2. Masuk melalui menu **Login Mahasiswa** menggunakan NIM dan password SIAKAD &amp; MyBest Anda sendiri.
3. Seluruh sesi disimpan terenkripsi dengan **AES-256-GCM** di Redis server (zero plaintext password).
4. Di dashboard, Anda dapat:
   - Memantau jadwal, tugas kuliah, presensi, bahan ajar, KHS, KRS, dan ujian.
   - Mengatur channel notifikasi mandiri ke Discord atau Telegram.
   - Menerbitkan **Personal API Key** (`muara_ubsi_***`) untuk dihubungkan ke AI Agent (**Claude Code**, **Cursor**, **Hermes**, **Codex**) melalui MCP Server.
5. **Tidak perlu instalasi atau setup server.**

---

### Opsi B: Mode Self-Hosted / Server Mandiri (Untuk Pengembang)

Jika Anda ingin menjalankan server backend dan frontend sendiri di localhost atau VPS:

> **Prinsip Keamanan Zero Credentials di Server**: Server UBSI API beroperasi secara murni multi-tenant. **DILARANG dan TIDAK PERLU** menyimpan NIM atau password kampus mahasiswa di file `.env` server! Seluruh kredensial mahasiswa dimasukkan secara dinamis melalui antarmuka Web UI `/login` atau disuplai melalui Personal API Key.

#### 1. Kloning dan Instalasi

```bash
git clone https://github.com/MuaraAI/UBSI-API.git
cd UBSI-API

# Menyiapkan virtual environment Python 3.12 via uv
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install -r requirements.txt
```

#### 2. Konfigurasi Environment Backend (`.env`)

Salin template konfigurasi resmi:
```bash
cp .env.example .env
```

File `.env` hanya berisi konfigurasi infrastruktur host (sesuai `.env.example`):
```ini
# SERVER CONFIG
HOST=127.0.0.1
PORT=8300
REDIS_URL=redis://127.0.0.1:6379/2

# SECURITY & REMOTE ACCESS
API_KEY=ubsi_sec_ganti_dengan_kunci_acak_panjang
ALLOWED_ORIGINS=https://ubsi-api.muaraai.com,http://localhost:3000
TRUSTED_PROXIES=127.0.0.1
ROOT_PATH=

# SESSION LOGIN BSI (Dashboard)
SESSION_COOKIE_DOMAIN=
SQLITE_DB_PATH=data/ubsi.db

# SCRAPER PROXY CONFIGURATION (OPSIONAL)
SCRAPER_PROXY=
SCRAPER_PROXY_POOL=
```

#### 3. Menjalankan Backend FastAPI (Port 8300)

```bash
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8300 --reload
```
Swagger UI interaktif tersedia di: `http://127.0.0.1:8300/docs`.

#### 4. Menjalankan Frontend Next.js 15 (Port 3000)

```bash
cd landing-page
npm install
npm run dev
```

Buka antarmuka di peramban: `http://localhost:3000`. Login menggunakan akun BSI Anda langsung di Web UI.

---

## Pengujian

Seluruh pengujian unit dan integrasi bersifat **100% offline** terhadap snapshot HTML kampus tanpa melakukan live request ke server universitas:

```bash
# Menjalankan seluruh test suite pytest (155 tests passing)
.venv/bin/pytest -q

# Menjalankan type-check dan production build frontend Next.js
cd landing-page && npm run build
```

---

## Deployment Produksi

Deployment backend berjalan otomatis ke server VPS Tencent menggunakan direktori terisolasi `/opt/ubsi-api` yang dikelola oleh PM2 (`ubsi-api` dan `ubsi-mcp`):

```bash
./scripts/deploy.sh
```

Frontend di-deploy secara otomatis melalui Vercel di domain resmi [ubsi-api.muaraai.com](https://ubsi-api.muaraai.com).

---

## Dokumentasi & Legal

- [API Reference](docs/api.md) — Kamus lengkap seluruh endpoint REST API beserta format request dan response JSON.
- [Model Context Protocol (MCP) Server](docs/mcp.md) — Panduan lengkap 38 tools MCP akademik, skema parameter, dan integrasi AI Agent.
- [System Architecture](docs/architecture.md) — Siklus request, two-tier cache, dan single-flight mutex.
- [Access & Account Safety](docs/anti-ban.md) — Kebijakan penggunaan bertanggung jawab: manajemen sesi, jeda adaptif, dan batas laju request.
- [Production Deployment](docs/deploy.md) — Panduan operasi dan pemeliharaan server VPS via PM2.
- [Remote Access & Domain](docs/remote-access.md) — Setup Caddy, Nginx, Cloudflare Tunnel, dan otentikasi `X-API-Key`.
- [Kebijakan Privasi](PRIVACY.md) — Detail penanganan data, enkripsi AES-256-GCM, dan hak kontrol pengguna.
- [Syarat & Ketentuan](https://ubsi-api.muaraai.com/terms) — Ketentuan layanan dan larangan otomasi terlarang.
- [Kode Etik (Code of Conduct)](CODE_OF_CONDUCT.md) — Norma komunitas & etika rekayasa perangkat lunak.
- [Kebijakan Keamanan](SECURITY.md) — Laporan kerentanan dan standar pelaporan rahasia.
- [DMCA & Hak Cipta](DMCA.md) — Kebijakan hak cipta & prosedur takedown notice.
- [Panduan Kontribusi](CONTRIBUTING.md) — Pedoman kontribusi dan struktur PR.

---

## Lisensi

Didistribusikan di bawah lisensi **MIT License**. Lihat [LICENSE](LICENSE) untuk informasi lebih lanjut.

<p align="center">
  <sub>Dikembangkan oleh <b>Yuken Velino</b> (<a href="https://github.com/Curzyori">@Curzyori</a>), <b>Verzio</b> (<a href="https://github.com/MyKineID">@MyKineID</a>), dan <b>Muhammad Raffli Aldiansyah</b> (<a href="https://github.com/Seeyaa77">@Seeyaa77</a>)<br />
  Fakultas Teknik &amp; Informatika · Universitas Bina Sarana Informatika Kampus Kota Pontianak</sub>
</p>
