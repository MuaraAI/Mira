"""Peta mengajar dosen: dicatat anonim dari jadwal MyBest, dibaca lewat /v1/lecturers/{kode}/schedule."""
import sqlite3

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture(autouse=True)
def tmp_db(monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "teach.db"))
    from app.teaching_db import init_teaching_db

    init_teaching_db()


def _fixture_courses():
    from app.modules.elearning import parse_courses

    with open("tests/fixtures/el_sch_v2.html", encoding="utf-8") as f:
        return parse_courses(f.read())


def test_parse_and_record_stores_teaching_without_student_identity(tmp_path):
    from app.modules.elearning import _parse_and_record_courses
    from app.config import settings

    with open("tests/fixtures/el_sch_v2.html", encoding="utf-8") as f:
        courses = _parse_and_record_courses(f.read())
    assert courses and courses[0]["kelas"] == "15.1C.30"

    conn = sqlite3.connect(settings.SQLITE_DB_PATH)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(teaching_sessions)")]
    rows = conn.execute("SELECT kode_dosen, nama_mtk, kelas, hari, jam, ruang FROM teaching_sessions").fetchall()
    conn.close()
    assert not any("nim" in c or "token" in c for c in cols)
    assert ("TDL", "BAHASA INGGRIS I", "15.1C.30", "Selasa", "09:10-10:50", "EN2-P1") in rows


def test_record_is_idempotent_and_skips_invalid_rows():
    from app.teaching_db import _sessions_sync, record_courses

    courses = _fixture_courses()
    record_courses(courses)
    record_courses(courses)
    record_courses([{"kode_dosen": "-", "hari": "Selasa", "nama": "X"}, {"kode_dosen": "ABC", "hari": "Teori", "nama": "Y"}])
    sessions = _sessions_sync("tdl")
    assert len(sessions) == 1 and sessions[0]["nama"] == "BAHASA INGGRIS I"
    assert _sessions_sync("-") == [] and _sessions_sync("ABC") == []


def test_stale_sessions_are_ignored():
    from app.config import settings
    from app.teaching_db import _sessions_sync, record_courses

    record_courses(_fixture_courses())
    conn = sqlite3.connect(settings.SQLITE_DB_PATH)
    conn.execute("UPDATE teaching_sessions SET last_seen = '2020-01-01T00:00:00Z'")
    conn.commit()
    conn.close()
    assert _sessions_sync("TDL") == []


@pytest.mark.asyncio
async def test_lecturer_schedule_endpoint():
    from app.teaching_db import record_courses

    record_courses(_fixture_courses())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ok = await ac.get("/v1/lecturers/tdl/schedule")
        bad = await ac.get("/v1/lecturers/x;drop/schedule")
    assert ok.status_code == 200
    data = ok.json()["data"]
    assert data["kode"] == "TDL" and data["subjects"] == ["BAHASA INGGRIS I"]
    assert data["sessions"][0]["hari"] == "Selasa"
    assert bad.status_code in (400, 404)
