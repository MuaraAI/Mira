# Anti-Ban & Account Safety Protocol

This document explains the technical mechanisms implemented to ensure student campus accounts are never flagged, rate-limited, or suspended by university network monitoring systems.

---

## 1. The Core Principles

University security systems and Web Application Firewalls (WAF) monitor for abnormal traffic behavior. Mira mimics authentic human browsing patterns using five protective layers:

---

## 2. Protective Mechanisms

### A. In-Memory Session Cookie Re-Use
- **Problem**: Traditional automation scripts submit login credentials (POST to `/login`) on every request. Submitting 30 logins in 5 minutes is an immediate red flag.
- **Solution**: The `StudentV2Client` and `ElearningClient` maintain an in-memory session. Once authenticated, subsequent queries use the existing session cookie.
- **Auto Re-Login**: A fresh login request is dispatched **only** when the server explicitly redirects back to `/login` due to cookie expiration.

### B. Tiered Cache Expirations (TTL)
Academic data changes infrequently. Caching is tuned to the natural update cycles of each data source:

| Data Type | Cache TTL | Rationale |
|---|---|---|
| **Schedules & KRS** | 2 Hours (7200s) | Changes only at the start of a semester |
| **Semester Grades** | 30 Minutes (1800s) | Updates only during midterm/final grading periods |
| **Assignments & Quizzes** | 10 Minutes (600s) | Checked periodically during study sessions |
| **Announcements & News** | 15 Minutes (900s) | Updated several times per week |
| **Library Catalog** | 1 Hour (3600s) | Book metadata is static |

### C. Browser TLS Impersonation via Scrapling
- **Problem**: Python `requests` or `urllib` send default TLS signatures and HTTP/1.1 headers that are trivially detected and blocked by modern firewalls.
- **Solution**: Scrapling utilizes `curl_cffi` configured with `impersonate="chrome"`.
- **Result**: Cipher suites, TLS extensions, ALPN, and HTTP/2 framing match genuine Google Chrome desktop browsers identically.

### D. Single-Flight Concurrency Control
Incoming requests from multiple background worker processes for the same course or schedule are serialized through an in-memory mutex. Campus infrastructure never receives concurrent requests for the same student data.

### E. Human Pacing (Jitter)
Multi-page crawler operations introduce random delays of 0.8–1.5 seconds between requests, mirroring natural human reading speed.

### F. Cooldown Login Saat Captcha / HTTP 429
- **Konteks**: Sejak pertengahan November 2026 form login `students.bsi.ac.id` mewajibkan CAPTCHA gambar (`name="captcha"`), dan `elearning.bsi.ac.id` (MyBest) memakai puzzle geser yang menghasilkan `captcha_token`. Tanpa verifikasi yang benar, login selalu ditolak dan berakhir kembali di halaman `/login`.
- **Masalah**: Worker notifikasi berjalan tiap 10 menit untuk setiap NIM dan setiap kategori. Jika login selalu gagal, pola ini menghasilkan ratusan POST `/login` per jam hingga kampus membalas **HTTP 429** untuk seluruh IP server, sehingga user yang sesinya masih hidup ikut gagal.
- **Solusi** (`app/upstream_session.py`):
  - Login gagal karena CAPTCHA -> cooldown 60 detik untuk NIM tersebut (`AUTH_CAPTCHA_REQUIRED`; sejak PR #182 dipendekkan dari 20 menit agar absen user tidak terkunci).
  - Login gagal karena kredensial -> cooldown 10 menit (`AUTH_FAILED`).
  - Respons HTTP 429 -> cooldown 5 menit untuk seluruh host, mengikuti header `Retry-After` bila ada (`UPSTREAM_THROTTLED`).
  - Cooldown hanya menggerbang **percobaan login baru**; request dengan sesi yang masih valid tetap berjalan.
  - Worker notifikasi melewati NIM yang sedang cooldown tanpa mencetak traceback.

### G. Auto-Solve CAPTCHA Kampus (2026-11-18, MyBest diperbarui 2026-11-20)
- Form login tidak lagi meminta kode CAPTCHA ke user: server menyelesaikannya sendiri dengan tantangan baru per percobaan, maksimal 3. Sesi kampus sliding 45 menit dan hanya satu sesi aktif per akun, jadi login ulang dilakukan reaktif saat kampus membalas halaman login, bukan proaktif berbasis umur.
- **SIAKAD**: CAPTCHA gambar dibaca OCR (`app/captcha_autosolver.py` + `app/captcha_relay.py`), satu kode per POST, berhenti saat kampus menolak tanpa pesan.
- **MyBest (2026-11-20)**: kampus mengganti CAPTCHA teks-gambar dengan puzzle geser. `app/elearning_captcha.py` memuat `/reload-captcha`, mencari posisi kepingan dengan template matching OpenCV (masked, sepanjang band baris `y`), mengirim `POST /verify-captcha {x, trail}`, lalu memakai token hasilnya sebagai `captcha_token` pada POST login. Token terikat cookie sesi pembuatnya, jadi tantangan baru dibuat untuk setiap percobaan. `ElearningClient._puzzle_login` menjalankan alurnya saat sesi kampus mati.
- Worker notifikasi tetap default-deny: CAPTCHA gambar tidak pernah ditebak, tanpa jawaban relay tidak ada POST ke kampus.
- Anti-bot form login: rate limit 10/menit/IP + login guard 10/menit/IP + limit per NIM 5/menit.

### H. SIAKAD Opsional (2026-11-19)
Saklar `SIAKAD_ENABLED` kini `true` di produksi (sejak 2026-11-19). Login tetap **MyBest-only**: SIAKAD tidak disentuh sampai user menautkannya di Sesi & Keamanan dengan password SIAKAD-nya sendiri. Password SIAKAD **tidak diwarisi** dari MyBest, karena menebak dengan password yang sama menambah login gagal dan bisa mengunci akun SIAKAD. Saat saklar dimatikan, seluruh lalu lintas ke `students.bsi.ac.id` kembali diblokir dengan `503 SIAKAD_DISABLED`.
