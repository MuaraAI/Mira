"""Offline regression tests for the 14-point Deep Security Audit remediation."""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException, Request
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.deps import require_elearning_creds, require_studentv2_creds
from app.main import app
from app.modules.elearning import _safe_header_filename, is_safe_bsi_storage_url
from app.upstream_session import UpstreamSession


class _DummyUpstream(UpstreamSession):
    BASE_URL = "https://kampus.test"
    MODULE = "test"
    HOST_LABEL = "kampus.test"

    def __init__(self):
        self._logged_in = False
        self._init_upstream_session()
        self.login_attempts: list[tuple[str, str]] = []
        self._client = httpx.Client(
            transport=httpx.MockTransport(lambda req: httpx.Response(200, text="ok"))
        )

    def get_client(self) -> httpx.Client:
        return self._client

    def login(self, nim: str, password: str) -> bool:
        self.login_attempts.append((nim, password))
        return password == "correct-pass"


def test_f02_upstream_session_binds_credential_hash():
    """F-02: Warm UpstreamSession must not be reused when a different password is supplied."""
    up = _DummyUpstream()
    assert up.ensure_session("15260767", "correct-pass") is True
    assert up.ensure_session("15260767", "correct-pass") is True
    assert len(up.login_attempts) == 1

    # Wrong password for the same NIM must NOT reuse the warm session
    assert up.ensure_session("15260767", "wrong-pass") is False
    assert len(up.login_attempts) == 2


def test_f02_deps_blocks_header_override_for_non_master_auth():
    """F-02: Non-master authenticated requests cannot fall back to X-Studentv2-NIM/X-Elearning-NIM headers."""
    req = Request(
        {
            "type": "http",
            "headers": [
                (b"x-studentv2-nim", b"99999999"),
                (b"x-studentv2-pass", b"spoofed"),
                (b"x-elearning-nim", b"99999999"),
                (b"x-elearning-pass", b"spoofed"),
            ],
            "state": {"_auth_ran": True, "is_master": False},
        }
    )
    with pytest.raises(HTTPException) as exc_sv2:
        require_studentv2_creds(req)
    assert exc_sv2.value.status_code == 401

    with pytest.raises(HTTPException) as exc_el:
        require_elearning_creds(req)
    assert exc_el.value.status_code == 401

    # Master key requests are still allowed to use developer override headers
    req_master = Request(
        {
            "type": "http",
            "headers": [
                (b"x-studentv2-nim", b"15260767"),
                (b"x-studentv2-pass", b"master-override"),
            ],
            "state": {"_auth_ran": True, "is_master": True},
        }
    )
    assert require_studentv2_creds(req_master) == ("15260767", "master-override")


