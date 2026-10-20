import pytest
from app.modules.news import is_safe_webhook_url
from app.session_store import _decrypt_payload


def test_webhook_rejects_dns_loopback_and_encoded_private_hosts():
    assert not is_safe_webhook_url("https://127.0.0.1.nip.io/hook")
    assert not is_safe_webhook_url("http://2130706433/hook")
    assert not is_safe_webhook_url("https://[::ffff:127.0.0.1]/hook")
    assert not is_safe_webhook_url("http://169.254.169.254/latest")
    # CGNAT dan Cloud metadata IP dilarang
    assert not is_safe_webhook_url("https://100.100.100.200/meta")
    assert not is_safe_webhook_url("https://100.64.0.1/cgnat")


@pytest.mark.asyncio
async def test_dispatch_webhook_notification_blocks_unsafe_urls():
    from app.modules.news import dispatch_webhook_notification
    # Mencoba dispatch ke localhost/privat langsung diblokir di fungsi dispatch
    ok = await dispatch_webhook_notification({"title": "Test"}, "https://127.0.0.1/hook")
    assert ok is False


@pytest.mark.asyncio
async def test_mcp_api_get_normalizes_error_status():
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.mcp_server import _api_get
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.json.return_value = {"detail": "Unauthorized"}
    mock_resp.text = "Unauthorized"
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        res = await _api_get("/v1/test")
        assert res["success"] is False
        assert "error" in res


def test_session_payload_never_accepts_legacy_plaintext_json():
    assert _decrypt_payload('{"nim":"15260767"}', "server-secret") is None
