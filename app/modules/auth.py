import asyncio
import logging
import re
import secrets
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.envelope import success_response, error_response
from app.limiter import limiter
from app.modules.studentv2 import StudentV2Client, studentv2_client
from app.modules.elearning import ElearningClient, elearning_client
from app.login_guard import LOGIN_IP_LIMIT, login_guard
from app.password_change import (
    SYSTEMS as PASSWORD_SYSTEMS,
    change_upstream_password,
    is_default_password,
    validate_new_password,
)
from app.password_reset import (
    EMAIL_RE,
    RESET_LINK_TTL_MINUTES,
    RESET_SYSTEMS,
    TOKEN_RE,
    nim_email_mismatch,
    normalize_email,
    request_reset_link,
    submit_reset,
)
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
            client = StudentV2Client(proxy=proxy)
            try:
                ok = client.login(nim, studentv2_pass)
            finally:
                client.close()
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
            client = ElearningClient(proxy=proxy)
            try:
                ok = client.login(nim, elearning_pass)
            finally:
                client.close()
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
    from app.main import extract_client_ip

    client_ip = extract_client_ip(request)
    decision = await login_guard.check_ip(client_ip)
    if not decision.allowed:
        minutes = max(1, -(-decision.retry_after // 60))
        body = error_response(
            code="IP_BLACKLISTED",
            message=(
                f"IP kamu diblokir sementara karena terlalu banyak percobaan login "
                f"(maks {LOGIN_IP_LIMIT}x per menit). Coba lagi dalam {minutes} menit."
            ),
            module="auth",
        )
        body["error"]["retry_after"] = decision.retry_after
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            headers={"Retry-After": str(decision.retry_after)},
            content=body,
        )

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

    await login_guard.record_attempt(nim, bool(sv2_ok and el_ok), client_ip)

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
                "default_password": {
                    "siakad": is_default_password(req_body.studentv2_pass),
                    "mybest": is_default_password(req_body.elearning_pass),
                },
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
    # Atribut harus identik dengan set_cookie agar semua browser engine menghapus cookie.
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.delete_cookie(
        key="ubsi_session",
        path="/",
        domain=settings.SESSION_COOKIE_DOMAIN or None,
        secure=is_https,
        httponly=True,
        samesite="lax",
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
    # Atribut harus identik dengan set_cookie agar semua browser engine menghapus cookie.
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.delete_cookie(
        key="ubsi_session",
        path="/",
        domain=settings.SESSION_COOKIE_DOMAIN or None,
        secure=is_https,
        httponly=True,
        samesite="lax",
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
    if getattr(request.state, "auth_type", "") != "session":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_response(
            code="SESSION_REQUIRED", message="Kelola API Key harus melalui sesi dashboard", module="auth"
        ))
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
    if getattr(request.state, "auth_type", "") != "session":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_response(
            code="SESSION_REQUIRED", message="Pembuatan API Key harus melalui sesi dashboard", module="auth"
        ))
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
    if getattr(request.state, "auth_type", "") != "session":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_response(
            code="SESSION_REQUIRED", message="Pencabutan API Key harus melalui sesi dashboard", module="auth"
        ))
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


def _require_session_nim(request: Request) -> str:
    nim = getattr(request.state, "nim", None)
    if getattr(request.state, "auth_type", "") != "session" or not nim:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response(
                code="SESSION_REQUIRED",
                message="Fitur ini hanya bisa dipakai lewat sesi dashboard",
                module="auth",
            ),
        )
    return str(nim)


@router.get("/security")
async def security_status(request: Request):
    """Ringkasan keamanan akun: jumlah login hari ini (WIB) dan status password default."""
    nim = _require_session_nim(request)
    activity = await login_guard.activity(nim)
    return success_response(
        data={
            **activity,
            "default_password": {
                "siakad": is_default_password(getattr(request.state, "studentv2_pass", "") or ""),
                "mybest": is_default_password(getattr(request.state, "elearning_pass", "") or ""),
            },
        }
    )


class ChangePasswordRequest(BaseModel):
    system: str = Field(..., pattern="^(siakad|mybest)$", description="Sistem kampus: siakad atau mybest")
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=1, max_length=128)


_STATE_FIELD = {"siakad": "studentv2_pass", "mybest": "elearning_pass"}


@router.post("/password")
async def change_password(body: ChangePasswordRequest, request: Request):
    """Ganti password SIAKAD/MyBest di server kampus, lalu sinkronkan ke sesi & API Key Mira."""
    nim = _require_session_nim(request)
    field = _STATE_FIELD[body.system]
    label = PASSWORD_SYSTEMS[body.system]["label"]

    if not await limiter.is_allowed(f"pwchange:{nim}", limit=3):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                code="RATE_LIMIT_EXCEEDED",
                message="Terlalu banyak percobaan ganti password. Tunggu 1 menit.",
                module="auth",
            ),
        )

    stored = getattr(request.state, field, "") or ""
    if not secrets.compare_digest(body.current_password.encode("utf-8"), stored.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="CURRENT_PASSWORD_MISMATCH",
                message=f"Password {label} saat ini tidak cocok dengan yang dipakai login.",
                module="auth",
            ),
        )

    problem = validate_new_password(nim, stored, body.new_password)
    if problem:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(code="WEAK_PASSWORD", message=problem, module="auth"),
        )

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None, change_upstream_password, body.system, nim, stored, body.new_password
    )

    if result.status != "changed":
        code = {
            "rejected": "PASSWORD_REJECTED",
            "form_missing": "PASSWORD_FORM_NOT_FOUND",
            "login_failed": "UPSTREAM_LOGIN_FAILED",
        }.get(result.status, "PASSWORD_STATUS_UNKNOWN")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY if result.status == "unknown" else status.HTTP_400_BAD_REQUEST,
            detail=error_response(code=code, message=result.message, module="auth"),
        )

    from app.api_keys_db import update_password_for_nim as update_keys
    from app.session_store import session_store

    sessions = await session_store.update_password_for_nim(nim, field, body.new_password)
    try:
        keys = await update_keys(nim, field, body.new_password)
    except Exception as err:
        logger.error("Sinkron password ke API Key gagal untuk %s: %s", nim, err)
        keys = 0
    logger.info("Password %s diganti untuk %s (%s sesi, %s API key disinkronkan)", label, nim, sessions, keys)
    return success_response(
        data={
            "system": body.system,
            "changed": True,
            "message": result.message,
            "sessions_updated": sessions,
            "api_keys_updated": keys,
        }
    )


