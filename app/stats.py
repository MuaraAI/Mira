"""Privacy-preserving public usage counters backed by Redis."""
from __future__ import annotations

import functools
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.cache import cache
from app.config import settings
from app.modules.studentv2 import branch_display

_PREFIX = "ubsi:stats:"
_RETENTION_SECONDS = 35 * 86400
# Pengguna dianggap online bila ada request dalam jendela ini (dashboard polling tiap 60 detik).
_ONLINE_WINDOW_SECONDS = 5 * 60
_ALLOWED_STAT_MODULES = frozenset({
    "studentv2",
    "elearning",
    "elibrary",
    "news",
    "repository",
    "ejournal",
    "auth",
    "channels",
    "notifications",
    "tools",
    "stats",
    "docs",
    "ujian",
    "academic",
    "social",
    "lecturers",
})


def _day(offset: int = 0) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=offset)).isoformat()


@functools.lru_cache(maxsize=4)
def _digest_key(secret: str) -> bytes:
    return hashlib.sha256(secret.encode()).digest()


def _identity(value: str) -> str:
    return hmac.new(_digest_key(settings.API_KEY), value.encode(), hashlib.sha256).hexdigest()


async def record_request(module: str, nim: str | None = None) -> None:
    safe_module = module if module in _ALLOWED_STAT_MODULES else "other"
    day = _day()
    try:
        client = await cache.get_client()
        request_key = f"{_PREFIX}requests:{day}"
        await client.incr(request_key)
        await client.expire(request_key, _RETENTION_SECONDS)
        module_key = f"{_PREFIX}requests:{safe_module}:{day}"
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
            if dimension == "branch":
                normalized = branch_display(normalized) or normalized
            key = f"{_PREFIX}{dimension}:{normalized}:{day}"
            await client.sadd(key, user_id)
            await client.expire(key, _RETENTION_SECONDS)
            if dimension == "branch":
                # Set permanen per cabang (tanpa expire) agar total_all_time tidak ikut kedaluwarsa.
                await client.sadd(f"{_PREFIX}branch:all:{normalized}", user_id)
    except Exception:
        pass


async def _collect_branch_stats(client: Any, valid_30d_days: set[str]) -> list[dict[str, Any]]:
    """Kumpulkan statistik aktif 30 hari dan total kumulatif all-time per cabang UBSI."""
    keys = await _iter_keys(client, f"{_PREFIX}branch:*:*")
    grouped_30d: dict[str, set[str]] = {}
    retained: dict[str, set[str]] = {}
    perm_members: dict[str, set[str]] = {}
    all_time: dict[str, set[str]] = {}

    for key in keys:
        parts = key.split(":")
        if len(parts) < 5:
            continue
        if parts[3] == "all":
            raw_name = ":".join(parts[4:])
            name = branch_display(raw_name) or raw_name
            members = set(await client.smembers(key))
            perm_members.setdefault(name, set()).update(members)
            all_time.setdefault(name, set()).update(members)
            continue

        raw_name = ":".join(parts[3:-1])
        # Kode mentah SIAKAD ("30", "05") dan nama tampilan ("UBSI Pontianak", "UBSI Bekasi")
        # adalah kampus yang sama: satukan di sumber agar tidak dihitung dobel.
        name = branch_display(raw_name) or raw_name
        members = set(await client.smembers(key))
        retained.setdefault(name, set()).update(members)
        all_time.setdefault(name, set()).update(members)
        if parts[-1] in valid_30d_days:
            grouped_30d.setdefault(name, set()).update(members)

    sadd = getattr(client, "sadd", None)
    if sadd is not None:
        for name, ids in retained.items():
            missing = ids - perm_members.get(name, set())
            if missing:
                await sadd(f"{_PREFIX}branch:all:{name}", *missing)

    branches = [
        {
            "name": name,
            "active_users_30d": len(grouped_30d.get(name, set())),
            "total_all_time": max(len(grouped_30d.get(name, set())), len(all_ids)),
        }
        for name, all_ids in all_time.items()
    ]
    branches.sort(
        key=lambda item: (item["active_users_30d"], item["total_all_time"]),
        reverse=True,
    )
    return branches


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

        valid_30d_days = {_day(offset) for offset in range(30)}
        branches = await _collect_branch_stats(client, valid_30d_days)
        programs: list[dict[str, Any]] = []
        program_keys = await _iter_keys(client, f"{_PREFIX}program:*:*")
        grouped_programs: dict[str, set[str]] = {}
        for key in program_keys:
            parts = key.split(":")
            if len(parts) < 5 or parts[3] == "all" or parts[-1] not in valid_30d_days:
                continue
            name = ":".join(parts[3:-1])
            grouped_programs.setdefault(name, set()).update(await client.smembers(key))
        programs.extend({"name": name, "active_users_30d": len(ids)} for name, ids in grouped_programs.items())
        programs.sort(key=lambda item: item["active_users_30d"], reverse=True)

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
