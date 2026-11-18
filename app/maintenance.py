"""Maintenance mode: status publik, whitelist NIM, dan respons 503.

Saklar dibaca dari env (`MAINTENANCE_MODE`). Whitelist dipisah koma dan
dibandingkan setelah NIM dinormalisasi (spasi dibuang).
"""
from fastapi.responses import JSONResponse

from app.config import settings
from app.envelope import error_response, success_response


def maintenance_active() -> bool:
    return bool(settings.MAINTENANCE_MODE)


def whitelist() -> set[str]:
    raw = settings.MAINTENANCE_WHITELIST_NIMS or ""
    return {part.strip() for part in raw.split(",") if part.strip()}


def is_whitelisted(nim: str | None) -> bool:
    if not nim:
        return False
    return nim.strip() in whitelist()


def maintenance_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content=error_response(
            code="MAINTENANCE",
            message=settings.MAINTENANCE_MESSAGE,
            module="maintenance",
            extra={"reason": settings.MAINTENANCE_REASON},
        ),
    )


def maintenance_payload() -> dict:
    """Payload publik untuk frontend (tanpa data pribadi)."""
    return success_response(
        data={
            "enabled": maintenance_active(),
            "message": settings.MAINTENANCE_MESSAGE,
            "reason": settings.MAINTENANCE_REASON,
        }
    )


def install(app) -> None:
    """Daftarkan endpoint publik GET /v1/maintenance."""
    from fastapi import APIRouter

    router = APIRouter(prefix="/v1", tags=["Maintenance"])

    @router.get("/maintenance")
    async def get_maintenance():
        return maintenance_payload()

    app.include_router(router)
