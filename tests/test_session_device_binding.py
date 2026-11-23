"""Sesi terikat device: pencabutan hanya menghapus token device yang ditarget."""
import pytest

from app.session_store import (
    SESSION_TTL_SECONDS,
    _DEVICE_INDEX_PREFIX,
    _INDEX_PREFIX,
    _KEY_PREFIX,
    _hash_token,
    session_store,
)
from tests.test_login_guard import FakeRedis


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    return fake


@pytest.mark.asyncio
async def test_delete_all_for_device_only_revokes_target_device(fake_redis):
    nim = "12345678"
    device_token = await session_store.create(nim, "sv-pass", "el-pass", device_id="dev-a")
    legacy_token = await session_store.create(nim, "sv-pass", "el-pass")

    device_data = await session_store.resolve(device_token)
    legacy_data = await session_store.resolve(legacy_token)
    assert device_data["device_id"] == "dev-a"
    assert legacy_data["device_id"] is None

    device_index_key = f"{_DEVICE_INDEX_PREFIX}{nim}:dev-a"
    assert await fake_redis.smembers(device_index_key) == {_hash_token(device_token)}
    assert fake_redis.ttls[device_index_key] == SESSION_TTL_SECONDS
    assert await fake_redis.smembers(_INDEX_PREFIX + nim) == {
        _hash_token(device_token),
        _hash_token(legacy_token),
    }

    assert await session_store.delete_all_for_device(nim, "dev-a") == 1

    assert await session_store.resolve(device_token) is None
    assert (await session_store.resolve(legacy_token))["nim"] == nim
    assert device_index_key not in fake_redis.sets
    assert await fake_redis.smembers(_INDEX_PREFIX + nim) == {_hash_token(legacy_token)}

    assert await session_store.delete_all_for_device(nim, "dev-a") == 0
    assert (await session_store.resolve(legacy_token))["nim"] == nim


@pytest.mark.asyncio
async def test_delete_all_for_device_handles_multiple_tokens_and_other_devices(fake_redis):
    nim = "12345678"
    first = await session_store.create(nim, "sv-pass", "el-pass", device_id="dev-a")
    second = await session_store.create(nim, "sv-pass", "el-pass", device_id="dev-a")
    other = await session_store.create(nim, "sv-pass", "el-pass", device_id="dev-b")
    legacy = await session_store.create(nim, "sv-pass", "el-pass")

    assert await session_store.delete_all_for_device(nim, "dev-a") == 2

    assert await session_store.resolve(first) is None
    assert await session_store.resolve(second) is None
    assert (await session_store.resolve(other))["device_id"] == "dev-b"
    assert (await session_store.resolve(legacy))["device_id"] is None
    assert await fake_redis.smembers(f"{_DEVICE_INDEX_PREFIX}{nim}:dev-b") == {
        _hash_token(other)
    }
    assert await fake_redis.smembers(_INDEX_PREFIX + nim) == {
        _hash_token(other),
        _hash_token(legacy),
    }
    assert (_KEY_PREFIX + _hash_token(first)) not in fake_redis.kv
    assert (_KEY_PREFIX + _hash_token(second)) not in fake_redis.kv


@pytest.mark.asyncio
async def test_resolve_refreshes_device_index_ttl(fake_redis):
    nim = "12345678"
    token = await session_store.create(nim, "sv-pass", "el-pass", device_id="dev-a")
    device_index_key = f"{_DEVICE_INDEX_PREFIX}{nim}:dev-a"
    fake_redis.ttls[device_index_key] = 1

    assert (await session_store.resolve(token))["device_id"] == "dev-a"

    assert fake_redis.ttls[device_index_key] == SESSION_TTL_SECONDS
    assert await fake_redis.smembers(device_index_key) == {_hash_token(token)}


@pytest.mark.asyncio
async def test_resolve_recreates_missing_device_index(fake_redis):
    nim = "12345678"
    token = await session_store.create(nim, "sv-pass", "el-pass", device_id="dev-a")
    device_index_key = f"{_DEVICE_INDEX_PREFIX}{nim}:dev-a"
    fake_redis.sets.pop(device_index_key)
    fake_redis.ttls.pop(device_index_key)

    assert (await session_store.resolve(token))["device_id"] == "dev-a"

    assert await fake_redis.smembers(device_index_key) == {_hash_token(token)}
    assert fake_redis.ttls[device_index_key] == SESSION_TTL_SECONDS
    assert await session_store.delete_all_for_device(nim, "dev-a") == 1
    assert await session_store.resolve(token) is None


@pytest.mark.asyncio
async def test_delete_removes_token_from_device_index(fake_redis):
    nim = "12345678"
    first = await session_store.create(nim, "sv-pass", "el-pass", device_id="dev-a")
    sibling = await session_store.create(nim, "sv-pass", "el-pass", device_id="dev-a")
    device_index_key = f"{_DEVICE_INDEX_PREFIX}{nim}:dev-a"

    await session_store.delete(first)

    assert await fake_redis.smembers(device_index_key) == {_hash_token(sibling)}
    assert await fake_redis.smembers(_INDEX_PREFIX + nim) == {_hash_token(sibling)}
    assert await session_store.resolve(first) is None
    assert (await session_store.resolve(sibling))["device_id"] == "dev-a"
    assert await session_store.delete_all_for_device(nim, "dev-a") == 1
