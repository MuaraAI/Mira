# Perbaikan alur login dan CAPTCHA (2026-11-17)

## Intent

Worker notifikasi mengirim jutaan login ke MyBest dengan jawaban CAPTCHA tebakan.
Jalur itu mengunci NIM lewat cooldown 20 menit sehingga user sah ikut gagal login,
absen, tugas, dan dashboard. Form login juga baru memuat CAPTCHA setelah NIM di-blur.

Pendekatan yang dipilih: perbaiki akar di worker, hapus cooldown setelah login relay
berhasil, tampilkan CAPTCHA begitu NIM valid, dan ikatkan tantangan ke cookie nonce
per host. Tidak ada OCR atau auto-solve CAPTCHA kampus.

## Akar masalah

Halaman login MyBest memakai PNG base64 untuk `captcha_answer` (3 karakter).
`solve_captcha()` mencari pola `(\d+)\s*\+\s*(\d+)`, yang cocok dengan `3+3` di
dalam string base64, lalu mengirim `captcha_answer=6`. Kampus menjawab
`Kode keamanan salah`, worker mengulang tiap siklus, NIM masuk cooldown.

## Perubahan

- `app/modules/elearning.py`: bila halaman login terdeteksi memakai CAPTCHA gambar,
  jangan panggil solver dan jangan POST sama sekali tanpa jawaban relay.
- `app/modules/auth.py`: login relay yang sukses memanggil `clear_login_block()` untuk
  MyBest dan SIAKAD, sehingga sesi baru langsung dipakai jalur absen dan tugas.
- `app/captcha_relay.py`: `create_challenge()` menyimpan nonce opsional;
  `consume_challenge()` memvalidasi nonce sebelum menghapus key Redis.
- `app/modules/auth.py`: `/v1/auth/captcha` menetapkan cookie HttpOnly per host
  (`ubsi_captcha_siakad`, `ubsi_captcha_elearning`). `/v1/auth/login` dan
  `/v1/auth/credentials` mengirim cookie yang sesuai saat mengonsumsi tantangan.
- `landing-page/src/app/login/AuthPortal.tsx`: CAPTCHA dimuat saat NIM mencapai
  8 digit dengan nilai input terbaru, bukan menunggu blur atau login gagal.
- `landing-page/src/components/LockedSiakadCard.tsx`: alur "Hubungkan SIAKAD"
  memuat CAPTCHA SIAKAD dari `/v1/auth/captcha` (host `siakad`, NIM dari
  `/v1/auth/me`), mengirim `captcha: {id, code}` ke `/v1/auth/credentials`,
  dan memuat gambar baru setiap gagal karena challenge sekali pakai.

## Lazy SIAKAD (2026-11-17, lanjutan)

Login default kini MyBest-only: satu password dan satu CAPTCHA MyBest.
SIAKAD jadi opt-in di form login dan lazily dihubungkan dari dashboard lewat
tombol "Hubungkan Akun SIAKAD" (`LockedSiakadCard`) yang sudah menyertakan
CAPTCHA SIAKAD. Kontrak endpoint tidak berubah: `/v1/auth/credentials`
memvalidasi challenge via cookie `ubsi_captcha_siakad` (PR sebelumnya).

Alasan: kedua kampus kini memakai CAPTCHA PNG (SIAKAD tidak lagi SVG-math),
OCR tesseract terukur 15-25% benar pada sampel hari ini, dan auto-solve
latar belakang adalah akar insiden lock 20 NIM. Detail investigasi format
CAPTCHA SIAKAD: `GET /login/captcha/web` mengembalikan JSON `{"image": ...}`,
form login memakai field `captcha`, dan kode salah di-redirect 302 ke
endpoint CAPTCHA.

## Non-goal
- Tidak menambah CAPTCHA buatan Mira.
- Tidak memecahkan CAPTCHA kampus dengan OCR atau vendor pihak ketiga.
- Tidak mengubah prioritas sumber data dashboard.

## Hotfix cooldown CAPTCHA (2026-11-18)

Insiden: user tidak bisa absen. Sesi MyBest mati setelah idle (~15 menit),
login ulang otomatis ditolak karena butuh CAPTCHA, dan NIM masuk cooldown
captcha 20 menit yang tersimpan in-memory per worker (2 worker) sehingga
re-login di satu worker tidak menyembuhkan worker lain. Semua request
upstream NIM terkait membalas 502 `AUTH_CAPTCHA_REQUIRED`.

