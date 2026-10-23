"""Offline tests untuk endpoint ujian semester (ujiankampusa SSO).

Parser murni dites dari fixture; router dites dengan mock fetch tanpa jaringan.
"""
from pathlib import Path

import pytest

from app.modules.elearning import parse_exam_schedule, parse_exam_types

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def dashboard_html() -> str:
    return (FIXTURES / "uk_dashboard.html").read_text()


@pytest.fixture
def schedule_html() -> str:
    return (FIXTURES / "uk_schedule_active.html").read_text()


@pytest.fixture
def empty_html() -> str:
    return (FIXTURES / "uk_schedule_empty.html").read_text()


# ---------- parser: dashboard ----------


def test_parse_exam_types_returns_eight_unique(dashboard_html):
    data = parse_exam_types(dashboard_html)
    keys = [t["key"] for t in data["types"]]
    # sidebar + quick-tile merender set link dua kali dengan token berbeda
    assert len(keys) == len(set(keys)) == 8
    assert set(keys) == {
        "latihan", "uts", "uas", "uts-pengganti", "uas-pengganti",
        "her", "her-pengganti", "her-khusus",
    }
    for t in data["types"]:
        assert t["token"].startswith("eyJ")


def test_parse_exam_types_rejects_login_page():
    with pytest.raises(ValueError):
        parse_exam_types("<html><body><form action='/login'></form></body></html>")


# ---------- parser: jadwal ----------


def test_parse_exam_schedule_full_cards(schedule_html):
    data = parse_exam_schedule(schedule_html)
    assert data["identity"]["nim"] == "15260001"
    assert data["identity"]["nama"] == "MAHASISWA UJI"
    assert data["empty_marker"] is True

    assert len(data["exams"]) == 2
    first = data["exams"][0]
    assert first["mata_kuliah"] == "LOGIKA DAN ALGORITMA"
    assert first["waktu"] == "Rabu - 08:20-09:20"
    assert first["kode_dosen"] == "ERX"
    assert first["kode_mtk"] == "207"
    assert first["jenis_mtk"] == "PG ONLINE"
    assert first["sks"] == "4"
    assert first["no_ruang"] == "301-P1"
    assert "21 Oktober 2026" in (first["tanggal_ujian"] or "")
    assert first["durasi_menit"] == "60"
    assert "20" in (first["soal_pg"] or "")
    assert first["soal_essay"] == "0"
    # ujian lewat: tanpa status & tanpa pintu masuk
    assert first["status"] is None
    assert first["can_enter"] is False

    ongoing = data["exams"][1]
    assert ongoing["mata_kuliah"] == "PENGANTAR TEKNOLOGI INFORMASI DAN KOMUNIKASI"
    assert ongoing["status"] == "Sedang Berlangsung"
    assert ongoing["can_enter"] is True


def test_parse_exam_schedule_empty_state_is_valid(empty_html):
    data = parse_exam_schedule(empty_html)
    assert data["exams"] == []
    assert data["empty_marker"] is True
    assert data["identity"]["nim"] == "15260001"


# ---------- router ----------


@pytest.fixture(autouse=True)
def reset_clients():
    from app.cache import cache
    from app.limiter import limiter

    cache._client = None
    limiter._client = None
    yield
    cache._client = None
    limiter._client = None


def _mock_redis(store: dict | None = None):
    """AsyncMock redis dengan in-memory store: get/set benar-benar menyimpan.

    Dipakai untuk membuktikan cache-hit kedua (panggilan kedua cached=True).
    """
    from unittest.mock import AsyncMock, patch

    store = store if store is not None else {}
    mock = AsyncMock()
    mock.store = store

    async def _get(key):
        return store.get(key)

    async def _set(key, value, ex=None):
        store[key] = value
        return True

    mock.get.side_effect = _get
    mock.set.side_effect = _set
    mock.incr.return_value = 1
    return patch("redis.asyncio.from_url", return_value=mock)


@pytest.mark.asyncio
async def test_exams_endpoint_cached(monkeypatch):
    from unittest.mock import patch

    from httpx import ASGITransport, AsyncClient

    from app.main import app

    html = (FIXTURES / "uk_dashboard.html").read_text()

    async def fake_fetch(path, nim, password):
        return html

    monkeypatch.setenv("ELEARNING_NIM", "15260001")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    with _mock_redis(), patch(
        "app.modules.elearning.pooled_elearning_client.fetch_page", fake_fetch
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r1 = await ac.get("/v1/elearning/exams")
            r2 = await ac.get("/v1/elearning/exams")

    assert r1.status_code == 200
    keys = {t["key"] for t in r1.json()["data"]["types"]}
    assert keys >= {"latihan", "uts"}
    assert r2.status_code == 200
    assert r2.json()["cached"] is True  # served from cache, no upstream refetch


@pytest.mark.asyncio
async def test_exam_schedule_endpoint(monkeypatch):
    from unittest.mock import patch

    from httpx import ASGITransport, AsyncClient

    from app.main import app

    dash = (FIXTURES / "uk_dashboard.html").read_text()
    sched = (FIXTURES / "uk_schedule_active.html").read_text()

    async def fake_dash(path, nim, password):
        return dash

    async def fake_cross(url, nim, password):
        return sched

    monkeypatch.setenv("ELEARNING_NIM", "15260001")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    with _mock_redis(), patch(
        "app.modules.elearning.pooled_elearning_client.fetch_page", fake_dash
    ), patch(
        "app.modules.elearning.pooled_elearning_client.fetch_cross_host", fake_cross
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.get("/v1/elearning/exams/latihan")

    assert r.status_code == 200
    body = r.json()["data"]
    assert body["identity"]["nim"] == "15260001"
    assert len(body["exams"]) == 2
    # keamanan: URL pintu masuk ujian tidak boleh bocor ke klien
    assert "ujiankampusa" not in r.text


@pytest.mark.asyncio
async def test_exam_schedule_unknown_type():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/v1/elearning/exams/bukan-ujian")
    assert r.status_code == 422  # path pattern menolak jenis tak dikenal
