"""Maintenance mode: saklar env, whitelist NIM, dan overlay web.

Kontrak:
- `MAINTENANCE_MODE=true` memblokir seluruh API dan dashboard, kecuali NIM di
  `MAINTENANCE_WHITELIST_NIMS` (dipisah koma).
- `GET /v1/maintenance` publik untuk frontend (teks, alasan, status).
- Penolakan API: 503 `MAINTENANCE` + `error.message` dan `error.reason`.
"""
from fastapi.testclient import TestClient


def _clear(monkeypatch):
    monkeypatch.setattr("app.config.settings.MAINTENANCE_MODE", False)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_WHITELIST_NIMS", "")


def test_maintenance_public_payload_off(monkeypatch):
    from app.main import app

    _clear(monkeypatch)
    client = TestClient(app)
    res = client.get("/v1/maintenance")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["enabled"] is False
    assert "message" in data and "reason" in data


def test_maintenance_public_payload_on(monkeypatch):
    from app.main import app

    _clear(monkeypatch)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_MODE", True)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_MESSAGE", "Mohon maaf, Mira sedang maintenance.")
    client = TestClient(app)
    data = client.get("/v1/maintenance").json()["data"]
    assert data["enabled"] is True
    assert data["message"] == "Mohon maaf, Mira sedang maintenance."


def test_login_blocked_for_non_whitelisted_nim(monkeypatch):
    from app.main import app

    _clear(monkeypatch)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_MODE", True)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_WHITELIST_NIMS", "15260767")
    client = TestClient(app)
    res = client.post(
        "/v1/auth/login",
        json={"nim": "11112222", "elearning_pass": "x"},
    )
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "MAINTENANCE"


def test_login_allowed_for_whitelisted_nim(monkeypatch):
    from unittest.mock import AsyncMock

    from app.main import app

    _clear(monkeypatch)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_MODE", True)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_WHITELIST_NIMS", "15260767, 99999999")
    monkeypatch.setattr(
        "app.captcha_autosolver.candidate_session",
        AsyncMock(return_value=({"cookies": {}, "token": "t"}, [])),
    )
    monkeypatch.setattr(
        "app.captcha_relay.create_challenge",
        AsyncMock(
            return_value={
                "id": "a" * 32,
                "image": "data:image/png;base64,AAA",
                "label": "MyBest",
                "expires_in": 300,
            }
        ),
    )
    client = TestClient(app)
    res = client.post(
        "/v1/auth/login",
        json={"nim": "15260767", "elearning_pass": "x"},
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_CAPTCHA_REQUIRED"


def test_dashboard_endpoint_blocked_without_session(monkeypatch):
    from app.main import app

    _clear(monkeypatch)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_MODE", True)
    client = TestClient(app, headers={"_skip_auto_auth": "1"})
    res = client.get("/v1/elearning/courses")
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "MAINTENANCE"


def test_health_and_capabilities_stay_open(monkeypatch):
    from app.main import app

    _clear(monkeypatch)
    monkeypatch.setattr("app.config.settings.MAINTENANCE_MODE", True)
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    assert client.get("/v1/capabilities").status_code == 200
