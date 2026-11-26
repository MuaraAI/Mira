# Architecture

Mira is structured as a single-process FastAPI application designed for high resilience, low memory footprint (~60–80 MB RAM), and non-invasive upstream querying.

---

## 1. Request Lifecycle

```text
Client Request
      │
      ▼
┌──────────────────────────────────────────────┐
│ Rate Limiter (Redis Sliding Window)          │
│ • Max 60 requests/minute per client IP       │
│ • Fail-open: Passes requests if Redis down   │
└──────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────┐
│ Route Handler & Input Validation             │
│ • Modular Credential Check (Option B)        │
└──────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────┐
│ Cache Manager (Redis DB 2)                   │
│                                              │
│ [1] Check Fresh Cache (TTL 10m - 2h)         │
│     ├── HIT  ──► Return {"cached": true}     │
│     └── MISS ──► Acquire Single-Flight Mutex │
└──────────────────────────────────────────────┘
      │ (Lock Acquired)
      ▼
┌──────────────────────────────────────────────┐
│ Scrapling Client Module                      │
│ • Re-use in-memory session cookie            │
│ • Chrome desktop TLS fingerprint (curl_cffi) │
│ • Auto-detect /login redirect & re-login 1x  │
│ • Pure HTML/JSON Parser                      │
└──────────────────────────────────────────────┘
      │
      ├── SUCCESS ──► Save to Redis:
      │               • Fresh Cache (with TTL)
      │               • Last-Known-Good (no TTL)
      │               Return {"cached": false}
      │
      └── UPSTREAM FAILURE ──► Read Last-Known-Good:
                               ├── LGG Found ──► Return {"cached": true, "stale": true}
                               └── No LGG    ──► Return 502 Bad Gateway
```

---

## 2. Two-Tier Caching Strategy

Scraping university websites is inherently susceptible to server timeouts, seasonal maintenance, and maintenance down-times. Mira mitigates this using a **two-tier cache**:

1. **Fresh Cache (`{key}:fresh`)**:
   - Stored with an explicit expiration (TTL).
   - Serves immediate responses without touching university servers.
2. **Last-Known-Good Cache (`{key}:lgg`)**:
   - Stored without an expiration date.
   - Updates every time a successful fetch occurs.
   - Acts as a safety net: if campus servers time out or fail, the API serves the most recent valid payload marked with `"stale": true` instead of failing with 500/502.

---

## 3. Single-Flight Mutex

To prevent the "thundering herd" problem where multiple simultaneous requests hit university servers at once:
- Each unique cache key possesses an in-process `asyncio.Lock()`.
- The first request executes the network scrape.
- Subsequent requests wait for the lock to release and consume the newly cached data.
- University servers receive at most **1 concurrent request** per resource.

---

## 4. Key Hashing Algorithm

All cache keys are generated deterministically using SHA-256 truncation:
```python
key_hash = hashlib.sha256(f"{module}:{path}:{sorted_params}".encode()).hexdigest()[:16]
full_key = f"ubsi:{module}:{key_hash}"
```
This isolates cache namespaces across modules and query parameters.

---

## 5. Session Pool & Parallel Aggregation

### A. Per-NIM Session Isolation (`app/session_pool.py`)
To prevent concurrent requests from different student credentials from overwriting each other's session cookies:
- The scraper client wraps instances inside `SessionPool`.
- Each unique NIM maintains its own independent authenticated HTTP client.
- Idle sessions are automatically evicted after 10 minutes (`ttl_seconds=600`, LRU cap `max_sessions=150`) to conserve VPS RAM.
- Expired sessions trigger immediate invalidation so subsequent calls trigger a clean re-login.
- Active campus cookies are persisted in Redis (`app/campus_session_store.py`) and restored reactively on expiry via `app/upstream_session.py` (with login cooldowns on CAPTCHA/HTTP 429).

### B. Canonical Account Links
- **Canonical SIAKAD Links (`app/account_links.py`)**: Per-NIM SIAKAD credentials are stored in SQLite (`account_links`, encrypted with Fernet) so students do not have to re-link across sessions or devices; Personal API Keys and background workers read directly from this canonical store. When the campus portal rejects a stored SIAKAD password, the link is marked `needs_relink` and SIAKAD endpoints return `409 SIAKAD_RELINK_REQUIRED`.

### C. Parallel Dashboard Endpoint (`/v1/studentv2/dashboard` & `/v1/elearning/dashboard`)
Retrieves 4 critical academic sections (`schedule`, `grades`, `news`, `announcements`) concurrently using `asyncio.gather(..., return_exceptions=True)`:
- Total response latency equals the single slowest upstream section rather than the sum of all 4.
- Sections with valid cached payloads are served immediately without hitting upstream servers.
- A failure in one section (e.g. news maintenance) is isolated and does not fail the remaining sections.

