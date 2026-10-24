"""Per-NIM session pool agar request antar user tidak saling menimpa sesi."""
import asyncio
import time
from collections import OrderedDict
from typing import Any


class SessionPool:
    """Pool sesi login per-NIM dengan TTL idle dan batas kapasitas LRU O(1)."""

    def __init__(self, factory, ttl_seconds: int = 600, max_sessions: int = 150):
        self._factory = factory
        self._ttl = ttl_seconds
        self._max_sessions = max_sessions
        self._sessions: "OrderedDict[str, tuple[Any, float]]" = OrderedDict()

    def get(self, nim: str) -> Any:
        entry = self._sessions.get(nim)
        now = time.monotonic()
        if entry is None:
            if len(self._sessions) >= self._max_sessions:
                if self._ttl > 0:
                    stale = [k for k, (_, ts) in self._sessions.items() if now - ts > self._ttl]
                    for k in stale:
                        self.invalidate(k)
                while len(self._sessions) >= self._max_sessions and self._sessions:
                    oldest_nim = next(iter(self._sessions))
                    self.invalidate(oldest_nim)
            try:
                client = self._factory(nim)
            except TypeError:
                client = self._factory()
            self._sessions[nim] = (client, now)
            return client
        client, _ = entry
        # Perpanjang TTL tiap kali dipakai & pindahkan ke ujung LRU (O(1))
        self._sessions.move_to_end(nim)
        self._sessions[nim] = (client, now)
        return client

    async def evict_idle(self) -> int:
        """Tutup sesi yang idle melewati TTL. Return jumlah sesi yang ditutup."""
        now = time.monotonic()
        stale = [nim for nim, (_, last_used) in self._sessions.items() if now - last_used > self._ttl]
        closed = 0
        for nim in stale:
            entry = self._sessions.pop(nim, None)
            if entry:
                client, _ = entry
                try:
                    close = getattr(client, "close", None)
                    if close:
                        result = close()
                        if asyncio.iscoroutine(result):
                            await result
                except Exception:
                    pass
                closed += 1
        return closed

    async def _close_client(self, client: Any) -> None:
        try:
            close = getattr(client, "close", None)
            if close:
                result = close()
                if asyncio.iscoroutine(result):
                    await result
        except Exception:
            pass

    def invalidate(self, nim: str) -> None:
        """Tutup dan buang sesi satu NIM (sync-safe, termasuk async close)."""
        entry = self._sessions.pop(nim, None)
        if not entry:
            return
        client, _ = entry
        close = getattr(client, "close", None)
        if not close:
            return
        result = close()
        if asyncio.iscoroutine(result):
            try:
                asyncio.get_running_loop().create_task(result)
            except RuntimeError:
                result.close()

    async def close(self) -> None:
        """Close and clear all pooled clients during application shutdown."""
        entries = tuple(self._sessions.values())
        self._sessions.clear()
        await asyncio.gather(*(self._close_client(client) for client, _ in entries), return_exceptions=True)

    def __len__(self):
        return len(self._sessions)
