"""Router PWA Web Push (/v1/notifications/pwa) — device mgmt + VAPID key.

Auth: session mahasiswa saja (sama seperti channels). Master Key / API key
tidak boleh mendaftar device pribadi orang lain.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.config import settings
from app.envelope import error_response, success_response
from app.pwa_push_db import (
    add_subscription,
    get_active_subscriptions_for_nim,
    list_subscriptions,
    remove_subscription,
)
from app.pwa_webpush import send_web_push

router = APIRouter(prefix="/v1/notifications/pwa", tags=["pwa-push"])

_VALID_ENDPOINT_SCHEMES = {"https", "http"}


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

    # Endpoint harus URL absolut https (push service selalu https)
    if not body.endpoint.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="VALIDATION_ERROR",
                message="Endpoint push harus URL https",
                module="pwa-push",
            ),
        )

    p256dh = body.keys.get("p256dh", "")
    auth = body.keys.get("auth", "")
    if not p256dh or not auth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="VALIDATION_ERROR",
                message="keys.p256dh dan keys.auth wajib diisi",
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
    devices = await list_subscriptions(nim)
    return success_response(data={"devices": devices, "total": len(devices)})


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
    delivered = 0
    for sub in subs:
        ok, http_status = await send_web_push(sub, payload, ttl=60)
        if ok:
            delivered += 1
    return success_response(data={
        "delivered": delivered,
        "total_devices": len(subs),
        "message": f"Notifikasi uji coba terkirim ke {delivered} perangkat",
    })
