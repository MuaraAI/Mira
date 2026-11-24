# Privacy Policy

**Effective date:** October 18, 2026 (Updated: November 24, 2026 - v3.5.0)
**Applies to:** Mira (`MuaraAI/Mira`, sebelumnya UBSI API), its hosted dashboard at `mira.muaraai.com` (redirect from `ubsi-api.muaraai.com`), and its API gateway at `api.muaraai.com`.

This project is an unofficial, community-built student tool. This policy explains, in plain terms, what data the service touches, where it lives, how it is protected, and how you can delete it.

## 1. Data We Process

| Data | Purpose | Where it lives |
| --- | --- | --- |
| NIM (student ID) | Identifying your session, trusted devices, and academic data | Redis (session), SQLite (`api_keys`, `account_links`, `account_devices`) |
| Campus passwords (MyBest, optional SIAKAD) | Authenticating you once at login, then reusing/refreshing the campus session | Redis (**AES-256-GCM encrypted** for session) & SQLite `account_links` (**Fernet encrypted** for canonical per-NIM SIAKAD link) |
| Trusted device metadata (`mira_device` cookie) | Protecting SIAKAD access and persistent writes when signing in from new browsers | SQLite `account_devices` (auto-revoked after 30 days of inactivity) + `HttpOnly` cookie (180 days) |
| Academic data (schedule, grades, KHS, KRS, exams, attendance, assignments, materials) | Displayed to you in the dashboard (SIAKAD profile uses an academic-only allowlist; sensitive personal info like address/phone/DOB is dropped) | Redis cache (transient, tiered TTL), never persisted to disk |
| Library / news / repository queries | Public campus data you request | Redis cache (transient) |
| Webhook channel config (Discord URL / Telegram token) | Sending you notifications you opted into | SQLite `webhook_channels`, **Fernet encrypted at rest** (masked in UI) |
| Personal API key metadata | Letting you build bots/scripts or connect MCP AI agents | SQLite `api_keys`, only a keyed BLAKE2b hash is stored (the raw key is shown once at creation) |
| Mira Komunitas (optional social profile, spaces, DMs, avatars) | Peer-to-peer student discussion & chat (public identity is `username`; NIM is never shown to other users) | Supabase Postgres (SQLite fallback in local dev) & local disk (`data/social_media/`) |

We do **not** collect: your real name for marketing, home address, phone number, birth date/place, religion, gender, tuition status, browsing history, or anything unrelated to the academic features above.

## 2. How Your Credentials Are Protected

- **AES-256-GCM & Fernet at rest**: Redis session payloads are encrypted with **AES-256-GCM** (key derived via keyed BLAKE2b from the server master key). Canonical SIAKAD links (`account_links`), Personal API Key credentials, and webhook configs (`webhook_channels`) in SQLite are encrypted with **Fernet** (keyed BLAKE2b KDF).
- **No plaintext anywhere**: Passwords are never written to disk in plaintext, logs, or responses. The dashboard never receives them back after login.
- **Hashed API keys**: Personal keys (`muara_mira_...` dan legacy `muara_ubsi_...`) are stored only as keyed BLAKE2b hashes. The full key is displayed exactly once, at creation.
- **Cookie hygiene & device approval**: The browser session (`ubsi_session`) and device identity (`mira_device`) use `HttpOnly`, `Secure`, `SameSite=Lax` cookies. JavaScript on the page cannot read them. New devices start as `pending` until approved by a trusted device.
- **Rate limiting**: Login is limited to 10 attempts per minute per IP (with escalating 15m/1h/24h blacklist) and 5 attempts per minute per NIM; the API is capped at 60 requests per minute per client.

## 3. What Happens in Your Browser

- The dashboard keeps a small in-memory cache (3 minutes) so switching pages is instant and does not hammer campus servers.
- Logging out (this device or all devices) clears that in-memory cache immediately, so the next person using the same browser cannot see your data.
- A fallback session token may be kept in your browser's `localStorage` for script usage; clearing your browser data or logging out removes it.

## 4. Third Parties

- **No analytics, no trackers, no ads, no telemetry.** The service phones home to nobody.
- The only outbound traffic goes to official UBSI campus portals (to fetch your own academic data) and to the notification channels **you** configured (Discord/Telegram/custom webhook).

## 5. Data Retention & Deletion

You control deletion directly from the dashboard:

- **Logout (this device)**: Deletes your session token from Redis instantly.
- **Logout all devices**: Deletes every session ever issued for your NIM.
- **Session expiry**: Sessions automatically expire after 7 days of inactivity (sliding window while active).
- **Cache**: Academic data in Redis is transient and expires by tier (10 minutes to 2 hours). It is never written to disk.
- **API keys**: Revoking a key deletes it from the database immediately.

Server operators may additionally purge `data/ubsi.db` and the Redis database at any time; both are rebuildable from a fresh login.

## 6. Your Responsibility

Use only your own credentials. This tool exists so students can read their **own** academic data conveniently. Collecting other people's credentials, scraping on behalf of others, or automating anything beyond read-only viewing is a violation of this policy and of the project's Code of Conduct.

## 7. Institutional Disclaimer

This is an independent student project. It is not affiliated with, endorsed by, or officially connected to Universitas Bina Sarana Informatika. All academic data remains the property of the university and is displayed back to you, the authenticated owner of that data.

## 8. Contact

Questions or privacy requests (including full data deletion) can be raised via a GitHub issue on `MuaraAI/Mira` or by contacting the maintainers listed in `README.md`.
