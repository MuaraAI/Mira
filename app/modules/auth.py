import asyncio
import logging
from datetime import datetime, timedelta, timezone
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
from app.deps import require_siakad_enabled
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
    nim_email_mismatch,
    normalize_email,
    request_reset_link,
)
from app.proxy import get_proxy
from app.upstream_session import clear_login_block

from app.account_devices import (
    approve_device,
    device_handle,
    resolve_device_handle,
    ensure_device,
    get_device_status,
    list_devices,
    require_trusted_device,
    revoke_device,
    LastTrustedDeviceError,
)
from app.account_links import get_link_status, set_link, unlink
from app.device_identity import device_label, issue_device_cookie, new_device_id, read_device_id


def _session_cookie_options(request: Request) -> tuple[bool, Optional[str]]:
    """Flag cookie sama untuk sesi dan identitas device."""
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    return is_https, settings.SESSION_COOKIE_DOMAIN or None


logger = logging.getLogger("app.auth")
router = APIRouter(prefix="/v1/auth", tags=["auth"])
studentv2_client = StudentV2Client()

_SYSTEM_LABEL = {"elearning": "MyBest", "studentv2": "SIAKAD"}
_CAMPUS_MESSAGE_PREVIEW = 160


def _rejection_detail(system: str, reason: str, errors: list[str]) -> dict:
    """Pesan penolakan yang menyebut sistem, penyebab, dan kutipan pesan kampus (jika ada)."""
    label = _SYSTEM_LABEL[system]
    quoted = ""
    if errors:
        preview = errors[0][:_CAMPUS_MESSAGE_PREVIEW]
        quoted = f' Pesan dari {label}: "{preview}".'
    if reason == "captcha":
        return error_response(
            code="CAPTCHA_INVALID",
            message=f"Kode CAPTCHA {label} salah atau sudah kedaluwarsa. Isi kode dari gambar terbaru.{quoted}",
            module="auth",
        )
    if reason == "throttled":
        return error_response(
            code="UPSTREAM_THROTTLED",
            message=f"{label} membatasi jumlah permintaan. Coba lagi beberapa menit kemudian.",
            module="auth",
        )
    if reason == "credentials":
        return error_response(
            code="INVALID_CREDENTIALS",
            message=f"Password {label} ditolak kampus.{quoted} Periksa password {label} lalu coba lagi.",
            module="auth",
        )
    return error_response(
        code="INVALID_CREDENTIALS",
        message=f"Login {label} ditolak kampus tanpa pesan jelas. Periksa username dan password {label}.",
        module="auth",
    )

async def verify_siakad_login(
    nim: str,
    studentv2_pass: str,
    session: Optional[dict] = None,
    captcha: Optional[str] = None,
    outcomes: Optional[dict] = None,
) -> bool:
    """Uji satu kredensial SIAKAD secara live. Dipakai /login dan /credentials.

    `outcomes` (bila diberikan) diisi alasan penolakan: {"studentv2": (reason, errors)}.
    """
    loop = asyncio.get_running_loop()

    def _test_sv2():
        try:
            if hasattr(studentv2_client.login, "assert_called"):
                return studentv2_client.login(nim, studentv2_pass, captcha=captcha, session=session)
            proxy = get_proxy(seed=nim)
            client = StudentV2Client(proxy=proxy)
            try:
                ok = client.login(nim, studentv2_pass, captcha=captcha, session=session)
            finally:
                client.close()
            if outcomes is not None:
                outcomes["studentv2"] = (
                    getattr(client, "_login_failure", None) or "unknown",
                    list(getattr(client, "_login_errors", []) or []),
                )
            if not ok:
                logger.warning("SIAKAD login returned False for NIM %s", nim)
            return ok
        except Exception as err:
            logger.error("SIAKAD login exception for NIM %s: %s", nim, err)
            return False

    return bool(await loop.run_in_executor(None, _test_sv2))


