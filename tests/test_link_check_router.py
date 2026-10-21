"""Endpoint /v1/tools/link-check: butuh login, validasi input, hasil berurutan."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_link_check_requires_authentication():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"_skip_auto_auth": "1"}) as client:
        response = await client.post("/v1/tools/link-check", json={"urls": ["https://github.com/MuaraAI/UBSI-API"]})
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_link_check_validates_body(monkeypatch):
    monkeypatch.setattr("app.config.settings.API_KEY", "master-key")
    headers = {"Authorization": "Bearer master-key"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        empty = await client.post("/v1/tools/link-check", json={"urls": []}, headers=headers)
        too_many = await client.post("/v1/tools/link-check", json={"urls": ["https://a.b"] * 21}, headers=headers)
        too_long = await client.post("/v1/tools/link-check", json={"urls": ["https://a.b/" + "x" * 2100]}, headers=headers)
    assert empty.status_code == 422 and too_many.status_code == 422 and too_long.status_code == 422


@pytest.mark.asyncio
async def test_link_check_returns_results_in_order(monkeypatch):
    monkeypatch.setattr("app.config.settings.API_KEY", "master-key")
    fake = AsyncMock(return_value=[{"access": "invalid"}, {"access": "private"}])
    with patch("app.modules.links.check_links", fake), patch("app.modules.links.limiter.is_allowed", AsyncMock(return_value=True)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/v1/tools/link-check", json={"urls": ["x", "https://drive.google.com/a"]},
                headers={"Authorization": "Bearer master-key"},
            )
    assert response.status_code == 200
    data = response.json()["data"]
    assert [r["access"] for r in data["results"]] == ["invalid", "private"] and data["total"] == 2
