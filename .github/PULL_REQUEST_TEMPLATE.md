## Ringkasan Perubahan
<!-- Jelaskan secara singkat apa yang diubah dan mengapa -->

## Jenis Perubahan
- [ ] `feat`: Fitur baru
- [ ] `fix`: Perbaikan bug / parser kampus
- [ ] `docs`: Pembaruan dokumentasi
- [ ] `refactor`: Perbaikan struktur kode tanpa mengubah perilaku
- [ ] `chore` / `perf` / `test`: Pemeliharaan, performa, atau pengujian

## Checklist Wajib Kontributor
- [ ] Saya adalah **Anggota Muara AI** dan **mahasiswa aktif UBSI** (sesuai [CONTRIBUTING.md](CONTRIBUTING.md)).
- [ ] PR ini dibuat dari **branch baru** (bukan direct push ke `main`) dengan judul **Conventional Commits**.
- [ ] **Zero Secrets & Dummy Data**: Tidak ada `.env`, NIM/password/email asli, cookie sesi, atau API key yang ikut ter-commit.
- [ ] **Offline TDD**: Seluruh test lulus 100% offline (`.venv/bin/pytest -q`) dan tidak melakukan live hit ke `*.bsi.ac.id`.
- [ ] *(Jika menyentuh `landing-page/`)* `npm run build` lulus tanpa error, bebas em-dash/CDN font/emoji dekoratif, dan aman di viewport 360px.
- [ ] *(Jika menyentuh skema Social)* Jalur SQLite (`app/social/db.py`), Postgres (`_PG_EXTRA_TABLES` / `_ADDED_COLUMNS`), dan migration `supabase/migrations/` sudah sinkron.
- [ ] Dokumentasi terkait (`README.md`, `AGENT.md`, `docs/*.md`) ikut diperbarui jika ada perubahan perilaku/endpoint/skema.

## Bukti Pengujian
<!-- Tempel ringkasan hasil pytest / npm run build / screenshot UI jika relevan -->