class VerifyCredentialsRequest(BaseModel):
    nim: str = Field(..., min_length=3, description="NIM Mahasiswa")
    elearning_pass: str = Field(..., min_length=1, description="Password MyBest Elearning")
    studentv2_pass: str = Field(default="", description="Password SIAKAD Students (opsional saat SIAKAD_ENABLED=false)")

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

    if req_body.studentv2_pass.strip() and not settings.SIAKAD_ENABLED:
        require_siakad_enabled()
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
    all_valid = bool(el_ok) if not settings.SIAKAD_ENABLED else bool(sv2_ok and el_ok)

    data = {
        "valid": all_valid,
        "nim": nim,
        "elearning": {
            "valid": bool(el_ok),
            "message": None if el_ok else "Password MyBest salah atau captcha gagal",
        },
    }
    if settings.SIAKAD_ENABLED:
        data["studentv2"] = {
            "valid": bool(sv2_ok),
            "message": None if sv2_ok else "Password SIAKAD salah atau akun tidak ditemukan",
        }
    return success_response(data=data)


async def verify_live_credentials(
    nim: str,
    elearning_pass: str,
    studentv2_pass: str,
    *,
    el_session: Optional[dict] = None,
    el_captcha: Optional[str] = None,
    sv_session: Optional[dict] = None,
    sv_captcha: Optional[str] = None,
    outcomes: Optional[dict] = None,
) -> tuple[bool, bool]:
    """Verifikasi kredensial kampus secara live (SIAKAD + MyBest paralel).

    Return (sv2_ok, el_ok). SIAKAD boleh kosong (opsional): pass kosong
    di-skip tanpa menembak server kampus, sv2_ok = False (terkunci).
    `*_session`/`*_captcha` dipakai jalur yang sudah menyelesaikan CAPTCHA:
    `captcha` MyBest adalah `captcha_token` puzzle geser
    (`app/elearning_captcha.py`), `captcha` SIAKAD adalah kode OCR
    (`app/captcha_autosolver.py`).
    """
    loop = asyncio.get_running_loop()

    def _test_el():
        try:
            if hasattr(elearning_client.login, "assert_called"):
                return elearning_client.login(
                    nim, elearning_pass, captcha=el_captcha, session=el_session
                )
            proxy = get_proxy(seed=nim)
            client = ElearningClient(proxy=proxy)
            try:
                ok = client.login(nim, elearning_pass, captcha=el_captcha, session=el_session)
            finally:
                client.close()
            if outcomes is not None:
                outcomes["elearning"] = (
                    getattr(client, "_login_failure", None) or "unknown",
                    list(getattr(client, "_login_errors", []) or []),
                )
            if not ok:
                logger.warning("Elearning login returned False for NIM %s", nim)
            return ok
        except Exception as err:
            logger.error("Elearning login exception for NIM %s: %s", nim, err)
            return False

    el_task = loop.run_in_executor(None, _test_el)
    sv_task = (
        verify_siakad_login(nim, studentv2_pass, session=sv_session, captcha=sv_captcha, outcomes=outcomes)
        if studentv2_pass
        else None
    )
    el_ok = bool(await el_task)
    sv2_ok = bool(await sv_task) if sv_task else False
    return sv2_ok, el_ok


