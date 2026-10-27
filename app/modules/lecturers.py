"""Profil mengajar dosen (/v1/lecturers): kelas yang diampu dari peta mengajar kolektif Mira."""
import re

from fastapi import APIRouter, HTTPException, status

from app.envelope import error_response, success_response
from app.teaching_db import STALE_DAYS, lecturer_sessions

router = APIRouter(prefix="/v1/lecturers", tags=["lecturers"])

_KODE_RE = re.compile(r"^[A-Za-z0-9]{2,8}$")


@router.get("/{kode}/schedule")
async def get_lecturer_schedule(kode: str):
    """Semua kelas yang diketahui diajar dosen ini (dikumpulkan anonim dari jadwal pengguna Mira)."""
    if not _KODE_RE.match(kode):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(code="VALIDATION_ERROR", message="Kode dosen tidak valid", module="lecturers"),
        )
    sessions = await lecturer_sessions(kode)
    return success_response(
        data={
            "kode": kode.upper(),
            "sessions": sessions,
            "subjects": sorted({s["nama"] for s in sessions}),
            "window_days": STALE_DAYS,
        }
    )
