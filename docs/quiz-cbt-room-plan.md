# Mira Dedicated Quiz CBT Room & Anti-Cheat Proctoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghadirkan Ruang Ujian Dedicated CBT (`/dashboard/kuis/room`) di Mira untuk pengerjaan kuis resmi MyBest dengan auto-save instan, sistem proctoring anti-curang standar MyBest (fullscreen, tab tracking, warning banners, copy block), dan mode tryout simulasi mandiri dengan pengacakan soal dan skor instan.

**Architecture:** Rute CBT terisolasi (`/dashboard/kuis/room`) yang dapat dibuka via Popup Window peramban (`window.open`) atau Fullscreen Tab. Didukung hook proctoring terpusat `useExamProctoring`, buffer persistensi `localStorage`, modul sinkronisasi asinkron ke endpoint `/v1/elearning/quiz/answer`, serta generator soal acak mandiri untuk mode simulasi offline.

**Tech Stack:** FastAPI (Python 3.12+), Next.js 15 (App Router, React 19, TypeScript), Tailwind CSS, Lucide Icons, LocalStorage API, HTML Fullscreen API.

**Spec:** `docs/quiz-cbt-room-design.md`

## Global Constraints

- **Zero Secrets**: Tidak ada hardcoded credentials atau token rahasia di kode frontend maupun backend.
- **Offline TDD**: Semua unit test backend di `tests/` wajib 100% offline tanpa kontak live ke `*.bsi.ac.id`.
- **Frontend Design**: Token Fluid Currents Light, tanpa em-dash (`—`), tanpa icon emoji (gunakan Lucide SVG), mobile floor 360px.
- **MyBest Consistency**: Tidak ada force-kick otomatis destruktif; gunakan warning banner saat keluar layar/pindah tab dan auto-save per nomor.

## Review Focus

1. **Popup Window Dimensions & Fallback**: Jika popup diblokir oleh peramban atau layar sempit (<768px), sistem otomatis fallback membuka di tab yang sama tanpa crash.
2. **Offline LocalStorage Resilience**: Jika koneksi putus saat kuis live berjalan, jawaban tetap tersimpan di `localStorage` dan di-retry saat koneksi pulih.
3. **Mobile Fullscreen Graceful Degradation**: Pada iOS Safari yang tidak mendukung `requestFullscreen` pada elemen non-video, antarmuka mengunci viewport penuh tanpa melempar runtime exception.
4. **Timer Synchronization**: Timer countdown berhenti saat kuis selesai atau waktu habis, dan memicu modal penutupan ujian secara otomatis.
5. **Score Calculation in Simulation Mode**: Kalkulasi skor simulasi (0-100) tepat membandingkan kunci jawaban tanpa terpengaruh urutan pengacakan opsi pilihan ganda.

---

### Task 1: Backend Verification & Endpoint Hardening for Quiz Auto-Save

**Files:**
- Modify: `app/modules/elearning.py:2550-2575`
- Test: `tests/test_elearning_router.py`

**Interfaces:**
- Consumes: `QuizAnswerPayload` (id_soal, data_jawab, csrf_token)
- Produces: `POST /v1/elearning/quiz/answer` returning `{ success: True, id_soal, data_jawab, message }`

- [ ] **Step 1: Write tests for quiz questions & answer endpoints**

```python
# tests/test_elearning_router.py
def test_quiz_answer_submission_flow(client, auth_headers):
    payload = {"id_soal": "501", "data_jawab": "501_B", "csrf_token": "mock_csrf_exam_token_456"}
    res = client.post("/v1/elearning/quiz/answer", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["data"]["success"] is True
```

- [ ] **Step 2: Run test to verify behavior**

Run: `.venv/bin/pytest tests/test_elearning_router.py -k "quiz" -v`
Expected: PASS (mengonfirmasi router kuis sudah siap menampung auto-save dari room frontend).

- [ ] **Step 3: Pastikan response envelope konsisten**

Pastikan error response dan success response memenuhi schema standar envelope Mira.

- [ ] **Step 4: Commit**

```bash
git add app/modules/elearning.py tests/test_elearning_router.py
git commit -m "test(elearning): verify quiz questions and answer submission endpoints"
```

---

### Task 2: Quiz Simulation Bank & Engine

**Files:**
- Create: `landing-page/src/data/quiz-simulation.ts`
- Test: `landing-page/src/data/__tests__/quiz-simulation.test.ts` (atau verifikasi type-check)

**Interfaces:**
- Consumes: None
- Produces: `SimulationQuestion`, `generateSimulationQuiz(count?: number): SimulationQuizPackage`, `evaluateSimulationScore(answers: Record<string, string>, questions: SimulationQuestion[]): SimulationResult`

