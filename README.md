<div align="center">

<img src="landing-page/public/maskot/mura-empty.png" alt="Mura, maskot Mira" width="104" />

# Mira

**Satu pintu untuk semua layanan kampus UBSI.**

Dashboard PWA, REST API, dan MCP Server untuk SIAKAD, MyBest, Ujian Online, Perpustakaan, Berita, dan Repository UBSI.

[![Website](https://img.shields.io/badge/website-mira.muaraai.com-0369A1?style=flat-square)](https://mira.muaraai.com)
[![License](https://img.shields.io/github/license/MuaraAI/Mira?style=flat-square&color=374151)](LICENSE)
![Python](https://img.shields.io/badge/python-3.12%2B-3776AB?style=flat-square&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![Tests](https://img.shields.io/badge/tests-100%25%20offline-0F766E?style=flat-square)

[Fitur](#fitur) · [Keamanan](#keamanan) · [Quickstart](#quickstart) · [MCP Server](#mcp-server) · [Dokumentasi](#dokumentasi) · [Tim](#tim)

</div>

---

## Kenapa Mira?

Layanan kuliah UBSI tersebar di enam portal berbeda dan sesinya habis setiap 15 menit. Mira menggabungkan semuanya dalam satu login, tetap aktif selama 7 hari, dan bisa dipasang di HP seperti aplikasi biasa.

| Layanan | Portal | Yang tersedia di Mira |
|---|---|---|
| SIAKAD | `students.bsi.ac.id` | Profil, jadwal, nilai, KHS, KRS, kartu ujian |
| MyBest | `elearning.bsi.ac.id` | Mata kuliah, tugas, presensi, materi, kuis, forum |
| Ujian Online | `ujiankampusa.bsi.ac.id` | Jadwal dan kartu ujian (UTS, UAS, Her) |
| Perpustakaan | `elibrary.bsi.ac.id` | Cari buku dan skripsi, stok, lokasi rak |
| Berita | `news.bsi.ac.id` | Berita kampus resmi |
| Repository | `repository.bsi.ac.id` | Publikasi riset terbaru |

## Fitur

**Untuk mahasiswa**
- PWA yang bisa dipasang di Android, iOS, dan desktop.
- Notifikasi push: kelas segera mulai, presensi dibuka, deadline tugas.
- Auto-relogin: tidak perlu login ulang tiap 15 menit.
- Pratinjau dan unduh materi kuliah langsung di dashboard.
- Komunitas: chat, spaces, dan profil antarmahasiswa.

**Untuk developer**
- Personal API Key (`muara_mira_*`) untuk bot Discord, Telegram, atau skrip pribadi.
- REST API dengan envelope JSON standar dan dokumentasi Swagger.
- Cache Redis dua tingkat dengan fallback data terakhir saat kampus down.
- MCP Server dengan 80 tools untuk AI agent.

## Keamanan

| Lapisan | Perlindungan |
|---|---|
| Kredensial | Password kampus dienkripsi AES-256-GCM, tidak pernah disimpan sebagai teks biasa |
| Login | Maks 10 percobaan per menit per IP. Spam = IP diblokir otomatis 15 menit, naik ke 1 jam lalu 24 jam bila diulang |
| Brute force per akun | Maks 5 percobaan per menit per NIM |
| Password default | Akun yang masih memakai `Mhs-1945` atau `Mhs-2026` diingatkan di setiap halaman dan bisa langsung ganti password dari Mira |
| Aktivitas | Jumlah login sukses dan gagal hari ini tampil di navbar desktop dan mobile |
| Lupa password | Reset lewat NIM + email terdaftar. NIM dan email yang tidak cocok ditolak sebelum diteruskan ke kampus |
| Isolasi | Sesi dan cookie kampus terpisah per NIM |
| Webhook | Proteksi SSRF: blokir IP privat dan validasi DNS |

Temukan celah keamanan? Laporkan sesuai [SECURITY.md](SECURITY.md).

## Quickstart

**Mahasiswa:** buka [mira.muaraai.com](https://mira.muaraai.com), login dengan NIM serta password SIAKAD dan MyBest, lalu pasang sebagai aplikasi.

**Developer:**

```bash
git clone https://github.com/MuaraAI/Mira.git && cd Mira

# Backend (FastAPI, port 8300)
uv venv .venv --python 3.12 && source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8300 --reload

# Frontend (Next.js, port 3000)
cd landing-page && npm install && npm run dev
```

Swagger UI: `http://127.0.0.1:8300/docs`

**Testing** (100% offline, tanpa request ke server kampus):

```bash
.venv/bin/pytest -q
cd landing-page && npm run build
```

## MCP Server

Endpoint Streamable HTTP untuk AI agent:

```bash
claude mcp add --transport http mira-academic https://api.muaraai.com/v1/mira/mcp \
  --header "Authorization: Bearer muara_mira_YOUR_KEY"
```

Konfigurasi Cursor, Codex, dan Hermes ada di [docs/mcp.md](docs/mcp.md).

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/api.md](docs/api.md) | Referensi endpoint REST API |
| [docs/architecture.md](docs/architecture.md) | Alur request, cache, dan session pool |
| [docs/mcp.md](docs/mcp.md) | Daftar tools MCP dan integrasi agent |
| [docs/anti-ban.md](docs/anti-ban.md) | Batas laju aman ke server kampus |
| [docs/deploy.md](docs/deploy.md) | Deploy ke VPS dengan PM2 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Alur branch, commit, dan pull request |
| [PRIVACY.md](PRIVACY.md) · [DMCA.md](DMCA.md) · [Syarat Layanan](https://mira.muaraai.com/terms) | Legal |

## Tim

Dikembangkan oleh [Muara AI](https://github.com/MuaraAI), mahasiswa Informatika UBSI Kampus Pontianak.

| | Nama | Peran |
|---|---|---|
| <img src="https://github.com/Curzyori.png" width="40" /> | **Yuken Velino** · [@Curzyori](https://github.com/Curzyori) | Founder, Backend |
| <img src="https://github.com/MyKineID.png" width="40" /> | **Verzio Yamanansyah** · [@MyKineID](https://github.com/MyKineID) | Co-Founder, Frontend |
| <img src="https://github.com/Seeyaa77.png" width="40" /> | **M Raffli Aldiansyah** · [@Seeyaa77](https://github.com/Seeyaa77) | Co-Founder, Hacker |

Ingin ikut kontribusi? Baca [CONTRIBUTING.md](CONTRIBUTING.md).

## Disclaimer

Mira adalah proyek **tidak resmi** dan tidak berafiliasi dengan Universitas Bina Sarana Informatika. Semua merek dan data akademik adalah milik UBSI dan pemiliknya masing-masing. Risiko penggunaan ditanggung pengguna.

Pihak UBSI yang keberatan dengan proyek ini dapat menghubungi [@Curzyori](https://github.com/Curzyori) atau `admin@muaraai.com`. Repositori akan diarsipkan atau dihapus secara kooperatif.

## Lisensi

[MIT](LICENSE) © Muara AI