class LoginRequest(BaseModel):
    nim: str = Field(..., min_length=3, description="NIM Mahasiswa")
    studentv2_pass: str = Field("", description="Password SIAKAD Students (opsional: kosongkan untuk lewati)")
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

    from app.maintenance import is_whitelisted, maintenance_active, maintenance_response

    if maintenance_active() and not is_whitelisted(nim):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="MAINTENANCE",
                message=settings.MAINTENANCE_MESSAGE,
                module="maintenance",
                extra={"reason": settings.MAINTENANCE_REASON},
            ),
        )

    el_pass = req_body.elearning_pass.strip()
    # Login Mira hanya memakai MyBest. Password SIAKAD TIDAK diwarisi dari
    # MyBest: dua sistem kampus ini punya password sendiri-sendiri, dan menebak
    # dengan password yang sama hanya menambah hitungan login gagal di kampus
    # sampai akun SIAKAD ikut terkunci. User menautkan SIAKAD secara manual di
    # dashboard (Sesi & Keamanan) memakai password SIAKAD-nya sendiri.
    raw_sv_pass = (req_body.studentv2_pass or "").strip()
    if not settings.SIAKAD_ENABLED:
        raw_sv_pass = ""
    siakad_attempted = bool(raw_sv_pass)

    from app.captcha_autosolver import MAX_CAPTCHA_ATTEMPTS, candidate_session
    from app.elearning_captcha import fetch_captcha_token

    async def _siakad_challenge() -> tuple[Optional[dict], Optional[str]]:
        if not siakad_attempted:
            return None, None
        try:
            session, candidates = await candidate_session("siakad", nim)
        except Exception as err:
            logger.warning("Gagal ambil CAPTCHA SIAKAD untuk %s: %s", nim, err)
            return None, None
        return session, (candidates[0] if candidates else None)

    sv_session, sv_code = await _siakad_challenge()
    outcomes: dict = {}
    el_ok = False
    el_reason = "unknown"
    el_errors: list[str] = []
    el_code = ""

    # CAPTCHA MyBest (puzzle geser) diselesaikan server: tiap POST membakar
    # `captcha_token`, jadi setiap percobaan memakai tantangan baru dan berhenti
    # begitu alasan bukan lagi "captcha" (password salah / throttle).
    for attempt in range(MAX_CAPTCHA_ATTEMPTS):
        try:
            el_session, el_code = await fetch_captcha_token("elearning", nim)
        except Exception as err:
            logger.warning("Gagal selesaikan puzzle MyBest untuk %s: %s", nim, err)
            el_reason = "captcha"
            el_errors = []
            break
        sv2_ok, el_ok = await verify_live_credentials(
            nim,
            el_pass,
            raw_sv_pass,
            el_session=el_session,
            el_captcha=el_code,
            sv_session=sv_session,
            sv_captcha=sv_code,
            outcomes=outcomes,
        )
        el_reason, el_errors = outcomes.get("elearning", ("unknown", []))
        if el_ok or el_reason != "captcha":
            break
        logger.warning(
            "Puzzle MyBest ditolak nim=%s percobaan=%s/%s pesan=%s",
            nim,
            attempt + 1,
            MAX_CAPTCHA_ATTEMPTS,
            (el_errors[0][:120] if el_errors else "-"),
        )

    if el_reason == "captcha" and not el_ok:
        logger.warning(
            "Login MyBest gagal CAPTCHA setelah %s percobaan nim=%s", MAX_CAPTCHA_ATTEMPTS, nim
        )
    else:
        logger.info("Login MyBest nim=%s alasan=%s", nim, el_reason)

    # Brute-force & login guard: hitung sukses jika MyBest valid (dan SIAKAD valid jika diisi)
    attempt_success = bool(el_ok and (sv2_ok or not siakad_attempted))
    await login_guard.record_attempt(nim, attempt_success, client_ip)
    # Worker bisa lebih dulu mengunci NIM karena CAPTCHA. Hapus blok per host
    # yang benar-benar diterima kampus. MyBest yang valid tetap dihitung sukses
    # walaupun SIAKAD opsional ikut diisi dengan password yang salah.
    # Catatan: block map bersifat lokal per worker; jalur absen/tugas juga
    # memakai cookie kampus tersimpan yang direstore sebelum cooldown dicek.
    if el_ok:
        clear_login_block("elearning", nim)
    if siakad_attempted and sv2_ok:
        clear_login_block("studentv2", nim)

    # MyBest wajib: gagal -> tolak 401
    if not el_ok:
        el_reason, el_errors = outcomes.get("elearning", ("unknown", []))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_rejection_detail("elearning", el_reason, el_errors),
        )

    # Opsi A: SIAKAD diisi tapi salah -> login tetap sukses, SIAKAD terkunci (pass kosong),
    # sertakan warning ramah agar user tahu fitur SIAKAD belum aktif.
    effective_sv_pass = raw_sv_pass if sv2_ok else ""
    warnings: list[str] = []
    if not settings.SIAKAD_ENABLED:
        warnings.append("SIAKAD dinonaktifkan; nilai, KHS, dan KRS dibuka di students.bsi.ac.id.")
    if siakad_attempted and not sv2_ok and (req_body.studentv2_pass or "").strip():
        # Warning hanya untuk user yang memang mengisi password SIAKAD sendiri.
        # Password yang diwarisi dari MyBest tidak boleh memunculkan keluhan:
        # user tidak pernah mengetiknya dan tidak bisa memperbaikinya.
        sv_reason, sv_errors = outcomes.get("studentv2", ("unknown", []))
        if sv_session is None:
            # Auto-solve CAPTCHA SIAKAD gagal: password belum tentu salah.
            sv_message = "Auto-solve CAPTCHA SIAKAD gagal, jadi SIAKAD belum bisa diperiksa."
        else:
            sv_message = _rejection_detail("studentv2", sv_reason, sv_errors)["error"]["message"]
        warnings.append(f"{sv_message} Fitur SIAKAD terkunci; hubungkan ulang di Sesi & Keamanan.")

    from app.session_store import session_store

    ua = request.headers.get("user-agent", "")
    device_id = read_device_id(request) or new_device_id()
    await ensure_device(nim, device_id, label=device_label(ua), user_agent=ua)
    token = await session_store.create(nim, effective_sv_pass, el_pass, device_id=device_id)

    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content=success_response(
            data={
                "nim": nim,
                "token": token,
                "message": "Login berhasil. Session aktif 7 hari (sliding).",
                "systems": {
                    "siakad": bool(effective_sv_pass),
                    "mybest": True,
                },
                "warnings": warnings,
                "default_password": {
                    "siakad": is_default_password(effective_sv_pass) if effective_sv_pass else False,
                    "mybest": is_default_password(el_pass),
                },
            }
        ),
    )
    is_https, cookie_domain = _session_cookie_options(request)
    cookie_samesite = "none" if is_https else "lax"

    response.set_cookie(
        key="ubsi_session",
        value=token,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=is_https,
        samesite=cookie_samesite,
        domain=cookie_domain,
    )
    issue_device_cookie(response, device_id, is_https=is_https, domain=cookie_domain)
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
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    cookie_samesite = "none" if is_https else "lax"
    cookie_domain = settings.SESSION_COOKIE_DOMAIN or None
    response.delete_cookie(
        key="ubsi_session",
        path="/",
        domain=cookie_domain,
        secure=is_https,
        httponly=True,
        samesite=cookie_samesite,
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
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    cookie_samesite = "none" if is_https else "lax"
    cookie_domain = settings.SESSION_COOKIE_DOMAIN or None
    response.delete_cookie(
        key="ubsi_session",
        path="/",
        domain=cookie_domain,
        secure=is_https,
        httponly=True,
        samesite=cookie_samesite,
    )
    return response


@router.get("/me")
async def me(request: Request):
    nim = getattr(request.state, "nim", None)
    is_master = getattr(request.state, "is_master", False)
    auth_type = getattr(request.state, "auth_type", "session")
    if is_master:
        return success_response(
            data={
                "identity": "master",
                "nim": None,
                "device": {"status": "trusted"},
                "session": None,
                "systems": {"siakad": True, "mybest": True},
                # Master memakai kredensial per-request (header), bukan sesi tertaut.
                "links": {
                    "mybest": {"linked": True, "required": True, "linked_password": "request"},
                    "siakad": {
                        "linked": True,
                        "required": False,
                        "linked_password": "request",
                        "status": "linked",
                    },
                },
            }
        )
    if not nim:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response(
                code="UNAUTHORIZED", message="Belum login", module="auth"
            ),
        )
    sv_pass = getattr(request.state, "studentv2_pass", "") or ""
    el_pass = getattr(request.state, "elearning_pass", "") or ""

    ua = request.headers.get("user-agent", "")
    device_id = ""
    device_status = "trusted"
    if auth_type == "session":
        device_id = getattr(request.state, "device_id", "") or new_device_id()
        device_status = await get_device_status(nim, device_id)
        if device_status != "missing":
            # /me menyegarkan last_seen baris yang sudah ada.
            device_status = await ensure_device(
                nim, device_id, label=device_label(ua), user_agent=ua
            )
        elif not await list_devices(nim):
            # Migrasi mulus sesi legasi (login sebelum fitur device-linking):
            # jika NIM belum punya perangkat sama sekali, daftarkan perangkat aktif
            # ini sebagai perangkat pertama (trusted) agar akses SIAKAD tidak terkunci 403.
            device_status = await ensure_device(
                nim, device_id, label=device_label(ua), user_agent=ua
            )
            session_token = request.cookies.get("ubsi_session") or _bearer_token(request)
            if session_token:
                try:
                    from app.session_store import session_store

                    await session_store.attach_device(session_token, device_id)
                except Exception as exc:
                    logger.warning("Gagal ikat device_id ke sesi legasi nim=%s: %s", nim, exc)

    link_status = await get_link_status(nim, "siakad")
    if link_status is None:
        # Sesi legasi belum punya baris kanonis; password di sesi menandakan tautan.
        link_status = "linked" if sv_pass else "unlinked"
    # Ketersediaan SIAKAD mengikuti store kanonis, bukan salinan sesi: login
    # MyBest-only tetap melihat tautan yang benar-benar tersimpan.
    siakad_available = link_status == "linked"

    # Sisa umur sesi (detik). Sesi Mira sliding 7 hari: setiap request sukses
    # memperpanjang, jadi angka ini = "kalau kamu berhenti membuka Mira".
    expires_in = getattr(request.state, "session_expires_in", None)
    session_info = None
    if isinstance(expires_in, int) and expires_in > 0:
        session_info = {
            "expires_in": expires_in,
            "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat(),
            "days_left": round(expires_in / 86400, 1),
        }

    # Password SIAKAD bisa berbeda dari MyBest (kampus memakai dua sistem akun).
    # `linked_password` memberi tahu UI apakah tautan SIAKAD memakai password
    # yang sama atau password terpisah, supaya user tidak bingung saat ganti.
    if not siakad_available:
        linked_password = None
    elif sv_pass and sv_pass == el_pass:
        linked_password = "mybest"
    else:
        linked_password = "separate"

    data = {
        "nim": nim,
        "auth_type": auth_type,
        "device": {"status": device_status},
        "session": session_info,
        # Kontrak lama tetap: boolean siap pakai untuk gerbang UI.
        "systems": {"siakad": siakad_available, "mybest": bool(el_pass)},
        # Detail per sistem untuk halaman Sesi & Keamanan.
        "links": {
            "mybest": {
                "linked": bool(el_pass),
                "required": True,
                "linked_password": "mybest" if el_pass else None,
            },
            "siakad": {
                "linked": siakad_available,
                "required": False,
                "linked_password": linked_password,
                "status": link_status,
            },
        },
    }
    if auth_type == "session" and device_status != "missing" and not read_device_id(request):
        response = JSONResponse(content=success_response(data=data))
        is_https, cookie_domain = _session_cookie_options(request)
        issue_device_cookie(response, device_id, is_https=is_https, domain=cookie_domain)
        return response
    return success_response(data=data)


