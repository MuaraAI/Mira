from typing import Any
import os
from fastapi import Request, HTTPException, status
from app.account_devices import require_trusted_device
from app.account_links import get_link_secret, get_link_status
from app.config import Settings, settings
from app.envelope import error_response

_SIAKAD_PROVIDER = "siakad"


def _siakad_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=error_response(code=code, message=message, module="studentv2"),
    )




async def _require_canonical_siakad(nim: str) -> str:
    """Baca password SIAKAD dari store kanonis; needs_relink 409, kosong 401."""
    link_status = await get_link_status(nim, _SIAKAD_PROVIDER)
    if link_status == "needs_relink":
        raise _siakad_error(
            status.HTTP_409_CONFLICT,
            "SIAKAD_RELINK_REQUIRED",
            "Password SIAKAD berubah di portal kampus. Tautkan ulang akun SIAKAD di dashboard Mira.",
        )
    secret = await get_link_secret(nim, _SIAKAD_PROVIDER)
    if secret:
        return secret
    raise _siakad_error(
        status.HTTP_401_UNAUTHORIZED,
        "UNAUTHORIZED",
        "Kredensial SIAKAD belum diatur (hubungkan akun SIAKAD lewat dashboard session)",
    )


async def require_studentv2_creds(
    request: Request = None,  # type: ignore[assignment]
    cfg: Any = None
) -> tuple[str, str]:
    # Support direct/legacy test call: require_studentv2_creds(empty_settings)
    if isinstance(request, Settings):
        cfg = request
        request = None

    # Tier 1: Manual Developer Header Override (hanya untuk Master Key atau direct test harness)
    if request is not None and hasattr(request, "headers"):
        allow_header_override = (
            not hasattr(request, "state")
            or not getattr(request.state, "_auth_ran", False)
            or getattr(request.state, "is_master", False)
        )
        if allow_header_override:
            h_nim = request.headers.get("x-studentv2-nim") or request.headers.get("x-nim")
            h_pass = request.headers.get("x-studentv2-pass") or request.headers.get("x-pass")
            if h_nim and h_pass:
                return h_nim.strip(), h_pass.strip()

    # Tier 2: Session Login BSI / Personal API Key (diisi api_key_auth_middleware).
    # Password selalu dari store kanonis; salinan di sesi tidak otoritatif.
    if request is not None and hasattr(request, "state"):
        nim = getattr(request.state, "nim", None)
        auth_type = getattr(request.state, "auth_type", "session")
        if nim and auth_type in ("session", "api_key"):
            if auth_type == "session":
                await require_trusted_device(request)
            return str(nim), await _require_canonical_siakad(str(nim))

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=error_response(
            code="UNAUTHORIZED",
            message="Kredensial SIAKAD belum diatur (wajib login via dashboard session atau sertakan Personal API Key muara_mira_***)",
            module="studentv2"
        )
    )

def require_elearning_creds(
    request: Request = None,  # type: ignore[assignment]
    cfg: Any = None
) -> tuple[str, str]:
    # Support direct/legacy test call: require_elearning_creds(empty_settings)
    if isinstance(request, Settings):
        cfg = request
        request = None

    # Tier 1: Session Login BSI / Personal API Key (injected by api_key_auth_middleware into request.state)
    if request is not None and hasattr(request, "state"):
        nim = getattr(request.state, "nim", None)
        pwd = getattr(request.state, "elearning_pass", None)
        if nim and pwd:
            return str(nim), str(pwd)

    # Tier 2: Manual Developer Header Override (hanya untuk Master Key atau direct test harness)
    allow_header_override = (
        request is not None
        and hasattr(request, "headers")
        and (
            not hasattr(request, "state")
            or not getattr(request.state, "_auth_ran", False)
            or getattr(request.state, "is_master", False)
        )
    )
    if allow_header_override:
        h_nim = request.headers.get("x-elearning-nim") or request.headers.get("x-nim")
        h_pass = request.headers.get("x-elearning-pass") or request.headers.get("x-pass")
        if h_nim and h_pass:
            return h_nim.strip(), h_pass.strip()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=error_response(
            code="UNAUTHORIZED",
            message="Kredensial Elearning belum diatur (wajib login via dashboard session atau sertakan Personal API Key muara_mira_***)",
            module="elearning"
        )
    )


def require_siakad_enabled() -> None:
    """Gerbang tunggal SIAKAD: 503 + CTA bila saklar SIAKAD_ENABLED mati.

    Dipasang lewat include_router(dependencies=[...]) dan juga dipanggil langsung
    dari endpoint auth yang memicu request ke students.bsi.ac.id.
    """
    if settings.SIAKAD_ENABLED:
        return
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=error_response(
            code="SIAKAD_DISABLED",
            message="SIAKAD dinonaktifkan di Mira. Buka students.bsi.ac.id untuk nilai, KHS, dan KRS.",
            module="siakad",
            extra={"cta_url": settings.SIAKAD_CTA_URL},
        ),
    )
