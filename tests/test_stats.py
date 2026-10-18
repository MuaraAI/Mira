import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_public_stats_does_not_require_auth(monkeypatch):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/v1/stats")
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "users" in response.json()["data"]
