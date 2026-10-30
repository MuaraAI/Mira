"""Proteksi endpoint login: rate limit per-IP, blacklist bertingkat, dan log aktivitas harian.

- Maksimal `LOGIN_IP_LIMIT` percobaan login per IP dalam jendela geser 60 detik.
- IP yang melewati batas masuk blacklist dengan durasi bertingkat (15 menit, 1 jam, 24 jam)
  sesuai jumlah pelanggaran dalam 24 jam terakhir.
- Setiap percobaan login (sukses/gagal) dicatat per-NIM per-hari (WIB) untuk badge
  "login hari ini" di dashboard.

Redis down = fail-open (sama seperti `app.limiter`), supaya gangguan Redis tidak
mengunci seluruh mahasiswa dari dashboard.
"""
import logging
import secrets
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger("app.login_guard")

WIB = ZoneInfo("Asia/Jakarta")
LOGIN_IP_LIMIT = 10
LOGIN_WINDOW_SECONDS = 60
BAN_STEPS_SECONDS = (15 * 60, 60 * 60, 24 * 3600)
STRIKE_TTL_SECONDS = 24 * 3600
ACTIVITY_TTL_SECONDS = 3 * 24 * 3600

_PREFIX = "ubsi:login_guard:"


@dataclass
class GuardDecision:
    allowed: bool
    retry_after: int = 0
    banned: bool = False
    remaining: int = LOGIN_IP_LIMIT


def today_wib() -> str:
    return datetime.now(WIB).strftime("%Y%m%d")


def mask_ip(ip: str) -> str:
    """Sembunyikan sebagian IP sebelum ditampilkan ke pengguna (privasi)."""
    if ":" in ip:
        parts = [p for p in ip.split(":") if p]
        return ":".join(parts[:3]) + ":****" if parts else "-"
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.*.*"
    return "-"


class LoginGuard:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client: Optional[aioredis.Redis] = None

    async def get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(self.redis_url, decode_responses=True)
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def check_ip(self, ip: str) -> GuardDecision:
        """Hitung satu percobaan login dari `ip`; blacklist bila melewati batas per menit."""
        try:
            client = await self.get_client()
            ban_key = f"{_PREFIX}ban:{ip}"
            ban_ttl = await client.ttl(ban_key)
            if ban_ttl and ban_ttl > 0:
                return GuardDecision(allowed=False, retry_after=int(ban_ttl), banned=True, remaining=0)

            now = time.time()
            window_key = f"{_PREFIX}window:{ip}"
            member = f"{now:.6f}:{secrets.token_hex(4)}"
            pipe = client.pipeline(transaction=True)
            pipe.zremrangebyscore(window_key, 0, now - LOGIN_WINDOW_SECONDS)
            pipe.zadd(window_key, {member: now})
            pipe.zcard(window_key)
            pipe.expire(window_key, LOGIN_WINDOW_SECONDS + 5)
            res = await pipe.execute()
            count = int(res[2])
            if count <= LOGIN_IP_LIMIT:
                return GuardDecision(allowed=True, remaining=LOGIN_IP_LIMIT - count)

            strike_key = f"{_PREFIX}strikes:{ip}"
            strikes = int(await client.incr(strike_key))
            await client.expire(strike_key, STRIKE_TTL_SECONDS)
            duration = BAN_STEPS_SECONDS[min(strikes, len(BAN_STEPS_SECONDS)) - 1]
            await client.set(ban_key, str(strikes), ex=duration)
            await client.delete(window_key)
            logger.warning("Login IP %s di-blacklist %ss (pelanggaran ke-%s)", ip, duration, strikes)
            return GuardDecision(allowed=False, retry_after=duration, banned=True, remaining=0)
        except (aioredis.RedisError, ConnectionError, OSError) as err:
            logger.warning("Login guard Redis error (fail-open): %s", err)
            return GuardDecision(allowed=True)

    async def record_attempt(self, nim: str, success: bool, ip: str) -> None:
        try:
            client = await self.get_client()
            key = f"{_PREFIX}activity:{nim}:{today_wib()}"
            pipe = client.pipeline(transaction=True)
            pipe.hincrby(key, "success" if success else "failed", 1)
            if success:
                pipe.hset(key, mapping={"last_success_at": datetime.now(WIB).isoformat(), "last_ip": mask_ip(ip)})
            pipe.expire(key, ACTIVITY_TTL_SECONDS)
            await pipe.execute()
        except (aioredis.RedisError, ConnectionError, OSError) as err:
            logger.warning("Gagal mencatat aktivitas login: %s", err)

    async def activity(self, nim: str) -> dict:
        data: dict = {}
        try:
            client = await self.get_client()
            data = await client.hgetall(f"{_PREFIX}activity:{nim}:{today_wib()}") or {}
        except (aioredis.RedisError, ConnectionError, OSError) as err:
            logger.warning("Gagal membaca aktivitas login: %s", err)
        return {
            "date": datetime.now(WIB).strftime("%Y-%m-%d"),
            "logins_today": int(data.get("success", 0) or 0),
            "failed_today": int(data.get("failed", 0) or 0),
            "last_login_at": data.get("last_success_at") or None,
            "last_login_ip": data.get("last_ip") or None,
        }


login_guard = LoginGuard(settings.REDIS_URL)
