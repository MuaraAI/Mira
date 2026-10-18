import pytest
from app.session_store import _encrypt_payload, _decrypt_payload, _derive_aes_key

def test_aes_key_derivation():
    key = _derive_aes_key("test-secret-key-12345")
    assert len(key) == 32  # 256 bits

def test_aes_encrypt_decrypt_roundtrip():
    secret = "my-secret-key-test-abc"
    data = {"nim": "15260767", "studentv2_pass": "pass123", "elearning_pass": "pass456"}
    encrypted = _encrypt_payload(data, secret)
    assert isinstance(encrypted, str)
    assert "pass123" not in encrypted
    assert "15260767" not in encrypted

    decrypted = _decrypt_payload(encrypted, secret)
    assert decrypted == data

def test_aes_decrypt_tampered_fails():
    secret = "my-secret-key-test-abc"
    data = {"nim": "15260767"}
    encrypted = _encrypt_payload(data, secret)
    # Tamper with base64 payload
    tampered = encrypted[:-4] + "AAAA"
    decrypted = _decrypt_payload(tampered, secret)
    assert decrypted is None

def test_aes_decrypt_wrong_key_fails():
    secret1 = "key-number-one-123"
    secret2 = "key-number-two-456"
    data = {"nim": "15260767", "studentv2_pass": "secret"}
    encrypted = _encrypt_payload(data, secret1)
    decrypted = _decrypt_payload(encrypted, secret2)
    assert decrypted is None
