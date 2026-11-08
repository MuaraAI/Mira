# Design Spec: Mira Dedicated Quiz CBT Room & Anti-Cheat Proctoring

**Tanggal:** 2026-11-08  
**Status:** Draf Perancangan  
**Target Rilis:** Mira v3.1.0  
**Penulis:** Tim Muara AI & Coding Agent  

---

## 1. Latar Belakang & Tujuan (Why & Intent)

Mahasiswa UBSI sebelumnya harus mengerjakan kuis mingguan dan ujian online langsung di portal web MyBest LMS (`elearning.bsi.ac.id`), yang sering mengalami masalah responsivitas di peramban seluler, layout yang kaku, dan minimnya fitur latihan simulasi mandiri.

Fitur ini menghadirkan **Ruang Ujian Dedicated CBT (`/dashboard/kuis/room`)** di dalam Mira:
1. Mahasiswa dapat mengerjakan kuis resmi MyBest langsung dari Mira dengan sinkronisasi jawaban instan (*auto-save* per opsi diklik).
2. Mematuhi standar integritas akademik kampus dengan menerapkan sistem *proctoring shield* (anti-curang) yang setara dengan sistem ujian kampus: *fullscreen lock*, deteksi pindah tab / kehilangan fokus, batas pelanggaran bertingkat (*strike count*), serta pemblokiran klik kanan dan pintasan salin teks.
3. Menyediakan mode **Simulasi Ujian Mandiri (Tryout)** berbasis bank soal acak yang berjalan luring (*offline*) di peramban, memungkinkan mahasiswa menguji kesiapan sebelum menghadapi kuis resmi tanpa menyentuh server kampus.

---

## 2. Sasaran (Goals, Non-Goals, Anti-Goals)

### Goals
- **Dedicated CBT Interface**: Halaman terisolasi tanpa sidebar dashboard utama untuk fokus maksimal, mendukung mode Popup peramban (`window.open` dimensi CBT 1200x800) maupun Fullscreen langsung.
- **Proctoring & Guardrail (Mengikuti Standar Asli MyBest)**:
  - Mode fokus layar penuh (Fullscreen) dengan tombol masuk/keluar yang jelas. Pada seluler, menggunakan *Full-Window Viewport Lock*.
  - Notifikasi peringatan saat pindah tab atau keluar dari layar ujian (*Warning Banner/Toast*), tanpa membatalkan atau membekukan sesi mahasiswa secara sepihak.
  - Mematikan seleksi teks (`user-select: none`) dan menu klik kanan (`contextmenu.preventDefault()`) untuk mencegah kecurangan santai.
  - Peringatan pada tombol pintasan inspeksi/copy (`Ctrl+C`, `Ctrl+U`, `F12`).
  - Menghindari *force-kick* atau *auto-submit* paksa agar mahasiswa tidak dirugikan saat ada notifikasi sistem, telepon masuk, atau gangguan koneksi sesaat.
- **Scope Soal**:
  - v3.1.0 berfokus 100% pada Pilihan Ganda (PG 1..N dengan opsi A..E). Soal essay dikecualikan karena kuis mingguan MyBest murni PG.
- **Live MyBest Sync & Finalize**:
  - Mengambil daftar soal, timer, dan CSRF token melalui `GET /v1/elearning/quiz/questions`.
  - Otomatis menyimpan jawaban ke backend kampus melalui `POST /v1/elearning/quiz/answer` tiap kali opsi radio dipilih.
  - Saat waktu habis atau mahasiswa menekan *Selesaikan Kuis*, sistem mengirim sinyal penutupan ke MyBest (`/selesai`) dan menampilkan ringkasan selesai.
- **Offline Simulation Mode (Tryout)**:
  - Bank soal latihan acak (30+ bank soal TIK, algoritma, basis data, jaringan, dan dasar pemrograman).
  - Timer countdown mandiri, status nomor soal terjawab/ragu-ragu/belum.
  - Rekap skor otomatis di akhir pengerjaan (jumlah benar, salah, dan nilai akhir 0-100).
- **Aksesibilitas & Standar UI**:
  - Responsif hingga lebar 360px.
  - Desain token Fluid Currents Light (bebas em-dash, tanpa ikon emoji).

### Non-Goals
- Tidak melakukan bypass bot detection server kampus untuk scraping kuis yang belum dibuka jadwalnya.
- Tidak menyuntikkan script jawaban otomatis ke halaman kampus eksternal (Mira bertindak sebagai klien mandiri).

### Anti-Goals
- Dilarang menyimpan atau membocorkan jawaban ujian antar user di server publik.
- Dilarang membuat sistem kuis yang kehilangan jawaban mahasiswa saat jaringan terputus sesaat (*offline-resilient buffer* wajib ada di localStorage).

---

## 3. Pendekatan Arsitektur (Approaches Considered)

