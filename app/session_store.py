"""Session store berbasis Redis untuk login BSI.

Token acak 32-byte; yang disimpan di Redis hanya SHA-256 hash-nya,
jadi dump Redis tidak menghasilkan token yang bisa dipakai.
TTL 7 hari bersifat sliding: setiap resolve sukses me-reset TTL.
"""
import hashlib
import json
import secrets
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis

from app.config import settings

SESSION_TTL_SECONDS = 7 * 24 * 3600
_KEY_PREFIX = "ubsi:session:"
_INDEX_PREFIX = "ubsi:session_index:"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SessionStore:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client: Optional[aioredis.Redis] = None

    async def get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(self.redis_url, decode_responses=True)
        return self._client

    async def create(
        self, nim: str, studentv2_pass: str, elearning_pass: str
    ) -> str:
        token = secrets.token_urlsafe(32)
        payload = json.dumps(
            {
                "nim": nim,
                "studentv2_pass": studentv2_pass,
                "elearning_pass": elearning_pass,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        client = await self.get_client()
        token_hash = _hash_token(token)
        await client.set(_KEY_PREFIX + token_hash, payload, ex=SESSION_TTL_SECONDS)
        index_key = _INDEX_PREFIX + nim
        await client.sadd(index_key, token_hash)
        await client.expire(index_key, SESSION_TTL_SECONDS)
        return token

    async def resolve(self, token: str) -> Optional[dict]:
        """Kembalikan data session dan reset TTL (sliding)."""
        if not token:
            return None
        client = await self.get_client()
        key = _KEY_PREFIX + _hash_token(token)
        raw = await client.get(key)
        if not raw:
            return None
        await client.expire(key, SESSION_TTL_SECONDS)
        try:
            data = json.loads(raw)
            nim = data.get("nim")
            if nim:
                await client.expire(_INDEX_PREFIX + nim, SESSION_TTL_SECONDS)
            return data
        except Exception:
            return None

    async def delete(self, token: str) -> None:
        client = await self.get_client()
        token_hash = _hash_token(token)
        key = _KEY_PREFIX + token_hash
        raw = await client.get(key)
        if raw:
            nim = json.loads(raw).get("nim", "")
            await client.srem(_INDEX_PREFIX + nim, token_hash)
        await client.delete(key)

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
