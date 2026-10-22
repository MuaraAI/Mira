"""Router alat bantu link tugas: /v1/tools/link-check."""
import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from app.envelope import error_response, success_response
from app.limiter import limiter
from app.file_cache import serve_cached
from app.file_proxy import ProxyError, content_disposition, fetch_public_file
from app.link_check import check_links, parse_share_link

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


@router.get("/link-file")
async def link_file(
    request: Request,
    url: str = Query(..., max_length=2048, description="Link Google Drive/Docs yang sudah publik"),
):
    """Ambil berkas (PDF/gambar) dari link Google yang publik untuk dipratinjau di aplikasi. Berkas privat ditolak."""
    identity = getattr(request.state, "nim", None) or "master"
    if not await limiter.is_allowed(f"linkfile:{identity}", limit=30):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(code="RATE_LIMIT_EXCEEDED", message="Terlalu banyak pratinjau berkas. Tunggu sebentar.", module="tools"),
        )
    info = parse_share_link(url)
    if info is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(code="INVALID_URL", message="Link tidak valid.", module="tools"),
        )

    async def produce() -> Response:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "id,en;q=0.8",
        }
        async with httpx.AsyncClient(timeout=20, headers=headers) as client:
            try:
                data, content_type, filename = await fetch_public_file(info, client)
            except ProxyError as err:
                raise HTTPException(
                    status_code=err.status,
                    detail=error_response(code=err.code, message=err.message, module="tools"),
                )
        return Response(content=data, media_type=content_type, headers={"Content-Disposition": content_disposition(filename)})

    # Hanya berkas publik yang pernah berhasil diambil yang masuk cache, jadi aman dibagi antar pengguna.
    return await serve_cached(request, f"linkfile:{info['normalized_url']}", produce)