- [ ] **Step 1: Definisikan type data dan bank soal simulasi**

Buat data 25-30 butir soal pilihan ganda standar mata kuliah semester 1 UBSI (Dasar Pemrograman, PTIK, Logika & Algoritma, Jaringan Komputer, Basis Data).

```typescript
export interface SimulationOption {
  key: "A" | "B" | "C" | "D" | "E";
  text: string;
}

export interface SimulationQuestion {
  id: string;
  no: number;
  pertanyaan: string;
  opsi: SimulationOption[];
  kunci_jawaban: "A" | "B" | "C" | "D" | "E";
  pembahasan?: string;
}

export interface SimulationQuizPackage {
  id: string;
  judul: string;
  durasi_menit: number;
  total_soal: number;
  daftar_soal: SimulationQuestion[];
}

export interface SimulationResult {
  total_soal: number;
  terjawab: number;
  benar: number;
  salah: number;
  skor: number; // 0 - 100
}
```

- [ ] **Step 2: Implementasikan pengacakan soal (*Fisher-Yates shuffle*) & fungsi evaluasi skor**

Fungsi `generateSimulationQuiz(count = 20)` mengacak urutan soal dan opsi, serta `evaluateSimulationScore` untuk mencocokkan jawaban user dengan kunci.

- [ ] **Step 3: Verifikasi build & tipe data**

Run: `cd landing-page && npx tsc --noEmit`
Expected: PASS tanpa error tipe.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/data/quiz-simulation.ts
git commit -m "feat(kuis): add simulation question bank and evaluation engine"
```

---

### Task 3: Proctoring Shield Hook (`useExamProctoring`)

**Files:**
- Create: `landing-page/src/hooks/useExamProctoring.ts`

**Interfaces:**
- Consumes: Window/Document events (`fullscreenchange`, `visibilitychange`, `blur`, `contextmenu`, `keydown`)
- Produces: `{ isFullscreen, strikes, warningMessage, requestEnterFullscreen, clearWarning, isScreenLocked }`

- [ ] **Step 1: Implementasikan hook pelindung ujian `useExamProctoring`**

- Deteksi `fullscreenchange`: mencatat ketika user keluar dari fullscreen.
- Deteksi `visibilitychange`: jika `document.hidden`, tambahkan strike dan tampilkan peringatan ("Anda terdeteksi berpindah tab atau meminimalkan layar ujian").
- Deteksi `contextmenu`: `e.preventDefault()` dengan toast peringatan.
- Deteksi `keydown`: cegah `F12`, `Ctrl+C`, `Ctrl+U`, `Ctrl+S`, `Ctrl+P`.
- Graceful degradation: cek apakah `document.documentElement.requestFullscreen` tersedia (fallback jika ditolak Safari iOS).

- [ ] **Step 2: Verifikasi tipe data hook**

Run: `cd landing-page && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add landing-page/src/hooks/useExamProctoring.ts
git commit -m "feat(kuis): implement useExamProctoring hook for fullscreen and tab tracking"
```

---

### Task 4: CBT Components (Navbar Timer, Question Card, Nav Grid)

**Files:**
- Create: `landing-page/src/components/quiz/CbtNavbar.tsx`
- Create: `landing-page/src/components/quiz/CbtQuestionGrid.tsx`
- Create: `landing-page/src/components/quiz/CbtQuestionView.tsx`
- Create: `landing-page/src/components/quiz/CbtViolationModal.tsx`
- Create: `landing-page/src/components/quiz/CbtFinishModal.tsx`

**Interfaces:**
- `CbtNavbar`: Menampilkan judul kuis, nama/NIM mahasiswa, countdown timer, indikator koneksi/auto-save status, dan tombol toggle fullscreen.
- `CbtQuestionGrid`: Grid nomor 1..N dengan status warna (biru = terjawab, kuning = ragu-ragu, abu-abu = belum).
- `CbtQuestionView`: Menampilkan teks soal, opsi radio A..E dengan klik responsif, tombol navigasi (*Sebelumnya*, *Ragu-ragu*, *Selanjutnya*, *Selesaikan*).
- `CbtViolationModal`: Modal peringatan non-destruktif saat keluar fullscreen atau pindah tab dengan tombol *"Kembali ke Ujian"*.
- `CbtFinishModal`: Modal konfirmasi rekapitulasi jumlah soal yang sudah dan belum dijawab sebelum submit final.

- [ ] **Step 1: Buat masing-masing komponen dengan styling antislop Fluid Currents**
- [ ] **Step 2: Pastikan WCAG AAA dan tap target minimum 44px**
- [ ] **Step 3: Verifikasi tipe data**

Run: `cd landing-page && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/components/quiz/
git commit -m "feat(kuis): add CBT room UI components with fluid currents styling"
```

---

### Task 5: Dedicated Quiz CBT Room Page (`/dashboard/kuis/room`)

**Files:**
- Create: `landing-page/src/app/dashboard/kuis/room/page.tsx`
- Create: `landing-page/src/app/dashboard/kuis/room/layout.tsx` (layout mandiri tanpa dashboard sidebar)

**Interfaces:**
- Consumes: Query params `mode` (`live` | `simulasi`), `token`, `paket`
- Integrates: `useExamProctoring`, `CbtNavbar`, `CbtQuestionGrid`, `CbtQuestionView`, `CbtViolationModal`, `CbtFinishModal`, `apiFetch`

- [ ] **Step 1: Buat custom layout untuk `/dashboard/kuis/room`**

Buat `layout.tsx` khusus yang me-render children tanpa membungkus sidebar dashboard, sehingga menguasai layar penuh secara bersih.

- [ ] **Step 2: Implementasikan alur kuis pada `room/page.tsx`**

- Fetch data: jika `mode=live`, panggil `/v1/elearning/quiz/questions?token_ujian=...`. Jika `mode=simulasi`, panggil `generateSimulationQuiz()`.
- State jawaban: simpan ke state React dan `localStorage` (`mira_quiz_progress_{id}`).
- Handler auto-save: jika mode live, panggil `POST /v1/elearning/quiz/answer` di background tiap opsi diklik.
- Handler submit final: jika mode live, panggil konfirmasi selesaikan kuis; jika mode simulasi, evaluasi skor dan tampilkan rekapitulasi nilai instan.

- [ ] **Step 3: Test Next.js build**

Run: `cd landing-page && ./node_modules/.bin/next build`
Expected: Compiled successfully dengan rute `/dashboard/kuis/room` terdaftar.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/app/dashboard/kuis/room/
git commit -m "feat(kuis): create dedicated CBT exam room page with dual-mode support"
```