@router.get("/devices")
async def list_my_devices(request: Request):
    """Daftar perangkat akun. Hanya perangkat tepercaya yang boleh melihatnya.

    `device_id` mentah tidak dikirim ke klien karena nilai itu dipakai gerbang
    sebagai bukti perangkat. Klien hanya menerima `handle` HMAC.
    """
    nim = _require_session_nim(request)
    await require_trusted_device(request)
    devices = await list_devices(nim)
    current_device = str(getattr(request.state, "device_cookie_id", "") or "")
    data = [
        {
            "handle": device_handle(nim, device["device_id"]),
            "label": device["label"],
            "user_agent": device.get("user_agent"),
            "status": device["status"],
            "last_seen": device.get("last_seen"),
            "is_current": bool(current_device) and device["device_id"] == current_device,
        }
        for device in devices
    ]
    return success_response(data={"devices": data, "total": len(data)})


@router.post("/devices/{handle}/approve")
async def approve_my_device(handle: str, request: Request):
    """Izinkan perangkat pending; hanya perangkat tepercaya yang boleh menyetujui."""
    nim = _require_session_nim(request)
    approved_by = await require_trusted_device(request)
    device_id = await resolve_device_handle(nim, handle)
    if not device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="DEVICE_NOT_FOUND",
                message="Perangkat tidak ditemukan atau sudah dicabut",
                module="auth",
            ),
        )
    approved = await approve_device(nim, device_id, approved_by=approved_by)
    if not approved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="DEVICE_NOT_FOUND",
                message="Perangkat tidak ditemukan atau sudah dicabut",
                module="auth",
            ),
        )
    return success_response(data={"device_id": device_id, "status": "trusted"})


