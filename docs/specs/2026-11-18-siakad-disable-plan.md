# Matikan SIAKAD lewat saklar: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mira berhenti memakai SIAKAD saat `SIAKAD_ENABLED=false`, dengan CTA ke situs kampus dan nol request ke students.bsi.ac.id; MyBest menjadi satu-satunya sumber data.

**Architecture:** Satu guard FastAPI (`require_siakad_enabled`) yang dipasang lewat `include_router(..., dependencies=[...])` dan membaca `settings.SIAKAD_ENABLED` per request, plus endpoint kapabilitas publik. Frontend membaca kapabilitas itu dan mengganti halaman SIAKAD dengan kartu CTA, sementara halaman lain pindah ke endpoint MyBest.

**Tech Stack:** FastAPI, Pydantic Settings, pytest + httpx ASGITransport (offline), Next.js 15 App Router, TypeScript.

**Spec:** `docs/specs/2026-11-18-siakad-disable-design.md`

## Global Constraints

- `SIAKAD_ENABLED: bool = False` di `app/config.py`; `SIAKAD_CTA_URL: str = "https://students.bsi.ac.id"`.
- Kode error: `SIAKAD_DISABLED`; status `503`; payload memuat `error.cta_url`.
- Semua test offline: tanpa Redis/HTTP nyata; Redis 6.0.16 (tanpa GETDEL).
- Suite penuh wajib hijau sebelum tiap commit akhir: `.venv/bin/pytest -q`.
- Frontend: `cd landing-page && npx tsc --noEmit` dan `npm run build` wajib lolos.
- Copy UI Bahasa Indonesia, tanpa emoji, aman di 360px, `rel="noopener noreferrer"` untuk tautan keluar.
- Docs dan `.env.example` diperbarui di PR yang sama; deploy backend manual, frontend via Vercel.
- Jangan menyentuh `app/modules/studentv2.py`; kode scraper tetap utuh.

## Review Focus

- Login pengguna lama yang masih mengirim `studentv2_pass`: harus sukses dengan `systems.siakad=false` dan satu warning, bukan 422/500.
- Sesi tersimpan dengan `studentv2_pass` kosong: resolver kredensial latar harus tetap mengembalikan tuple supaya notifikasi kelas/presensi berjalan.
- Endpoint SIAKAD tanpa sesi: harus 503 `SIAKAD_DISABLED` sebelum dependency kredensial berbunyi, bukan 401 `AUTH_FAILED`.
- `/v1/capabilities` harus publik; kalau ikut digerbangi API key, frontend tidak bisa tahu status sebelum login.
- Flag dinyalakan kembali: semua endpoint SIAKAD dan auth-adjacent kembali 200/berfungsi tanpa perubahan kode.

---

### Task 1: Flag, guard, dan endpoint kapabilitas

**Files:**
- Modify: `app/config.py` (tambah dua field setelah `CAMPUS_DEFAULT_PASSWORDS`)
- Modify: `app/envelope.py:22-37` (`error_response` menerima `extra`)
- Modify: `app/deps.py` (fungsi baru di akhir file)
- Create: `app/modules/capabilities.py`
- Modify: `app/main.py:165` (guard) dan `app/main.py:213-222` (`public_paths`)
- Modify: `tests/conftest.py` (default flag `True` untuk test lama)
- Test: `tests/test_siakad_toggle.py`

**Interfaces:**
- Consumes: `settings` dari `app.config`, `error_response` dari `app.envelope`.
- Produces:
  - `error_response(code: str, message: str, module: Optional[str] = None, extra: Optional[dict] = None) -> dict[str, Any]` (`extra` di-merge ke `error`).
  - `require_siakad_enabled() -> None` di `app/deps.py`: raise `HTTPException(503, detail=error_response("SIAKAD_DISABLED", ..., extra={"cta_url": settings.SIAKAD_CTA_URL}))` bila flag mati.
  - `app.modules.capabilities.router` dengan `GET /v1/capabilities` → `{"siakad": {"enabled": bool, "cta_url": str}}`.

- [ ] **Step 1: Tulis test yang gagal**

