# Privacy Policy

**Effective date:** October 18, 2026
**Applies to:** UBSI API (`MuaraAI/Mira`), its hosted dashboard at `ubsi-api.muaraai.com`, and its API gateway at `api.muaraai.com`.

This project is an unofficial, community-built student tool. This policy explains, in plain terms, what data the service touches, where it lives, how it is protected, and how you can delete it.

## 1. Data We Process

| Data | Purpose | Where it lives |
| --- | --- | --- |
| NIM (student ID) | Identifying your session and academic data | Redis (session), SQLite (API keys) |
| Campus passwords (SIAKAD, MyBest) | Authenticating you once at login, then reusing the session | Redis, **AES-256-GCM encrypted** |
| Academic data (schedule, grades, KHS, KRS, exams, attendance, assignments, materials) | Displayed to you in the dashboard | Redis cache (transient, tiered TTL), never persisted to disk |
| Library / news / repository queries | Public campus data you request | Redis cache (transient) |
| Webhook channel config (Discord URL / Telegram token) | Sending you notifications you opted into | SQLite, encrypted at rest |
| Personal API key metadata | Letting you build bots/scripts | SQLite, only a hash is stored (the raw key is shown once at creation) |

We do **not** collect: your real name for marketing, email, phone number, location, browsing history, or anything unrelated to the academic features above.

## 2. How Your Credentials Are Protected

- **AES-256-GCM at rest**: Session payloads (including campus passwords) are encrypted with a 256-bit key derived from the server master key. Redis dumps reveal only ciphertext; tampering is rejected by the authentication tag.
- **No plaintext anywhere**: Passwords are never written to disk, logs, or responses. The dashboard never receives them back after login.
- **Hashed API keys**: Personal keys (`muara_ubsi_...`) are stored only as hashes. The full key is displayed exactly once, at creation.
- **Cookie hygiene**: The browser session uses an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. JavaScript on the page cannot read it.
- **Rate limiting**: Login is limited to 5 attempts per minute per NIM; the API is capped at 60 requests per minute per client.

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
