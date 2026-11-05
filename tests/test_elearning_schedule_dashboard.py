import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.cache import cache
from app.limiter import limiter

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def reset_clients():
    cache._client = None
    limiter._client = None
    yield
    cache._client = None
    limiter._client = None


@pytest.mark.asyncio
async def test_get_elearning_schedule_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "12345678")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/schedule")

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["data"]) == 6
        first = data["data"][0]
        assert first["kode"] == "101"
        assert first["hari"] == "Jumat"
        assert first["jam"] == "07:30-09:10"
        assert first["ruang"] == "EL2-P1"
        assert first["kode_dosen"] == "BDM"


@pytest.mark.asyncio
async def test_get_elearning_dashboard_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "12345678")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    sch_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")
    assign_html = (FIXTURES / "el_assignment_1.html").read_text(encoding="utf-8")
    makeup_html = (FIXTURES / "el_kuliah_pengganti.html").read_text(encoding="utf-8")
    quiz_html = (FIXTURES / "el_exercise.html").read_text(encoding="utf-8")
    profile_html = '<input name="name" value="Budi Perkasa"><input name="email" value="budi@bsi.ac.id">'

    async def mock_fetch(path: str, nim: str, password: str) -> str:
        if path == "/sch":
            return sch_html
        if path == "/assignment":
            return assign_html
        if path == "/kuliah-pengganti":
            return makeup_html
        if path == "/exercise":
            return quiz_html
        if path == "/profil":
            return profile_html
        return ""

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", side_effect=mock_fetch):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/dashboard")

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        dash = data["data"]
        assert "courses" in dash
        assert "schedule" in dash
        assert "assignments" in dash
        assert "makeups" in dash
        assert "quiz" in dash
        assert "profile" in dash

        assert len(dash["courses"]) == 6
        assert len(dash["schedule"]) == 6
        assert dash["profile"]["nama"] == "Budi Perkasa"
        assert dash["profile"]["email"] == "budi@bsi.ac.id"
