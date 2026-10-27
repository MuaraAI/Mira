"""Helper generik untuk pola cache-then-upstream yang dipakai semua router.

Menghapus duplikasi blok 30 baris (fresh check, single-flight lock,
fetch, parse, LGG fallback) yang sebelumnya disalin di setiap endpoint.
Sekaligus menerapkan stale-while-revalidate: data LGG dikirim instan
dengan flag stale sementara refresh upstream berjalan sebagai background
task.
"""
import asyncio
import inspect
import logging
from typing import Any, Callable, Optional

from fastapi import HTTPException, status

from app.cache import cache

logger = logging.getLogger("app.router_helper")
from app.envelope import error_response, success_response

_revalidating: set[str] = set()
_background_tasks: set[asyncio.Task] = set()


async def _read_cache(cache_key: str, allow_stale: bool):
    if allow_stale:
        return await cache.fresh_or_stale(cache_key)
    fresh = await cache.get_fresh(cache_key)
    return (fresh, False) if fresh is not None else None


async def cached_endpoint(
    module: str,
    name: str,
    fetch: Callable[[], Any],
    parse: Callable[[Any], Any],
    ttl: int,
    cache_params: Optional[dict] = None,
    swr: bool = True,
    should_cache: Optional[Callable[[Any], bool]] = None,
    allow_stale: bool = True,
    ttl_for: Optional[Callable[[Any], int]] = None,
):
    """Pola standar endpoint: cek cache, fetch upstream dengan lock, fallback LGG.

    - fresh cache -> dikirim dengan cached=True
    - LGG tersedia -> dikirim instan dengan stale=True, refresh di background
      (hanya jika swr=True; kalau False, LGG dikirim tanpa revalidasi)
    - kosong semuanya -> fetch upstream di bawah single-flight lock,
      hasil diparse lalu disimpan dengan TTL
    - allow_stale False -> data yang sudah lewat TTL tidak dikirim; selalu fetch ulang (data
      real-time seperti status presensi), LGG hanya dipakai bila upstream gagal
    - should_cache(data) False -> hasil dikirim tapi tidak disimpan (mis. hasil parsial
      karena sebagian sumber gagal), supaya request berikutnya mencoba lagi
    - ttl_for(data) -> TTL per hasil (mis. hasil parsial disimpan singkat, bukan dibuang)
    """
    params = cache_params or {}
    cache_key = cache.make_key(module, name, **params)

    cached = await _read_cache(cache_key, allow_stale)
    if cached is not None:
        data, is_stale = cached
        if is_stale:
            if swr:
                _schedule_revalidate(cache_key, fetch, parse, ttl, should_cache, ttl_for)
            return success_response(data=data, cached=True, stale=True)
        return success_response(data=data, cached=True)

    async with cache.get_lock(cache_key):
        cached = await _read_cache(cache_key, allow_stale)
        if cached is not None:
            data, is_stale = cached
            if is_stale:
                return success_response(data=data, cached=True, stale=True)
            return success_response(data=data, cached=True)

        try:
            html = fetch()
            if inspect.isawaitable(html):
                html = await html
            data = parse(html)
            if should_cache is None or should_cache(data):
                await cache.set(cache_key, data, ttl=ttl_for(data) if ttl_for else ttl)
            return success_response(data=data, cached=False)
        except Exception as e:
            lgg_result = await cache.get_lgg(cache_key)
            if lgg_result:
                lgg_data, _ = lgg_result
                return success_response(data=lgg_data, cached=True, stale=True)
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                # Pesan teknis (sering berbahasa Inggris, mis. "ReadTimeout") hanya untuk log;
                # pengguna melihat kalimat yang jelas.
                detail=error_response(code="UPSTREAM_ERROR", message=_upstream_message(module, e), module=module)
            )


_UPSTREAM_LABEL = {
    "elearning": "MyBest",
    "studentv2": "SIAKAD",
    "elibrary": "Perpustakaan",
    "news": "portal berita kampus",
}


def _upstream_message(module: str, exc: Exception) -> str:
    label = _UPSTREAM_LABEL.get(module, "server kampus")
    logger.warning("upstream %s gagal: %s: %s", module, type(exc).__name__, exc)
    name = type(exc).__name__.lower()
    if "timeout" in name or "timed out" in str(exc).lower():
        return f"{label} terlalu lama merespons. Coba lagi sebentar."
    return f"{label} sedang tidak bisa dihubungi. Coba lagi sebentar."


def _schedule_revalidate(
    cache_key: str,
    fetch: Callable[[], Any],
    parse: Callable[[Any], Any],
    ttl: int,
    should_cache: Optional[Callable[[Any], bool]] = None,
    ttl_for: Optional[Callable[[Any], int]] = None,
) -> None:
    if cache_key in _revalidating:
        return
    _revalidating.add(cache_key)

    async def _revalidate():
        try:
            html = fetch()
            if inspect.isawaitable(html):
                html = await html
            data = parse(html)
            if should_cache is None or should_cache(data):
                await cache.set(cache_key, data, ttl=ttl_for(data) if ttl_for else ttl)
        except Exception:
            pass  # background refresh: biarkan LGG tetap terpakai
        finally:
            _revalidating.discard(cache_key)

    try:
        task = asyncio.create_task(_revalidate())
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except RuntimeError:
        _revalidating.discard(cache_key)
        pass  # tidak ada event loop (mis. saat test sinkron) — aman diabaikan


async def close_background_tasks() -> None:
    if _background_tasks:
        await asyncio.gather(*tuple(_background_tasks), return_exceptions=True)
