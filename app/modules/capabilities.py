"""Endpoint kapabilitas publik: fitur apa yang aktif sekarang.

Dibaca frontend sebelum login untuk memutuskan antara data SIAKAD atau kartu CTA.
"""
from fastapi import APIRouter

from app.config import settings
from app.envelope import success_response

router = APIRouter(prefix="/v1", tags=["Capabilities"])


@router.get("/capabilities")
async def get_capabilities():
    """Status fitur kampus. Publik: tidak butuh sesi maupun API key."""
    return success_response(
        data={
            "siakad": {
                "enabled": settings.SIAKAD_ENABLED,
                "cta_url": settings.SIAKAD_CTA_URL,
            }
        }
    )
