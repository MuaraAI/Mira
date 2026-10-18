"""Privacy-preserving public usage counters backed by Redis."""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any

from app.cache import cache
from app.config import settings

_PREFIX = "ubsi:stats:"
_RETENTION_SECONDS = 35 * 86400


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
        if nim:
            user_key = f"{_PREFIX}users:{day}"
            await client.sadd(user_key, _identity(nim))
            await client.expire(user_key, _RETENTION_SECONDS)
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


async def get_public_stats() -> dict[str, Any]:
    try:
        client = await cache.get_client()
        users: dict[str, int] = {}
        for label, days in (("active_24h", 1), ("active_7d", 7), ("active_30d", 30)):
            keys = [f"{_PREFIX}users:{_day(offset)}" for offset in range(days)]
            members = await client.sunion(keys) if keys else set()
            users[label] = len(members)

        branches: list[dict[str, Any]] = []
        programs: list[dict[str, Any]] = []
        for dimension, output in (("branch", branches), ("program", programs)):
            keys = await client.keys(f"{_PREFIX}{dimension}:*:*")
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
            "service": "UBSI API",
            "status": "operational",
            "period": "rolling_30_days",
            "users": users,
            "requests": {
                "total_24h": await _sum_requests(client, 1),
                "total_7d": await _sum_requests(client, 7),
                "total_30d": await _sum_requests(client, 30),
            },
            "branches": branches,
            "programs": programs,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        return {"service": "UBSI API", "status": "operational", "users": {}, "requests": {}, "branches": [], "programs": []}
