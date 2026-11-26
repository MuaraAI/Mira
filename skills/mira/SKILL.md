---
name: mira
description: Use when working with Mira (UBSI Academic Operating System by Muara AI) or routing between Mira MCP tools, REST API, FastAPI backend, or Next.js frontend tasks.
license: MIT
---

# Mira Agent Skill Router

Mira adalah platform akademik tidak resmi (open source, MIT) dari komunitas **Muara AI** untuk menyatukan 6 layanan kampus Universitas Bina Sarana Informatika (UBSI): **SIAKAD**, **MyBest Elearning**, **Ujian Online**, **Perpustakaan OPAC**, **Berita Kampus**, dan **Repository Riset**. Proyek ini independen dan tidak berafiliasi secara resmi dengan UBSI.

## Pilih Sub-Skill Sesuai Tugas

| Tugas Anda | Skill | Kapan Dipakai |
|---|---|---|
| Sambungkan AI agent ke 42 tools `mira_*` | `mira-mcp` | Membaca jadwal, tugas, presensi, KHS, materi, diskusi, kuis, atau trigger pengingat lewat MCP |
| Integrasi REST API / bikin bot Discord atau Telegram | `mira-api` | Memanggil endpoint `/v1/*`, parsing envelope JSON, kelola Personal API Key atau webhook |
| Kembangkan / debug backend Python & scraper kampus | `mira-backend` | Edit `app/`, tambah parser HTML kampus, dual-DB SQLite + Supabase Postgres, `pytest` offline |
| Kembangkan / edit frontend web, dashboard, atau SEO | `mira-web` | Edit `landing-page/` (Next.js 15), UI Semi Pixel-Art Light, metadata SEO, PWA, font `.woff2` |

## URL Produksi Resmi

- **Web & Dashboard:** `https://mira.muaraai.com` (Demo: `/demo`, Panduan: `/panduan`, Developer Docs: `/developers`)
- **Base URL REST API:** `https://api.muaraai.com/v1/mira` (Katalog JSON: `/v1/docs`)
- **MCP Streamable HTTP:** `https://api.muaraai.com/v1/mira/mcp`
- **Agent Skills Catalog:** `https://skills.sh/muaraai/mira`
- **Repository GitHub:** `https://github.com/MuaraAI/Mira` · Kontak: `admin@muaraai.com`

## Instalasi Skill ke AI Agent

```bash
# Pasang seluruh 5 skill Mira sekaligus
npx skills add MuaraAI/Mira

# Atau pasang selektif untuk pengguna MCP / API saja
npx skills add MuaraAI/Mira --skill mira-mcp --skill mira-api

# Atau pasang khusus kontributor repo (backend & frontend)
npx skills add MuaraAI/Mira --skill mira-backend --skill mira-web
```

## Batasan Kontribusi Repository

Kontribusi ke `MuaraAI/Mira` hanya dibuka bagi **Anggota Muara AI** berstatus mahasiswa aktif UBSI dan **wajib** memakai branch baru + Pull Request ke `main` (dilarang direct push ke `main`).
