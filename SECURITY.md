# Security Policy (v2.5)

## 1. Scope & Architecture

UBSI API (`MuaraAI/Mira`) is an unofficial REST API aggregator, MCP server, and PWA student dashboard for Universitas Bina Sarana Informatika academic services.

- **Localhost Core & Authenticated Ingress**: The API server binds strictly to `127.0.0.1:8300` (and MCP server to `127.0.0.1:8350`). Remote access is exposed only through trusted reverse proxies (Caddy, Nginx) or Cloudflare Tunnel, guarded by authentication and rate limiting.
- **Per-NIM Multi-Tenant Isolation**: Each authenticated student session (`ubsi_session`), Personal API Key (`muara_mira_*`), and upstream campus scraper session (`SessionPool` + credential hash verification) is strictly isolated by NIM.

## 2. Credential Security & Encryption at Rest

- **Zero Hardcoded Secrets**: Master secret (`API_KEY`), VAPID keys, and environment configuration are loaded strictly from `.env` (mode `0600`) and excluded via `.gitignore`.
- **Encrypted Session & Key Storage**:
  - Dashboard sessions (`ubsi_session`) are stored in Redis with Fernet (AES-128-CBC + HMAC-SHA256) encryption derived via HKDF-SHA256 from `API_KEY`.
  - Personal API Keys (`muara_mira_*`) are hashed with keyed BLAKE2b (`person=b"mira-key-v1"`) and their associated campus credentials are encrypted with HKDF-derived Fernet keys in SQLite (`0600`) and Redis cache.
  - Notification webhook configurations (Discord, Telegram, Custom HTTPS) are encrypted at rest in SQLite (`0600`).

## 3. Server Safety, Anti-SSRF & Upstream Protection

- **Authentication & Brute-Force Defense**:
  - Constant-time master key comparison via `secrets.compare_digest()`.
  - Sliding-window rate limiting on `/v1/auth/login` (5 attempts / 5 min per IP and per NIM) and on failed authentication attempts (20 / min per IP).
  - Global rate limiting (60 req/min per identity/IP) and strict write-operation rate limiting (5 req/min for presence, assignments, quiz answers, discussions, and webhook tests).
- **SSRF & Open Redirect Defenses**:
  - Outbound webhooks, PWA push endpoints, and file downloads enforce HTTPS, hostname allowlists, and DNS/IP validation rejecting loopback, private, link-local, and cloud metadata addresses (`169.254.169.254`).
- **Upstream Etiquette**:
  - Two-tier Redis caching (Fresh + Last-Known-Good SWR), single-flight per-key mutexes, and human-like request pacing protect campus upstream servers from burst load.

## 4. Reporting Vulnerabilities

If you discover a security vulnerability or credential exposure risk, please report it privately to the maintainers (`@Curzyori`, `@MyKineID`, `@Seeyaa77`) rather than opening a public issue.
