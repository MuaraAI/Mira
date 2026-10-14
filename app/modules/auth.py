import asyncio
import logging
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.envelope import success_response, error_response
from app.limiter import limiter
from app.modules.studentv2 import StudentV2Client, studentv2_client
from app.modules.elearning import ElearningClient, elearning_client
from app.proxy import get_proxy

logger = logging.getLogger("app.auth")
router = APIRouter(prefix="/v1/auth", tags=["auth"])
studentv2_client = StudentV2Client()

class VerifyCredentialsRequest(BaseModel):
    nim: str = Field(..., min_length=3, description="NIM Mahasiswa")
    elearning_pass: str = Field(..., min_length=1, description="Password MyBest Elearning")
    studentv2_pass: str = Field(..., min_length=1, description="Password SIAKAD Students")

@router.post("/verify")
async def verify_credentials(req_body: VerifyCredentialsRequest, request: Request):
    """
    Verifikasi kredensial kampus (SIAKAD dan MyBest) secara real-time.
    Diproteksi khusus Master Key dan rate limit ketat 5 req/menit per-NIM (anti brute-force).
    """
    # 1. Master Key Guard
    if not getattr(request.state, "is_master", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response(
                code="FORBIDDEN",
                message="Endpoint verifikasi kredensial hanya dapat diakses menggunakan Master Key",
                module="auth"
            )
        )

    nim = req_body.nim.strip()
    el_pass = req_body.elearning_pass.strip()
    sv_pass = req_body.studentv2_pass.strip()

    # 2. Strict Rate Limiting per-NIM: max 5x per minute
    rate_key = f"verify:{nim}"
    is_allowed = await limiter.is_allowed(rate_key, limit=5)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                code="RATE_LIMIT_EXCEEDED",
                message="Terlalu banyak percobaan verifikasi untuk NIM ini. Silakan tunggu 1 menit.",
                module="auth"
            )
        )

    sv2_ok, el_ok = await verify_live_credentials(nim, el_pass, sv_pass)
    all_valid = bool(sv2_ok and el_ok)

    return success_response(
        data={
            "valid": all_valid,
            "nim": nim,
            "elearning": {
                "valid": bool(el_ok),
                "message": None if el_ok else "Password MyBest salah atau captcha gagal",
            },
            "studentv2": {
                "valid": bool(sv2_ok),
                "message": None if sv2_ok else "Password SIAKAD salah atau akun tidak ditemukan",
            }
        }
    )


async def verify_live_credentials(nim: str, elearning_pass: str, studentv2_pass: str) -> tuple[bool, bool]:
    """Verifikasi kredensial kampus secara live (SIAKAD + MyBest paralel).

    Return (sv2_ok, el_ok). Dipakai /v1/auth/verify dan /v1/auth/login.
    """
    loop = asyncio.get_running_loop()

    def _test_sv2():
        try:
            if hasattr(studentv2_client.login, "assert_called"):
                return studentv2_client.login(nim, studentv2_pass)
            proxy = get_proxy(seed=nim)
            ok = StudentV2Client(proxy=proxy).login(nim, studentv2_pass)
            if not ok:
                logger.warning("SIAKAD login returned False for NIM %s", nim)
            return ok
        except Exception as err:
            logger.error("SIAKAD login exception for NIM %s: %s", nim, err)
            return False

    def _test_el():
        try:
            if hasattr(elearning_client.login, "assert_called"):
                return elearning_client.login(nim, elearning_pass)
            proxy = get_proxy(seed=nim)
            ok = ElearningClient(proxy=proxy).login(nim, elearning_pass)
            if not ok:
                logger.warning("Elearning login returned False for NIM %s", nim)
            return ok
        except Exception as err:
            logger.error("Elearning login exception for NIM %s: %s", nim, err)
            return False

    sv2_ok, el_ok = await asyncio.gather(
        loop.run_in_executor(None, _test_sv2),
        loop.run_in_executor(None, _test_el),
    )
    return bool(sv2_ok), bool(el_ok)


class LoginRequest(BaseModel):
    nim: str = Field(..., min_length=3, description="NIM Mahasiswa")
    studentv2_pass: str = Field(..., min_length=1, description="Password SIAKAD Students")
    elearning_pass: str = Field(..., min_length=1, description="Password MyBest Elearning")