Sejak default-deny, kegagalan login beralasan captcha tidak pernah POST ke
kampus: biayanya satu GET halaman login. Cooldown panjang tidak melindungi
apa pun dan hanya mengunci fitur user, jadi `CAPTCHA_COOLDOWN_SECONDS`
diperpendek 20 menit menjadi 60 detik. Perlindungan flood tetap ada di rate
limiter API (60 req/menit/IP), login_guard (10 login/menit/IP), dan blok host
429 (5 menit). Test `test_captcha_cooldown_constant_is_reasonably_long`
diganti `test_captcha_cooldown_constant_is_short`.

## Verifikasi

Regression test offline: `tests/test_elearning_login_image_captcha.py`,
`tests/test_login_clears_captcha_cooldown.py`, dan tiga test nonce di
`tests/test_captcha_relay.py`. Suite backend dan build frontend dijalankan sebelum PR.
Deploy produksi tetap butuh persetujuan terpisah.

## CAPTCHA Mira + auto-solve latar belakang (2026-11-18, arsitektur baru)

Keputusan user: CAPTCHA milik Mira sendiri muncul otomatis tanpa NIM,
sedangkan CAPTCHA kampus (MyBest/SIAKAD) di-auto-solve di backend.
CAPTCHA manusia kampus hanya jadi fallback saat auto-solve gagal.

### Alur baru

1. `POST /v1/auth/mira-captcha` mengirim tantangan SVG buatan Mira
   (`app/mira_captcha.py`): kode 5 karakter, charset tanpa ambigu (tanpa
   0/O, 1/I), TTL 600 detik di Redis (`ubsi:mira-captcha:<id>`), rate limit
   20/menit/IP. Verifikasi case-insensitive dan typo-tolerant: challenge
   hanya dihapus saat kode cocok (Lua `EVAL`, Redis 6 tanpa GETDEL).
2. `POST /v1/auth/login` wajib `mira_captcha` (`LoginRequest`). Kode Mira
   salah -> 401 `MIRA_CAPTCHA_INVALID` plus tantangan segar di
   `error.mira_captcha`.
3. Backend lalu auto-solve CAPTCHA kampus (`app/captcha_autosolver.py`):
   ambil tantangan dari `captcha_relay`, OCR voting (ImageMagick +
   tesseract), lalu validasi tiap kandidat dengan probe login memakai
   `DUMMY_PASSWORD` (bukan password user). Alasan kampus "credentials"
   berarti kode diterima; "captcha" berarti coba kandidat berikutnya;
   "throttled" menghentikan loop. Maksimal 5 tantangan, 4 kandidat per
   tantangan.
4. Auto-solve gagal -> 401 `AUTH_CAPTCHA_REQUIRED` dengan
   `error.fallback_captcha` (`id`, `image`, `label`, `host`) dan cookie
   nonce per host. User mengisi kode kampus, lalu mengirim ulang dengan
   `campus_captcha: {id, code}`.
5. `/v1/auth/credentials` (hubungkan SIAKAD) memakai alur yang sama;
   field lama `captcha` diganti `campus_captcha`.
6. Frontend: `AuthPortal.tsx` memuat CAPTCHA Mira sejak halaman dibuka
   (tanpa NIM), tanpa preload CAPTCHA kampus; `LockedSiakadCard.tsx`
   hanya menampilkan CAPTCHA kampus kalau server mengirim fallback.

### Risiko operasional

- Probe login dengan password dummy menambah 1-4 POST login kampus per
  percobaan login user per host. Limit `MAX_CHALLENGES` menjaga lonjakan;
  probe 429 ("throttled") menghentikan loop segera.
- Akurasi OCR kampus masih rendah (15-25% pada sampel), jadi probe
  sering menghabiskan kandidat. Fallback manusia menjamin user tetap
  bisa masuk, hanya lebih lambat.
- Solver lama tetap default-deny: CAPTCHA gambar tidak pernah ditebak
  oleh worker notifikasi.

### Kontrak baru pada penolakan

| Kode | Payload tambahan | Arti |
|---|---|---|
| `MIRA_CAPTCHA_INVALID` | `error.mira_captcha` {id, image, expires_in} | Kode Mira salah/kosong; tantangan segar siap dipakai |
| `AUTH_CAPTCHA_REQUIRED` | `error.fallback_captcha` {id, image, label, host} | Auto-solve gagal; isi kode kampus lalu kirim `campus_captcha` |

### Verifikasi

`tests/test_mira_captcha.py` (create/verify/sekali pakai/salah),
`tests/test_captcha_autosolver.py` (kandidat valid, retry tantangan,
throttle, probe SIAKAD), dan pembaruan kontrak di `tests/conftest.py`
(stub offline Mira + auto-solve untuk seluruh suite). Suite backend
501 passed; build frontend lolos.
