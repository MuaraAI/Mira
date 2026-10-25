<h1 align="center">
  <br />
  <img src="landing-page/public/maskot/mura-empty.png" alt="Mura Maskot Mira" width="120" /><br />
  Mira
</h1>

<p align="center">
  <strong>Satu Tempat untuk Seluruh Layanan Kampus UBSI</strong><br />
  Platform akademik modern, Progressive Web App (PWA), REST API aggregator, dan FastMCP Server untuk 6 layanan kampus Universitas Bina Sarana Informatika.<br />
  <sub>SIAKAD · MyBest Elearning · Ujian Online · Perpustakaan OPAC · Berita Resmi · Repository Riset</sub>
</p>

<div align="center">

  <a href="https://mira.muaraai.com"><img src="https://img.shields.io/badge/website-mira.muaraai.com-0369A1?style=flat-square" alt="Website" /></a>
  <a href="https://github.com/MuaraAI/Mira/blob/main/LICENSE"><img src="https://img.shields.io/github/license/MuaraAI/Mira?style=flat-square&color=374151" alt="License" /></a>
  <img src="https://img.shields.io/badge/python-3.12%2B-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Next.js-15%20App%20Router-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/PWA-Native%20Web%20Push-BE123C?style=flat-square" alt="PWA" />
  <img src="https://img.shields.io/badge/Redis-AES--256--GCM-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/tests-318%20passed%20(offline)-0F766E?style=flat-square" alt="Tests" />
  <a href="https://api.muaraai.com/v1/mira/mcp"><img src="https://img.shields.io/badge/MCP%20Server-80%20tools-7C3AED?style=flat-square" alt="MCP Server" /></a>
  <a href="https://github.com/MuaraAI/Mira/releases"><img src="https://img.shields.io/badge/release-v2.5.0%20stable-0369A1?style=flat-square" alt="Release" /></a>

</div>

<p align="center">
  <a href="#latar-belakang">Latar Belakang</a> ·
  <a href="#layanan-terintegrasi">6 Layanan Kampus</a> ·
  <a href="#fitur-unggulan">Fitur Unggulan</a> ·
  <a href="#cara-kerja--alur-logika-how-it-works">Cara Kerja &amp; Flowchart</a> ·
  <a href="#arsitektur--keamanan">Arsitektur &amp; Keamanan</a> ·
  <a href="#mcp-server-untuk-ai-agent">MCP Server (80 Tools)</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#tim-pengembang--kontributor">Tim Pengembang</a> ·
  <a href="#disclaimer">Disclaimer</a> ·
  <a href="#lisensi">Lisensi</a>
</p>

---

## Latar Belakang

Layanan perkuliahan Universitas Bina Sarana Informatika (UBSI) terfragmentasi di berbagai portal web subdomain terpisah:
- `students.bsi.ac.id` untuk jadwal dan nilai (SIAKAD)
- `elearning.bsi.ac.id` untuk modul pembelajaran dan tugas (MyBest)
- `ujiankampusa.bsi.ac.id` untuk jadwal ujian semester dan latihan
- `elibrary.bsi.ac.id` untuk penelusuran katalog buku perpustakaan (OPAC)
- `news.bsi.ac.id` untuk berita resmi universitas
- `repository.bsi.ac.id` untuk arsip karya ilmiah dan skripsi

Mahasiswa harus login berulang kali setiap hari, membuka banyak tab terpisah, serta rentan logout otomatis setelah 15 menit.

**Mira** menyatukan seluruh ekosistem tersebut ke dalam satu antarmuka terpadu: dashboard Progressive Web App (PWA) yang cepat dan responsif, REST API terotentikasi, serta Model Context Protocol (MCP) Server yang memungkinkan AI Agent membaca data akademik secara aman.

---

## Layanan Terintegrasi

