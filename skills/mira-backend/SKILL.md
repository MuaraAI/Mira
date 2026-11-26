---
name: mira-backend
description: Use when developing or debugging Mira Python FastAPI modules, UBSI campus scrapers or HTML parsers, dual SQLite and Supabase Postgres schemas, session pooling, or offline pytest suites.
license: MIT
---

# Mira Backend Development (`app/` & `tests/`)

Playbook rekayasa backend FastAPI (Python 3.12+), scraper portal kampus UBSI, penyimpanan ganda (SQLite + Redis + Supabase Postgres), dan pengujian pytest 100% offline.

## Aturan Ketat Sebelum Mengubah Kode

1. **Git Branch & PR:** Hanya untuk Anggota Muara AI (mahasiswa aktif UBSI). Dilarang commit/push ke `main`; buat feature branch baru `<type>/<ringkas>` dan ajukan PR.
2. **Zero Secrets & Fallback:** Kredensial hanya dari `.env`. Dilarang hardcode token/URL privat atau fallback `os.getenv("KEY", "default_secret")` — env yang hilang wajib gagal cepat.
3. **100% Offline TDD:** Seluruh test di `tests/` dilarang menembak `*.bsi.ac.id`, Redis, SQLite produksi, atau Supabase nyata. Simpan snapshot HTML teranonimkan (NIM dummy `12345678`, `password-dummy`, `test@example.com`) di `tests/fixtures/` lalu kunci parser dengan `pytest`.
4. **Root Cause First:** Perbaiki di satu titik sumber yang dilalui semua pemanggil (mis. agregasi cabang di `stats.py`), bukan menambal gejala di tiap pemanggil.

## Peta Penyimpanan & Aturan Skema Ganda

| Data | Engine | Modul Kunci |
|---|---|---|
| Akun, `account_links` (Fernet), `api_keys` (BLAKE2b+Fernet), `webhook_channels` (Fernet), PWA Push | **SQLite WAL** (`data/ubsi.db`) | `app/account_links.py`, `app/api_keys_db.py`, `app/channels_db.py`, `app/pwa_push_db.py` |
| Sesi dashboard (`ubsi_session`, AES-256-GCM 7 hari sliding), cache SWR, cookie kampus, stats, rate limit | **Redis** (db 2) | `app/session_store.py`, `app/cache.py`, `app/campus_session_store.py`, `app/limiter.py` |
| **Mira Komunitas** (profil, chat, spaces, mention, reaksi, teman) | **Supabase Postgres** (fallback SQLite offline) | `app/social/db.py` (`using_postgres()`, `transaction()`, `connect()`) |

**Aturan Skema Ganda (`app/social/`):** Setiap tabel atau kolom baru pada fitur Komunitas **wajib** ditambahkan di dua jalur sekaligus (`_CREATE`/`_ADDED_COLUMNS` SQLite **dan** `_PG_EXTRA_TABLES`/`_ADDED_COLUMNS` Postgres) plus file migrasi di `supabase/migrations/` dan dijalankan via MCP `apply_migration`. Lupa salah satu menyebabkan HTTP 500 di produksi.

## Kontrak Auth, Sesi & Scraper

- **Login MyBest-only:** `POST /v1/auth/login` hanya memverifikasi `elearning.bsi.ac.id`. Password SIAKAD **tidak** diwarisi dari MyBest; user menautkannya terpisah lewat `POST /v1/auth/credentials`.
- **Re-login Reaktif & Solver Server:** Sesi kampus dikelola di latar belakang oleh `app/upstream_session.py` (`app/elearning_captcha.py` OpenCV puzzle geser MyBest; `app/captcha_autosolver.py` ddddocr SIAKAD).
- **Allowlist Profil SIAKAD:** `parse_profile` hanya mengambil field akademik; data pribadi sensitif (TTL, alamat, telepon, agama, biaya) sengaja ditolak.
- **Kredensial Terkunci:** Kredensial tersimpan yang ditolak kampus ditandai `needs_relink` dan membalas `409 SIAKAD_RELINK_REQUIRED`.

## Jebakan Teknis Kritis

- **Async Wrapper (`cached_endpoint`):** Gunakan `inspect.isawaitable()` (bukan `asyncio.iscoroutine()`) agar `Future` dari `loop.run_in_executor()` ter-await sempurna.
- **Auth Middleware & Proxy CIDR:** Jangan pernah bypass auth untuk `127.0.0.1` (reverse proxy mengirim dari localhost). Normalisasi path dengan `request.url.path.rstrip("/") == "/health"`. Hanya percaya `X-Forwarded-For` / `CF-Connecting-IP` jika socket berasal dari CIDR di `TRUSTED_PROXIES`.
- **Memory & Idle Eviction:** Pastikan background worker di `lifespan` rutin memanggil `await pool.evict_idle()` (`SessionPool` idle TTL 10 menit, LRU maks 150).

## Gerbang Verifikasi Wajib

```bash
.venv/bin/pytest -q
git diff --cached | grep -nE '(nim|password|token|pass)\s*[:=]\s*["'\''][^"'\'']{6,}' || true
graphify update .
```
