import pytest
from app.config import Settings

def test_settings_defaults(monkeypatch):
    monkeypatch.delenv("PORT", raising=False)
    monkeypatch.delenv("HOST", raising=False)
    monkeypatch.delenv("REDIS_URL", raising=False)
    
    s = Settings(_env_file=None)
    assert s.HOST == "127.0.0.1"
    assert s.PORT == 8300
    assert s.REDIS_URL == "redis://127.0.0.1:6379/2"
    assert s.TTL_DEFAULT == 60
    assert s.TTL_SCHEDULE == 7200
    assert s.TTL_GRADES == 1800
    assert s.TTL_ASSIGNMENTS == 600
    assert s.TTL_NEWS == 900
    assert s.TTL_LIBRARY == 3600

def test_settings_env_override(monkeypatch):
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/5")
    
    s = Settings(_env_file=None)
    assert s.PORT == 9000
    assert s.HOST == "0.0.0.0"
    assert s.REDIS_URL == "redis://localhost:6379/5"

def test_security_config_defaults(monkeypatch):
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.delenv("TRUSTED_PROXIES", raising=False)
    monkeypatch.delenv("WEB_BASE_URL", raising=False)
    cfg = Settings(_env_file=None)
    assert cfg.API_KEY == ""
    assert cfg.ALLOWED_ORIGINS == "https://mira.muaraai.com,https://ubsi-api.muaraai.com"
    assert cfg.WEB_BASE_URL == "https://mira.muaraai.com"
    assert cfg.TRUSTED_PROXIES == "127.0.0.1"

def test_session_and_root_path_settings(monkeypatch):
    monkeypatch.delenv("ROOT_PATH", raising=False)
    monkeypatch.delenv("SESSION_COOKIE_DOMAIN", raising=False)
    monkeypatch.delenv("SQLITE_DB_PATH", raising=False)

    s = Settings(_env_file=None)
    assert s.ROOT_PATH == ""
    assert s.SESSION_COOKIE_DOMAIN == ""
    assert s.SQLITE_DB_PATH == "data/ubsi.db"

    s_custom = Settings(
        _env_file=None,
        ROOT_PATH="/v1/ubsi-api",
        SESSION_COOKIE_DOMAIN=".muaraai.com",
        SQLITE_DB_PATH="/var/lib/ubsi/ubsi.db",
    )
    assert s_custom.ROOT_PATH == "/v1/ubsi-api"
    assert s_custom.SESSION_COOKIE_DOMAIN == ".muaraai.com"
    assert s_custom.SQLITE_DB_PATH == "/var/lib/ubsi/ubsi.db"