| Layanan | Domain Kampus | Cakupan &amp; Kemampuan Utama |
|---|---|---|
| **SIAKAD (StudentV2)** | `students.bsi.ac.id` | Biodata profil mahasiswa, jadwal kuliah mingguan, rekap Nilai Murni semester, Kartu Hasil Studi (KHS), Kartu Rencana Studi (KRS), dan kartu ujian. |
| **MyBest LMS** | `elearning.bsi.ac.id` | Daftar mata kuliah aktif, pelacak tenggat tugas, presensi kehadiran mandiri, rekap presensi dosen, unduh paket materi (Slide/Modul/Silabus/RPS/RTM), serta pengerjaan kuis. |
| **Ujian Online** | `ujiankampusa.bsi.ac.id` | Integrasi SSO MyBest untuk membaca jadwal ujian semester (Latihan, UTS, UAS, Her, Pendadaran), kartu peserta, dan status sesi ujian aktif tanpa membuka celah kecurangan. |
| **Perpustakaan OPAC** | `elibrary.bsi.ac.id` | Pencarian katalog buku fisik, tugas akhir, dan skripsi, lengkap dengan informasi ketersediaan eksemplar dan lokasi nomor rak cabang. |
| **Portal Berita** | `news.bsi.ac.id` | Berita kampus resmi real-time melalui integrasi native WordPress REST API JSON. |
| **Repository Riset** | `repository.bsi.ac.id` | Publikasi ilmiah terbaru mahasiswa &amp; dosen serta penelusuran riset berbasis EPrints. |

---

## Fitur Unggulan

### Untuk Mahasiswa
- **PWA Installable:** Dapat dipasang di layar utama Android, iOS, maupun Desktop layaknya aplikasi native tanpa perlu mengunduh file `.apk` manual.
- **Notifikasi Push Mandiri (VAPID RFC 8291):** Pengingat otomatis jadwal kuliah H-1 (slot 19:00 &amp; 21:00 WIB), presensi kelas dibuka, dan tenggat tugas mendekati deadline langsung ke layar HP.
- **Auto-Relogin Anti-Logout:** Sesi kampus yang biasanya habis dalam 15 menit diperbarui secara otomatis di server tanpa membuat mahasiswa harus login ulang berulang kali.
- **Pratinjau &amp; Unduh Materi:** Pratinjau langsung berkas materi kuliah (PDF) dengan viewer terintegrasi dan zoom mobile yang mulus.
- **Kerahasiaan Akun:** Tidak ada kata sandi yang disimpan dalam bentuk teks biasa. Kredensial dienkripsi dengan standar militer AES-256-GCM.

### Untuk Pengembang &amp; Komunitas AI
- **Dual-Prefix Personal API Key:** Menerbitkan kunci otentikasi mandiri (`muara_mira_***` dan `muara_ubsi_***`) untuk bot Discord, bot Telegram, atau skrip otomatisasi pribadi.
- **Twin Gateway API:** Jalur endpoint primer `/v1/mira/*` berdampingan dengan legacy alias `/v1/ubsi-api/*` (zero breaking change bagi integrator lama).
- **Two-Tier Redis Cache &amp; SWR:** Kecepatan akses 0ms untuk perpindahan tab dengan perlindungan Last-Known-Good (LGG) saat server kampus sedang down.
- **100% Offline Testing:** Seluruh 318 pengujian unit dan integrasi berjalan secara hermetis tanpa melakukan live hit ke server universitas.

---

---

## Cara Kerja & Alur Logika (How It Works)

Banyak yang bertanya: **"Kok bisa Mira mengambil jadwal, presensi, tugas, dan nilai dari 6 portal kampus secara serentak tanpa mahasiswa harus login berulang kali?"**

Berikut penjelasan mendalam mengenai alur logika otomasi dan siklus pemrosesan request di balik Mira:

### 1. Flowchart Arsitektur & Siklus Request

