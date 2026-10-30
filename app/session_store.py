"""Session store berbasis Redis untuk login BSI dengan enkripsi AES-256-GCM.

Token acak 32-byte; yang disimpan di Redis hanya SHA-256 hash-nya sebagai key,
dan seluruh payload (termasuk kredensial kampus) dienkripsi penuh dengan
AES-256-GCM menggunakan kunci 256-bit yang diturunkan dari master API_KEY server.
TTL 7 hari bersifat sliding: setiap resolve sukses me-reset TTL.
"""
import base64
import functools
import hashlib
import json
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import redis.asyncio as aioredis

from app.config import settings

SESSION_TTL_SECONDS = 7 * 24 * 3600
_KEY_PREFIX = "ubsi:session:"
_INDEX_PREFIX = "ubsi:session_index:"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@functools.lru_cache(maxsize=4)
def _derive_aes_key(secret: str) -> bytes:
    if not secret:
        raise RuntimeError("API_KEY wajib disetel di file .env server!")
    return hashlib.blake2b(
        b"ubsi_session_aes256_v1",
        key=secret.encode("utf-8"),
        digest_size=32,
    ).digest()


@functools.lru_cache(maxsize=4)
def _get_aesgcm(secret: str) -> AESGCM:
    return AESGCM(_derive_aes_key(secret))


def _encrypt_payload(data: dict, secret: str) -> str:
    aesgcm = _get_aesgcm(secret)
    nonce = os.urandom(12)  # 96-bit nonce standar GCM
    plaintext = json.dumps(data).encode("utf-8")
    ct = aesgcm.encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ct).decode("utf-8")


def _migrate_legacy_payload(blob: str | bytes, secret: str) -> Optional[str]:
    """Re-encrypt a known legacy JSON session exactly once during migration."""
    text = blob.decode("utf-8", "ignore") if isinstance(blob, bytes) else blob
    if not text.startswith("{"):
        return None
    try:
        data = json.loads(text)
        if not isinstance(data, dict) or not all(
            data.get(field) for field in ("nim", "studentv2_pass", "elearning_pass")
        ):
            return None
        return _encrypt_payload(data, secret)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None


def _decrypt_payload(blob: str | bytes, secret: str) -> Optional[dict]:
    if not blob or not secret:
        return None
    try:
        raw = base64.b64decode(blob)
        if len(raw) < 28:  # 12-byte nonce + 16-byte tag minimum
            return None
        nonce = raw[:12]
        ct = raw[12:]
        aesgcm = _get_aesgcm(secret)
        plaintext = aesgcm.decrypt(nonce, ct, None)
        return json.loads(plaintext.decode("utf-8"))
    except (InvalidTag, ValueError, TypeError, json.JSONDecodeError):
        return None


class SessionStore:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client: Optional[aioredis.Redis] = None

    async def get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(self.redis_url, decode_responses=True)
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def create(
        self, nim: str, studentv2_pass: str, elearning_pass: str
    ) -> str:
        token = secrets.token_urlsafe(32)
        payload_data = {
            "nim": nim,
            "studentv2_pass": studentv2_pass,
            "elearning_pass": elearning_pass,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        encrypted_blob = _encrypt_payload(payload_data, settings.API_KEY)
        client = await self.get_client()
        token_hash = _hash_token(token)
        await client.set(_KEY_PREFIX + token_hash, encrypted_blob, ex=SESSION_TTL_SECONDS)
        index_key = _INDEX_PREFIX + nim
        await client.sadd(index_key, token_hash)
        await client.expire(index_key, SESSION_TTL_SECONDS)
        return token

    async def resolve(self, token: str) -> Optional[dict]:
        """Kembalikan data session terdekripsi dan reset TTL (sliding)."""
        if not token:
            return None
        client = await self.get_client()
        key = _KEY_PREFIX + _hash_token(token)
        raw = await client.get(key)
        if not raw:
            return None
        # Validasi dulu; payload invalid dihapus, bukan diperpanjang (anti keep-alive blob tampered)
        data = _decrypt_payload(raw, settings.API_KEY)
        if not data:
            migrated = _migrate_legacy_payload(raw, settings.API_KEY)
            if migrated:
                data = _decrypt_payload(migrated, settings.API_KEY)
                if data:
                    await client.set(key, migrated, ex=SESSION_TTL_SECONDS)
            if not data:
                await client.delete(key)
                return None
        await client.expire(key, SESSION_TTL_SECONDS)
        nim = data.get("nim")
        if nim:
            await client.expire(_INDEX_PREFIX + nim, SESSION_TTL_SECONDS)
        return data

    async def delete(self, token: str) -> None:
        client = await self.get_client()
        token_hash = _hash_token(token)
        key = _KEY_PREFIX + token_hash
        raw = await client.get(key)
        if raw:
            data = _decrypt_payload(raw, settings.API_KEY)
            nim = (data or {}).get("nim", "")
            if nim:
                await client.srem(_INDEX_PREFIX + nim, token_hash)
        await client.delete(key)

    async def get_credentials_for_nim(self, nim: str) -> Optional[tuple[str, str, str]]:
        """Resolve one active encrypted session for background notifications."""
        client = await self.get_client()
        token_hashes = await client.smembers(_INDEX_PREFIX + nim)
        for token_hash in token_hashes:
            raw = await client.get(_KEY_PREFIX + token_hash)
            data = _decrypt_payload(raw, settings.API_KEY) if raw else None
            if data and data.get("studentv2_pass") and data.get("elearning_pass"):
                return str(data["nim"]), str(data["studentv2_pass"]), str(data["elearning_pass"])
        return None

    async def update_password_for_nim(self, nim: str, field: str, new_password: str) -> int:
        """Perbarui password tersimpan di semua sesi aktif NIM setelah ganti password sukses."""
        if field not in ("studentv2_pass", "elearning_pass"):
            raise ValueError(f"Field password tidak dikenal: {field}")
        client = await self.get_client()
        updated = 0
        for token_hash in await client.smembers(_INDEX_PREFIX + nim):
            key = _KEY_PREFIX + token_hash
            raw = await client.get(key)
            data = _decrypt_payload(raw, settings.API_KEY) if raw else None
            if not data:
                continue
            data[field] = new_password
            ttl = await client.ttl(key)
            await client.set(key, _encrypt_payload(data, settings.API_KEY), ex=ttl if ttl and ttl > 0 else SESSION_TTL_SECONDS)
            updated += 1
        return updated

    async def delete_all_for_nim(self, nim: str) -> int:
        client = await self.get_client()
        index_key = _INDEX_PREFIX + nim
        token_hashes = await client.smembers(index_key)
        removed = 0
        for token_hash in token_hashes:
            removed += await client.delete(_KEY_PREFIX + token_hash)
        await client.delete(index_key)
        return removed


session_store = SessionStore(settings.REDIS_URL)
