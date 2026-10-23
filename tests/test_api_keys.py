import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.api_keys_db import (
    init_api_keys_db,
    create_api_key,
    list_api_keys,
    revoke_api_key,
    resolve_api_key,
)
from app.session_store import session_store


class FakeRedis:
    def __init__(self):
        self.kv: dict = {}
        self.sets: dict = {}

    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, val, ex=None):
        self.kv[key] = str(val)
        return True

    async def delete(self, *keys):
        c = 0
        for k in keys:
            if k in self.kv:
                del self.kv[k]
                c += 1
            if k in self.sets:
                del self.sets[k]
                c += 1
        return c

    async def expire(self, key, seconds):
        return True

    async def sadd(self, key, *members):
        s = self.sets.setdefault(key, set())
        for m in members:
            s.add(str(m))
        return len(members)

    async def smembers(self, key):
        return self.sets.get(key, set())

    async def srem(self, key, *members):
        s = self.sets.get(key, set())
        for m in members:
            s.discard(str(m))
        return len(members)

    async def incr(self, key):
        self.kv[key] = int(self.kv.get(key, 0)) + 1
        return self.kv[key]


@pytest.fixture(autouse=True)
def setup_test_env(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_ubsi.db")
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", test_db)
    monkeypatch.setattr("app.config.settings.API_KEY", "test_master_secret_key_123456789")
    init_api_keys_db()

    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    # Mock cache client for api_keys_db
    monkeypatch.setattr("app.cache.cache.get_client", lambda: fake)


@pytest.mark.asyncio
async def test_api_key_lifecycle_direct():
    # 1. Create Key (New keys should use muara_mira_ prefix)
    key_info = await create_api_key("15260767", "Bot Discord", "pass_sv2", "pass_el")
    assert key_info["nim"] == "15260767"
    assert key_info["name"] == "Bot Discord"
    assert key_info["key"].startswith("muara_mira_")
    plain_key = key_info["key"]

    # Pastikan password kampus TIDAK disimpan plaintext di Redis
    import inspect
    from app.cache import cache
    getter = cache.get_client()
    r_client = await getter if inspect.isawaitable(getter) else getter
    for val in getattr(r_client, "kv", {}).values():
        assert "pass_sv2" not in str(val), "Password kampus tidak boleh bocor plaintext di Redis!"
        assert "pass_el" not in str(val), "Password kampus tidak boleh bocor plaintext di Redis!"

    # 2. List Keys
    keys = await list_api_keys("15260767")
    assert len(keys) == 1
    assert keys[0]["id"] == key_info["id"]
    assert "key" not in keys[0]  # Plain key never returned in list
    assert keys[0]["prefix"].startswith("muara_mira_")

    # 3. Resolve Key
    resolved = await resolve_api_key(plain_key)
    assert resolved is not None
    assert resolved["nim"] == "15260767"
    assert resolved["studentv2_pass"] == "pass_sv2"
    assert resolved["elearning_pass"] == "pass_el"

    # 4. Resolve Legacy Key format (muara_ubsi_)
    legacy_key = "muara_ubsi_" + "a" * 40
    # Invalid random hex will return None because not in DB, but doesn't crash regex
    assert await resolve_api_key(legacy_key) is None
    assert await resolve_api_key("muara_mira_invalid_random_string_12345") is None
    assert await resolve_api_key("not_muara_prefix") is None

    # 5. Revoke Key
    revoked = await revoke_api_key("15260767", key_info["id"])
    assert revoked is True
    assert await resolve_api_key(plain_key) is None

    # 6. List after revoke
    keys_after = await list_api_keys("15260767")
    assert len(keys_after) == 0


@pytest.mark.asyncio
async def test_api_key_legacy_migration():
    import json
    from app.api_keys_db import (
        _legacy_hash_key,
        _legacy_get_fernet,
        _mask_key,
        _hash_key,
        resolve_api_key,
        _connect,
    )

    # 1. Manually insert legacy key (SHA256 hash + legacy Fernet)
    legacy_plain = "muara_ubsi_11223344556677889900aabbccddeeff11223344"
    legacy_hash = _legacy_hash_key(legacy_plain)
    assert len(legacy_hash) == 64

    f_leg = _legacy_get_fernet()
    enc_creds = f_leg.encrypt(
        json.dumps({"studentv2_pass": "leg_sv2", "elearning_pass": "leg_el"}).encode("utf-8")
    ).decode("utf-8")

    conn = _connect()
    conn.execute(
        """
        INSERT INTO api_keys (nim, name, key_hash, key_prefix, encrypted_creds, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
        """,
        ("15260999", "Legacy Bot", legacy_hash, _mask_key(legacy_plain), enc_creds),
    )
    conn.commit()
    conn.close()

    # 2. Resolve via resolve_api_key (auto migration happens!)
    resolved = await resolve_api_key(legacy_plain)
    assert resolved is not None
    assert resolved["nim"] == "15260999"
    assert resolved["studentv2_pass"] == "leg_sv2"
    assert resolved["elearning_pass"] == "leg_el"

    # 3. Verify in SQLite that key_hash was migrated to BLAKE2b (128 chars)
    new_hash = _hash_key(legacy_plain)
    assert len(new_hash) == 128
    conn2 = _connect()
    row = conn2.execute("SELECT key_hash FROM api_keys WHERE nim = ?", ("15260999",)).fetchone()
    conn2.close()
    assert row["key_hash"] == new_hash


@pytest.mark.asyncio
async def test_api_key_endpoints_async():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Create session
        session_token = await session_store.create(
            nim="15260767",
            studentv2_pass="pass_sv2_real",
            elearning_pass="pass_el_real",
        )
        headers = {"Authorization": f"Bearer {session_token}"}

        # 2. Get keys (initially empty)
        res = await client.get("/v1/auth/keys", headers=headers)
        assert res.status_code == 200
        assert res.json()["data"]["keys"] == []

        # 3. Create key
        res_create = await client.post(
            "/v1/auth/keys", headers=headers, json={"name": "Otomasi Mahasiswa"}
        )
        assert res_create.status_code == 200
        created_data = res_create.json()["data"]
        plain_key = created_data["key"]
        assert plain_key.startswith("muara_mira_")
        key_id = created_data["id"]

        # 4. Access endpoint using Personal API Key (Bearer)
        apikey_headers = {"Authorization": f"Bearer {plain_key}"}
        res_me = await client.get("/v1/auth/me", headers=apikey_headers)
        assert res_me.status_code == 200
        assert res_me.json()["data"]["nim"] == "15260767"
        assert res_me.json()["data"]["auth_type"] == "api_key"

        # Also test X-API-Key header
        res_me_x = await client.get("/v1/auth/me", headers={"x-api-key": plain_key})
        assert res_me_x.status_code == 200
        assert res_me_x.json()["data"]["nim"] == "15260767"

        # Personal keys may use data routes but cannot manage key lifecycle.
        assert (await client.get("/v1/auth/keys", headers=apikey_headers)).status_code == 403
        assert (await client.post("/v1/auth/keys", headers=apikey_headers, json={"name": "Escalation"})).status_code == 403
        assert (await client.delete(f"/v1/auth/keys/{key_id}", headers=apikey_headers)).status_code == 403

        # 5. Revoke key
        res_del = await client.delete(f"/v1/auth/keys/{key_id}", headers=headers)
        assert res_del.status_code == 200
        assert res_del.json()["data"]["revoked"] is True

        # 6. Access with revoked key -> 401
        res_me_revoked = await client.get("/v1/auth/me", headers=apikey_headers)
        assert res_me_revoked.status_code == 401
        assert res_me_revoked.json()["error"]["code"] == "UNAUTHORIZED"
