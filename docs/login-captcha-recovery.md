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
