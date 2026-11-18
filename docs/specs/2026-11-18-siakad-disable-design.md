# Desain: Matikan SIAKAD lewat saklar, geser sumber data ke MyBest

Tanggal: 2026-11-18
Status: disetujui user 2026-11-18, diimplementasikan

## Intent

User memutuskan SIAKAD (students.bsi.ac.id) tidak lagi dipakai sebagai sumber data
di Mira: login cukup MyBest, akun SIAKAD tidak bisa dihubungkan dari Mira, dan
halaman yang butuh data SIAKAD menampilkan CTA ke situs kampus. Tujuannya
mengurangi kerumitan (dua portal, dua CAPTCHA, dua model sesi, dua sumber kebenaran)
sekaligus memusatkan pengembangan ke data MyBest yang lebih kaya.

## Goals

1. Mira berjalan penuh tanpa kredensial SIAKAD: **nol request** keluar ke students.bsi.ac.id,
   mencakup router studentv2, `/login`, `/credentials`, `/change-password`,
   `/v1/auth/captcha` (host siakad), `/v1/auth/forgot-password` (system siakad),
   `/v1/auth/verify` (target siakad), dan notifier.
2. Endpoint SIAKAD membalas `503 SIAKAD_DISABLED` dengan `error.cta_url`.
3. Frontend menampilkan kartu terkunci + CTA "Buka SIAKAD" untuk nilai, KHS, KRS, ujian, sertifikat.
4. Login hanya memakai password MyBest; CAPTCHA yang di-auto-solve hanya MyBest.
5. Menghidupkan lagi cukup `SIAKAD_ENABLED=true` + restart, **untuk API**. UI yang
   sudah dibuat MyBest-only adalah kondisi tetap; mengembalikan tampilan SIAKAD
   adalah perubahan frontend terpisah.

## Non-goals

- Tidak menghapus kode scraper SIAKAD (`app/modules/studentv2.py` tetap ada).
- Tidak mengubah data MyBest (courses, materi, tugas, presensi, kuis).
- Tidak menyentuh layanan lain: Ujian Online (`ujian_router`), perpustakaan, berita, repository, e-journal.
- Tidak membangun direktori dosen pengganti (lihat "keputusan saya").

## Anti-goals

- Gagal jika `SIAKAD_ENABLED=false` tapi masih ada request keluar ke SIAKAD.
- Gagal jika halaman terkunci menampilkan error mentah 503 tanpa CTA.
- Gagal jika menghidupkan flag (level API) membutuhkan perubahan kode.

## Constraints

- Test suite 100% offline; tanpa Redis/HTTP nyata.
- Redis produksi 6.0.16 (tanpa GETDEL) bila menyentuh cache.
- Deploy backend manual (rsync tanpa `--delete`, `.env` tidak diikutkan); frontend auto Vercel.
- Respons Bahasa Indonesia, tanpa emoji, layout aman sampai 360px.
- Dokumentasi (`docs/*.md`) diperbarui di PR yang sama.

## Kondisi saat ini (fakta)

- 15 endpoint SIAKAD, semuanya bergantung kredensial via `require_studentv2_creds`
  (`app/modules/studentv2.py:555-881`), termasuk `/schedule` yang punya fallback MyBest inline
  (`studentv2.py:562-586`).