---

### Task 6: Launcher Integration on Kuis Dashboard

**Files:**
- Modify: `landing-page/src/app/dashboard/kuis/page.tsx`

**Interfaces:**
- Adds:
  - Tombol *"Mulai Kuis (CBT Room)"* pada kartu kuis yang aktif: opsi Popup Window (`window.open`) atau Fullscreen Tab.
  - Kartu *"Simulasi Kuis Mandiri (Tryout)"* di bagian atas/bawah halaman kuis agar mahasiswa dapat latihan kapan saja.

- [ ] **Step 1: Tambahkan tombol aksi CBT di kartu kuis aktif**

Buat helper fungsi untuk membuka CBT room:
```typescript
function openCbtRoom(mode: "live" | "simulasi", token?: string, title?: string, isPopup = true) {
  const url = `/dashboard/kuis/room?mode=${mode}${token ? `&token=${encodeURIComponent(token)}` : ""}${title ? `&paket=${encodeURIComponent(title)}` : ""}`;
  if (isPopup && typeof window !== "undefined") {
    const width = 1200;
    const height = 800;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    const win = window.open(url, "_blank", `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`);
    if (win) return;
  }
  window.open(url, "_blank");
}
```

- [ ] **Step 2: Tambahkan banner/kartu simulasi tryout interaktif**

Tombol *"Mulai Simulasi Tryout"* yang langsung meluncurkan ruang kuis simulasi acak.

- [ ] **Step 3: Test Next.js build**

Run: `cd landing-page && ./node_modules/.bin/next build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add landing-page/src/app/dashboard/kuis/page.tsx
git commit -m "feat(kuis): integrate CBT room launcher and simulation card into kuis dashboard"
```

---

### Task 7: End-to-End Verification & Documentation Update

**Files:**
- Modify: `docs/api.md` (tambahkan panduan integrasi CBT room)
- Modify: `AGENT.md` (perbarui catatan arsitektur kuis)

- [ ] **Step 1: Jalankan pytest test suite offline**

Run: `.venv/bin/pytest -q`
Expected: 445+ tests PASS 100%.

- [ ] **Step 2: Jalankan Next.js production build**

Run: `cd landing-page && npm run build`
Expected: Compiled successfully.

- [ ] **Step 3: Sinkronisasi knowledge graph**

Run: `graphify update .`
Expected: Graph updated.

- [ ] **Step 4: Commit**

```bash
git add docs/ AGENT.md
git commit -m "docs(kuis): update documentation for dedicated CBT exam room and simulation mode"
```