```text
[ Browser / PWA / AI Agent ]
         │
         ▼  (1) Request + Cookie 'ubsi_session' ATAU Header 'Authorization: Bearer muara_mira_***'
┌────────────────────────────────────────────────────────────────────────┐
│ Caddy Reverse Proxy Gateway (api.muaraai.com)                         │
│ • SSL Termination & Rate Limiter Sliding (60 req/min per IP/NIM)      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FastAPI Engine (:8300) / FastMCP (:8350)                               │
│ • Autentikasi Dual-Prefix (muara_mira_* & muara_ubsi_*)                │
│ • Validasi Sesi: Ambil Ciphertext Kredensial dari Redis                │
│ • Dekripsi Kredensial on-the-fly (AES-256-GCM / Fernet WAL)            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼  (2) Cek Cache Berjenjang
                        ┌─────────────────────────┐
                        │ Redis Two-Tier Cache    │
                        │ Ada data segar (fresh)? │
                        └────────────┬────────────┘
                                     │
                    ┌────────────────┴────────────────┐
             (ADA)  ▼                                 ▼  (TIDAK ADA / EXPIRED)
    ┌──────────────────────────────┐        ┌───────────────────────────────────┐
    │ Kembalikan Data JSON (0ms)   │        │ Single-Flight Mutex Lock          │
    │ Langsung ke Klien            │        │ Cegah ribuan request serentak     │
    └──────────────────────────────┘        └─────────────────┬─────────────────┘
                                                              │
                                                              ▼  (3) Scraper SessionPool
                                            ┌───────────────────────────────────┐
                                            │ SessionPool per-NIM (Scrapling)   │
                                            │ Pakai Cookie Jar aktif kampus     │
                                            └─────────────────┬─────────────────┘
                                                              │
                                                              ▼  (4) Tembak Upstream
                                            ┌───────────────────────────────────┐
                                            │ Server Kampus (*.bsi.ac.id)       │
                                            │ SIAKAD / MyBest / Ujian / OPAC    │
                                            └─────────────────┬─────────────────┘
                                                              │
                                                              ▼  (5) Evaluasi Sesi Kampus
                                            ┌───────────────────────────────────┐
                                            │ Apakah Sesi Kampus Valid?         │
                                            └────────────┬──────────────────────┘
                                                         │
                                        ┌────────────────┴────────────────┐
                                 (YA)   ▼                                 ▼  (EXPIRED / 302 REDIRECT)
                    ┌──────────────────────────────┐            ┌───────────────────────────────┐
                    │ Parser HTML Cepat (lxml)     │            │ Auto-Relogin Otomatis         │
                    │ Transformasi ke skema JSON   │            │ Submit password AES-256-GCM   │
                    └──────────────┬───────────────┘            │ Dapatkan Cookie Jar baru      │
                                   │                            └───────────────┬───────────────┘
                                   ▼                                            │
                    ┌──────────────────────────────┐                            │
                    │ Simpan ke Redis (Tier Fresh) │◄───────────────────────────┘
                    │ Simpan ke LGG (Cadangan)     │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    [ Response JSON Standard Envelope ke Mahasiswa ]
```

---

### 2. Lima Pilar Logika di Balik Kecepatan & Keamanan Mira

#### A. Sesi Persisten & Auto-Relogin (Solusi Masalah Logout 15 Menit)
* **Masalah Asli Kampus:** Server SIAKAD dan MyBest memiliki batas waktu idle yang sangat singkat (~15 menit). Jika tidak aktif, session cookie PHP/Laravel akan hangus dan mahasiswa dipaksa login ulang.
* **Solusi Mira:** Saat login pertama kali di dashboard, password dienkripsi secara simetris dengan **AES-256-GCM** (kunci 256-bit berbasis BLAKE2b KDF) dan disimpan di Redis dengan masa aktif sliding 7 hari.
* **Mekanisme Kerja:** Ketika klien meminta data dan server kampus merespons dengan HTTP 302 redirect ke form login (menandakan sesi kampus habis), backend Mira secara transparan dan otomatis melakukan *auto-relogin* di balik layar menggunakan password terenkripsi tadi, memperbarui cookie jar, dan mengulangi request tanpa mahasiswa merasakan adanya interupsi sama sekali.

#### B. Single-Flight Mutex (Perlindungan Anti-Banned & Anti-DDoS Server Kampus)
* **Masalah:** Jika ada 50 mahasiswa satu kelas membuka jadwal kuliah pada jam yang sama, menembak 50 request scraping bersamaan ke server kampus bisa memicu IP rate-limit atau membebani server BSI.
* **Solusi Mira:** Kami mengimplementasikan pola **Single-Flight Mutex** berbasis Redis Lock (`_claim` & `_release`). Ketika data cache kedaluwarsa, hanya **1 request pertama** yang diizinkan mengambil data mentah dari server kampus. 49 request lainnya menunggu secara non-blocking (*sleep-wait*) sampai request pertama selesai mem-parse dan menyimpan hasilnya ke Redis. Hasilnya dibagikan bersama ke seluruh mahasiswa.

