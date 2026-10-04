# Specification: UBSI API — Landing Page Murni & Centralized Vault Integration (muaraai.com)

**Date:** 2026-10-01
**Status:** Approved by Core Team
**Update 2026-10-04:** Mengikuti keputusan konsolidasi ekosistem Muara AI & PR #11 ai-web: Pembuatan key dan dashboard lokal di repo ini DITIADAKAN. Seluruh manajemen kunci API (`muara_ubsi_...`) dipusatkan di portal komunitas `https://muaraai.com/dashboard/vault`.
**Supersedes:** `2026-09-30-monorepo-frontend-split-and-local-dashboard-design.md` & rute `/dashboard` lokal di landing-page dibatalkan; `landing-page/` menjadi murni landing page & dokumentasi teknis.
**Component:** `landing-page/` (showcase & docs) + backend auth `app/vault.py` (FastAPI VPS Tencent)
**Target Repository:** `MuaraAI/UBSI-API`

---

## 1. Keputusan Arsitektur Terbaru (Konsolidasi Ekosistem)

Untuk mencegah fragmentasi sistem login dan duplikasi dashboard di banyak subdomain, seluruh manajemen akun dan pembuatan API key dipusatkan di satu pintu:

```text
PORTAL UTAMA (muaraai.com/dashboard/vault)
  → Satu-satunya tempat login (GitHub OAuth SSO)
  → Member generate key muara_ubsi_... secara terpusat (WebCrypto view-once)
  → Key hash disimpan ke database Supabase (ubsi_api.api_keys via view public.api_keys)

FRONTEND UBSI API (ubsi-api.muaraai.com)
  → MURNI Landing Page & Dokumentasi Teknis 19 Endpoint Kampus
  → ZERO login, ZERO database/Supabase di sisi browser
  → Tombol CTA mengarahkan pengguna: "Dapatkan API Key di muaraai.com"

BACKEND VPS TENCENT (api.muaraai.com/v1/ubsi-api/*)
  → Header: X-API-Key: muara_ubsi_...
  → Hashing sha256 -> Cek Redis Cache (10m) -> Fallback query Supabase REST API
  → Dekripsi NIM & password kampus (AES-256-GCM) -> Eksekusi scraping kampus multi-tenant
```

Prinsip yang dipertahankan:
- Vault `ubsi_api.api_keys` tetap **hash-only sha256**. Tidak ada komponen yang bisa "membaca key dari DB" — by design. Key asli hanya pernah ada di layar portal saat generate, dan di sisi user.
- Zero database dan zero secret baru di dashboard. Backend satu pintu dengan dua jalur verifikasi.
- Satu kode dashboard, dua mode: hosted (login wajib) dan self-host clone (BYOK).

### 1.1 Update 2026-10-02: SSO antar portal "Login With MuaraAI"

Dashboard ini ikut konvensi SSO ekosistem MuaraAI (spec: `MuaraAI/ai-web/docs/superpowers/specs/2026-10-02-ai-web-portal-design.md` §1.1):

- Supabase client dibuat dengan `cookieOptions: { name: "sb-muaraai-auth-token", domain: ".muaraai.com" }` + PKCE (bukan cookie default per-subdomain).
- Efek: login di `ubsi-api.muaraai.com` otomatis ter-login di `ai.muaraai.com` dan sebaliknya (satu `auth.users`, satu cookie domain).
- Perlu didaftarkan di Supabase Auth settings: redirect URL `https://ubsi-api.muaraai.com/auth/callback` (di samping yang dari ai-web).
- Konsekuensi kode: `landing-page/` memakai `@supabase/ssr` (bukan supabase-js polos) untuk cookie-based session — dependency baru di §2 berubah dari `@supabase/supabase-js` menjadi `@supabase/ssr` (yang membawa supabase-js).

### 1.2 Update 2026-10-02: konvensi key per produk (jangan tertukar)

Ekosistem MuaraAI kini punya dua produk API dengan prefix key berbeda dan TIDAK saling dipakai:

| Produk | Prefix key | Gateway | Sumber key |
|---|---|---|---|
| UBSI API | `muara_ubsi_` | `api.muaraai.com/v1/ubsi-api/*` | portal ini (`POST /v1/auth/provision` / muaraai.com nanti) |
| Muara V1 Flash (AI) | `muara_ai_` | `api.muaraai.com/v1/ai/*` | `ai.muaraai.com` dashboard |

`ubsi_api.api_keys` dan `ai.api_keys` adalah table terpisah di project Supabase yang sama. Spec ini HANYA menangani `muara_ubsi_`; spesifikasi AI ada di `MuaraAI/ai-backend/docs/superpowers/specs/2026-10-02-ai-gateway-muara-design.md`.

