# Perbaikan alur login dan CAPTCHA

> **Status akhir (2026-11-20):** form login **tidak** menampilkan CAPTCHA.
> SIAKAD diselesaikan OCR (ddddocr, ~20 ms); MyBest memakai puzzle geser yang
> diselesaikan template matching OpenCV lalu diverifikasi `/verify-captcha`
> (`app/elearning_captcha.py`). Keduanya memakai tantangan baru per percobaan,
> maksimal 3 percobaan. `POST /v1/auth/captcha`, CAPTCHA Mira, dan
> `app/mira_captcha.py` sudah dihapus. Bagian di bawah adalah catatan riwayat
> insiden 2026-11-17; beberapa detail sengaja dipertahankan sebagai konteks.

## Intent

Worker notifikasi mengirim jutaan login ke MyBest dengan jawaban CAPTCHA tebakan.
Jalur itu mengunci NIM lewat cooldown 20 menit sehingga user sah ikut gagal login,
absen, tugas, dan dashboard. Form login juga baru memuat CAPTCHA setelah NIM di-blur.

Pendekatan awal (2026-11-17): perbaiki akar di worker, hapus cooldown setelah login
relay berhasil, tampilkan CAPTCHA begitu NIM valid, dan ikatkan tantangan ke cookie
nonce per host.

**Catatan:** bagian "tidak ada OCR" dan "CAPTCHA ditampilkan ke user" sudah TIDAK
berlaku. Sejak 2026-11-19 server menyelesaikan CAPTCHA sendiri lewat OCR. Lihat
blok status di atas.

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
- `app/modules/auth.py`: login menyelesaikan CAPTCHA lewat OCR (tanpa endpoint tantangan)
  (`ubsi_captcha_siakad`, `ubsi_captcha_elearning`). `/v1/auth/login` dan
  `/v1/auth/credentials` mengirim cookie yang sesuai saat mengonsumsi tantangan.
- `landing-page/src/app/login/AuthPortal.tsx`: CAPTCHA dimuat saat NIM mencapai
  8 digit dengan nilai input terbaru, bukan menunggu blur atau login gagal.
- `landing-page/src/components/LockedSiakadCard.tsx`: alur "Hubungkan SIAKAD"
  memuat CAPTCHA SIAKAD dari OCR (host `siakad`, NIM dari
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

Insiden: user tidak bisa absen. Sesi MyBest mati setelah idle (cookie kampus 45 menit sliding),
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
3. Backend menyelesaikan CAPTCHA kampus (`app/captcha_autosolver.py`):
   ambil tantangan baru dari `captcha_relay`, baca dengan ddddocr
   (~20 ms; tesseract hanya cadangan bila ddddocr tidak terpasang), lalu
   pakai kode itu langsung pada POST login asli. Kode kampus sekali pakai,
   jadi tidak ada probe validasi: satu kode untuk satu percobaan.
4. Penolakan berulang: server mengulang dengan tantangan baru sampai
   `MAX_CAPTCHA_ATTEMPTS` (3). Perulangan berhenti lebih awal bila alasan
   kampus bukan lagi `captcha` (password salah atau throttle). Bila semua
   percobaan gagal, endpoint membalas 401 `CAPTCHA_INVALID` tanpa gambar:
   user cukup menekan Masuk lagi.
5. `/v1/auth/credentials` (hubungkan SIAKAD) memakai alur OCR yang sama.
6. Frontend: `AuthPortal.tsx` tidak menampilkan CAPTCHA sama sekali; form
   hanya berisi NIM, password MyBest, dan persetujuan.

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
| `CAPTCHA_INVALID` | `error.message` | OCR gagal 3 tantangan berurutan; ulangi login |

### Verifikasi

`tests/test_mira_captcha.py` (create/verify/sekali pakai/salah),
`tests/test_captcha_autosolver.py` (kandidat valid, retry tantangan,
throttle, probe SIAKAD), dan pembaruan kontrak di `tests/conftest.py`
(stub offline Mira + auto-solve untuk seluruh suite). Suite backend
501 passed; build frontend lolos.

## SIAKAD dimatikan (2026-11-18)

Sejak saklar `SIAKAD_ENABLED=false`, CAPTCHA SIAKAD tidak pernah diminta Mira:
login hanya memakai MyBest, dan auto-solve CAPTCHA SIAKAD tidak dipanggil.
Endpoint `/v1/auth/forgot-password` untuk
`system=siakad`, dan `/v1/auth/credentials` membalas `503 SIAKAD_DISABLED` dengan
`error.cta_url`. Nilai akhir, KHS, dan KRS dibaca user langsung di
`students.bsi.ac.id`. Kontrak lengkap: `docs/api.md` seksi
`GET /v1/capabilities`, desain: `docs/specs/2026-11-18-siakad-disable-design.md`.

## CAPTCHA kampus sekali pakai: auto-solve tanpa probe (2026-11-18, lanjutan)

Terukur di produksi: satu kode CAPTCHA MyBest hanya berlaku untuk **satu POST**
login. Probe validasi (password dummy) memvalidasi kode, tetapi POST login asli
dengan kode yang sama selalu ditolak `Kode keamanan salah`, sehingga user
melihat `CAPTCHA_INVALID` walau OCR benar.

Perbaikan: `app/captcha_autosolver.py` tidak lagi memprobe. Ia hanya mengambil
tantangan baru (`candidate_session`) lalu mengembalikan kandidat OCR teratas.
`POST /v1/auth/login` mencoba kandidat itu langsung pada login asli dengan
password user; bila kampus membalas alasan `captcha`, server mengambil
tantangan baru dan mencoba lagi (maksimal 3 percobaan), lalu jatuh ke fallback
`CAPTCHA_INVALID` bila semuanya gagal. Password salah
langsung berhenti di percobaan pertama (alasan `credentials`), jadi tidak ada
POST berulang tanpa guna.

## CAPTCHA Mira dihapus + re-login latar pakai OCR (2026-11-18, final)

Keputusan user: CAPTCHA milik Mira dihapus. Form login memakai CAPTCHA MyBest
otomatis lewat OCR (ddddocr) dengan tantangan baru per percobaan.
`POST /v1/auth/mira-captcha`, modul `app/mira_captcha.py`, dan seluruh tesnya
dihapus.

Sesi MyBest mati setelah idle (cookie kampus 45 menit **sliding**). Sebelumnya re-login latar selalu gagal
karena butuh CAPTCHA (`AUTH_CAPTCHA_REQUIRED` pada absen/tugas). Sekarang
`ElearningClient._ocr_login()` menyelesaikan CAPTCHA itu dengan OCR: satu
tantangan baru per percobaan (kode sekali pakai), maksimal 3 percobaan, berhenti
segera bila kampus menolak tanpa pesan atau mengembalikan alasan selain captcha.
Login user di form web tetap manual supaya hasilnya deterministik.