#### C. Two-Tier Cache & Last-Known-Good (SWR 0ms)
* **Tingkat 1 (Fresh Cache):** Data disimpan dengan TTL proporsional (Jadwal: 2 jam, Nilai: 30 menit, Tugas: 10 menit, Perpustakaan: 1 jam).
* **Tingkat 2 (Last-Known-Good / LGG):** Salinan data terakhir yang sukses disimpan permanen sebagai cadangan. Jika server kampus BSI mengalami maintenance, mati listrik, atau timeout, Mira tidak menampilkan error ke mahasiswa, melainkan menyajikan data LGG dengan flag `is_fallback: true` (Stale-While-Revalidate).

#### D. Multi-Tenant SessionPool (Isolasi Ketat per-NIM)
* Setiap mahasiswa memiliki slot HTTP Client (`PooledElearningClient` dan `StudentV2Client`) masing-masing yang terisolasi berdasarkan NIM.
* Cookie session PHP/Laravel antar-mahasiswa tidak akan pernah tertukar satu sama lain.
* Jika mahasiswa tidak aktif selama 15 menit, instance client di memory RAM akan di-evict (dibersihkan) secara otomatis untuk menghemat penggunaan memory VPS.

#### E. Pure HTML Parsing Offline-Tested (lxml + CSS Selectors)
* Mira tidak menggunakan browser headless berat (seperti Puppeteer atau Selenium) yang memakan ratusan megabyte RAM.
* Kami menggunakan **Scrapling + lxml C-extensions** yang memproses DOM HTML dalam hitungan **sub-milidetik** (<2ms). Seluruh logika parser diuji dengan 337+ unit test offline menggunakan snapshot HTML statis dari server kampus.

---

## Arsitektur & Keamanan

```text
               [ Browser Mahasiswa / PWA / AI Agent ]
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       https://mira.muaraai.com       https://api.muaraai.com
       [ Next.js 15 App Router ]      [ Caddy Gateway Reverse Proxy ]
                 │                               │
                 │ SWR API Fetch                 ▼
                 └────────────────────► [ FastAPI Server (:8300) ]
                                        [ FastMCP Server (:8350) ]
                                                 │
                        ┌────────────────────────┼────────────────────────┐
                        ▼                        ▼                        ▼
                [ Redis DB 2 ]           [ SQLite WAL DB ]      [ Multi-Tenant Pool ]
            - Session AES-256-GCM     - Personal API Keys      - Sticky Scrapling/HTTPX
            - Two-Tier Cache & SWR    - Webhook Channels       - Anti-SSRF DNS Guard
            - Rate Limiter Sliding    - PWA Push Subscriptions - Idle Eviction (15 Min)
                                                 │
                                                 ▼
                             [ 6 Server Kampus *.bsi.ac.id ]
```

- **Enkripsi Kredensial AES-256-GCM:** Password kampus dienkripsi menggunakan kunci 256-bit yang diturunkan melalui Keyed BLAKE2b KDF.
- **Isolasi Multi-Tenant:** Setiap NIM memiliki instance HTTP client dan cookie jar terisolasi dengan auto-eviction saat tidak aktif.
- **Pertahanan Anti-SSRF:** Validasi skema IP, pemblokiran private IP, dan resolusi DNS ketat untuk webhook kustom dan pengunduhan berkas kampus.

---

## MCP Server untuk AI Agent

Mira menyediakan endpoint **Model Context Protocol (MCP)** resmi berbasis Streamable HTTP dengan **80 tools akademik** (40 primer `mira_*` + 40 legacy alias `ubsi_*`):

```text
https://api.muaraai.com/v1/mira/mcp
```

### Konfigurasi Klien AI Agent

#### 1. Claude Code CLI
```bash
claude mcp add --transport http mira-academic   https://api.muaraai.com/v1/mira/mcp   --header "Authorization: Bearer muara_mira_YOUR_KEY"
```

#### 2. Cursor (`.cursor/mcp.json`)
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

#### 3. Hermes Agent (`~/.hermes/config.yaml`)
```yaml
mcp_servers:
  mira-academic:
    url: https://api.muaraai.com/v1/mira/mcp
    headers:
      Authorization: "Bearer muara_mira_YOUR_KEY"
```

#### 4. OpenAI Codex CLI (`~/.codex/config.toml`)
```toml
[mcp_servers.mira-academic]
url = "https://api.muaraai.com/v1/mira/mcp"
http_headers = { "Authorization" = "Bearer muara_mira_YOUR_KEY" }
```

Panduan lengkap skema parameter dan rekomendasi prompt agen tersedia di **[Dokumentasi MCP Server (docs/mcp.md)](docs/mcp.md)**.