- MyBest punya jadwal sendiri: `/v1/elearning/schedule` (`app/modules/elearning.py:1972`).
- Login sudah MyBest-first, SIAKAD opt-in (`landing-page/src/app/login/AuthPortal.tsx`, PR #183).
- Frontend memakai `/v1/studentv2/*` di 8 halaman: dashboard, jadwal, materi, presensi, nilai, krs, ujian, berita.
- `LockedSiakadCard` dipakai di 7 tempat (dashboard, jadwal, krs, nilai, sesi, ujian) dan memanggil
  `/v1/auth/captcha` + `/v1/auth/credentials`.
- `landing-page/src/lib/lecturers.ts:58` memakai `/v1/studentv2/lecturers` untuk memetakan kode dosen ke nama.
- `/v1/elearning/profile` hanya mengembalikan `nama` + `email` (`app/modules/elearning.py:789-799`).
- MCP mem-proxy 12 tool ke `/v1/studentv2/*` (`app/mcp_server.py:262-366`).

## Pendekatan

| # | Cara | Trade-off | Status |
|---|------|-----------|--------|
| A | Env flag + guard tunggal di level router | Satu titik kebenaran, request-time (mudah diuji dua kondisi), kode asli utuh | **Dipilih user** |
| B | Dependency guard per endpoint | Diff kecil, tapi mudah terlewat dan `/docs` menyesatkan | ditolak |
| C | Hapus modul + halaman | Codebase bersih, tapi diff besar dan revert = bikin ulang | ditolak |

## Keputusan user

1. Nilai akhir, KHS, KRS tetap ada di UI dengan status "butuh SIAKAD" berupa CTA keluar.
2. Login Mira hanya MyBest; tidak ada tombol "Hubungkan akun SIAKAD".
3. CTA membuka `https://students.bsi.ac.id`.
4. Mekanisme: saklar (varian A).

## Keputusan yang saya ambil (boleh dikoreksi)

- Guard tunggal: `require_siakad_enabled` dipasang sekali lewat
  `app.include_router(studentv2_router, dependencies=[Depends(require_siakad_enabled)])`.
  Guard membaca `settings.SIAKAD_ENABLED` **per request** (bukan saat import), jadi test bisa
  mem-monkeypatch settings tanpa memuat ulang aplikasi. Ini menggantikan rencana awal
  "router stub per path".
- `/v1/studentv2/schedule` ikut 503 (kontrak jujur: endpoint SIAKAD = mati). Frontend memakai
  `/v1/elearning/schedule` yang sudah ada.
- `/v1/auth/captcha` dengan `host=siakad`, `/v1/auth/forgot-password` dengan `system=siakad`,
  dan `/v1/auth/verify` dengan target siakad ikut membalas `503 SIAKAD_DISABLED`
  (goal 1: nol lalu lintas SIAKAD).
- `LoginRequest.studentv2_pass` tetap diterima (kompatibilitas klien), tetapi diabaikan saat flag
  mati: `systems.siakad` selalu `false`, tanpa verifikasi SIAKAD, tanpa auto-solve CAPTCHA SIAKAD,
  plus satu warning "SIAKAD dinonaktifkan".
- `/v1/auth/credentials` → `503 SIAKAD_DISABLED` + `cta_url` (tidak ada alur penghubung akun).
- `session_store.get_credentials_for_nim` dan `api_keys_db._sync_credentials_for_nim` dilonggarkan:
  kredensial MyBest saja dianggap cukup, sehingga `notifier.process_nim` tetap jalan
  (notifikasi kelas/presensi tidak boleh mati).
- Nama dosen: MyBest hanya memberi kode dosen. Tanpa `/v1/studentv2/lecturers`, label menampilkan
  kode (mis. "Dosen: AB") alih-alih nama lengkap. Tidak ada sumber pengganti yang dibangun sekarang.
- Profil: `nama` + `email` dari MyBest, `NIM` dari sesi. `prodi`, `kelas`, `semester_aktif`
  ditampilkan sebagai "—".
- `LockedSiakadCard` lama dihapus (7 call site) dan diganti `SiaKadLockedCard` yang hanya
  menampilkan penjelasan + CTA keluar, tanpa form password/CAPTCHA.

## Rancangan teknis

Backend:

1. `app/config.py`: `SIAKAD_ENABLED: bool = False`.
2. `app/deps.py`: `require_siakad_enabled()` → 503 `SIAKAD_DISABLED` + `cta_url` bila flag mati.
3. `app/main.py`: pasang guard pada `include_router(studentv2_router, ...)`; daftarkan
   `GET /v1/capabilities` di `public_paths` → `{"siakad": {"enabled": ..., "cta_url": ...}}`.
4. `app/modules/auth.py`: abaikan `studentv2_pass` saat flag mati; hentikan pemanggilan
   `solve_campus_captcha("siakad", nim)`; `_rejection_detail` tidak memuat host siakad.
5. `app/modules/elearning.py` / `app/captcha_relay.py`: `host=siakad` ditolak 503 saat flag mati.
6. `app/password_reset.py`: sistem siakad → 503.
7. `app/password_change.py`, `app/notifier.py`: lewati cabang SIAKAD; `notifier` tetap jalan dengan MyBest.
8. `app/session_store.py`, `app/api_keys_db.py`: izinkan sesi/API key dengan password SIAKAD kosong.
9. MCP tidak diubah: 503 dari API diteruskan apa adanya.

Frontend:

10. Hook `useCapabilities()` membaca `/v1/capabilities` (tanpa cache atau TTL 60 detik).
11. Halaman nilai, krs, ujian, sertifikat → `SiaKadLockedCard` (CTA keluar, `target="_blank" rel="noopener"`).
12. `dashboard`, `jadwal`, `materi`, `presensi` → pakai `/v1/elearning/schedule`; profil MyBest untuk nama/email.
13. `berita`: tetap memakai modul news; kalender/announcements/prodi-contacts disembunyikan.
14. `AuthPortal.tsx`: hapus baris opt-in SIAKAD, field password SIAKAD, state terkait, dan fallback CAPTCHA SIAKAD.
15. `lecturers.ts`: label jatuh ke kode dosen saat direktori tidak tersedia.
16. `landing-page/src/components/LockedSiakadCard.tsx` dihapus setelah semua call site pindah.

## Pengujian (offline)

- conftest: set `settings.SIAKAD_ENABLED=True` sebagai default test (menjaga 24+ test SIAKAD lama hijau),
  test mode-mati mem-monkeypatch `False`.
- `/v1/capabilities` → `enabled=false` + `cta_url` (dan `true` saat flag dinyalakan).
- Parameterized: tiap endpoint studentv2 → 503 + `code=="SIAKAD_DISABLED"` + `cta_url` saat flag mati.
- `/v1/auth/captcha` host siakad, `forgot-password` siakad, `/verify` siakad → 503 saat flag mati;
  MyBest tetap 200.
- Login dengan `studentv2_pass` terisi saat flag mati → 200, `systems.siakad == false`, warning ada,
  tanpa panggilan auto-solver SIAKAD.
- `/v1/auth/credentials` → 503.
- `change_password` target elearning 200; target siakad 503.
- Notifier: `process_nim` tetap mengirim notifikasi dengan kredensial MyBest saja.
- Suite penuh hijau; `npx tsc --noEmit` + `npm run build`.

## Rollout

1. Merge PR (backend + frontend).
2. Tambahkan `SIAKAD_ENABLED=false` di `.env` VPS, rsync, `pm2 restart ubsi-api`, `pm2 save`, update `RELEASE`.
3. Verifikasi produksi: `/v1/capabilities`, `/v1/studentv2/grades` (503 + cta),
   `/v1/elearning/schedule` (200), login MyBest sukses, log tanpa request students.bsi.ac.id.
4. Update `docs/api.md`, `docs/anti-ban.md`, `docs/login-captcha-recovery.md`.

## Yang diserahkan ke builder

- Struktur `SiaKadLockedCard` dan penempatannya di tiap halaman.
- Cara menyembunyikan menu sidebar untuk halaman yang terkunci.
- Teks kartu terkunci dan CTA.
- TTL cache `/v1/capabilities`.
