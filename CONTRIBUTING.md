# Panduan Kontribusi (Contributing)

Terima kasih atas minat Anda terhadap **Mira** (`MuaraAI/Mira`), platform akademik (Dashboard PWA, REST API, dan MCP Server) untuk layanan kampus Universitas Bina Sarana Informatika (UBSI).

## 1. Syarat Kontributor (WAJIB)

Kontribusi kode, dokumentasi, maupun pull request ke repositori ini **bersifat eksklusif** dan **hanya dibuka bagi**:

1. **Anggota resmi organisasi [Muara AI](https://github.com/MuaraAI)**, **DAN**
2. **Mahasiswa aktif Universitas Bina Sarana Informatika (UBSI)**.

Kontributor yang bukan merupakan anggota Muara AI atau tidak berstatus mahasiswa aktif UBSI tidak memenuhi syarat untuk mengajukan Pull Request.

---

## 2. Alur Git & Wajib Branch Baru

**Dilarang keras melakukan direct commit atau direct push ke branch `main`**, termasuk untuk perubahan kecil atau pembaruan dokumentasi. Setiap kontribusi **wajib menggunakan branch baru** dan melalui Pull Request:

1. **Sinkronkan branch `main` terbaru:**
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Buat branch baru** sesuai jenis perubahan:
   ```bash
   git checkout -b <type>/<deskripsi-singkat>
   # Contoh:
   # feat/elearning-toefl
   # fix/elearning-puzzle-captcha
   # docs/sync-api-reference
   ```
3. **Kerjakan perubahan & uji secara lokal** (pastikan seluruh test lulus).
4. **Commit dengan format Conventional Commits:**
   ```bash
   git add <file-terkait>
   git commit -m "<type>(<scope>): <pesan jelas dan ringkas>"
   # Contoh: fix(elearning): selesaikan puzzle captcha MyBest 2026
   ```
5. **Push branch baru ke remote:**
   ```bash
   git push -u origin <nama-branch>
   ```
6. **Buka Pull Request (PR) ke `main`** lewat GitHub atau `gh pr create`. Sertakan ringkasan perubahan, bukti pengujian, dan tunggu review/persetujuan maintainer sebelum merge.

---

## 3. Setup Lingkungan Pengembangan

Arsitektur proyek dan panduan lengkap tersedia di [README.md](README.md), [AGENT.md](AGENT.md), dan [docs/architecture.md](docs/architecture.md).

```bash
# Clone repositori
git clone https://github.com/MuaraAI/Mira.git
cd Mira

# Backend (FastAPI, Python 3.12+)
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8300 --reload

# Frontend (Next.js 15, di terminal terpisah)
cd landing-page
npm install
npm run dev
```

---

## 4. Aturan Kualitas & Pengujian (WAJIB)

Sebelum membuka Pull Request, pastikan semua aturan berikut terpenuhi:

- **Satu perubahan logis per PR**: gunakan judul Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `refactor(...)`).
- **Strict Offline TDD**: seluruh unit dan integration test di `tests/` **wajib 100% offline** (dilarang mengirim request HTTP langsung ke `*.bsi.ac.id` atau menyentuh Redis/Supabase produksi). Gunakan snapshot HTML anonim di `tests/fixtures/`.
- **Data Dummy Saja**: dilarang memakai NIM, password, email, atau token asli di dalam test, fixture, komentar, atau body PR. Gunakan nilai dummy (`12345678`, `password-dummy`, `test@example.com`).
- **Zero Secrets Rule**: jangan pernah men-stage atau meng-commit `.env`, API key, cookie sesi, atau kredensial apa pun. Periksa `git status` dan `git diff --cached` sebelum push.
- **Zero Internal Planning Docs di Git**: jangan pernah meng-commit dokumen planning/design/spec internal atau catatan debug agen (`docs/specs/`, `docs/superpowers/`, `docs/prd/`, `docs/releases/`, `docs/*-plan.md`, `docs/*-design.md`). Folder `docs/` hanya untuk dokumentasi resmi produk.
- **Skema Ganda Social (SQLite + Supabase Postgres)**: setiap perubahan tabel/kolom fitur komunitas (`app/social/db.py`) wajib memperbarui jalur SQLite, jalur Postgres (`_PG_EXTRA_TABLES` / `_ADDED_COLUMNS`), dan menambahkan migration baru di `supabase/migrations/` (lihat [supabase/README.md](supabase/README.md)).
- **Dokumentasi Ikut Kode**: perubahan endpoint, perilaku auth, atau skema wajib memperbarui dokumen terkait (`README.md`, `AGENT.md`, `docs/*.md`) di PR yang sama.
- **Verification Gate**:
  ```bash
  # Backend (677+ offline tests harus lulus 100%)
  .venv/bin/pytest -q

  # Frontend (jika mengubah folder landing-page/)
  cd landing-page && npm run build
  ```

---

## 5. Keamanan & Hak Cipta

- **Kerentanan Keamanan**: jangan buka public issue untuk celah keamanan atau kebocoran kredensial. Laporkan secara privat sesuai [SECURITY.md](SECURITY.md).
- **Kode Etik**: seluruh anggota wajib mematuhi [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- **Hak Cipta & DMCA**: seluruh merek, materi, dan aset portal kampus adalah milik Universitas Bina Sarana Informatika. Lihat [DMCA.md](DMCA.md).

## Lisensi

Dengan berkontribusi, Anda menyetujui bahwa kontribusi Anda dilisensikan di bawah [MIT License](LICENSE).
