"""Cache berkas unduhan di memori proses (LRU, TTL pendek) dengan ETag.

Pratinjau PDF membuka berkas yang sama berulang kali. Dengan cache ini buka-ulang tidak lagi
menunggu upstream (MyBest / Google) selama TTL, tetapi data tetap segar: setelah TTL berkas
diambil lagi, dan bila isinya sama klien cukup menerima 304 tanpa mengunduh ulang.
"""
import asyncio
import hashlib
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from fastapi import Request, Response

MAX_BYTES = 12 * 1024 * 1024
TTL_SECONDS = 90
_MAX_LOCKS = 256


@dataclass
class FileEntry:
    data: bytes
    content_type: str
    disposition: Optional[str]
    etag: str
    stored_at: float


class FileCache:
    def __init__(self, max_bytes: int = MAX_BYTES, ttl: int = TTL_SECONDS):
        self.max_bytes = max_bytes
        self.ttl = ttl
        self._items: "OrderedDict[str, FileEntry]" = OrderedDict()
        self._size = 0
        self._locks: dict[str, asyncio.Lock] = {}

    def get(self, key: str) -> Optional[FileEntry]:
        entry = self._items.get(key)
        if entry is None:
            return None
        if time.monotonic() - entry.stored_at > self.ttl:
            self._drop(key)
            return None
        self._items.move_to_end(key)
        return entry

    def set(self, key: str, entry: FileEntry) -> None:
        if len(entry.data) > self.max_bytes // 2:
            return  # berkas sangat besar: jangan menguasai cache
        self._drop(key)
        self._items[key] = entry
        self._size += len(entry.data)
        while self._size > self.max_bytes and self._items:
            oldest = next(iter(self._items))
            self._drop(oldest)

    def _drop(self, key: str) -> None:
        entry = self._items.pop(key, None)
        if entry is not None:
            self._size -= len(entry.data)
        lk = self._locks.get(key)
        if lk is not None and not lk.locked():
            self._locks.pop(key, None)

    def evict_expired(self) -> int:
        now = time.monotonic()
        expired = [k for k, v in self._items.items() if now - v.stored_at > self.ttl]
        for k in expired:
            self._drop(k)
        if len(self._locks) > _MAX_LOCKS:
            for k in list(self._locks.keys()):
                if k not in self._items and not self._locks[k].locked():
                    self._locks.pop(k, None)
        return len(expired)

    def lock(self, key: str) -> asyncio.Lock:
        if len(self._locks) >= _MAX_LOCKS and key not in self._locks:
            for k in list(self._locks.keys()):
                if k not in self._items and not self._locks[k].locked():
                    self._locks.pop(k, None)
                    if len(self._locks) < _MAX_LOCKS:
                        break
        return self._locks.setdefault(key, asyncio.Lock())

    def clear(self) -> None:
        self._items.clear()
        self._locks.clear()
        self._size = 0


file_cache = FileCache()


def make_etag(data: bytes) -> str:
    return '"' + hashlib.blake2b(data, digest_size=12).hexdigest() + '"'


def _matches(request: Request, etag: str) -> bool:
    header = request.headers.get("if-none-match", "")
    return any(token.strip() in (etag, f"W/{etag}") for token in header.split(","))


def _response(request: Request, entry: FileEntry) -> Response:
    headers = {
        "ETag": entry.etag,
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Expose-Headers": "Content-Disposition, ETag",
    }
    if entry.disposition:
        headers["Content-Disposition"] = entry.disposition
    if _matches(request, entry.etag):
        return Response(status_code=304, headers=headers)
    return Response(content=entry.data, media_type=entry.content_type, headers=headers)


async def serve_cached(
    request: Request,
    key: str,
    producer: Callable[[], Awaitable[Response]],
) -> Response:
    """Layani berkas dari cache bila segar; kalau tidak, panggil `producer` (satu kali per kunci)."""
    entry = file_cache.get(key)
    if entry is None:
        async with file_cache.lock(key):
            entry = file_cache.get(key)
            if entry is None:
                produced = await producer()
                data = produced.body if isinstance(produced.body, bytes) else bytes(produced.body)
                entry = FileEntry(
                    data=data,
                    content_type=produced.headers.get("content-type", "application/octet-stream"),
                    disposition=produced.headers.get("content-disposition"),
                    etag=make_etag(data),
                    stored_at=time.monotonic(),
                )
                file_cache.set(key, entry)
    return _response(request, entry)