### Pendekatan 1: Dedicated Exam Room (`/dashboard/kuis/room`) — *DIPILIH*
Membuat rute khusus `/dashboard/kuis/room` yang lepas dari layout standar dashboard (tidak ada sidebar atau topbar navigasi umum).
* **Kelebihan**:
  - State kuis terisolasi, tidak ada risiko unmount/re-render akibat navigasi sidebar.
  - Mudah dibuka baik sebagai jendela popup (`window.open`) maupun tab fullscreen penuh.
  - Proctoring shield bersih karena menguasai seluruh viewport peramban.
* **Trade-off**: Membutuhkan satu halaman rute baru dan komponen shell mandiri.

### Pendekatan 2: In-Page Fullscreen Modal di Halaman `/dashboard/kuis`
Menjalankan kuis di dalam modal layer penuh (`fixed inset-0 z-50`) langsung di halaman daftar kuis.
* **Alasan Ditolak**:
  - Tidak mendukung mode Popup jendela mandiri secara bersih (harus render dashboard dulu baru popup).
  - Kompleksitas kode di `kuis/page.tsx` menjadi sangat tinggi dan berisiko mengalami kebocoran memori/state.

---

## 4. Rincian Teknis & Alur Komponen

### A. Rute & Shell Halaman (`landing-page/src/app/dashboard/kuis/room/page.tsx`)
* Membaca query params:
  - `?mode=live&token=...` untuk kuis resmi MyBest.
  - `?mode=simulasi&paket=...` untuk kuis simulasi tryout.
* Layout:
  1. **Top Navbar CBT**: Nama paket kuis, identitas mahasiswa, dan Countdown Timer (`HH : MM : SS`).
  2. **Aside (Kiri)**: Grid nomor soal (PG 1..N dan Essay jika ada) dengan 3 status warna:
     - Hijau/Biru Arus (`#1980D4`): Sudah Dijawab.
     - Kuning Amber (`#EAB308`): Ragu-ragu.
     - Abu-abu (`#F1F5F9`): Belum Dijawab.
  3. **Main Content (Kanan)**:
     - Header nomor soal aktif (*Soal No. X dari N*).
     - Teks pertanyaan kuis.
     - Opsi pilihan ganda (*A..E*) dengan feedback visual saat dipilih.
     - Tombol navigasi: *Sebelumnya*, *Ragu-ragu*, *Selanjutnya*, dan *Selesaikan Kuis*.
  4. **Proctoring Overlay & Modal Peringatan**:
     - *Start Modal*: Persetujuan masuk mode layar penuh sebelum soal ditampilkan.
     - *Violation Modal*: Muncul jika melanggar layar penuh atau pindah tab (Pelanggaran X dari 3).
     - *Confirm Finish Modal*: Menampilkan ringkasan jumlah soal yang sudah dan belum dijawab sebelum submit final.

### B. Proctoring Shield Hook (`useExamProctoring`)
Menangani event listener:
* `fullscreenchange`: mencatat saat `!document.fullscreenElement` ketika kuis sudah berstatus aktif.
* `visibilitychange`: mencatat saat `document.hidden`.
* `blur`: mendeteksi saat fokus peramban berpindah ke jendela aplikasi luar.
* `contextmenu`: `e.preventDefault()` untuk mematikan klik kanan.
* `keydown`: mencegat tombol `F12`, `Ctrl+C`, `Ctrl+U`, `Ctrl+S`, `Ctrl+P`.
* Counter pelanggaran tersimpan di state lokal dan `sessionStorage`.

### C. Auto-Save & State Persistence
* Setiap pilihan jawaban disimpan ke `localStorage` (`mira_quiz_progress_{id}`) agar jawaban tidak hilang jika peramban tidak sengaja ter-reload.
* Untuk kuis live, memanggil `apiFetch('/v1/elearning/quiz/answer', { method: 'POST', body: ... })` secara asinkron tanpa memblokir navigasi antar-soal.

### D. Bank Soal Mode Simulasi (`landing-page/src/data/quiz-simulation.ts`)
* Berisi 30+ bank soal umum perkuliahan Informatika & TIK UBSI (Logika & Algoritma, Jaringan Komputer, PTIK, Dasar Pemrograman, Basis Data).
* Sistem mengacak (*shuffle*) 15-20 butir soal tiap kali sesi simulasi baru dimulai.

---

## 5. Rencana Pengujian & Verifikasi

1. **Unit & Integration Test (Backend)**:
   - Pengujian `fetch_quiz_questions` dan `submit_quiz_answer` tetap 100% lulus di suite pytest offline.
2. **Frontend Build & Typescript Check**:
   - `npm run build` di direktori `landing-page/` lulus tanpa peringatan atau error tipe data.
3. **Smoke Test Peramban (Simulasi & Proctoring)**:
   - Masuk mode fullscreen saat tombol *Mulai Ujian* ditekan.
   - Peringatan pelanggaran terpicu saat menekan `ESC` atau memindahkan tab.
   - Jawaban tersimpan di state saat berpindah nomor soal.
   - Mode simulasi menghitung skor akhir secara akurat.
