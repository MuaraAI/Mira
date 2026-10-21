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
    if redis is None:
        # Route ini mahal (sampai 100 fetch keluar per panggilan): tanpa Redis
        # limiter fail-open dan cache mati -> tolak, jangan jadi proxy gratis.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(code="LINK_CHECK_UNAVAILABLE", message="Layanan cek link sedang tidak tersedia. Coba lagi sebentar.", module="tools"),
        )
    if body.refresh:
        # refresh melewati cache sepenuhnya: batasi jauh lebih ketat
        if not await limiter.is_allowed(f"linkcheck:refresh:{identity}", limit=2):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=error_response(code="RATE_LIMIT_EXCEEDED", message="Terlalu banyak pengecekan ulang. Tunggu sebentar.", module="tools"),
            )
    results = await check_links(body.urls, redis=redis, refresh=body.refresh)
    return success_response(data={"results": results, "total": len(results)})
