import pytest
from app.modules.news import is_safe_webhook_url
from app.session_store import _decrypt_payload


def test_webhook_rejects_dns_loopback_and_encoded_private_hosts():
    assert not is_safe_webhook_url("https://127.0.0.1.nip.io/hook")
    assert not is_safe_webhook_url("http://2130706433/hook")
    assert not is_safe_webhook_url("https://[::ffff:127.0.0.1]/hook")
    assert not is_safe_webhook_url("http://169.254.169.254/latest")


def test_session_payload_never_accepts_legacy_plaintext_json():
    assert _decrypt_payload('{"nim":"15260767"}', "server-secret") is None