```python
# tests/test_siakad_toggle.py
def test_error_response_merges_extra():
    from app.envelope import error_response
    body = error_response("SIAKAD_DISABLED", "mati", module="auth", extra={"cta_url": "https://students.bsi.ac.id"})
    assert body["error"]["cta_url"] == "https://students.bsi.ac.id"
    assert body["error"]["code"] == "SIAKAD_DISABLED"

def test_test_suite_defaults_to_siakad_enabled():
    from app.config import settings
    assert settings.SIAKAD_ENABLED is True  # dari fixture conftest, bukan default produksi

@pytest.mark.asyncio
async def test_capabilities_reports_disabled(monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"_skip_auto_auth": "1"}) as ac:
        res = await ac.get("/v1/capabilities")
    assert res.status_code == 200
    assert res.json()["data"]["siakad"] == {"enabled": False, "cta_url": "https://students.bsi.ac.id"}

@pytest.mark.asyncio
async def test_capabilities_reports_enabled(monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", True)
    ...  # GET tanpa header apa pun; assert data["siakad"]["enabled"] is True
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `.venv/bin/pytest -q tests/test_siakad_toggle.py`
Expected: FAIL (`ImportError: app.modules.capabilities`, atau `TypeError: error_response() got an unexpected keyword argument 'extra'`).

- [ ] **Step 3: Implementasi**

`app/envelope.py`: tambah parameter `extra: Optional[dict] = None`; bila ada, `err_obj.update(extra)`.
`app/config.py`: `SIAKAD_ENABLED: bool = False`, `SIAKAD_CTA_URL: str = "https://students.bsi.ac.id"`.
`app/deps.py`: `require_siakad_enabled()` seperti Interfaces.
`app/modules/capabilities.py`: router `APIRouter(prefix="/v1", tags=["Capabilities"])`, endpoint mengembalikan `success_response(data={"siakad": {...}})`.
`app/main.py`: `app.include_router(capabilities_router)`; `app.include_router(studentv2_router, dependencies=[Depends(require_siakad_enabled)])`; tambah `"/v1/capabilities"` ke `public_paths`.
`tests/conftest.py`: autouse fixture menyetel `settings.SIAKAD_ENABLED = True` supaya 24+ test SIAKAD lama tetap hijau; test mode-mati mem-monkeypatch `False` di badan test.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `.venv/bin/pytest -q tests/test_siakad_toggle.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/config.py app/envelope.py app/deps.py app/modules/capabilities.py app/main.py tests/conftest.py tests/test_siakad_toggle.py
git commit -m "feat(siakad): tambah flag SIAKAD_ENABLED, guard, dan endpoint kapabilitas"
```

---

### Task 2: Gerbang router SIAKAD dan pengecualian auth-adjacent

**Files:**
- Modify: `app/main.py` (urutan middleware vs router tidak berubah; guard sudah terpasang di Task 1)
- Modify: `app/modules/auth.py:252-300` (`/captcha`), `:1010+` (`/forgot-password`), `:119-176` (`/verify`)
- Test: `tests/test_siakad_toggle.py`

**Interfaces:**
- Consumes: `require_siakad_enabled`, `settings.SIAKAD_ENABLED`, `settings.SIAKAD_CTA_URL`.
- Produces: tidak ada API baru; perilaku 503 untuk `host="siakad"`, `system="siakad"`, dan `/verify` dengan `studentv2_pass` terisi.

- [ ] **Step 1: Tulis test yang gagal**

```python
SIAKAD_PATHS = [
    "/v1/studentv2/schedule", "/v1/studentv2/grades", "/v1/studentv2/news",
    "/v1/studentv2/announcements", "/v1/studentv2/dashboard", "/v1/studentv2/profile",
    "/v1/studentv2/khs", "/v1/studentv2/krs", "/v1/studentv2/krs/print",
    "/v1/studentv2/uts", "/v1/studentv2/uas", "/v1/studentv2/calendar",
    "/v1/studentv2/prodi-contacts", "/v1/studentv2/certificates", "/v1/studentv2/lecturers",
]

@pytest.mark.asyncio
@pytest.mark.parametrize("path", SIAKAD_PATHS)
async def test_siakad_paths_return_503_when_disabled(path, monkeypatch):
    monkeypatch.setattr("app.config.settings.SIAKAD_ENABLED", False)
    ...  # GET path, assert 503, error.code == "SIAKAD_DISABLED", error.cta_url endswith "students.bsi.ac.id"

@pytest.mark.asyncio
async def test_captcha_siakad_disabled_but_elearning_ok(monkeypatch):
    ...  # POST /v1/auth/captcha {"nim": ..., "host": "siakad"} -> 503 SIAKAD_DISABLED
         # POST host "elearning" -> bukan 503 SIAKAD_DISABLED (patch app.captcha_relay.create_challenge)

@pytest.mark.asyncio
async def test_forgot_password_siakad_disabled():
    ...  # POST {"nim":..., "email":"a@b.c", "system":"siakad"} -> 503 SIAKAD_DISABLED

