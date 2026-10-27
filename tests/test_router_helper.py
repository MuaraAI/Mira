"""Uji pola cached_endpoint: SWR, lock, dan fallback LGG benar-benar bekerja."""
import pytest
from unittest.mock import AsyncMock, patch
from app.router_helper import cached_endpoint
from app.cache import cache
from app.limiter import limiter


@pytest.fixture(autouse=True)
def reset_clients():
    cache._client = None
    limiter._client = None
    yield
    cache._client = None
    limiter._client = None


def _mock_redis():
    redis = AsyncMock()
    redis.get.return_value = None
    redis.incr.return_value = 1
    return redis


@pytest.mark.asyncio
async def test_fetch_dipanggil_dan_hasil_tersimpan(monkeypatch):
    saved = {}

    async def fake_set(key, payload, ttl=None):
        saved[key] = (payload, ttl)

    monkeypatch.setattr(cache, "set", fake_set)
    with patch("redis.asyncio.from_url", return_value=_mock_redis()):
        res = await cached_endpoint(
            module="m", name="x",
            fetch=lambda: "<html>a</html>",
            parse=lambda html: {"dari": html},
            ttl=60,
        )
    assert res["success"] is True
    assert res["cached"] is False
    assert res["data"]["dari"] == "<html>a</html>"
    assert saved, "cache.set harus dipanggil"


@pytest.mark.asyncio
async def test_lgg_dikirim_instan_dan_revalidate_dijadwalkan(monkeypatch):
    # fresh miss, LGG hit
    async def fake_fresh_or_stale(key):
        return {"lama": True}, True  # data, is_stale

    revalidate_called = []
    monkeypatch.setattr(cache, "fresh_or_stale", fake_fresh_or_stale)
    monkeypatch.setattr(
        "app.router_helper._schedule_revalidate",
        lambda key, fetch, parse, ttl, *rest: revalidate_called.append(key),
    )

    fetch_called = []

    def fetch():
        fetch_called.append(1)
        return "<html>baru</html>"

    res = await cached_endpoint(
        module="m", name="y", fetch=fetch,
        parse=lambda html: {"dari": html}, ttl=60,
    )
    assert res["success"] is True
    assert res["cached"] is True
    assert res["stale"] is True
    assert res["data"] == {"lama": True}
    # fetch upstream TIDAK dipanggil di jalur request; revalidate dijadwalkan
    assert not fetch_called
    assert revalidate_called, "SWR harus menjadwalkan refresh background"


@pytest.mark.asyncio
async def test_upstream_gagal_fallback_lgg(monkeypatch):
    async def miss(key):
        return None

    async def lgg_hit(key):
        return ({"cadangan": True}, "2026-09-24T00:00:00")

    monkeypatch.setattr(cache, "fresh_or_stale", miss)
    monkeypatch.setattr(cache, "get_lgg", lgg_hit)

    def fetch():
        raise RuntimeError("upstream down")

    res = await cached_endpoint(
        module="m", name="z", fetch=fetch,
        parse=lambda html: html, ttl=60,
    )
    assert res["success"] is True
    assert res["stale"] is True
    assert res["data"] == {"cadangan": True}


@pytest.mark.asyncio
async def test_allow_stale_false_refetches_instead_of_serving_expired_data(monkeypatch):
    async def fake_get_fresh(key):
        return None

    async def fake_set(key, payload, ttl=None):
        pass

    async def fake_fresh_or_stale(key):  # tidak boleh dipakai
        raise AssertionError("data kedaluwarsa tidak boleh dikirim")

    monkeypatch.setattr(cache, "get_fresh", fake_get_fresh)
    monkeypatch.setattr(cache, "fresh_or_stale", fake_fresh_or_stale)
    monkeypatch.setattr(cache, "set", fake_set)
    with patch("redis.asyncio.from_url", return_value=_mock_redis()):
        res = await cached_endpoint(
            module="m", name="live", fetch=lambda: "baru", parse=lambda h: {"v": h}, ttl=3, allow_stale=False
        )
    assert res["data"] == {"v": "baru"}
    assert res["cached"] is False


@pytest.mark.asyncio
async def test_ttl_for_menentukan_ttl_per_hasil(monkeypatch):
    """Hasil parsial tetap disimpan, tapi dengan TTL pendek (bukan dibuang)."""
    saved = {}

    async def fake_set(key, payload, ttl=None):
        saved["ttl"] = ttl

    monkeypatch.setattr(cache, "set", fake_set)
    with patch("redis.asyncio.from_url", return_value=_mock_redis()):
        await cached_endpoint(
            module="elearning", name="parsial",
            fetch=lambda: {"failed_courses": ["X"]},
            parse=lambda data: data,
            ttl=600,
            ttl_for=lambda data: 60 if data.get("failed_courses") else 600,
        )
    assert saved["ttl"] == 60


@pytest.mark.asyncio
async def test_error_upstream_berbahasa_indonesia_tanpa_detail_teknis(monkeypatch):
    from fastapi import HTTPException

    class ReadTimeout(Exception):
        pass

    def boom():
        raise ReadTimeout("The read operation timed out")

    async def no_lgg(key):
        return None

    monkeypatch.setattr(cache, "get_lgg", no_lgg)
    with patch("redis.asyncio.from_url", return_value=_mock_redis()):
        with pytest.raises(HTTPException) as info:
            await cached_endpoint(module="elearning", name="lambat", fetch=boom, parse=lambda d: d, ttl=60)
    message = info.value.detail["error"]["message"]
    assert message == "MyBest terlalu lama merespons. Coba lagi sebentar."
    assert "ReadTimeout" not in message and "timed out" not in message


def test_presensi_tidak_membawa_server_time():
    """Payload presensi harus stabil antar polling supaya UI tidak render ulang tanpa perubahan."""
    from app.modules.elearning import annotate_presence

    data = annotate_presence({"riwayat": [], "status_sesi": "Belum Dimulai"})
    assert "server_time" not in data
