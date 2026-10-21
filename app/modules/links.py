"""Router alat bantu link tugas: /v1/tools/link-check."""
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.envelope import error_response, success_response
from app.limiter import limiter
from app.link_check import check_links

router = APIRouter(prefix="/v1/tools", tags=["tools"])


class LinkCheckRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1, max_length=20, description="Maksimal 20 link per permintaan")
    refresh: bool = Field(default=False, description="Abaikan cache hasil sebelumnya")


@router.post("/link-check")
async def link_check(request: Request, body: LinkCheckRequest):
    """Urai link tugas (Google Drive/Docs/GitHub) dan cek apakah orang lain bisa membukanya tanpa login."""
    if any(len(url) > 2048 for url in body.urls):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(code="VALIDATION_ERROR", message="URL maksimal 2048 karakter", module="tools"),
        )
    identity = getattr(request.state, "nim", None) or "master"
    if not await limiter.is_allowed(f"linkcheck:{identity}", limit=20):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(code="RATE_LIMIT_EXCEEDED", message="Terlalu banyak pengecekan link. Tunggu sebentar.", module="tools"),
        )

    redis = None
    try:
        from app.cache import cache

        redis = await cache.get_client()
    except Exception:
        redis = None
    results = await check_links(body.urls, redis=redis, refresh=body.refresh)
    return success_response(data={"results": results, "total": len(results)})
