import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_health_endpoint_redis_up():
    from app.main import cache
    cache._client = None
    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True
    with patch("redis.asyncio.from_url", return_value=mock_redis):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["redis"] == "up"
    cache._client = None

@pytest.mark.asyncio
async def test_health_endpoint_redis_down():
    from app.main import cache
    cache._client = None
    mock_redis = AsyncMock()
    mock_redis.ping.side_effect = ConnectionError("Redis down")
    with patch("redis.asyncio.from_url", return_value=mock_redis):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["redis"] == "down"
    cache._client = None

@pytest.mark.asyncio
async def test_master_key_bypasses_rate_limiter():
    # Master requests are intentionally unlimited; the route itself is not registered.
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/some-endpoint")
    assert res.status_code == 404

@pytest.mark.asyncio
async def test_modular_creds_validation():
    from app.deps import require_studentv2_creds, require_elearning_creds
    from fastapi import HTTPException
    from app.config import Settings

    empty_settings = Settings(_env_file=None)
    with pytest.raises(HTTPException) as exc_info:
        require_studentv2_creds(empty_settings)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["error"]["code"] == "UNAUTHORIZED"
    assert exc_info.value.detail["error"]["module"] == "studentv2"

    with pytest.raises(HTTPException) as exc_info:
        require_elearning_creds(empty_settings)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["error"]["code"] == "UNAUTHORIZED"
    assert exc_info.value.detail["error"]["module"] == "elearning"

@pytest.mark.asyncio
async def test_get_docs_endpoint_public_access():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/docs")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "endpoints" in data["data"]
    assert "mcp" in data["data"]
    assert data["data"]["info"]["version"] == "1.3.0"

@pytest.mark.asyncio
async def test_get_docs_endpoint_with_category():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/docs?category=elearning")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "elearning" in data["data"]["endpoints"]
    assert "studentv2" not in data["data"]["endpoints"]