@pytest.mark.asyncio
async def test_verify_siakad_target_disabled():
    ...  # Master Key header + {"nim":..., "elearning_pass":"x", "studentv2_pass":"y"} -> 503 SIAKAD_DISABLED
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `.venv/bin/pytest -q tests/test_siakad_toggle.py -k "siakad"`
Expected: FAIL (mayoritas masih 200/401/403).

- [ ] **Step 3: Implementasi**

Di `/captcha`: bila `req_body.host == "siakad"` dan flag mati → `raise HTTPException(503, detail=error_response("SIAKAD_DISABLED", ..., extra={"cta_url": ...}))` sebelum rate limit.
Di `/forgot-password`: guard yang sama untuk `body.system == "siakad"` sebelum `_guard_public_auth`.
Di `/verify`: bila `studentv2_pass` terisi dan flag mati → 503; `sv2_ok` dihapus dari hasil (hanya `elearning`), `valid` = `el_ok` saja.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `.venv/bin/pytest -q tests/test_siakad_toggle.py -k "siakad"`
Expected: PASS (20 test).

- [ ] **Step 5: Commit**

```bash
git add app/modules/auth.py tests/test_siakad_toggle.py
git commit -m "feat(siakad): gerbang router SIAKAD dan endpoint auth terkait"
```

---

### Task 3: Login, credentials, dan change-password saat flag mati

**Files:**
- Modify: `app/modules/auth.py:320-530` (`/login`), `:769-843` (`/credentials`), `:897+` (`/password`)
- Test: `tests/test_siakad_toggle.py`

**Interfaces:**
- Consumes: flag + guard dari Task 1-2.
- Produces: login mengembalikan `systems.siakad == False` dan `warnings == ["SIAKAD dinonaktifkan..."]`; `studentv2_pass` diabaikan.

- [ ] **Step 1: Tulis test yang gagal**

```python
@pytest.mark.asyncio
async def test_login_ignores_siakad_pass_when_disabled(monkeypatch):
    # flag False; mira captcha + autosolver distub (pola conftest); verify_live_credentials di-patch (False, True)
    ...  # POST login {"nim":..., "studentv2_pass":"apa-saja", "elearning_pass":"el", "mira_captcha": {...}}
         # assert 200; data["systems"] == {"siakad": False, "mybest": True}
         # assert any("SIAKAD dinonaktifkan" in w for w in data["warnings"])
         # assert mock solve_campus_captcha TIDAK dipanggil dengan "siakad"

@pytest.mark.asyncio
async def test_credentials_returns_503_when_disabled():
    ...  # login MyBest-only, lalu POST /v1/auth/credentials {"system":"siakad","password":"x"} -> 503 SIAKAD_DISABLED

@pytest.mark.asyncio
async def test_change_password_siakad_disabled_but_elearning_ok(monkeypatch):
    ...  # {"system":"siakad",...} -> 503 SIAKAD_DISABLED
         # {"system":"elearning",...} dengan patch password changer -> bukan 503
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `.venv/bin/pytest -q tests/test_siakad_toggle.py -k "login or credentials or change_password"`
Expected: FAIL.

- [ ] **Step 3: Implementasi**

`/login`: bila flag mati → `siakad_attempted = False`, `raw_sv_pass = ""`, lewati `solve_campus_captcha("siakad", nim)`, dan tambahkan warning "SIAKAD dinonaktifkan; nilai, KHS, dan KRS dibuka di students.bsi.ac.id.".
`/credentials`: guard di awal setelah rate limit → 503.
`/password`: bila `body.system == "siakad"` dan flag mati → 503 sebelum cek `stored`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `.venv/bin/pytest -q tests/test_siakad_toggle.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/modules/auth.py tests/test_siakad_toggle.py
git commit -m "feat(siakad): login abaikan kredensial SIAKAD, credentials dan ganti password digerbang"
```

---

### Task 4: Kredensial MyBest-only untuk notifier

**Files:**
- Modify: `app/session_store.py:160-169`
- Modify: `app/api_keys_db.py:245-251`
- Test: `tests/test_siakad_toggle.py`

**Interfaces:**
- Consumes: `settings.SIAKAD_ENABLED`.
- Produces: `get_credentials_for_nim(nim) -> Optional[tuple[str, str, str]]` tetap 3-tuple; `studentv2_pass` boleh `""` saat flag mati.

- [ ] **Step 1: Tulis test yang gagal**

```python
@pytest.mark.asyncio
async def test_session_store_returns_mybest_only_credentials(monkeypatch):
    # FakeRedis menyimpan sesi dengan studentv2_pass="" dan elearning_pass="el"
    ...  # assert await session_store.get_credentials_for_nim("12345678") == ("12345678", "", "el")