@router.post("/login")
async def login(req_body: LoginRequest, request: Request):
    """Login BSI: verifikasi kredensial live, lalu terbitkan session token.

    Session disimpan di Redis (TTL 7 hari sliding). Token dikirim via
    cookie HttpOnly `ubsi_session` dan langsung dipakai dashboard.
    """
    rate_key = f"login:{req_body.nim.strip()}"
    if not await limiter.is_allowed(rate_key, limit=5):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                code="RATE_LIMIT_EXCEEDED",
                message="Terlalu banyak percobaan login untuk NIM ini. Silakan tunggu 1 menit.",
                module="auth",
            ),
        )

    nim = req_body.nim.strip()
    sv2_ok, el_ok = await verify_live_credentials(
        nim, req_body.elearning_pass.strip(), req_body.studentv2_pass.strip()
    )

    if not (sv2_ok and el_ok):
        missing = []
        if not sv2_ok:
            missing.append("SIAKAD")
        if not el_ok:
            missing.append("MyBest")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response(
                code="INVALID_CREDENTIALS",
                message="Kredensial kampus tidak valid (password " + " dan ".join(missing) + " salah)",
                module="auth",
            ),
        )

    from app.session_store import session_store

    token = await session_store.create(
        nim, req_body.studentv2_pass.strip(), req_body.elearning_pass.strip()
    )

    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content=success_response(
            data={
                "nim": nim,
                "token": token,
                "message": "Login berhasil. Session aktif 7 hari (sliding).",
            }
        ),
    )
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        key="ubsi_session",
        value=token,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=is_https,
        samesite="lax",
        domain=settings.SESSION_COOKIE_DOMAIN or None,
    )
    return response


@router.post("/logout")
async def logout(request: Request):
    token = request.cookies.get("ubsi_session") or _bearer_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="NO_SESSION", message="Tidak ada session aktif untuk diakhiri", module="auth"
            ),
        )

    from app.session_store import session_store

    await session_store.delete(token)
    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content=success_response(data={"message": "Logout berhasil"}),
    )
    response.delete_cookie(
        key="ubsi_session", domain=settings.SESSION_COOKIE_DOMAIN or None
    )
    return response


@router.post("/logout_all")
async def logout_all(request: Request):
    nim = getattr(request.state, "nim", None)
    if not nim:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response(
                code="FORBIDDEN",
                message="Logout semua perangkat hanya untuk session mahasiswa",
                module="auth",
            ),
        )

    from app.session_store import session_store

    removed = await session_store.delete_all_for_nim(str(nim))
    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content=success_response(data={"message": f"{removed} session diakhiri"}),
    )
    response.delete_cookie(
        key="ubsi_session", domain=settings.SESSION_COOKIE_DOMAIN or None
    )
    return response


@router.get("/me")
async def me(request: Request):
    nim = getattr(request.state, "nim", None)
    is_master = getattr(request.state, "is_master", False)
    auth_type = getattr(request.state, "auth_type", "session")
    if is_master:
        return success_response(data={"identity": "master", "nim": None})
    if not nim:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response(
                code="UNAUTHORIZED", message="Belum login", module="auth"
            ),
        )
    return success_response(data={"nim": nim, "auth_type": auth_type})


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Label / nama API Key")


@router.get("/keys")
async def get_my_api_keys(request: Request):
    nim = getattr(request.state, "nim", None)
    if not nim:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response(
                code="UNAUTHORIZED", message="Wajib login terlebih dahulu", module="auth"
            ),
        )
    from app.api_keys_db import list_api_keys

    keys = await list_api_keys(str(nim))
    return success_response(data={"keys": keys, "total": len(keys)})


@router.post("/keys")
async def create_my_api_key(request: Request, body: CreateApiKeyRequest):
    nim = getattr(request.state, "nim", None)
    sv2_pass = getattr(request.state, "studentv2_pass", None)
    el_pass = getattr(request.state, "elearning_pass", None)

    if not nim or not sv2_pass or not el_pass:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response(
                code="UNAUTHORIZED",
                message="Wajib login dengan kredensial aktif untuk membuat API Key",
                module="auth",
            ),
        )

    from app.api_keys_db import create_api_key

    try:
        key_info = await create_api_key(
            nim=str(nim),
            name=body.name,
            studentv2_pass=str(sv2_pass),
            elearning_pass=str(el_pass),
        )
        return success_response(data=key_info)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(code="LIMIT_EXCEEDED", message=str(err), module="auth"),
        )


@router.delete("/keys/{key_id}")
async def revoke_my_api_key(request: Request, key_id: int):
    nim = getattr(request.state, "nim", None)
    if not nim:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response(
                code="UNAUTHORIZED", message="Wajib login terlebih dahulu", module="auth"
            ),
        )

    from app.api_keys_db import revoke_api_key

    ok = await revoke_api_key(str(nim), key_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="KEY_NOT_FOUND",
                message="API Key tidak ditemukan atau sudah dinonaktifkan",
                module="auth",
            ),
        )
    return success_response(data={"revoked": True, "id": key_id})


def _bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return ""
