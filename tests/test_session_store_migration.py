import json

from app.session_store import _migrate_legacy_payload, _decrypt_payload


def test_legacy_session_payload_is_migrated_to_aes():
    payload = {"nim": "15260767", "studentv2_pass": "sv", "elearning_pass": "el"}
    encrypted = _migrate_legacy_payload(json.dumps(payload), "server-secret")
    assert encrypted is not None
    assert not encrypted.startswith("{")
    assert _decrypt_payload(encrypted, "server-secret") == payload


def test_invalid_legacy_payload_is_not_migrated():
    assert _migrate_legacy_payload('{"nim":"15260767"}', "server-secret") is None
