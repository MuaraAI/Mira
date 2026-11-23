import json
import sqlite3

import pytest

from app.account_links import (
    get_link_secret,
    init_account_links_db,
    set_link,
    unlink,
)
from app.api_keys_db import (
    _get_fernet,
    _hash_key,
    create_api_key,
    get_credentials_for_nim,
    init_api_keys_db,
    resolve_api_key,
    update_password_for_nim,
)
from app.cache import cache
from app.config import settings


def _decrypt_payload(encrypted: str) -> dict:
    return json.loads(_get_fernet().decrypt(encrypted.encode("utf-8")).decode("utf-8"))


def _stored_credential(nim: str) -> dict:
    with sqlite3.connect(settings.SQLITE_DB_PATH) as conn:
        row = conn.execute(
            "SELECT encrypted_creds FROM api_keys WHERE nim = ?", (nim,)
        ).fetchone()
    return _decrypt_payload(row[0])


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
async def api_key(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "mira.sqlite3"))
    monkeypatch.setattr(settings, "API_KEY", "test-master-secret-key-123456789")
    monkeypatch.setattr(settings, "SIAKAD_ENABLED", True)
    init_api_keys_db()
    await init_account_links_db()
    fake_redis = FakeRedis()
    monkeypatch.setattr(cache, "_client", fake_redis)

    key = await create_api_key("nim-1", "test", "old-siakad", "mybest-password")
    return fake_redis, key["key"]


@pytest.mark.asyncio
async def test_api_key_reads_canonical_link_added_after_key_creation(api_key):
    _, plain_key = api_key
    await set_link("nim-1", "siakad", kind="password", secret="canonical-siakad")

    resolved = await resolve_api_key(plain_key)

    assert resolved["studentv2_pass"] == "canonical-siakad"
    assert resolved["elearning_pass"] == "mybest-password"


@pytest.mark.asyncio
async def test_api_key_cache_cannot_restore_unlinked_password(api_key):
    redis, plain_key = api_key
    redis.values[f"ubsi:apikey:{_hash_key(plain_key)}"] = _get_fernet().encrypt(
        json.dumps(
            {
                "nim": "nim-1",
                "studentv2_pass": "stale-siakad",
                "elearning_pass": "mybest-password",
            }
        ).encode("utf-8")
    ).decode("utf-8")

    await set_link("nim-1", "siakad", kind="password", secret="canonical-siakad")
    assert (await resolve_api_key(plain_key))["studentv2_pass"] == "canonical-siakad"

    await unlink("nim-1", "siakad")
    resolved = await resolve_api_key(plain_key)

    assert resolved["studentv2_pass"] == ""
    assert resolved["elearning_pass"] == "mybest-password"


@pytest.mark.asyncio
async def test_api_key_does_not_expose_legacy_siakad_without_canonical_link(api_key):
    _, plain_key = api_key

    resolved = await resolve_api_key(plain_key)

    assert resolved["studentv2_pass"] == ""
    assert resolved["elearning_pass"] == "mybest-password"


@pytest.mark.asyncio
async def test_api_key_sees_link_mutations_without_waiting_for_cache_ttl(api_key):
    redis, plain_key = api_key
    link_key = "ubsi:acct:link:nim-1:siakad"
    redis.values[f"ubsi:apikey:{_hash_key(plain_key)}"] = _get_fernet().encrypt(
        json.dumps(
            {
                "nim": "nim-1",
                "studentv2_pass": "old-siakad",
                "elearning_pass": "mybest-password",
            }
        ).encode("utf-8")
    ).decode("utf-8")

    await set_link("nim-1", "siakad", kind="password", secret="secret-baru")
    assert not any(key.startswith(link_key) for key in redis.values)
    assert (await resolve_api_key(plain_key))["studentv2_pass"] == "secret-baru"

    await unlink("nim-1", "siakad")
    assert not any(key.startswith(link_key) for key in redis.values)
    assert (await resolve_api_key(plain_key))["studentv2_pass"] == ""
    assert await get_link_secret("nim-1", "siakad") is None


@pytest.mark.asyncio
async def test_background_credentials_read_canonical_siakad(api_key):
    _, _ = api_key
    assert (await get_credentials_for_nim("nim-1"))[1] == ""

    await set_link("nim-1", "siakad", kind="password", secret="canonical-siakad")

    nim, siakad_pass, elearning_pass = await get_credentials_for_nim("nim-1")
    assert nim == "nim-1"
    assert siakad_pass == "canonical-siakad"
    assert elearning_pass == "mybest-password"

    await unlink("nim-1", "siakad")
    assert (await get_credentials_for_nim("nim-1"))[1] == ""


@pytest.mark.asyncio
async def test_siakad_disabled_never_exposes_link_secret(api_key, monkeypatch):
    _, plain_key = api_key
    monkeypatch.setattr(settings, "SIAKAD_ENABLED", False)
    await set_link("nim-1", "siakad", kind="password", secret="canonical-siakad")

    assert (await resolve_api_key(plain_key))["studentv2_pass"] == ""
    assert (await get_credentials_for_nim("nim-1"))[1] == ""


@pytest.mark.asyncio
async def test_api_key_never_stores_siakad_copy(api_key):
    redis, plain_key = api_key
    await set_link("nim-1", "siakad", kind="password", secret="canonical-siakad")

    resolved = await resolve_api_key(plain_key)

    assert resolved["studentv2_pass"] == "canonical-siakad"
    assert "studentv2_pass" not in _stored_credential("nim-1")
    cached = _decrypt_payload(redis.values[f"ubsi:apikey:{_hash_key(plain_key)}"])
    assert "studentv2_pass" not in cached


@pytest.mark.asyncio
async def test_update_password_for_siakad_does_not_touch_api_key_copy(api_key):
    redis, plain_key = api_key
    await set_link("nim-1", "siakad", kind="password", secret="canonical-siakad")

    assert await update_password_for_nim("nim-1", "studentv2_pass", "secret-baru") == 0
    assert "studentv2_pass" not in _stored_credential("nim-1")
    cached = _decrypt_payload(redis.values[f"ubsi:apikey:{_hash_key(plain_key)}"])
    assert "studentv2_pass" not in cached
    assert (await resolve_api_key(plain_key))["studentv2_pass"] == "canonical-siakad"


@pytest.mark.asyncio
async def test_credentials_tuple_keeps_shape_with_canonical_siakad(api_key):
    _, _ = api_key
    await set_link("nim-1", "siakad", kind="password", secret="canonical-siakad")

    assert await get_credentials_for_nim("nim-1") == (
        "nim-1",
        "canonical-siakad",
        "mybest-password",
    )