def test_api_keys_db_returns_mybest_only_credentials(monkeypatch, tmp_path):
    ...  # insert row terenkripsi dengan studentv2_pass kosong; assert tuple tidak None
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `.venv/bin/pytest -q tests/test_siakad_toggle.py -k "credentials"`
Expected: FAIL (`None` dikembalikan).

- [ ] **Step 3: Implementasi**

Ganti syarat `data.get("studentv2_pass") and data.get("elearning_pass")` menjadi syarat yang hanya menuntut `data.get("nim")` dan `data.get("elearning_pass")`; kembalikan `(nim, data.get("studentv2_pass") or "", elearning_pass)`. `notifier.process_nim` tidak diubah (memakai tuple yang sama).

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `.venv/bin/pytest -q tests/test_siakad_toggle.py -k "credentials" && .venv/bin/pytest -q tests/ -k "notifier"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/session_store.py app/api_keys_db.py tests/
git commit -m "feat(notifier): izinkan sesi MyBest-only untuk kredensial latar"
```

---

### Task 5: Frontend, kapabilitas + kartu CTA untuk halaman nilai/KRS/ujian

**Files:**
- Create: `landing-page/src/lib/capabilities.ts`
- Create: `landing-page/src/components/SiaKadLockedCard.tsx`
- Modify: `landing-page/src/app/dashboard/nilai/page.tsx:150-160,208,592,682`
- Modify: `landing-page/src/app/dashboard/krs/page.tsx:40,53`
- Modify: `landing-page/src/app/dashboard/ujian/page.tsx:96-97,193`
- Test: build (tidak ada test unit React di repo)

**Interfaces:**
- Produces:
  - `interface Capabilities { siakad: { enabled: boolean; cta_url: string } }`
  - `useCapabilities(): { data: Capabilities | null; loading: boolean }` (memakai `useApi<Capabilities>("/v1/capabilities", { persistMs: 60_000 })`)
  - `SiaKadLockedCard({ title?: string; description?: string })` merender penjelasan + `<a href={capabilities?.siakad.cta_url ?? "https://students.bsi.ac.id"} target="_blank" rel="noopener noreferrer">`.

- [ ] **Step 1: Implementasi hook dan komponen**

`capabilities.ts` mengekspor tipe + hook. `SiaKadLockedCard` memakai `px-card bg-white` seperti `LockedSiakadCard` lama, tanpa input apa pun.

- [ ] **Step 2: Ganti pemakaian di tiga halaman**

`nilai/page.tsx`: hapus `useApi` ke `/v1/studentv2/profile|krs|khs|grades`; tab KHS/KRS/nilai SIAKAD diganti `<SiaKadLockedCard title="Nilai akhir dan KHS ada di SIAKAD" ... />`; tab nilai MyBest (`/v1/elearning/grades`) tetap.
`krs/page.tsx`: seluruh isi diganti kartu; hapus `krs/print`.
`ujian/page.tsx`: blok UTS/UAS SIAKAD diganti kartu; jadwal ujian MyBest (`/v1/elearning/exams/uts`) tetap.

- [ ] **Step 3: Verifikasi tipe dan build**

