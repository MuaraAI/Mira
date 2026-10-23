"""Router PWA Web Push (/v1/notifications/pwa) — device mgmt + VAPID key.

Auth: session mahasiswa saja (sama seperti channels). Master Key / API key
tidak boleh mendaftar device pribadi orang lain.
"""
import asyncio

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.envelope import error_response, success_response
from app.modules.news import is_safe_webhook_url
from app.pwa_push_db import (
    add_subscription,
    get_active_subscriptions_for_nim,
    list_categories,
    list_subscriptions,
    remove_subscription,
    set_categories,
)
from app.pwa_webpush import _b64url_decode, dispatch_pwa_to_nim

router = APIRouter(prefix="/v1/notifications/pwa", tags=["pwa-push"])

# Anti-SSRF ketat: endpoint push hanya boleh ke push service resmi (suffix host).
ALLOWED_PUSH_HOST_SUFFIXES = (
    "fcm.googleapis.com",  # Android/Chrome
    "push.apple.com",  # Safari/iOS
    "notify.windows.com",  # Edge
    "mozilla.com",  # Firefox (autopush)
)


def _endpoint_allowed(endpoint: str) -> bool:
    from urllib.parse import urlparse

    host = urlparse(endpoint).hostname or ""
    return any(host == s or host.endswith("." + s) for s in ALLOWED_PUSH_HOST_SUFFIXES)


def _require_session_nim(request: Request) -> str:
    nim = getattr(request.state, "nim", None)
    if not nim:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response(
                code="FORBIDDEN",
                message="Endpoint PWA push hanya untuk session login mahasiswa",
                module="pwa-push",
            ),
        )
    return str(nim)


class SubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=8, max_length=2048)
    keys: dict[str, str] = Field(..., min_length=1, max_length=2)
    device_name: str = Field(default="Browser", max_length=64)

    @field_validator("keys")
    @classmethod
    def _cap_key_lengths(cls, v: dict[str, str]) -> dict[str, str]:
        for key, value in v.items():
            if len(value) > 512:
                raise ValueError(f"keys.{key} maksimal 512 karakter")
        return v


class CategoriesRequest(BaseModel):
    categories: list[str] = Field(..., min_length=1, max_length=16)


@router.get("/vapid-key")
async def get_vapid_public_key():
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_response(
                code="PWA_PUSH_DISABLED",
                message="Server belum mengonfigurasi VAPID keys",
                module="pwa-push",
            ),
        )
    return success_response(data={"public_key": settings.VAPID_PUBLIC_KEY})


@router.post("/subscribe")
async def subscribe_device(request: Request, body: SubscribeRequest):
    nim = _require_session_nim(request)

    # Anti-SSRF: host wajib push service resmi (anti DNS-rebinding + anti internal host).
    # getaddrinfo blocking dijalankan di threadpool agar tidak membekukan event loop.
    if not _endpoint_allowed(body.endpoint) or not await asyncio.to_thread(
        is_safe_webhook_url, body.endpoint
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="VALIDATION_ERROR",
                message="Endpoint push tidak valid (wajib https dan IP publik push service)",
                module="pwa-push",
            ),
        )

    p256dh = body.keys.get("p256dh", "")
    auth = body.keys.get("auth", "")
    # Validasi bentuk di trust boundary: kunci rusak jangan sampai tersimpan
    # (device yang tersimpan rusak tidak pernah menerima push tanpa jejak).
    try:
        user_pub = _b64url_decode(p256dh)
        auth_raw = _b64url_decode(auth)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="VALIDATION_ERROR",
                message="keys.p256dh/auth harus base64url valid",
                module="pwa-push",
            ),
        ) from exc
    if len(user_pub) != 65 or user_pub[0] != 0x04 or len(auth_raw) < 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="VALIDATION_ERROR",
                message="keys.p256dh harus P-256 uncompressed (65 byte, prefix 0x04) dan keys.auth minimal 16 byte",
                module="pwa-push",
            ),
        )

    sub_id = await add_subscription(
        nim=nim,
        endpoint=body.endpoint,
        p256dh=p256dh,
        auth=auth,
        device_name=body.device_name.strip() or "Browser",
    )
    return success_response(data={
        "id": sub_id,
        "device_name": body.device_name.strip() or "Browser",
        "message": "Notifikasi perangkat berhasil diaktifkan",
    })


@router.get("/devices")
async def list_devices(request: Request):
    nim = _require_session_nim(request)
    devices = await list_subscriptions(nim, active_only=True)
    return success_response(data={"devices": devices, "total": len(devices)})


@router.get("/categories")
async def get_my_categories(request: Request):
    nim = _require_session_nim(request)
    cats = await list_categories(nim)
    return success_response(data={"categories": cats, "total": len(cats)})


@router.put("/categories")
async def update_my_categories(request: Request, body: CategoriesRequest):
    nim = _require_session_nim(request)
    try:
        await set_categories(nim, body.categories)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="VALIDATION_ERROR",
                message=str(exc),
                module="pwa-push",
            ),
        )
    cats = await list_categories(nim)
    return success_response(data={"categories": cats, "total": len(cats)})


@router.delete("/devices/{device_id}")
async def delete_device(request: Request, device_id: int):
    nim = _require_session_nim(request)
    deleted = await remove_subscription(nim, device_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="NOT_FOUND",
                message="Perangkat tidak ditemukan",
                module="pwa-push",
            ),
        )
    return success_response(data={"message": "Perangkat berhasil dihapus"})


@router.post("/test")
async def send_test_push(request: Request):
    nim = _require_session_nim(request)
    subs = await get_active_subscriptions_for_nim(nim)
    if not subs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="NO_DEVICE",
                message="Belum ada perangkat terdaftar. Aktifkan notifikasi dulu.",
                module="pwa-push",
            ),
        )
    payload = {
        "title": "UBSI API: Notifikasi Uji Coba",
        "body": "Notifikasi PWA aktif di perangkat ini. Semua kategori akademik akan masuk ke sini.",
        "url": "/dashboard/notifikasi",
        "tag": "pwa-test",
    }
    # Jalur dispatch yang sama dengan worker: ValueError tertangani, 404/410 ter-prune
    delivered = await dispatch_pwa_to_nim(nim, payload, ttl=60)
    if delivered == 0:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(
                code="DELIVERY_FAILED",
                message="Tidak ada perangkat yang menerima uji coba. Cek koneksi perangkat atau daftar ulang.",
                module="pwa-push",
            ),
        )
    return success_response(data={
        "delivered": delivered,
        "total_devices": len(subs),
        "message": f"Notifikasi uji coba terkirim ke {delivered} perangkat",
    })
