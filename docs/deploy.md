# Production Deployment Guide

Guide for deploying and operating Mira (formerly UBSI API) on a Linux VPS using PM2 and Redis.

---

## 1. System Requirements

- **Operating System**: Linux (Ubuntu 22.04+ or Debian 12 recommended)
- **RAM**: 512 MB minimum (application consumes ~25–40 MB idle, ~80 MB peak)
- **Dependencies**: Python 3.12+ (via `uv`), Node.js (for PM2), Redis Server

---

## 2. Automated One-Command Deploy

The repository includes an automated synchronization and restart script:

```bash
./scripts/deploy.sh
```

What `scripts/deploy.sh` does:
1. Verifies SSH connectivity to `curzy-vps-tencent`.
2. Syncs code via `rsync` to `/opt/ubsi-api`, excluding temporary and test files.
3. Automatically sets up a dedicated virtual environment (`/home/ubuntu/.venvs/ubsi-api`) using `uv`.
4. Installs and updates packages from `requirements.txt`.
5. Starts or restarts the service via PM2 (`ecosystem.config.cjs`).
6. Runs a remote health check against `http://127.0.0.1:8300/health`.

---

## 3. PM2 Process Configuration

The process configuration is defined in `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: "ubsi-api",
      cwd: "/opt/ubsi-api",
      script: "/home/ubuntu/.venvs/ubsi-api/bin/uvicorn",
      args: "app.main:app --host 127.0.0.1 --port 8300 --workers 2 --limit-concurrency 100 --timeout-keep-alive 5",
      interpreter: "none",
      autorestart: true,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        MALLOC_ARENA_MAX: "2",
        MALLOC_TRIM_THRESHOLD_: "65536",
        PYTHONOPTIMIZE: "1"
      }
    },
    {
      name: "ubsi-mcp",
      cwd: "/opt/ubsi-api",
      script: "/home/ubuntu/.venvs/ubsi-api/bin/python",
      args: "-m app.mcp_server --transport streamable-http --host 127.0.0.1 --port 8350 --path /mcp",
      interpreter: "none",
      autorestart: true,
      max_memory_restart: "200M",
      env: {
        UBSI_API_URL: "http://127.0.0.1:8300",
        PYTHONUNBUFFERED: "1",
        MALLOC_ARENA_MAX: "2",
        MALLOC_TRIM_THRESHOLD_: "65536"
      }
    }
  ]
};
```

Dua proses berjalan berdampingan: `ubsi-api` (REST, port 8300) dan `ubsi-mcp`
(MCP streamable-http, port 8350). Keduanya memakai venv yang sama dan harus
di-restart bersamaan setelah deploy karena berbagi kode di `/opt/ubsi-api`.

---

## 4. Useful Operations Commands

### Check Service Status
```bash
pm2 status ubsi-api ubsi-mcp
```

### View Live Logs
```bash
pm2 logs ubsi-api --lines 50
pm2 logs ubsi-mcp --lines 50
```

### Restart Service (e.g. after updating credentials)
```bash
pm2 restart ubsi-api
pm2 restart ubsi-mcp
pm2 save
```

### Run Live Smoke Test on Server
```bash
/home/ubuntu/.venvs/ubsi-api/bin/python /opt/ubsi-api/scripts/smoke.py --base-url http://127.0.0.1:8300
```
