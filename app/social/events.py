"""Realtime Mira Komunitas lewat Redis pub/sub.

Produksi menjalankan beberapa worker uvicorn, jadi event tidak boleh disimpan
in-memory: setiap pengguna punya channel Redis `ubsi:social:u:{nim}` dan setiap
koneksi SSE berlangganan ke channel miliknya sendiri.

Fail-open: kalau Redis mati, publish diam-diam gagal dan stream menolak dengan
503 sehingga klien beralih ke polling ringan.
"""
import asyncio
import json
import logging
from typing import AsyncIterator, Iterable, Optional

import redis.asyncio as aioredis

from app.config import settings
from app.social.service import Event

logger = logging.getLogger("app.social.events")

_CHANNEL_PREFIX = "ubsi:social:u:"
# Setiap stream SSE memegang satu slot koneksi uvicorn (limit-concurrency); batasi per worker.
MAX_STREAMS_PER_WORKER = 60

_client: Optional[aioredis.Redis] = None
_active_streams = 0


def _channel(nim: str) -> str:
    return f"{_CHANNEL_PREFIX}{nim}"


async def _get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


async def publish(events: Iterable[Event]) -> None:
    batch = [e for e in events if e.recipients]
    if not batch:
        return
    try:
        client = await _get_client()
        pipe = client.pipeline(transaction=False)
        for event in batch:
            data = json.dumps({"type": event.type, **event.payload}, separators=(",", ":"))
            for nim in set(event.recipients):
                pipe.publish(_channel(nim), data)
        await pipe.execute()
    except Exception as exc:  # Realtime bersifat best-effort; data sudah aman di SQLite.
        logger.debug("social publish skipped: %s", exc)


_CONN_PREFIX = "ubsi:social:conn:"
# TTL penghitung koneksi; di-refresh tiap heartbeat sehingga worker yang mati tidak menahan status online.
CONN_TTL_SECONDS = 90
# Stream berputar tiap 5 menit dan klien menyambung ulang < 1 detik: tunggu dulu sebelum menyatakan offline.
OFFLINE_GRACE_SECONDS = 6.0


async def mark_connected(nim: str) -> bool:
    """Tambah penghitung koneksi; True bila ini koneksi pertama (pengguna baru saja online)."""
    try:
        client = await _get_client()
        key = f"{_CONN_PREFIX}{nim}"
        count = await client.incr(key)
        await client.expire(key, CONN_TTL_SECONDS)
        return int(count) == 1
    except Exception:
        return True


async def refresh_connection(nim: str) -> None:
    try:
        client = await _get_client()
        await client.expire(f"{_CONN_PREFIX}{nim}", CONN_TTL_SECONDS)
    except Exception:
        pass


async def mark_disconnected(nim: str) -> None:
    try:
        client = await _get_client()
        key = f"{_CONN_PREFIX}{nim}"
        if int(await client.decr(key)) <= 0:
            await client.delete(key)
    except Exception:
        pass


async def is_connected(nim: str) -> bool:
    try:
        client = await _get_client()
        return bool(await client.exists(f"{_CONN_PREFIX}{nim}"))
    except Exception:
        return False


def stream_slot_available() -> bool:
    return _active_streams < MAX_STREAMS_PER_WORKER


class Subscription:
    """Langganan pub/sub satu pengguna; dibuka di luar generator supaya gagal cepat."""

    def __init__(self, pubsub: "aioredis.client.PubSub"):
        self._pubsub = pubsub
        self._closed = False

    @classmethod
    async def open(cls, nim: str) -> "Subscription":
        global _active_streams
        client = await _get_client()
        pubsub = client.pubsub()
        await pubsub.subscribe(_channel(nim))
        _active_streams += 1
        return cls(pubsub)

    async def iterate(self, heartbeat: float = 20.0, lifetime: float = 300.0) -> AsyncIterator[Optional[str]]:
        """Yield payload JSON event, atau None sebagai sinyal heartbeat.

        Stream berakhir setelah `lifetime` detik supaya koneksi berputar (deploy,
        restart worker, sesi kedaluwarsa) tanpa meninggalkan koneksi zombie.
        """
        loop = asyncio.get_running_loop()
        deadline = loop.time() + lifetime
        next_beat = loop.time() + heartbeat
        while loop.time() < deadline:
            message = await self._pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("type") == "message":
                yield message["data"]
            elif loop.time() >= next_beat:
                next_beat = loop.time() + heartbeat
                yield None

    async def close(self) -> None:
        global _active_streams
        if self._closed:
            return
        self._closed = True
        _active_streams -= 1
        try:
            await self._pubsub.unsubscribe()
            await self._pubsub.aclose()
        except Exception:
            pass


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
