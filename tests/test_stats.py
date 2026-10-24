import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.stats import get_public_stats


@pytest.mark.asyncio
async def test_public_stats_does_not_require_auth(monkeypatch):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/v1/stats")
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "users" in response.json()["data"]


class FakeRedis:
    """Redis tiruan: dua hari data harian, counter permanen bisa diatur."""

    def __init__(self, requests_all=None, users_all=None, online=None):
        self.values = {"ubsi:stats:requests:all": requests_all} if requests_all is not None else {}
        self.sets = {"ubsi:stats:users:all": set(users_all or ())}
        self.online = dict(online or {})

    async def get(self, key):
        if key in self.values:
            return str(self.values[key])
        return "100" if ":requests:20" in key else None

    async def incrby(self, key, amount):
        self.values[key] = int(self.values.get(key) or 0) + amount

    async def scard(self, key):
        return len(self.sets[key]) if key in self.sets else 5

    async def smembers(self, key):
        return {"a", "b"}

    async def keys(self, pattern):
        if "requests:20" in pattern:
            return ["ubsi:stats:requests:2026-10-21", "ubsi:stats:requests:2026-10-22"]
        if "users:20" in pattern:
            return ["ubsi:stats:users:2026-10-21", "ubsi:stats:users:2026-10-22"]
        return []

    async def sunion(self, *keys):
        return {"user1", "user2"}

    async def sunionstore(self, dest, keys):
        self.sets[dest] = set(self.sets.get(dest, set())) | {"user1", "user2"}

    async def zremrangebyscore(self, key, low, high):
        self.online = {member: score for member, score in self.online.items() if score > high}

    async def zcard(self, key):
        return len(self.online)


async def _stats_with(fake):
    from unittest.mock import patch

    with patch("app.cache.cache.get_client", return_value=fake):
        return await get_public_stats()


@pytest.mark.asyncio
async def test_public_stats_has_averages_and_all_time_totals():
    data = await _stats_with(FakeRedis())

    # Rata-rata dan total all-time berada langsung di dalam 'users' dan 'requests'
    assert data["users"]["average_per_day"] == 5
    assert data["users"]["total_all_time"] == 2
    assert data["requests"]["average_per_day"] == 100
    assert data["requests"]["total_all_time"] == 200


@pytest.mark.asyncio
async def test_all_time_totals_never_drop_below_permanent_counters():
    # Key harian lama sudah kedaluwarsa: counter permanen lebih besar dari sisa data harian.
    fake = FakeRedis(requests_all=9000, users_all={"old1", "old2", "old3"})
    data = await _stats_with(fake)

    assert data["requests"]["total_all_time"] == 9000
    assert data["users"]["total_all_time"] == 5  # 3 lama + 2 dari key harian


@pytest.mark.asyncio
async def test_permanent_request_counter_catches_up_with_daily_keys():
    fake = FakeRedis(requests_all=50)
    data = await _stats_with(fake)

    assert data["requests"]["total_all_time"] == 200
    assert fake.values["ubsi:stats:requests:all"] == 200


@pytest.mark.asyncio
async def test_online_now_counts_only_recent_users():
    import time

    now = time.time()
    fake = FakeRedis(online={"fresh": now - 30, "idle": now - 3600})
    data = await _stats_with(fake)

    assert data["users"]["online_now"] == 1
