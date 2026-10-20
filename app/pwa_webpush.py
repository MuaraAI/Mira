"""Web Push (RFC 8291 aes128gcm) + VAPID (RFC 8292) engine — zero SaaS.

Semua kripto pakai `cryptography` yang sudah ada di venv; tidak ada
dependency baru. Encrypt dijalankan di threadpool karena CPU-bound.
"""
import asyncio
import base64
import json
import os
import struct
import time
from typing import Any
from urllib.parse import urlparse

import httpx
from cryptography.hazmat.primitives.asymmetric.ec import (
    SECP256R1,
    EllipticCurvePrivateKey,
    EllipticCurvePublicKey,
    derive_private_key,
    generate_private_key,
    ECDH,
)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from app.config import settings

_JWT_TTL = 12 * 3600


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def generate_vapid_keypair() -> tuple[str, str]:
    """Return (private_key_hex_32byte, public_key_uncompressed_b64url)."""
    priv: EllipticCurvePrivateKey = generate_private_key(SECP256R1())
    priv_raw = priv.private_numbers().private_value.to_bytes(32, "big")
    pub_raw = priv.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return priv_raw.hex(), _b64url(pub_raw)


def _load_private_key() -> EllipticCurvePrivateKey:
    raw = bytes.fromhex(settings.VAPID_PRIVATE_KEY)
    if len(raw) != 32:
        raise ValueError("VAPID_PRIVATE_KEY harus hex 32 byte (generate via scripts/generate_vapid_keys.py)")
    return derive_private_key(int.from_bytes(raw, "big"), SECP256R1())


def _vapid_auth_header(endpoint: str) -> str:
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        raise ValueError("VAPID keys belum dikonfigurasi di server")
    origin = f"{urlparse(endpoint).scheme}://{urlparse(endpoint).netloc}"
    claims = {
        "aud": origin,
        "exp": int(time.time()) + _JWT_TTL,
        "sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}",
    }
    header = _b64url(json.dumps({"typ": "JWT", "alg": "ES256"}, separators=(",", ":")).encode())
    payload = _b64url(json.dumps(claims, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}".encode()
    der = _load_private_key().sign(signing_input, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")  # ES256: raw r||s, bukan DER
    return f"vapid t={header}.{payload}.{_b64url(sig)}, k={settings.VAPID_PUBLIC_KEY}"


def _encrypt_payload(p256dh_b64: str, auth_b64: str, plaintext: bytes) -> bytes:
    """RFC 8291 aes128gcm: body = salt(16) | rs(4) | idlen(1) | eph_pub(65) | ciphertext."""
    user_pub_raw = _b64url_decode(p256dh_b64)
    auth_secret = _b64url_decode(auth_b64)
    if len(user_pub_raw) != 65:
        raise ValueError("p256dh harus uncompressed P-256 point 65 byte")

    user_pub: EllipticCurvePublicKey = EllipticCurvePublicKey.from_encoded_point(SECP256R1(), user_pub_raw)
    eph: EllipticCurvePrivateKey = generate_private_key(SECP256R1())
    eph_pub_raw = eph.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )

    shared = eph.exchange(ECDH(), user_pub)
    # RFC 8291 4.1: PRK_key = HKDF(salt=auth_secret, ikm=ecdh, info="WebPush: info"||0x00||ua_pub||as_pub)
    prk_key = HKDF(
        algorithm=hashes.SHA256(), length=32, salt=auth_secret,
        info=b"WebPush: info\x00" + user_pub_raw + eph_pub_raw,
    ).derive(shared)

    salt = os.urandom(16)
    rs = 4096
    # RFC 8291 4.2: CEK/NONCE = HKDF(salt=salt_header, ikm=PRK_key, info=content_encoding||0x00)
    cek = HKDF(
        algorithm=hashes.SHA256(), length=16, salt=salt,
        info=b"Content-Encoding: aes128gcm\x00",
    ).derive(prk_key)
    nonce = HKDF(
        algorithm=hashes.SHA256(), length=12, salt=salt,
        info=b"Content-Encoding: nonce\x00",
    ).derive(prk_key)

    record = plaintext + b"\x02"  # delimiter rekaman terakhir
    ciphertext = AESGCM(cek).encrypt(nonce, record, None)

    header = salt + struct.pack("!L", rs) + bytes([len(eph_pub_raw)]) + eph_pub_raw
    return header + ciphertext


async def send_web_push(subscription: dict[str, str], payload: dict[str, Any], ttl: int = 86400) -> tuple[bool, int]:
    """Kirim push terenkripsi ke 1 endpoint. Return (ok, http_status).

    404/410 berarti subscription basi -> caller wajib prune.
    """
    try:
        auth_header = await asyncio.to_thread(_vapid_auth_header, subscription["endpoint"])
        body = await asyncio.to_thread(
            _encrypt_payload,
            subscription["p256dh"],
            subscription["auth"],
            json.dumps(payload, separators=(",", ":")).encode(),
        )
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                subscription["endpoint"],
                content=body,
                headers={
                    "Content-Encoding": "aes128gcm",
                    "Content-Type": "application/octet-stream",
                    "TTL": str(ttl),
                    "Authorization": auth_header,
                    "Urgency": "normal",
                },
            )
        return resp.status_code in (200, 201), resp.status_code
    except ValueError:
        raise
    except Exception:
        return False, 0
