from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.cache import cache
from app.limiter import limiter
from app.main import app
from app.modules.academic_events import parse_academic_events

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def reset_clients():
    cache._client = None
    limiter._client = None
    yield
    cache._client = None
    limiter._client = None


def test_parse_academic_events_from_fixture():
    html = (FIXTURES / "staff_kegiatan_akademik.html").read_text(encoding="utf-8")
    events = parse_academic_events(html)

    assert len(events) == 11

    uts = events[0]
    assert uts["nama"] == "UTS Semester Gasal 2026/2027"
    assert uts["tanggal_mulai"] == "2026-11-09"
    assert uts["tanggal_selesai"] == "2026-11-14"
    assert uts["kategori"] == "ujian"
    assert uts["days_left"] == 4
    assert uts["countdown"] == "4 hari lagi"
    assert uts["status"] == "Akan Datang"

    libur = [e for e in events if "libur" in e["nama"].lower()][0]
    assert libur["kategori"] == "libur"
    assert libur["tanggal_mulai"] == "2026-12-21"
    assert libur["tanggal_selesai"] == "2027-01-02"

    wisuda = [e for e in events if "wisuda" in e["nama"].lower()][0]
    assert wisuda["kategori"] == "wisuda"


@pytest.mark.asyncio
async def test_get_academic_events_public_endpoint():
    mock_html = (FIXTURES / "staff_kegiatan_akademik.html").read_text(encoding="utf-8")
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with (
        patch("redis.asyncio.from_url", return_value=mock_redis),
        patch("app.modules.academic_events.fetch_academic_events_html", return_value=mock_html),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/academic/events")

        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert len(body["data"]) == 11
        assert body["data"][0]["nama"] == "UTS Semester Gasal 2026/2027"
        assert body["data"][0]["kategori"] == "ujian"