@pytest.mark.asyncio
async def test_f02_lecturers_rejects_oversized_search():
    """F-02: /v1/studentv2/lecturers bounds search query length to prevent Redis LGG bloat."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(f"/v1/studentv2/lecturers?search={'A' * 101}")
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_f04_auth_failure_rate_limit_and_stats_module_allowlist():
    """F-04: Failed auth attempts are rate-limited and stats module names are allowlisted."""
    from app.stats import record_request

    fake_redis = AsyncMock()
    with patch("app.stats.cache.get_client", AsyncMock(return_value=fake_redis)):
        await record_request("random_unbounded_path_12345", None)

    incr_keys = [call.args[0] for call in fake_redis.incr.await_args_list]
    assert any(":requests:other:" in k for k in incr_keys)
    assert not any("random_unbounded_path_12345" in k for k in incr_keys)

    with patch("app.main.limiter.is_allowed", AsyncMock(return_value=False)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get(
                "/v1/studentv2/schedule",
                headers={"_skip_auto_auth": "1", "X-API-Key": "invalid-key"},
            )
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_f08_pwa_devices_masks_endpoint_and_upsert_keeps_row_id(tmp_path, monkeypatch):
    """F-08: Upserting an existing PWA endpoint preserves its row ID and /devices masks the token."""
    from app.pwa_push_db import add_subscription, init_pwa_db, list_subscriptions

    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "pwa_sec.db"))
    init_pwa_db()

    ep1 = "https://fcm.googleapis.com/fcm/send/secret_capability_token_111111"
    id1 = await add_subscription("15260767", ep1, "k1", "a1", "Device 1")
    assert id1 > 0

    for idx in range(2, 6):
        await add_subscription(
            "15260767",
            f"https://fcm.googleapis.com/fcm/send/secret_capability_token_{idx}_long_suffix",
            f"k{idx}",
            f"a{idx}",
            f"Device {idx}",
        )

    # Re-subscribing ep1 when 5 devices exist must return id1 (> 0) and NOT evict ep1
    id1_again = await add_subscription("15260767", ep1, "k1_new", "a1_new", "Device 1")
    assert id1_again == id1

    masked_devices = await list_subscriptions("15260767", active_only=True, mask_endpoint=True)
    assert len(masked_devices) == 5
    assert any(d["id"] == id1 for d in masked_devices)
    for d in masked_devices:
        assert "..." in d["endpoint"]
        assert "secret_capability_token_111111" not in d["endpoint"]


@pytest.mark.asyncio
async def test_f09_session_key_id_uses_nim_not_token_prefix():
    """F-09: Multiple session tokens for the same NIM share a single rate-limit bucket."""
    fake_session = {
        "nim": "15260767",
        "studentv2_pass": "pw",
        "elearning_pass": "pw",
    }
    seen_identifiers: list[str] = []

    async def fake_is_allowed(identifier: str, limit: int = 60) -> bool:
        seen_identifiers.append(identifier)
        return True

    with patch("app.session_store.session_store.resolve", AsyncMock(return_value=fake_session)), \
         patch("app.main.limiter.is_allowed", side_effect=fake_is_allowed), \
         patch("app.main.record_request", AsyncMock()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            await ac.get(
                "/v1/auth/me",
                headers={"_skip_auto_auth": "1", "Authorization": "Bearer sess_token_alpha_111"},
            )
            await ac.get(
                "/v1/auth/me",
                headers={"_skip_auto_auth": "1", "Authorization": "Bearer sess_token_beta_222"},
            )

    assert seen_identifiers == ["key:session:15260767", "key:session:15260767"]


def test_f10_storage_url_requires_https_and_sanitizes_headers():
    """F-10: Storage URL validator rejects plain HTTP and header filename sanitizer strips CRLF/quotes."""
    assert is_safe_bsi_storage_url("https://elearning.bsi.ac.id/storage/soal/tugas1.pdf") is True
    assert is_safe_bsi_storage_url("http://elearning.bsi.ac.id/storage/soal/tugas1.pdf") is False
    assert _safe_header_filename('evil"\r\nX-Injected: 1.pdf', "fallback.pdf") == "evil_X-Injected: 1.pdf"


def test_f11_mcp_http_transport_does_not_leak_server_env_credentials(monkeypatch):
    """F-11: Remote MCP HTTP/SSE calls without caller credentials must not inherit server env keys."""
    import app.mcp_server as mcp_mod

    monkeypatch.setenv("MIRA_API_KEY", "muara_mira_server_owner_secret_key")
    monkeypatch.setenv("MIRA_SESSION_TOKEN", "server_owner_session_token")

    # 1. When HTTP context is active with empty headers, env credentials must not leak
    ctx = MagicMock()
    ctx.headers = {}
    tok = mcp_mod._current_mcp_context.set(ctx)
    try:
        headers = mcp_mod._build_headers()
        assert "Authorization" not in headers
        assert "X-API-Key" not in headers
        assert "Cookie" not in headers
    finally:
        mcp_mod._current_mcp_context.reset(tok)

    # 2. When transport is streamable-http, even with ctx=None env credentials must not leak
    monkeypatch.setattr(mcp_mod, "_active_transport", "streamable-http")
    headers_http = mcp_mod._build_headers()
    assert "Authorization" not in headers_http
    assert "X-API-Key" not in headers_http


@pytest.mark.asyncio
async def test_f14_api_key_redis_cache_uses_key_hash_and_wildcard_origin_blocked(tmp_path, monkeypatch):
    """F-14: create_api_key caches under ubsi:apikey:<key_hash> and ALLOWED_ORIGINS=* never enables cookie CSRF."""
    from app.api_keys_db import create_api_key, init_api_keys_db

    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "keys_sec.db"))
    init_api_keys_db()

    fake_redis = AsyncMock()
    with patch("app.api_keys_db.cache.get_client", AsyncMock(return_value=fake_redis)):
        await create_api_key("15260767", "Test Key", "sv2_pw", "el_pw")

    assert fake_redis.set.await_count == 1
    redis_key = fake_redis.set.await_args.args[0]
    assert redis_key.startswith("ubsi:apikey:")
    assert redis_key != "ubsi:apikey:..."
    assert len(redis_key.split(":")[-1]) == 128

    # Wildcard ALLOWED_ORIGINS must not allow untrusted Origin to use ambient cookie auth
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", "*")
    with patch("app.session_store.session_store.resolve", AsyncMock(return_value={"nim": "15260767", "studentv2_pass": "a", "elearning_pass": "b"})), \
         patch("app.main.limiter.is_allowed", AsyncMock(return_value=True)):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"_skip_auto_auth": "1"},
        ) as ac:
            ac.cookies.set("ubsi_session", "valid_cookie_token")
            res = await ac.get(
                "/v1/auth/me",
                headers={"Origin": "https://attacker.example"},
            )
    assert res.status_code == 401