@router.delete("/devices/{handle}")
async def revoke_my_device(handle: str, request: Request):
    """Cabut perangkat dan akhiri semua sesi yang lahir dari perangkat itu."""
    nim = _require_session_nim(request)
    await require_trusted_device(request)
    device_id = await resolve_device_handle(nim, handle)
    if not device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="DEVICE_NOT_FOUND",
                message="Perangkat tidak ditemukan atau sudah dicabut",
                module="auth",
            ),
        )
    try:
        changed = await revoke_device(nim, device_id)
    except LastTrustedDeviceError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_response(
                code="LAST_TRUSTED_DEVICE",
                message="Perangkat tepercaya terakhir tidak bisa dicabut. "
                "Izinkan perangkat lain terlebih dahulu.",
                module="auth",
            ),
        )
    if not changed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="DEVICE_NOT_FOUND",
                message="Perangkat tidak ditemukan atau sudah dicabut",
                module="auth",
            ),
        )
    from app.session_store import session_store

    sessions_ended = await session_store.delete_all_for_device(nim, device_id)
    return success_response(
        data={"device_id": device_id, "revoked": True, "sessions_ended": sessions_ended}
    )


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
    # API key membawa kredensial kampus; hanya perangkat tepercaya yang boleh membuatnya.
    await require_trusted_device(request)
    sv2_pass = getattr(request.state, "studentv2_pass", None) or ""
    el_pass = getattr(request.state, "elearning_pass", None) or ""
    # MyBest wajib; SIAKAD boleh kosong (key tetap bisa dibuat, tapi endpoint studentv2 terkunci)
    if not nim or not el_pass:
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
    sv_pass = getattr(request.state, "studentv2_pass", "") or ""
    el_pass = getattr(request.state, "elearning_pass", "") or ""
    return success_response(
        data={
            **activity,
            "systems": {
                "siakad": bool(sv_pass),
                "mybest": bool(el_pass),
            },
            "default_password": {
                "siakad": is_default_password(sv_pass) if sv_pass else False,
                "mybest": is_default_password(el_pass) if el_pass else False,
            },
        }
    )


