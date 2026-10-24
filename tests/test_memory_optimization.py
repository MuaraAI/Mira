"""Offline unit tests for Backend & MCP Server Memory Optimizations (M-01 to M-12)."""
from __future__ import annotations

import time
from collections import OrderedDict
from unittest.mock import MagicMock, patch

import pytest

from app.api_keys_db import _get_fernet, _legacy_get_fernet
from app.file_cache import FileCache, FileEntry, _MAX_LOCKS
from app.modules.auth import verify_live_credentials
from app.pwa_webpush import _cached_private_key
from app.session_pool import SessionPool
from app.session_store import _derive_aes_key, _get_aesgcm
from app.stats import _digest_key
from app.upstream_session import SHARED_HTTP_LIMITS, SHARED_SSL_CONTEXT
import app.mcp_server as mcp_server


@pytest.mark.asyncio
async def test_file_cache_evict_expired_and_locks_bounded():
    fc = FileCache(max_bytes=1024 * 1024, ttl=10)
    fc.set(
        "k1",
        FileEntry(
            data=b"hello",
            content_type="text/plain",
            disposition='inline; filename="a.txt"',
            etag='"123"',
            stored_at=time.monotonic(),
        ),
    )
    assert fc.get("k1") is not None

    # Force expiry
    fc._items["k1"].stored_at = time.monotonic() - 20.0
    evicted = fc.evict_expired()
    assert evicted == 1
    assert "k1" not in fc._items
    assert fc._size == 0

    # Verify _locks stays bounded at _MAX_LOCKS
    for i in range(_MAX_LOCKS + 25):
        fc.lock(f"key-{i}")
    assert len(fc._locks) <= _MAX_LOCKS


@pytest.mark.asyncio
async def test_verify_live_credentials_closes_temporary_clients():
    sv2_instance = MagicMock()
    sv2_instance.login.return_value = True
    el_instance = MagicMock()
    el_instance.login.return_value = True

    with patch("app.modules.auth.StudentV2Client", return_value=sv2_instance), patch(
        "app.modules.auth.ElearningClient", return_value=el_instance
    ):
        ok_sv2, ok_el = await verify_live_credentials("12345678", "pass1", "pass2")
        assert ok_sv2 is True
        assert ok_el is True
        sv2_instance.close.assert_called_once()
        el_instance.close.assert_called_once()


def test_session_pool_ordered_dict_lru_and_shared_tls():
    closed = []

    class DummyClient:
        def __init__(self):
            self.closed = False

        def close(self):
            self.closed = True
            closed.append(self)

    pool = SessionPool(DummyClient, ttl_seconds=300, max_sessions=2)
    assert isinstance(pool._sessions, OrderedDict)
    c1 = pool.get("nim1")
    c2 = pool.get("nim2")
    # Touch nim1 so nim2 becomes LRU
    assert pool.get("nim1") is c1
    c3 = pool.get("nim3")
    assert c3 is not None
    assert c2.closed is True
    assert "nim2" not in pool._sessions
    assert list(pool._sessions.keys()) == ["nim1", "nim3"]
    assert SHARED_SSL_CONTEXT is not None
    assert SHARED_HTTP_LIMITS.max_connections == 6


def test_crypto_key_derivation_lru_caches(monkeypatch):
    monkeypatch.setattr("app.config.settings.API_KEY", "unit-test-master-secret-key-12345")
    assert _get_fernet() is _get_fernet()
    assert _legacy_get_fernet() is _legacy_get_fernet()
    assert _derive_aes_key("secret-a") is _derive_aes_key("secret-a")
    assert _get_aesgcm("secret-a") is _get_aesgcm("secret-a")
    assert _digest_key("secret-a") is _digest_key("secret-a")
    hex_key = "11" * 32
    assert _cached_private_key(hex_key) is _cached_private_key(hex_key)


@pytest.mark.asyncio
async def test_mcp_shared_http_client_and_deduplicated_tool_schemas():
    c1 = mcp_server._get_http_client()
    c2 = mcp_server._get_http_client()
    assert c1 is c2

    tools = mcp_server.server._tool_manager._tools
    mira_tool = tools["mira_get_schedule"]
    ubsi_tool = tools["ubsi_get_schedule"]
    assert mira_tool is not ubsi_tool
    assert mira_tool.fn_metadata is ubsi_tool.fn_metadata
    assert mira_tool.parameters is ubsi_tool.parameters

    docs_1 = await mcp_server.ubsi_get_api_docs(category="studentv2")
    docs_2 = await mcp_server.ubsi_get_api_docs(category="studentv2")
    assert docs_1 is docs_2
    assert "\n  " not in docs_1