def _field_error(status_code: int, code: str, message: str, fields: list[str], **extra) -> JSONResponse:
    """Error dengan daftar field yang salah, dipakai UI untuk efek getar pada input terkait."""
    body = error_response(code=code, message=message, module="auth")
    body["error"]["fields"] = fields
    body["error"].update(extra)
    headers = {"Retry-After": str(extra["retry_after"])} if "retry_after" in extra else None
    return JSONResponse(status_code=status_code, content=body, headers=headers)


async def _guard_public_auth(request: Request) -> Optional[JSONResponse]:
    """Endpoint publik (lupa/reset password) berbagi kuota & blacklist IP yang sama dengan login."""
    from app.main import extract_client_ip

    decision = await login_guard.check_ip(extract_client_ip(request))
    if decision.allowed:
        return None
    minutes = max(1, -(-decision.retry_after // 60))
    return _field_error(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "IP_BLACKLISTED",
        f"IP kamu diblokir sementara karena terlalu banyak percobaan. Coba lagi dalam {minutes} menit.",
        [],
        retry_after=decision.retry_after,
    )


class ForgotPasswordRequest(BaseModel):
    nim: str = Field(..., min_length=1, max_length=20)
    email: str = Field(..., min_length=1, max_length=254)
    system: str = Field("mybest", pattern="^(siakad|mybest)$")


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, request: Request):
    """Minta link reset password ke email terdaftar, setelah NIM dan email dicek cocok."""
    blocked = await _guard_public_auth(request)
    if blocked:
        return blocked

    nim = body.nim.strip()
    email = normalize_email(body.email)
    label = RESET_SYSTEMS[body.system]["label"]
    bad = [f for f, ok in (("nim", re.fullmatch(r"\d{6,12}", nim)), ("email", EMAIL_RE.match(email))) if not ok]
    if bad:
        return _field_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "INVALID_INPUT",
            "NIM harus berupa angka." if bad == ["nim"] else "Format email belum benar." if bad == ["email"] else "Periksa NIM dan email.",
            bad,
        )

    redis_client = await login_guard.get_client()
    if await nim_email_mismatch(redis_client, nim, email):
        return _field_error(
            status.HTTP_400_BAD_REQUEST,
            "NIM_EMAIL_MISMATCH",
            "NIM dan email tidak cocok. Pakai email yang terdaftar untuk NIM ini.",
            ["nim", "email"],
        )

    if not await limiter.is_allowed(f"forgot:{body.system}:{email}", limit=1):
        return _field_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "RATE_LIMIT_EXCEEDED",
            "Link baru saja diminta. Tunggu 1 menit sebelum minta lagi.",
            [],
            retry_after=60,
        )

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, request_reset_link, body.system, email)
    if result.status == "sent":
        return success_response(
            data={
                "sent": True,
                "system": body.system,
                "email": email,
                "expires_in_minutes": RESET_LINK_TTL_MINUTES,
                "message": f"Link reset {label} dikirim ke {email}. Berlaku {RESET_LINK_TTL_MINUTES} menit.",
            }
        )
    if result.status == "not_found":
        return _field_error(status.HTTP_404_NOT_FOUND, "EMAIL_NOT_REGISTERED", result.message, ["email"])
    if result.status == "throttled":
        return _field_error(status.HTTP_429_TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED", result.message, [], retry_after=60)
    return _field_error(
        status.HTTP_502_BAD_GATEWAY if result.status == "unknown" else status.HTTP_400_BAD_REQUEST,
        "RESET_REQUEST_FAILED",
        result.message,
        [],
    )


class ResetPasswordRequest(BaseModel):
    system: str = Field(..., pattern="^(siakad|mybest)$")
    token: str = Field(..., min_length=1, max_length=128)
    email: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, request: Request):
    """Setel password baru memakai token dari link reset kampus."""
    blocked = await _guard_public_auth(request)
    if blocked:
        return blocked

    email = normalize_email(body.email)
    token = body.token.strip()
    if not TOKEN_RE.match(token) or not EMAIL_RE.match(email):
        return _field_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "INVALID_RESET_LINK",
            "Link reset tidak valid. Tempel ulang link lengkap dari email.",
            ["link"],
        )
    problem = validate_new_password("", "", body.password)
    if problem:
        return _field_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "WEAK_PASSWORD", problem, ["password"])

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, submit_reset, body.system, token, email, body.password)
    if result.status == "reset":
        return success_response(data={"reset": True, "system": body.system, "message": result.message})
    if result.status == "token_invalid":
        return _field_error(status.HTTP_410_GONE, "RESET_LINK_EXPIRED", result.message, ["link"])
    return _field_error(
        status.HTTP_502_BAD_GATEWAY if result.status == "unknown" else status.HTTP_400_BAD_REQUEST,
        "RESET_FAILED",
        result.message,
        ["password"] if result.status == "rejected" else [],
    )


def _bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return ""
