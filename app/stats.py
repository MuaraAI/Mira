"""Privacy-preserving public usage counters backed by Redis."""
from __future__ import annotations

import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.cache import cache
from app.config import settings

_PREFIX = "ubsi:stats:"
_RETENTION_SECONDS = 35 * 86400
# Pengguna dianggap online bila ada request dalam jendela ini (dashboard polling tiap 60 detik).
_ONLINE_WINDOW_SECONDS = 5 * 60


def _day(offset: int = 0) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=offset)).isoformat()


def _identity(value: str) -> str:
    digest_key = hashlib.sha256(settings.API_KEY.encode()).digest()
    return hmac.new(digest_key, value.encode(), hashlib.sha256).hexdigest()


async def record_request(module: str, nim: str | None = None) -> None:
    day = _day()
    try:
        client = await cache.get_client()
        request_key = f"{_PREFIX}requests:{day}"
        await client.incr(request_key)
        await client.expire(request_key, _RETENTION_SECONDS)
        module_key = f"{_PREFIX}requests:{module}:{day}"
        await client.incr(module_key)
        await client.expire(module_key, _RETENTION_SECONDS)
        # Counter all-time permanen (tanpa expire): untuk total kumulatif publik.
        await client.incr(f"{_PREFIX}requests:all")
        if nim:
            user_id = _identity(nim)
            user_key = f"{_PREFIX}users:{day}"
            await client.sadd(user_key, user_id)
            await client.expire(user_key, _RETENTION_SECONDS)
            # Set unik all-time permanen (isi HMAC, bukan NIM mentah).
            await client.sadd(f"{_PREFIX}users:all", user_id)
            await client.zadd(f"{_PREFIX}online", {user_id: time.time()})
    except Exception:
        pass


async def record_profile(nim: str, branch: str | None, program: str | None) -> None:
    day = _day()
    try:
        client = await cache.get_client()
        user_id = _identity(nim)
        for dimension, value in (("branch", branch), ("program", program)):
            normalized = " ".join((value or "").split())[:80]
            if not normalized:
                continue
            key = f"{_PREFIX}{dimension}:{normalized}:{day}"
            await client.sadd(key, user_id)
            await client.expire(key, _RETENTION_SECONDS)
    except Exception:
        pass


async def _sum_requests(client: Any, days: int) -> int:
    total = 0
    for offset in range(days):
        value = await client.get(f"{_PREFIX}requests:{_day(offset)}")
        total += int(value or 0)
    return total


async def _iter_keys(client: Any, pattern: str) -> list[str]:
    # SCAN non-blocking: KEYS O(N) memblokir event loop Redis di traffic tinggi.
    scan = getattr(client, "scan_iter", None)
    if scan is not None:
        return [key async for key in scan(match=pattern)]
    return sorted(await client.keys(pattern))  # fallback FakeRedis test suite


async def get_public_stats() -> dict[str, Any]:
    try:
        client = await cache.get_client()

        # 1. Hari aktif riil dari key tanggal yang masih tersimpan (retensi 35 hari).
        all_req_keys = await _iter_keys(client, f"{_PREFIX}requests:20*")
        req_vals = [int(await client.get(k) or 0) for k in all_req_keys]
        active_days = max(1, len([v for v in req_vals if v > 0]))

        all_user_keys = await _iter_keys(client, f"{_PREFIX}users:20*")
        daily_user_counts = [await client.scard(k) for k in all_user_keys]

        # Total all-time memakai counter permanen agar tidak turun saat key harian kedaluwarsa.
        # Counter dinaikkan ke jumlah harian bila tertinggal (data sebelum counter permanen ada).
        all_requests_key = f"{_PREFIX}requests:all"
        total_requests_all = int(await client.get(all_requests_key) or 0)
        retained_requests = sum(req_vals)
        if retained_requests > total_requests_all:
            await client.incrby(all_requests_key, retained_requests - total_requests_all)
            total_requests_all = retained_requests

        all_users_key = f"{_PREFIX}users:all"
        if all_user_keys:
            await client.sunionstore(all_users_key, [all_users_key, *all_user_keys])
        total_users_all = await client.scard(all_users_key)

        online_key = f"{_PREFIX}online"
        await client.zremrangebyscore(online_key, 0, time.time() - _ONLINE_WINDOW_SECONDS)
        online_now = await client.zcard(online_key)

        # 2. Pengguna (rolling window + rata-rata harian riil + total unik all-time)
        users: dict[str, Any] = {}
        for label, days in (("active_24h", 1), ("active_7d", 7), ("active_30d", 30)):
            keys = [f"{_PREFIX}users:{_day(offset)}" for offset in range(days)]
            members = await client.sunion(keys) if keys else set()
            users[label] = len(members)
        users["average_per_day"] = round(sum(daily_user_counts) / active_days)
        users["total_all_time"] = total_users_all
        users["online_now"] = online_now

        # 3. Request (rolling window + rata-rata harian riil + total all-time)
        requests_data = {
            "total_24h": await _sum_requests(client, 1),
            "total_7d": await _sum_requests(client, 7),
            "total_30d": await _sum_requests(client, 30),
            "average_per_day": round(total_requests_all / active_days),
            "total_all_time": total_requests_all,
        }

        branches: list[dict[str, Any]] = []
        programs: list[dict[str, Any]] = []
        for dimension, output in (("branch", branches), ("program", programs)):
            keys = await _iter_keys(client, f"{_PREFIX}{dimension}:*:*")
            grouped: dict[str, set[str]] = {}
            for key in keys:
                parts = key.split(":")
                if len(parts) < 5:
                    continue
                name = ":".join(parts[3:-1])
                grouped.setdefault(name, set()).update(await client.smembers(key))
            output.extend({"name": name, "active_users_30d": len(ids)} for name, ids in grouped.items())
            output.sort(key=lambda item: item["active_users_30d"], reverse=True)

        return {
            "service": "Mira API",
            "status": "operational",
            "period": "rolling_30_days",
            "users": users,
            "requests": requests_data,
            "branches": branches,
            "programs": programs,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        return {"service": "Mira API", "status": "operational", "users": {}, "requests": {}, "branches": [], "programs": []}