## 2. Struktur

```text
landing-page/src/
├── app/dashboard/page.tsx            # entry route (client)
├── lib/dashboard/api-client.ts       # fetch wrapper: Bearer JWT ATAU X-API-Key
├── lib/dashboard/auth.tsx            # hosted: supabase-js session + members check
├── lib/dashboard/connection.tsx      # self-host: baseUrl + key + "ingat perangkat"
├── components/dashboard/
│   ├── LoginGate.tsx                 # hosted: tombol login + status pending/rejected
│   ├── ConnectionGate.tsx            # self-host: form BYOK
│   ├── OverviewTab.tsx / GradesTab.tsx / PresenceTab.tsx / SettingsTab.tsx
└── data/dashboard-presets.ts         # preset URL cloud/localhost
```

- Env publik (aman diekspos): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_REQUIRE_MEMBER_LOGIN` (tidak diset pada build self-host → mode BYOK).
- Dep baru: `@supabase/supabase-js` (satu-satunya dependency baru).
- Isolasi kode: seluruh kode dashboard di `src/app/dashboard/`, `src/components/dashboard/`, `src/lib/dashboard/` — tidak menyentuh komponen landing. App Router melakukan code-splitting per-route.

## 3. Backend (satu-satunya perubahan server)

Middleware `api_key_auth_middleware` (`app/main.py`) mendapat jalur ketiga, urutan eksekusi tetap:

1. Master Key (`compare_digest`) — existing.
2. `X-API-Key` member (resolver existing: sha256 → Supabase → Redis 10m) — existing.
3. **BARU: `Authorization: Bearer <jwt>`**:
   - Verifikasi JWT Supabase project `muaraai` (secret/JWKS, `aud=authenticated`).
   - Redis cache `ubsi:jwt:{sub}` TTL 10 menit → cek `public.members.user_id = sub` dan `registration_status='approved'` → ambil `key_hash` milik member → dekripsi kredensial lewat jalur vault existing → inject `request.state.nim/pass` (identik dengan jalur member key).
   - Rate limit per `member:{sub}` (60 req/menit, pola limiter existing).
   - JWT invalid/expired → 401; member belum approved → 403 `MEMBER_NOT_APPROVED`.

### 3.1 Endpoint Provisioning Key: `POST /v1/auth/provision` (BARU)

Member yang belum punya key bisa membuatnya langsung dari dashboard (hosted), tanpa menyentuh Master Key dan tanpa logika kripto di frontend:

- **Auth:** wajib `Authorization: Bearer <supabase_jwt>` member `approved` (jalur 3 di atas). Master Key tidak berpartisipasi.
- **Body:** `{"nim": "...", "studentv2_pass": "...", "elearning_pass": "..."}`.
- **Alur:**
  1. Validasi kredensial LIVE ke kampus dengan **reuse logika `POST /v1/auth/verify`** (paralel SIAKAD + MyBest). Gagal → 400 `INVALID_CREDENTIALS`, tidak ada yang disimpan.
  2. Generate key `muara_ubsi_<urlsafe-random-32B>`.
  3. Simpan: `key_hash = sha256(key)` + kredensial terenkripsi AES-256-GCM (reuse `encrypt_credential` dari `app/vault.py`) ke `ubsi_api.api_keys` (`user_id` = sub member).
  4. Response menampilkan key plaintext **SEKALI** (view-once). Server tidak pernah menyimpan plaintext.
- **Aturan:** 1 member = 1 key aktif. Generate ulang (regenerate) = revoke key lama; endpoint regenerate wajib kirim `{"confirm": true}`.
- **Rate limit:** 3 req/menit per `member:{sub}` (anti spam key + anti brute-force kampus).
- **Response:** `{"api_key": "muara_ubsi_...", "key_prefix": "muara_ubsi_abcd", "created_at": ...}`.
- Tests: `tests/test_auth_provision.py` (offline): sukses, kredensial kampus salah (tidak tersimpan), member belum approved, tanpa JWT, rate limit, regenerate merevoke key lama.

- CORS sudah mengizinkan `https://ubsi-api.muaraai.com` (diterapkan 2026-10-01).
- Tests baru `tests/test_jwt_auth.py` (offline): valid/expired/unsigned JWT, approved vs pending member, rate limit, dan memastikan jalur `X-API-Key` lama tidak berubah perilaku.

## 4. Alur Pengguna