Run: `cd landing-page && npx tsc --noEmit && npm run build`
Expected: lolos tanpa error.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/lib/capabilities.ts landing-page/src/components/SiaKadLockedCard.tsx landing-page/src/app/dashboard/nilai landing-page/src/app/dashboard/krs landing-page/src/app/dashboard/ujian
git commit -m "feat(web): kartu CTA SIAKAD untuk halaman nilai, KRS, dan ujian"
```

---

### Task 6: Frontend, pindahkan data ke MyBest dan hapus alur hubungkan SIAKAD

**Files:**
- Modify: `landing-page/src/app/dashboard/page.tsx:125-127,273`
- Modify: `landing-page/src/app/dashboard/jadwal/page.tsx:135,209,260`
- Modify: `landing-page/src/app/dashboard/materi/page.tsx:58`
- Modify: `landing-page/src/app/dashboard/presensi/page.tsx:175`
- Modify: `landing-page/src/app/dashboard/sesi/page.tsx:32,57`
- Modify: `landing-page/src/app/dashboard/berita/page.tsx:67-69`
- Modify: `landing-page/src/lib/lecturers.ts:57-75`
- Modify: `landing-page/src/app/login/AuthPortal.tsx` (hapus SIAKAD: state `skipSiakad`, `siakadPass`, field, chip, fallback captcha siakad)
- Delete: `landing-page/src/components/LockedSiakadCard.tsx`
- Test: build

**Interfaces:**
- Consumes: `useCapabilities`, `SiaKadLockedCard` (Task 5); `/v1/elearning/schedule`, `/v1/elearning/profile`, `/v1/elearning/courses`.
- Produces: tidak ada endpoint baru.

- [ ] **Step 1: Ganti sumber data**

`dashboard`: `profile` → `/v1/elearning/profile` (+ `me.nim`), `schedule` → `/v1/elearning/schedule`, blok KHS → `SiaKadLockedCard`.
`jadwal`: hapus `siakadApi` dan `connectOpen`; pakai `elearningApi` saja.
`materi`, `presensi`: kode dosen cadangan dari `/v1/elearning/schedule`.
`sesi`: profil dari `/v1/auth/me` + `/v1/elearning/profile`; tombol hubungkan SIAKAD dihapus.
`berita`: hapus `announcementsApi`, `calendarApi`, `contactsApi`; sisakan modul news.
`lecturers.ts`: bila `/v1/studentv2/lecturers` balas 503, `loadDirectory()` mengembalikan map kosong (tanpa error UI); pemanggil sudah menampilkan kode dosen.

- [ ] **Step 2: Bersihkan login dan hapus komponen lama**

`AuthPortal.tsx`: hapus seluruh state/JSX SIAKAD (baris opt-in, `PasswordField studentv2_pass`, tombol lewati, `effectiveSiakad`), payload kirim `studentv2_pass: ""`.
Setelah semua call site hilang, hapus `LockedSiakadCard.tsx` dan import-nya.

- [ ] **Step 3: Verifikasi tipe dan build**

Run: `cd landing-page && npx tsc --noEmit && npm run build`
Expected: lolos; `grep -rn "LockedSiakadCard\|/v1/studentv2" landing-page/src` kosong.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src
git commit -m "feat(web): dashboard sepenuhnya memakai data MyBest, alur SIAKAD dihapus"
```

---

### Task 7: Docs, env contoh, dan verifikasi rollout

**Files:**
- Modify: `docs/api.md` (capabilities + catatan 503), `docs/anti-ban.md` (bagian SIAKAD), `docs/login-captcha-recovery.md` (CAPTCHA SIAKAD tidak dipakai)
- Modify: `.env.example` (tambah `SIAKAD_ENABLED=false`, `SIAKAD_CTA_URL`)
- Modify: `docs/specs/2026-11-18-siakad-disable-design.md` (status → disetujui/implemented)

**Interfaces:** tidak ada.

- [ ] **Step 1: Update docs dan `.env.example`**

Sebutkan: endpoint SIAKAD balas `503 SIAKAD_DISABLED` + `cta_url`; `/v1/capabilities` publik; login mengabaikan `studentv2_pass`; cara menghidupkan kembali (set `SIAKAD_ENABLED=true`, restart).

- [ ] **Step 2: Jalankan suite penuh dan build**

Run: `.venv/bin/pytest -q && cd landing-page && npx tsc --noEmit && npm run build`
Expected: seluruh test lulus, build sukses.

- [ ] **Step 3: Commit**

```bash
git add docs .env.example
git commit -m "docs(siakad): dokumentasikan saklar SIAKAD_ENABLED dan kapabilitas"
```

---

### Task 8: Rollout produksi (butuh persetujuan user)

**Files:** tidak ada perubahan kode.

- [ ] **Step 1: Merge PR** (backend + frontend), tunggu Vercel deploy selesai.
- [ ] **Step 2: Set env VPS**

Tambahkan `SIAKAD_ENABLED=false` di `/opt/ubsi-api/.env` (jangan cetak nilai lain), rsync kode tanpa `--delete`, update `RELEASE`, `pm2 restart ubsi-api`, `pm2 save`.

- [ ] **Step 3: Verifikasi produksi**

```bash
curl -s https://<api>/v1/capabilities            # siakad.enabled == false
curl -s -o /dev/null -w '%{http_code}' https://<api>/v1/studentv2/grades   # 503
curl -s -o /dev/null -w '%{http_code}' https://<api>/v1/elearning/schedule # 200 dengan sesi
pm2 logs ubsi-api --lines 200 --nostream | grep -c "students.bsi.ac.id"    # 0 setelah restart
```
