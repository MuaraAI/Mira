"""Tests VAPID + RFC 8291 encryption — 100% offline (decrypt roundtrip)."""
import base64
import json
import os

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.pwa_webpush import (
    _b64url,
    _b64url_decode,
    generate_vapid_keypair,
    send_web_push,
)


@pytest.fixture(autouse=True)
def _vapid_keys(monkeypatch):
    priv_hex, pub_b64 = generate_vapid_keypair()
    monkeypatch.setattr("app.config.settings.VAPID_PRIVATE_KEY", priv_hex)
    monkeypatch.setattr("app.config.settings.VAPID_PUBLIC_KEY", pub_b64)
    monkeypatch.setattr("app.config.settings.VAPID_CLAIM_EMAIL", "admin@muaraai.com")


def _user_keypair():
    priv = ec.generate_private_key(ec.SECP256R1())
    pub_raw = priv.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return priv, _b64url(pub_raw), _b64url(os.urandom(16))


def test_vapid_keypair_shape():
    priv_hex, pub_b64 = generate_vapid_keypair()
    assert len(bytes.fromhex(priv_hex)) == 32
    assert len(_b64url_decode(pub_b64)) == 65
    assert pub_b64.startswith("B")


def test_vapid_jwt_verifies_with_public_key():
    from app.pwa_webpush import _vapid_auth_header

    auth_header = _vapid_auth_header("https://fcm.googleapis.com/fcm/send/abc")
    assert auth_header.startswith("vapid t=")
    token = auth_header.split("t=")[1].split(",")[0]
    header_b64, payload_b64, sig_b64 = token.split(".")
    signing_input = f"{header_b64}.{payload_b64}".encode()
    sig = _b64url_decode(sig_b64)
    r = int.from_bytes(sig[:32], "big")
    s = int.from_bytes(sig[32:], "big")
    der = encode_dss_signature(r, s)
    pub_bytes = _b64url_decode(_vapid_auth_header("https://x.test/e").split("k=")[1])
    pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), pub_bytes)
    pub.verify(der, signing_input, ec.ECDSA(hashes.SHA256()))  # raises kalau sig invalid
    claims = json.loads(_b64url_decode(payload_b64))
    assert claims["aud"] == "https://fcm.googleapis.com"
    assert claims["sub"].startswith("mailto:")


@pytest.mark.asyncio
async def test_payload_encrypt_roundtrip_via_decrypt():
    """Simulasi sisi browser decrypt body aes128gcm (RFC 8188/8291)."""
    from app.pwa_webpush import _encrypt_payload

    priv, p256dh, auth = _user_keypair()
    plaintext = json.dumps({"title": "Ujian", "body": "Besok 08:00"}).encode()
    body = _encrypt_payload(p256dh, auth, plaintext)

    salt, rs = body[:16], int.from_bytes(body[16:20], "big")
    idlen = body[20]
    eph_raw = body[21 : 21 + idlen]
    ciphertext = body[21 + idlen :]

    eph_pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), eph_raw)
    shared = priv.exchange(ec.ECDH(), eph_pub)
    prk = HKDF(
        algorithm=hashes.SHA256(), length=32, salt=_b64url_decode(auth),
        info=b"WebPush: info\x00" + _b64url_decode(p256dh) + eph_raw,
    ).derive(shared)
    cek = HKDF(
        algorithm=hashes.SHA256(), length=16, salt=salt,
        info=b"Content-Encoding: aes128gcm\x00",
    ).derive(prk)
    nonce = HKDF(
        algorithm=hashes.SHA256(), length=12, salt=salt,
        info=b"Content-Encoding: nonce\x00",
    ).derive(prk)

    record = AESGCM(cek).decrypt(nonce, ciphertext, None)
    assert record[-1:] == b"\x02"
    assert record[:-1] == plaintext
    assert rs == 4096


@pytest.mark.asyncio
async def test_send_web_push_mocked_201_and_prune_signal():
    from unittest.mock import AsyncMock, patch

    _, p256dh, auth = _user_keypair()
    sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/x", "p256dh": p256dh, "auth": auth}
    mock_resp = AsyncMock(status_code=201)
    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        ok, status_code = await send_web_push(sub, {"title": "t"})
        assert ok is True and status_code == 201
        _, kwargs = mock_post.call_args
        assert kwargs["headers"]["Content-Encoding"] == "aes128gcm"
        assert "vapid t=" in kwargs["headers"]["Authorization"]


@pytest.mark.asyncio
async def test_send_web_push_missing_keys_raises_valueerror(monkeypatch):
    monkeypatch.setattr("app.config.settings.VAPID_PRIVATE_KEY", "")
    _, p256dh, auth = _user_keypair()
    sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/y", "p256dh": p256dh, "auth": auth}
    with pytest.raises(ValueError):
        await send_web_push(sub, {"title": "t"})