---

## Quickstart

### Jalur A: Penggunaan Langsung (Mahasiswa)
1. Buka peramban ke **[mira.muaraai.com](https://mira.muaraai.com)**.
2. Masuk menggunakan NIM dan password akun kampus Anda.
3. Tekan tombol **Pasang Aplikasi (PWA)** untuk menginstal aplikasi di ponsel atau desktop.
4. Akses seluruh fitur akademik tanpa perlu instalasi server apa pun.

---

### Jalur B: Pengembangan Lokal / Self-Hosted (Developer)

#### 1. Kloning Repositori
```bash
git clone https://github.com/MuaraAI/Mira.git
cd Mira
```

#### 2. Menjalankan Backend FastAPI (Port 8300)
```bash
# Menyiapkan virtual environment Python 3.12 via uv
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install -r requirements.txt

# Menyiapkan file environment
cp .env.example .env

# Jalankan server FastAPI
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8300 --reload
```
Dokumentasi interaktif Swagger UI tersedia di `http://127.0.0.1:8300/docs`.

#### 3. Menjalankan Frontend Next.js 15 (Port 3000)
```bash
cd landing-page
npm install
npm run dev
```
Buka `http://localhost:3000` pada peramban Anda.

#### 4. Menjalankan Test Suite (100% Offline)
```bash
# Test backend pytest (318 passing)
.venv/bin/pytest -q

# Type-check dan production build frontend
cd landing-page && npm run build
```

---

## Tim Pengembang &amp; Kontributor

Mira dikembangkan dan dirawat secara independen oleh komunitas **[Muara AI](https://github.com/MuaraAI)** bersama 3 core developer mahasiswa Informatika UBSI Kampus Kota Pontianak:

<div align="center">
<table width="100%">
  <tr>
    <td align="center" width="33%" valign="top">
      <br />
      <a href="https://github.com/Curzyori">
        <img src="https://github.com/Curzyori.png" width="96" height="96" alt="Yuken Velino" style="border-radius:50%;" /><br />
        <b>Yuken Velino</b>
      </a>
      <br />
      <a href="https://github.com/Curzyori"><code>@Curzyori</code></a>
      <br /><br />
      <a href="https://github.com/MuaraAI/Mira/commits?author=Curzyori">
        <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FMuaraAI%2FMira%2Fcontributors&query=%24%5B0%5D.contributions&label=commits&color=0369A1&logo=github" alt="Commits" />
      </a>
      <br /><br />
      <b>Founder | Backend</b><br />
      <sub>NIM 15260767 · Informatika (S1)<br />
      Kelas 15.1C.30 · Semester 1<br />
      FTI · UBSI Kota Pontianak</sub>
      <br /><br />
    </td>
    <td align="center" width="33%" valign="top">
      <br />
      <a href="https://github.com/MyKineID">
        <img src="https://github.com/MyKineID.png" width="96" height="96" alt="Verzio Yamanansyah" style="border-radius:50%;" /><br />
        <b>Verzio Yamanansyah</b>
      </a>
      <br />
      <a href="https://github.com/MyKineID"><code>@MyKineID</code></a>
      <br /><br />
      <a href="https://github.com/MuaraAI/Mira/commits?author=MyKineID">
        <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FMuaraAI%2FMira%2Fcontributors&query=%24%5B1%5D.contributions&label=commits&color=0369A1&logo=github" alt="Commits" />
      </a>
      <br /><br />
      <b>Co-Founder | Frontend</b><br />
      <sub>NIM 15260225 · Informatika (S1)<br />
      Kelas 15.1B.30 · Semester 1<br />
      FTI · UBSI Kota Pontianak</sub>
      <br /><br />
    </td>
    <td align="center" width="33%" valign="top">
      <br />
      <a href="https://github.com/Seeyaa77">
        <img src="https://github.com/Seeyaa77.png" width="96" height="96" alt="M Raffli Aldiansyah" style="border-radius:50%;" /><br />
        <b>M Raffli Aldiansyah</b>
      </a>
      <br />
      <a href="https://github.com/Seeyaa77"><code>@Seeyaa77</code></a>
      <br /><br />
      <a href="https://github.com/MuaraAI/Mira/commits?author=Seeyaa77">
        <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FMuaraAI%2FMira%2Fcontributors&query=%24%5B3%5D.contributions&label=commits&color=0369A1&logo=github" alt="Commits" />
      </a>
      <br /><br />
      <b>Co-Founder | Hacker</b><br />
      <sub>NIM 15260161 · Informatika (S1)<br />
      Kelas 15.1A.30 · Semester 1<br />
      FTI · UBSI Kota Pontianak</sub>
      <br /><br />
    </td>
  </tr>
</table>
</div>

> **Tertarik ikut berkontribusi?**  
> Repositori ini terbuka bagi seluruh mahasiswa UBSI dan pengembang open source. Baca panduan kontribusi, konvensi commit, dan alur pull request di **[CONTRIBUTING.md](CONTRIBUTING.md)**.

---

## Disclaimer

> Proyek **Mira** adalah perangkat lunak tidak resmi (*unofficial*) yang dikembangkan secara independen oleh mahasiswa **Universitas Bina Sarana Informatika (UBSI)** untuk keperluan riset rekayasa perangkat lunak, otomatisasi personal, dan efisiensi waktu dalam mengakses jadwal, tugas, nilai, serta materi perkuliahan tanpa navigasi manual berulang.
>
> 1. Proyek ini **tidak berafiliasi resmi, tidak disponsori, dan tidak dikelola oleh pihak Universitas Bina Sarana Informatika (UBSI)**.
> 2. Pengembang **tidak bertanggung jawab** atas segala bentuk penyalahgunaan atau konsekuensi yang timbul dari penggunaan perangkat lunak ini. Seluruh risiko berada pada pengguna masing-masing.
> 3. Seluruh merek dagang, nama sistem, materi silabus, dan data akademik adalah hak cipta dan hak milik sah dari **Universitas Bina Sarana Informatika** serta pemilik hak ciptanya masing-masing.
>
> **Permohonan Penghapusan / Pengarsipan (Takedown Notice)**: Jika pihak otoritas universitas atau pengelola sistem IT UBSI berkeberatan atas repositori ini, silakan hubungi pengelola langsung via GitHub ([@Curzyori](https://github.com/Curzyori)) atau email `admin@muaraai.com`. Repositori ini akan dengan senang hati **diarsipkan atau dihapus permanen secara kooperatif**.

---

## Dokumentasi &amp; Tautan Legal

- [Kamus Lengkap API (docs/api.md)](docs/api.md) — Spesifikasi seluruh endpoint REST API dan schema JSON.
- [Panduan MCP Server (docs/mcp.md)](docs/mcp.md) — Dokumentasi 80 tools MCP akademik dan integrasi AI Agent.
- [Arsitektur Sistem (docs/architecture.md)](docs/architecture.md) — Siklus request, two-tier cache, dan single-flight mutex.
- [Etika &amp; Anti-Ban (docs/anti-ban.md)](docs/anti-ban.md) — Batas laju aman, jeda adaptif, dan proteksi sesi.
- [Panduan Deployment (docs/deploy.md)](docs/deploy.md) — Panduan operasi server VPS via PM2 dan Caddy.
- [Akses Jarak Jauh (docs/remote-access.md)](docs/remote-access.md) — Setup Caddy, Nginx, dan Cloudflare Tunnel.
- [Kebijakan Privasi (PRIVACY.md)](PRIVACY.md) — Penanganan kredensial, enkripsi AES-256-GCM, dan hak pengguna.
- [Syarat &amp; Ketentuan](https://mira.muaraai.com/terms) — Ketentuan layanan platform.
- [Kode Etik (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md) — Norma komunitas pengembang.
- [Kebijakan Keamanan (SECURITY.md)](SECURITY.md) — Standar pelaporan kerentanan secara bertanggung jawab.
- [DMCA &amp; Hak Cipta (DMCA.md)](DMCA.md) — Prosedur takedown notice hak cipta.
- [Panduan Kontribusi (CONTRIBUTING.md)](CONTRIBUTING.md) — Standar branching dan Conventional Commits.

---

## Lisensi

Didistribusikan di bawah lisensi terbuka **MIT License**. Lihat berkas [LICENSE](LICENSE) untuk informasi selengkapnya.

<p align="center">
  <sub>Dikembangkan dengan penuh dedikasi oleh komunitas <b>Muara AI</b> dan Mahasiswa Informatika UBSI.</sub>
</p>