---

## 6. Multi-Channel Webhook Broadcaster (`app/modules/news.py`)

Mira includes an automated background watcher for new campus publications:
- **Background Worker (`lifespan`)**: Non-blocking async loop checking upstream WordPress REST API every 10 minutes (`NEWS_WEBHOOK_INTERVAL`).
- **Cold-Start Protection**: First run seeds current post IDs into Redis (`ubsi:news:seen_ids`, TTL 30 days) to prevent spamming notifications on reboot.
- **Parallel Multi-Channel Delivery**:
  - **Discord Webhook**: Rich Embeds formatted with Teal (`#2DD4BF`), article banner image, and clickable links.
  - **Telegram Bot API**: HTML-escaped messages sent via `sendPhoto` with automatic fallback to `sendMessage`.
  - **Custom Webhook**: Generic JSON payload `{"event": "news.published", "data": {...}}`.
- **Fault-Tolerant & Retry**: Dispatches via `asyncio.gather(*tasks, return_exceptions=True)`. Posts are only marked as seen if delivery succeeds, retrying automatically on the next cycle if upstream or network fails.

---

## 7. Repository Layout

```text
UBSI-API/ (Repo: MuaraAI/Mira)
├── app/
│   ├── modules/
│   │   ├── auth.py            # Auth: Login MyBest-only, session, keys, credentials, password, forgot-password
│   │   ├── capabilities.py    # Public feature flags (`GET /v1/capabilities`)
│   │   ├── studentv2.py       # SIAKAD: Profil akademik, Jadwal, Nilai, KHS/KHS-semester, KRS+cetak, UTS/UAS, Dashboard
│   │   ├── elearning.py       # MyBest: Courses, Schedule, Absensi, Tugas, Materi, Kuis CBT, TOEFL, Ujian, Rekap Nilai
│   │   ├── elibrary.py        # Perpus: OPAC search, Book detail, 60s retry
│   │   ├── news.py            # Portal: Native WP REST API & Multi-channel Webhook Broadcaster
│   │   ├── repository.py      # EPrints: Recent publications & search
│   │   ├── ejournal.py        # OJS: 23 Journal catalog with real titles
│   │   ├── academic_events.py # Kalender kegiatan akademik publik (`staffv2.bsi.ac.id`)
│   │   ├── lecturers.py       # Jadwal mengajar dosen per kode inisial
│   │   ├── channels.py        # Channels: Webhook notification CRUD & testing
│   │   ├── pwa_push.py        # PWA Web Push: VAPID key, subscribe/unsubscribe, devices, categories
│   │   ├── social.py          # Komunitas: router HTTP tipis + SSE stream (/v1/social)
│   │   ├── links.py           # Pemeriksa keamanan tautan tugas/materi
│   │   └── stats.py           # Analitik penggunaan anonim (/v1/stats)
│   ├── social/                # Komunitas: chat ala Discord (ruang + channel) + Telegram (DM)
│   │   ├── db.py              # Dual-driver schema: Supabase Postgres (prod) + SQLite fallback (dev/test)
│   │   ├── service.py         # Aturan akses, validasi, query; kembalikan Outcome + Event
│   │   ├── events.py          # Fan-out realtime Redis pub/sub per pengguna (fail-open)
│   │   └── media.py           # Upload & serving avatar/banner komunitas (`data/social_media/`)
│   ├── account_links.py       # Store kanonis tautan kredensial SIAKAD per NIM (SQLite, Fernet)
│   ├── api_keys_db.py         # Personal API Keys (`muara_mira_*` / legacy `muara_ubsi_*`), BLAKE2b + Fernet
│   ├── cache.py               # Redis 2-tier cache (fresh + LGG) & single-flight mutex
│   ├── campus_session_store.py# Persistensi cookie sesi kampus di Redis
│   ├── captcha_autosolver.py  # OCR CAPTCHA gambar SIAKAD (ddddocr utama, tesseract fallback)
│   ├── captcha_relay.py       # Helper tantangan sesi CAPTCHA per percobaan
│   ├── elearning_captcha.py   # Solver puzzle geser MyBest 2026 (OpenCV template matching + /verify-captcha)
│   ├── channels_db.py         # SQLite WAL persistence for webhook channels (Fernet encrypted at rest)
│   ├── channel_validation.py  # Anti-SSRF and payload validation for webhooks
│   ├── config.py              # Pydantic Settings, tiered TTLs, feature & maintenance flags
│   ├── deps.py                # Session/API key/account_links credential injection & header overrides
│   ├── envelope.py            # Clean Minimalist JSON envelope
│   ├── limiter.py             # Sliding window rate limiter (60 req/min)
│   ├── login_guard.py         # Login & forgot-password guard (10/min/IP, escalating blacklist, daily logs)
│   ├── maintenance.py         # Maintenance mode gate (503 MAINTENANCE + NIM whitelist)
│   ├── mcp_server.py          # MCP Server (42 tools `mira_*`, Streamable HTTP port 8350)
│   ├── notifier.py            # Scheduled academic notification & reminder worker
│   ├── password_change.py     # Ganti password kampus + deteksi password default
│   ├── password_reset.py      # Reset password kampus via email + validasi NIM-email (HMAC)
│   ├── pwa_push_db.py         # SQLite store for PWA Web Push subscriptions & preferences
│   ├── pwa_webpush.py         # RFC 8291 VAPID Web Push dispatcher & maintenance broadcast
│   ├── retry.py               # Exponential backoff retry with jitter
│   ├── router_helper.py       # Helper generik cache, lock, & SWR
│   ├── session_pool.py        # Pool sesi per-NIM dengan idle TTL (10m) & LRU (150)
│   ├── session_store.py       # Redis session storage (AES-256-GCM, sliding 7 days TTL)
│   ├── stats.py               # Privacy-preserving usage metrics (HMAC-SHA256 NIM)
│   └── ubsi_catalog.py        # Katalog publik lokasi kampus, prodi & kode cabang resmi UBSI
│   ├── upstream_session.py    # Cooldown CAPTCHA/429 & reactive campus session recovery
│   └── main.py                # Base FastAPI app, CIDR proxy trust, & global middleware
├── landing-page/              # Next.js 15 App Router Frontend & Student PWA Dashboard
│   ├── public/fonts/          # Self-hosted woff2 fonts (Space Grotesk, Inter, JetBrains Mono, Pixelify Sans)
│   ├── src/app/               # Landing, /login, /dashboard/*, /recap, robots, sitemap
│   ├── src/components/        # Semi Pixel-Art Light UI components, CBT Room, Social, & dashboard layouts
│   └── src/lib/               # Client apiFetch wrapper, hooks, and session guards
├── supabase/                  # Cermin resmi SQL migrations Supabase Postgres (`Mira Social`)
├── tests/
│   ├── fixtures/              # Snapshot HTML offline anonim (sv2_*.html, el_*.html)
│   ├── conftest.py            # Fixture autouse & test auth client
│   └── test_*.py              # 677+ Automated offline unit & integration tests
├── templates/
│   ├── Caddyfile.example      # Caddy reverse proxy template (HTTPS auto)
│   ├── nginx.example.conf     # Nginx reverse proxy configuration template
│   └── cloudflared.example.yml# Cloudflare Tunnel ingress template
├── scripts/
│   ├── backfill_profile_stats.py # Deduplikasi & backfill aman cabang/prodi (/v1/stats)
│   ├── backup_db.sh           # 4x-daily SQLite backup (VPS + offsite Google Drive)
│   ├── deploy.sh              # 1-klik deploy ke VPS via rsync & PM2
│   ├── generate_vapid_keys.py # Generator VAPID keypair untuk PWA Web Push
│   └── smoke.py               # Live verification CLI tool (auth-aware)
├── skills/
│   ├── mira/SKILL.md          # Router Agent Skill utama
│   ├── mira-mcp/              # Playbook 42 MCP tools mira_* + references/tools.md
│   ├── mira-api/              # Integrasi REST API + references/endpoints.md
│   ├── mira-backend/          # Playbook kontributor FastAPI, scraper & dual-DB
│   └── mira-web/              # Playbook kontributor Next.js 15, desain & SEO
├── docs/
│   ├── api.md                 # Complete API dictionary & JSON payloads
│   ├── architecture.md        # Request lifecycle, session pool, and cache flow
│   ├── anti-ban.md            # Account security & safety protocols
│   ├── deploy.md              # VPS PM2 production operations
│   ├── mcp.md                 # MCP Server reference & 42 tool catalog
│   └── remote-access.md       # Caddy, Nginx, & Cloudflare Tunnel guide
├── ecosystem.config.cjs       # PM2 production config (`ubsi-api` + `ubsi-mcp`)
├── AGENT.md                   # Panduan operasional AI Agent & arsitektur sesi/database
├── CONTRIBUTING.md            # Syarat kontributor (Anggota Muara AI & mahasiswa aktif UBSI), wajib branch baru
├── SECURITY.md                # Kebijakan keamanan & enkripsi
├── PRIVACY.md                 # Kebijakan privasi & retensi data
├── DMCA.md                    # Kebijakan hak cipta & takedown notice
├── LICENSE                    # MIT License (c) 2026 Muara AI
└── requirements.txt           # Project dependencies
```