Hosted:
1. Buka `/dashboard` → `LoginGate`: tombol "Login with MuaraAI" (GitHub/email via Supabase Auth).
2. Setelah login, cek keanggotaan: `pending`/`rejected` → halaman status + link pendaftaran di muaraai.com; `approved` → lanjut.
3. **ProvisionGate** (bila member belum punya key): form NIM + Password SIAKAD + Password Elearning → `POST /v1/auth/provision` (validasi live kampus + generate, lihat 3.1) → key tampil **view-once** dengan tombol copy + peringatan "simpan sekarang, key tidak bisa dilihat lagi" → lanjut ke dashboard. Sudah punya key → langsung masuk.
4. Dashboard jalan pakai Bearer JWT — tidak ada key yang diminta, ditampilkan, atau disimpan di browser. Sesi JWT dikelola supabase-js (auto-refresh, sign out = revoke). API key hasil provision dipakai untuk jalur custom/script (di luar dashboard).
5. Empat tab:

| Tab | Sumber data | Isi |
|---|---|---|
| Overview | `/v1/studentv2/schedule`, `/v1/news` | Jadwal hari ini + ticker berita |
| Nilai | `/v1/elearning/grades`, `/v1/elearning/courses` | Rekap per pertemuan 1-16 + simulator IPK |
| Presensi | `/v1/elearning/presence` | Riwayat + progress bar threshold 75% |
| Pengaturan | sesi | Profil member, sign out |

Self-host (`NEXT_PUBLIC_REQUIRE_MEMBER_LOGIN` tidak diset):
1. `ConnectionGate` BYOK: Base URL (preset `http://localhost:8300`) + master key lokal.
2. Checkbox "Ingat di perangkat ini" default ON (localStorage); tidak dicentang → sessionStorage (hilang saat tab ditutup). Tombol "Putuskan" menghapus seluruh state.
3. Error handling: 401 → kredensial salah; 429 → rate limit; 5xx/timeout → banner; tanpa crash.

## 5. Keamanan

- API key: hash-only di DB, dibuat via `POST /v1/auth/provision` (view-once, tampil sekali saat generate; ilang = regenerate yang merevoke lama); untuk jalur custom/script/self-host.
- Hosted dashboard tidak menyimpan atau menyentuh key; sesi = JWT Supabase pendek, auto-refresh, revoke via sign out.
- XSS dimitigasi: data API dirender sebagai teks murni (tanpa `dangerouslySetInnerHTML`), zero script pihak ketiga, CSP ketat (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`).
- Key/JWT tidak pernah di URL atau query param; hanya header. Backend tidak mencetak header auth ke log.
- Rate limit 60 req/menit per identitas (key_id / member sub); Master bypass.
- Env yang diekspos hanya Supabase anon key (aman; RLS melindungi data member).

## 6. Standar Desain

- Tema Deep Water dark-first (`#0A1220` bg, `#2DD4BF` accent), konsisten `landing-page/DESIGN.md`.
- Font & ikon self-hosted, tanpa emoji dekoratif, tanpa em-dash di copy UI (iron rules AGENTS.md).
- Mobile floor 360px tanpa horizontal overflow; navigasi keyboard; kontras WCAG AA.

## 7. Verification Gate

1. `cd landing-page && npm run build` → compiled successfully; `npx tsc --noEmit` → 0 error.
2. `.venv/bin/pytest -q` → semua lulus (126 existing + test JWT baru), 100% offline.
3. Smoke hosted: login member approved → ProvisionGate (generate key view-once) → 4 tab terisi via Bearer JWT; sign out → LoginGate; member pending → halaman status.
4. Smoke self-host mode: tanpa env Supabase → BYOK gate jalan ke localhost.
5. Jalur lama utuh: `X-API-Key` tetap 200/401/429 sesuai test existing.
6. Mobile 360px: `scrollWidth <= clientWidth`.

## 8. Out of Scope

- Portal member muaraai.com itu sendiri (proyek terpisah; dashboard hanya mengonsumsi `members` + Auth yang sudah ada).
- OAuth IdP buatan sendiri (dipakai Supabase Auth sebagai identity provider).
- Fitur write operations — tetap di repo privat.
- iCal, bulk downloader (roadmap v1.2 terpisah). Multi-bahasa, PWA, push notification.

## 9. Pembersihan

- Folder `web/` artifact lama (untracked, ~547MB `node_modules/`) menunggu konfirmasi pemilik untuk dihapus.
- Plan lama `2026-09-30-monorepo-frontend-split-and-local-dashboard.md` Task 2-7 usang; Task 1 (rename) selesai oleh @MyKineID (`fbac2af`). Plan baru mengikuti spec ini.
