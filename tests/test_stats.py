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


@pytest.mark.asyncio
async def test_public_stats_has_averages_and_all_time_totals():
    class FakeRedis:
        async def get(self, key):
            return "100" if ":requests:" in key else None

        async def scard(self, key):
            return 5

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

    from unittest.mock import patch

    with patch("app.cache.cache.get_client", return_value=FakeRedis()):
        data = await get_public_stats()

    # Rata-rata dan total all-time berada langsung di dalam 'users' dan 'requests'
    assert data["users"]["average_per_day"] == 5
    assert data["users"]["total_all_time"] == 2
    assert data["requests"]["average_per_day"] == 100
    assert data["requests"]["total_all_time"] == 200
