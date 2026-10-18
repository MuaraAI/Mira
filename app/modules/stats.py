from fastapi import APIRouter
from app.envelope import success_response
from app.stats import get_public_stats

router = APIRouter(prefix="/v1", tags=["public-stats"])


@router.get("/stats")
async def public_stats():
    return success_response(data=await get_public_stats(), cached=True)
