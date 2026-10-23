"""Endpoint /v1/tools/link-check: butuh login, validasi input, hasil berurutan."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_link_check_requires_authentication():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"_skip_auto_auth": "1"}) as client:
        response = await client.post("/v1/tools/link-check", json={"urls": ["https://github.com/MuaraAI/Mira"]})
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


@pytest.mark.asyncio
async def test_link_file_requires_authentication():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"_skip_auto_auth": "1"}) as ac:
        res = await ac.get("/v1/tools/link-file?url=https://drive.google.com/file/d/1MXHPc0R1xzrwm6yLosPUaAbCdEfGhIjK/view")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_link_file_returns_pdf_with_etag_and_maps_errors(monkeypatch):
    from app.file_cache import file_cache
    from app.file_proxy import ProxyError
    from app.limiter import limiter

    file_cache.clear()

    async def allow(*a, **k):
        return True

    monkeypatch.setattr(limiter, "is_allowed", allow)
    calls = {"n": 0}

    async def ok(info, client):
        calls["n"] += 1
        return b"%PDF-1.4 hi", "application/pdf", "tugas.pdf"

    monkeypatch.setattr("app.modules.links.fetch_public_file", ok)
    url = "https://drive.google.com/file/d/1MXHPc0R1xzrwm6yLosPUaAbCdEfGhIjK/view"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        first = await ac.get("/v1/tools/link-file", params={"url": url})
        etag = first.headers["etag"]
        again = await ac.get("/v1/tools/link-file", params={"url": url}, headers={"If-None-Match": etag})
        bad = await ac.get("/v1/tools/link-file", params={"url": "tugas saya"})

        async def private(info, client):
            raise ProxyError("NOT_PUBLIC", "Berkas masih privat.", 403)

        monkeypatch.setattr("app.modules.links.fetch_public_file", private)
        file_cache.clear()
        denied = await ac.get("/v1/tools/link-file", params={"url": url})
    assert first.status_code == 200 and first.content.startswith(b"%PDF") and "inline" in first.headers["content-disposition"]
    assert again.status_code == 304 and calls["n"] == 1
    assert bad.status_code == 400
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "NOT_PUBLIC"
    file_cache.clear()