class ConnectCredentialsRequest(BaseModel):
    system: str = Field(..., pattern="^(siakad)$", description="Sistem kampus yang ingin dihubungkan (saat ini: siakad)")
    password: str = Field(..., min_length=1, max_length=128, description="Password akun kampus")


@router.post("/credentials")
async def connect_credentials(body: ConnectCredentialsRequest, request: Request):
    """Tautkan kredensial SIAKAD ke akun (store kanonis per NIM) setelah login MyBest.

    Verifikasi live ke server kampus -> tulis store kanonis `account_links`,
    lalu segarkan salinan sesi aktif. API key membaca store kanonis.
    """
    nim = _require_session_nim(request)

    # Gerbang device: perangkat belum tepercaya tidak boleh menautkan SIAKAD,
    # apalagi menyentuh store kanonis.
    await require_trusted_device(request)

    if not await limiter.is_allowed(f"connect:{nim}", limit=5):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                code="RATE_LIMIT_EXCEEDED",
                message="Terlalu banyak percobaan menghubungkan akun. Tunggu 1 menit.",
                module="auth",
            ),
        )

    if not settings.SIAKAD_ENABLED:
        require_siakad_enabled()

    from app.captcha_autosolver import MAX_CAPTCHA_ATTEMPTS, candidate_session

    pwd = body.password.strip()

    # SIAKAD juga memakai CAPTCHA: selesaikan lewat OCR dengan tantangan baru
    # tiap percobaan, berhenti segera saat alasan bukan lagi "captcha".
    sv_ok = False
    last_reason = "unknown"
    last_errors: list[str] = []
    for _ in range(MAX_CAPTCHA_ATTEMPTS):
        try:
            sv_session, sv_candidates = await candidate_session("siakad", nim)
        except Exception as err:
            logger.warning("Gagal ambil CAPTCHA SIAKAD untuk %s: %s", nim, err)
            sv_candidates = []
        if not sv_candidates:
            last_reason = "captcha"
            break
        outcomes: dict[str, tuple[str, list[str]]] = {}
        sv_ok = await verify_siakad_login(
            nim, pwd, session=sv_session, captcha=sv_candidates[0], outcomes=outcomes
        )
        if sv_ok:
            break
        last_reason, last_errors = outcomes.get("studentv2", ("unknown", []))
        if last_reason != "captcha":
            break

    if not sv_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_rejection_detail("studentv2", last_reason, last_errors),
        )

    clear_login_block("studentv2", nim)

    from app.session_store import session_store

    # Store kanonis jadi sumber kebenaran; sesi ikut disegarkan agar /me dan
    # migrasi legasi tetap konsisten.
    await set_link(nim, "siakad", kind="password", secret=pwd, status="linked")
    sessions = await session_store.update_password_for_nim(nim, "studentv2_pass", pwd)
    keys = 0

    # Mutasi in-memory request.state agar handler middleware selanjutnya di request ini sinkron
    request.state.studentv2_pass = pwd

    logger.info("SIAKAD dihubungkan untuk %s (%s sesi disegarkan)", nim, sessions)
    return success_response(
        data={
            "system": body.system,
            "connected": True,
            "message": "Akun SIAKAD berhasil dihubungkan. Semua fitur akademik terbuka.",
            "systems": {
                "siakad": True,
                "mybest": bool(getattr(request.state, "elearning_pass", "")),
            },
            "sessions_updated": sessions,
            "api_keys_updated": keys,
        }
    )


