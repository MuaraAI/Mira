from typing import Any
import os
from fastapi import Request, HTTPException, status
from app.config import Settings, settings
from app.envelope import error_response

def require_studentv2_creds(
    request: Request = None,  # type: ignore[assignment]
    cfg: Any = None
) -> tuple[str, str]:
    # Support direct/legacy test call: require_studentv2_creds(empty_settings)
    if isinstance(request, Settings):
        cfg = request
        request = None

    # Tier 1: Session Login BSI / Personal API Key (injected by api_key_auth_middleware into request.state)
    if request is not None and hasattr(request, "state"):
        nim = getattr(request.state, "nim", None)
        pwd = getattr(request.state, "studentv2_pass", None)
        if nim and pwd:
            return str(nim), str(pwd)

    # Tier 2: Manual Developer Header Override (untuk pengujian & otomasi)
    if request is not None and hasattr(request, "headers"):
        h_nim = request.headers.get("x-studentv2-nim") or request.headers.get("x-nim")
        h_pass = request.headers.get("x-studentv2-pass") or request.headers.get("x-pass")
        if h_nim and h_pass:
            return h_nim.strip(), h_pass.strip()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=error_response(
            code="UNAUTHORIZED",
            message="Kredensial SIAKAD belum diatur (wajib login via dashboard session atau sertakan Personal API Key muara_ubsi_***)",
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

    # Tier 2: Manual Developer Header Override (untuk pengujian & otomasi)
    if request is not None and hasattr(request, "headers"):
        h_nim = request.headers.get("x-elearning-nim") or request.headers.get("x-nim")
        h_pass = request.headers.get("x-elearning-pass") or request.headers.get("x-pass")
        if h_nim and h_pass:
            return h_nim.strip(), h_pass.strip()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=error_response(
            code="UNAUTHORIZED",
            message="Kredensial Elearning belum diatur (wajib login via dashboard session atau sertakan Personal API Key muara_ubsi_***)",
            module="elearning"
        )
    )
