from fastapi import APIRouter
from app.cache import cache
from app.envelope import success_response
from app.stats import get_public_stats

router = APIRouter(prefix="/v1", tags=["public-stats"])

_STATS_CACHE_KEY = "ubsi:stats:public"
_STATS_CACHE_TTL = 60


@router.get("/stats")
async def public_stats():
    cached = await cache.get_fresh(_STATS_CACHE_KEY)
    if isinstance(cached, dict) and "users" in cached:
        return success_response(data=cached, cached=True)
    data = await get_public_stats()
    await cache.set(_STATS_CACHE_KEY, data, ttl=_STATS_CACHE_TTL)
    return success_response(data=data, cached=True)