@router.delete("/credentials/siakad")
async def disconnect_siakad(request: Request):
    """Lepas tautan SIAKAD: tulis tombstone kanonis dan kosongkan salinan sesi.

    MyBest tidak bisa dilepas: password MyBest adalah syarat sesi Mira sendiri.
    """
    nim = _require_session_nim(request)

    # Gerbang device: perangkat belum tepercaya tidak boleh melepas tautan akun.
    await require_trusted_device(request)

    link_status = await get_link_status(nim, "siakad")
    if link_status is None and (getattr(request.state, "studentv2_pass", "") or ""):
        # Sesi legasi belum punya baris kanonis: anggap tautan hidup seperti /me.
        link_status = "linked"
    if link_status not in ("linked", "needs_relink"):
        return success_response(
            data={
                "system": "siakad",
                "connected": False,
                "message": "SIAKAD memang belum tertaut.",
                "sessions_updated": 0,
                "api_keys_updated": 0,
            }
        )

    from app.session_store import session_store

    changed = await unlink(nim, "siakad")
    if not changed:
        logger.info("Tombstone SIAKAD untuk %s sudah ada sebelumnya", nim)
    sessions = await session_store.update_password_for_nim(nim, "studentv2_pass", "")
    keys = 0

    request.state.studentv2_pass = ""
    # Cookie sesi kampus tidak lagi dipakai: buang supaya request berikutnya
    # tidak memakai sesi SIAKAD yang sudah dilepas.
    for module in ("studentv2",):
        try:
            from app.campus_session_store import drop_cookies

            drop_cookies(module, nim)
        except Exception:
            logger.debug("Gagal menghapus cookie sesi %s untuk %s", module, nim)

    logger.info("SIAKAD dilepas untuk %s (%s sesi disegarkan)", nim, sessions)
    return success_response(
        data={
            "system": "siakad",
            "connected": False,
            "message": "Tautan SIAKAD dilepas. Fitur SIAKAD disembunyikan sampai kamu hubungkan lagi.",
            "sessions_updated": sessions,
            "api_keys_updated": keys,
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

    # Gerbang device: perangkat belum tepercaya tidak boleh memutar password kanonis.
    await require_trusted_device(request)

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

    if body.system == "siakad" and not settings.SIAKAD_ENABLED:
        require_siakad_enabled()
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="SYSTEM_NOT_CONNECTED",
                message=f"Akun {label} belum terhubung di sesi ini. Hubungkan dulu di Sesi & Keamanan.",
                module="auth",
            ),
        )
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

    if field == "studentv2_pass":
        # Ganti password SIAKAD yang diterima kampus ikut menulis store kanonis.
        await set_link(nim, "siakad", kind="password", secret=body.new_password, status="linked")

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
    """Endpoint publik lupa password berbagi kuota & blacklist IP yang sama dengan login."""
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
    if body.system == "siakad" and not settings.SIAKAD_ENABLED:
        require_siakad_enabled()

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


def _bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return ""
