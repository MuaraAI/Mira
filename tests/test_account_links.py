import pytest

from app.account_links import (
    get_link_secret,
    get_link_status,
    import_legacy_siakad,
    init_account_links_db,
    mark_needs_relink,
    set_link,
    unlink,
)
from app.cache import cache
from app.config import settings


class FakeRedis:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = str(value)
        return True

    async def delete(self, *keys):
        removed = 0
        for key in keys:
            if key in self.values:
                del self.values[key]
                removed += 1
        return removed


@pytest.fixture
async def account_link_env(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "links.sqlite3"))
    monkeypatch.setattr(settings, "API_KEY", "test-master-secret-key-123456789")
    monkeypatch.setattr(settings, "SIAKAD_ENABLED", True)
    fake_redis = FakeRedis()
    monkeypatch.setattr(cache, "_client", fake_redis)
    await init_account_links_db()
    return fake_redis


@pytest.mark.asyncio
async def test_set_then_get_roundtrip(account_link_env):
    await set_link("12345678", "siakad", kind="password", secret="rahasia")

    assert await get_link_status("12345678", "siakad") == "linked"
    assert await get_link_secret("12345678", "siakad") == "rahasia"
    assert "rahasia" not in str(account_link_env.values)


@pytest.mark.asyncio
async def test_unlink_is_tombstone_and_blocks_legacy_import(account_link_env):
    await set_link("12345678", "siakad", kind="password", secret="rahasia")

    assert await unlink("12345678", "siakad") is True
    assert await get_link_status("12345678", "siakad") == "unlinked"
    assert await get_link_secret("12345678", "siakad") is None
    assert await import_legacy_siakad("12345678", "rahasia-lama") is False
    assert await get_link_secret("12345678", "siakad") is None


@pytest.mark.asyncio
async def test_import_legacy_is_idempotent_and_respects_tombstone(account_link_env):
    assert await import_legacy_siakad("12345678", "password-awal") is True
    assert await import_legacy_siakad("12345678", "password-baru") is False

    assert await get_link_status("12345678", "siakad") == "linked"
    assert await get_link_secret("12345678", "siakad") == "password-awal"

    await unlink("12345678", "siakad")
    assert await import_legacy_siakad("12345678", "password-lain") is False
    assert await get_link_secret("12345678", "siakad") is None


@pytest.mark.asyncio
async def test_missing_link_returns_none(account_link_env):
    assert await get_link_status("12345678", "siakad") is None
    assert await get_link_secret("12345678", "siakad") is None
    assert await unlink("12345678", "siakad") is False


@pytest.mark.asyncio
async def test_mark_needs_relink_keeps_secret_but_blocks_secret_read(account_link_env):
    await set_link("12345678", "siakad", kind="password", secret="rahasia")

    await mark_needs_relink("12345678")

    assert await get_link_status("12345678", "siakad") == "needs_relink"
    assert await get_link_secret("12345678", "siakad") is None


@pytest.mark.asyncio
async def test_mutations_purge_link_cache(account_link_env):
    link_key = "ubsi:acct:link:12345678:siakad"
    account_link_env.values[f"{link_key}:fresh"] = "stale"
    account_link_env.values[f"{link_key}:lgg"] = "stale"

    await set_link("12345678", "siakad", kind="password", secret="rahasia")

    assert not any(key.startswith(link_key) for key in account_link_env.values)
    assert await get_link_secret("12345678", "siakad") == "rahasia"
    assert await get_link_status("12345678", "siakad") == "linked"

    await mark_needs_relink("12345678")
    assert not any(key.startswith(link_key) for key in account_link_env.values)

    await unlink("12345678", "siakad")
    assert not any(key.startswith(link_key) for key in account_link_env.values)


@pytest.mark.asyncio
async def test_providers_are_independent(account_link_env):
    await set_link("12345678", "siakad", kind="password", secret="rahasia-siakad")
    await set_link("12345678", "google", kind="oauth", secret="token-google")

    assert await get_link_secret("12345678", "siakad") == "rahasia-siakad"
    assert await get_link_secret("12345678", "google") == "token-google"

    await unlink("12345678", "siakad")

    assert await get_link_secret("12345678", "siakad") is None
    assert await get_link_secret("12345678", "google") == "token-google"
