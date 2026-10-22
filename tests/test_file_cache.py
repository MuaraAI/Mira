"""Cache berkas: ETag, 304, TTL, dan batas ukuran."""
import time

import pytest
from fastapi import FastAPI, Request, Response
from httpx import ASGITransport, AsyncClient

from app.file_cache import FileCache, FileEntry, file_cache, make_etag, serve_cached


def make_app(counter: dict):
    app = FastAPI()

    @app.get("/f")
    async def f(request: Request):
        async def produce():
            counter["n"] += 1
            return Response(content=counter["body"], media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="a.pdf"'})

        return await serve_cached(request, "k", produce)

    return app


@pytest.fixture(autouse=True)
def clean_cache():
    file_cache.clear()
    yield
    file_cache.clear()


@pytest.mark.asyncio
async def test_second_request_is_served_from_cache_with_etag():
    counter = {"n": 0, "body": b"%PDF-1.4 one"}
    async with AsyncClient(transport=ASGITransport(app=make_app(counter)), base_url="http://t") as ac:
        first = await ac.get("/f")
        second = await ac.get("/f")
    assert first.status_code == second.status_code == 200
    assert counter["n"] == 1
    assert first.headers["etag"] == make_etag(b"%PDF-1.4 one")
    assert first.headers["content-disposition"] == 'attachment; filename="a.pdf"'
    assert "ETag" in first.headers["access-control-expose-headers"]


@pytest.mark.asyncio
async def test_if_none_match_returns_304_without_body():
    counter = {"n": 0, "body": b"%PDF-1.4 one"}
    async with AsyncClient(transport=ASGITransport(app=make_app(counter)), base_url="http://t") as ac:
        etag = (await ac.get("/f")).headers["etag"]
        res = await ac.get("/f", headers={"If-None-Match": etag})
        stale = await ac.get("/f", headers={"If-None-Match": '"other"'})
    assert res.status_code == 304 and res.content == b""
    assert stale.status_code == 200 and stale.content == b"%PDF-1.4 one"


@pytest.mark.asyncio
async def test_expired_entry_is_refetched_and_changed_content_gets_new_etag(monkeypatch):
    counter = {"n": 0, "body": b"%PDF-1.4 one"}
    async with AsyncClient(transport=ASGITransport(app=make_app(counter)), base_url="http://t") as ac:
        old = (await ac.get("/f")).headers["etag"]
        entry = file_cache.get("k")
        entry.stored_at = time.monotonic() - 1000  # sudah lewat TTL
        counter["body"] = b"%PDF-1.4 two"
        res = await ac.get("/f", headers={"If-None-Match": old})
    assert counter["n"] == 2
    assert res.status_code == 200 and res.content == b"%PDF-1.4 two"
    assert res.headers["etag"] != old


def test_lru_evicts_oldest_and_skips_huge_files():
    cache = FileCache(max_bytes=100, ttl=60)
    mk = lambda n: FileEntry(b"x" * n, "a/b", None, "e", time.monotonic())
    cache.set("a", mk(40))
    cache.set("b", mk(40))
    cache.set("c", mk(40))
    assert cache.get("a") is None and cache.get("b") and cache.get("c")
    cache.set("huge", mk(80))  # lebih dari separuh kapasitas: tidak disimpan
    assert cache.get("huge") is None
