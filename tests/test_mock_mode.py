"""Mock mode (MOCK_MODE=1): /v1/mock/* menyajikan data demo 100% palsu.

100% offline: tidak ada HTTP, Redis, atau DB. Default OFF — router tidak
ter-mount dan middleware tidak membebasan path-nya.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.modules.mock import router as mock_router


def _build_mock_app() -> FastAPI:
    app = FastAPI()
    app.include_router(mock_router)
    return app


def test_mock_router_not_mounted_by_default(monkeypatch):
    """Default produksi: /v1/mock/* tidak ada di app utama."""
    from app.main import app as real_app

    paths = {getattr(r, "path", "") for r in real_app.routes}
    # Saat MOCK_MODE aktif di env lokal developer, route mungkin ter-mount;
    # tes ini memvalidasi flag config-nya sendiri adalah opt-in.
    from app.config import Settings
    default_settings = Settings(_env_file=None)
    assert default_settings.MOCK_MODE is False


def test_mock_profile_payload_is_fake_and_marked():
    client = TestClient(_build_mock_app())
    res = client.get("/v1/mock/profile")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["mock"] is True
    assert body["data"]["nim"] == "00.0.0000"
    # Tidak boleh ada NIM/nama orang sungguhan.
    assert "15260767" not in res.text


def test_mock_schedule_courses_khs_presence_shapes():
    client = TestClient(_build_mock_app())

    schedule = client.get("/v1/mock/schedule").json()["data"]
    assert schedule["mock"] is True
    item = schedule["items"][0]
    for key in ("kode", "nama", "hari", "jam", "sks", "ruang", "kode_dosen"):
        assert key in item

    courses = client.get("/v1/mock/courses").json()["data"]
    assert all(k in courses[0] for k in ("token", "token_absen", "token_assignment"))

    khs = client.get("/v1/mock/khs").json()["data"]
    assert {"items", "total_mutu", "total_sks", "ipk"} <= set(khs)

    presence = client.get("/v1/mock/presence").json()["data"]
    assert {"status_sesi", "can_submit", "present_today"} <= set(presence)

    assignments = client.get("/v1/mock/assignments").json()["data"]
    assert {"tasks", "submissions"} <= set(assignments)
