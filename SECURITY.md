# Security Policy

## 1. Scope & Architecture

**Mira** (`MuaraAI/Mira`, formerly UBSI API) is an unofficial REST API aggregator, MCP server, and PWA student dashboard for Universitas Bina Sarana Informatika (UBSI) academic services.

- **Localhost Core & Authenticated Ingress**: The API server binds strictly to `127.0.0.1:8300` (and MCP server to `127.0.0.1:8350`). Remote access is exposed only through trusted reverse proxies (Caddy, Nginx) or Cloudflare Tunnel, guarded by authentication, `TRUSTED_PROXIES` CIDR validation, and rate limiting.
- **Per-NIM Multi-Tenant Isolation**: Each authenticated student session (`ubsi_session`), Personal API Key (`muara_mira_*` / legacy `muara_ubsi_*`), canonical SIAKAD link (`account_links`), and upstream campus scraper session (`SessionPool`, idle TTL 10 min, LRU max 150) is strictly isolated by NIM.

## 2. Credential Security & Encryption at Rest

- **Zero Hardcoded Secrets**: Master secret (`API_KEY`), VAPID keys, Supabase credentials, and environment configuration are loaded strictly from `.env` (mode `0600`) and excluded via `.gitignore`. Missing required secrets fail fast at startup.
- **Encrypted Session & Credential Storage**:
  - Dashboard sessions (`ubsi_session`) are stored in Redis with **AES-256-GCM** encryption (key derived via keyed BLAKE2b from `API_KEY`), 7-day sliding TTL, delivered via `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
  - Personal API Keys (`muara_mira_*` and legacy `muara_ubsi_*`) are hashed with keyed **BLAKE2b** (512-bit digest) and their associated credentials are encrypted with **Fernet** (keyed BLAKE2b KDF) in SQLite WAL (`0600`) and Redis cache.
  - Canonical per-NIM SIAKAD credentials (`account_links`) are stored encrypted with **Fernet** in SQLite (`data/ubsi.db`).
  - Notification webhook configurations (`webhook_channels`: Discord, Telegram, Custom HTTPS) are encrypted at rest with **Fernet** in SQLite (`0600`) and masked in dashboard responses.
- **Device-Bound Authorization (`account_devices`)**:
  - Browser devices are bound via an `HttpOnly` `mira_device` cookie (180 days). The first device for a NIM is automatically `trusted`; subsequent devices start as `pending` until approved by an existing trusted device, and idle approvals are revoked after 30 days.
  - `pending` devices can use MyBest, but all SIAKAD endpoints and persistent write paths (Personal API Key creation, PWA push subscriptions, webhook channels) return `403 SIAKAD_DEVICE_PENDING`.
- **Academic-Only Profile Allowlist**:
  - `studentv2.parse_profile` enforces a strict academic allowlist; sensitive personal data (birth place/date, address, phone, religion, gender, tuition status) is dropped by the parser and never cached or returned.

## 3. Server Safety, Anti-SSRF & Upstream Protection

- **Authentication & Brute-Force Defense**:
  - Constant-time master key comparison via `secrets.compare_digest()`.
  - Login & forgot-password guard (`app/login_guard.py`): max 10 attempts/minute per IP with escalating IP blacklists (15 min -> 1 hour -> 24 hours on repeat offenses), plus max 5 attempts/minute per NIM.
  - Password change endpoint rate-limited to 3 requests/minute per NIM.
  - Global sliding-window rate limiting (60 req/min per identity/IP) with `TRUSTED_PROXIES` CIDR matching to read real client IPs safely behind Cloudflare/Caddy.
- **SSRF & Open Redirect Defenses**:
  - Outbound webhooks, PWA push endpoints, and file downloads enforce HTTPS, hostname allowlists, and DNS/IP validation rejecting loopback, private, link-local, and cloud metadata addresses (`169.254.169.254`).
- **Upstream Etiquette**:
  - Two-tier Redis caching (Fresh + Last-Known-Good SWR), single-flight per-key mutexes, login cooldowns on CAPTCHA/HTTP 429 (`app/upstream_session.py`), and human-like request pacing protect campus upstream servers from burst load.

## 4. Reporting Vulnerabilities

If you discover a security vulnerability or credential exposure risk, please report it privately to the maintainers (`@Curzyori`, `@MyKineID`, `@Seeyaa77`) rather than opening a public issue.
