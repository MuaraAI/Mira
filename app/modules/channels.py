import asyncio
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.channel_validation import ALLOWED_CATEGORIES, validate_channel_payload
from app.channels_db import (
    add_channel,
    delete_channel,
    get_channel,
    list_channels,
    set_channel_active,
    update_channel_categories,
)
from app.envelope import error_response, success_response

router = APIRouter(prefix="/v1/channels", tags=["channels"])


class ChannelRequest(BaseModel):
    type: Literal["discord", "telegram", "custom"]
    categories: list[str] = Field(..., min_length=1, max_length=5)
    config: dict[str, str] = Field(default_factory=dict)


class ReminderRequest(BaseModel):
    category: str = Field(default="matkul-besok", max_length=64)


class ChannelCategoriesRequest(BaseModel):
    categories: list[str] = Field(..., max_length=5)


def _require_session_nim(request: Request) -> str:
    """Channel notifikasi hanya untuk session mahasiswa (bukan Master Key)."""
    nim = getattr(request.state, "nim", None)
    if not nim:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response(
                code="FORBIDDEN",
                message="Endpoint channel hanya untuk session login mahasiswa",
                module="channels",
            ),
        )
    return str(nim)


@router.get("")
async def list_my_channels(request: Request):
    nim = _require_session_nim(request)
    channels = await list_channels(nim)
    return success_response(data={"channels": channels, "total": len(channels)})


@router.post("")
async def create_channel(request: Request, body: ChannelRequest):
    nim = _require_session_nim(request)

    channel_type = body.type
    categories = body.categories
    config = body.config

    valid, error_message = validate_channel_payload(channel_type, categories, config)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(code="VALIDATION_ERROR", message=error_message, module="channels"),
        )

    try:
        channel_id = await add_channel(nim, channel_type, categories, config)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(code="CHANNEL_LIMIT", message=str(exc), module="channels"),
        )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=success_response(
            data={
                "id": channel_id,
                "type": channel_type,
                "categories": categories,
                "is_active": False,
                "message": "Channel dibuat nonaktif. Jalankan test-send untuk mengaktifkan.",
            }
        ),
    )


@router.patch("/{channel_id}")
async def edit_channel_categories(
    channel_id: int, request: Request, body: ChannelCategoriesRequest
):
    nim = _require_session_nim(request)
    if not body.categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(code="VALIDATION_ERROR", message="Minimal pilih satu kategori event notifikasi", module="channels"),
        )
    invalid = [category for category in body.categories if category not in ALLOWED_CATEGORIES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="VALIDATION_ERROR",
                message=f"Kategori tidak dikenal: {', '.join(invalid)}",
                module="channels",
            ),
        )
    updated = await update_channel_categories(nim, channel_id, body.categories)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(code="NOT_FOUND", message="Channel tidak ditemukan", module="channels"),
        )
    return success_response(data={"id": channel_id, "categories": body.categories, "message": "Kategori webhook diperbarui"})


@router.delete("/{channel_id}")
async def remove_channel(channel_id: int, request: Request):
    nim = _require_session_nim(request)
    deleted = await delete_channel(nim, channel_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="NOT_FOUND", message="Channel tidak ditemukan", module="channels"
            ),
        )
    return success_response(data={"message": "Channel dihapus"})


@router.post("/{channel_id}/test")
async def test_channel(channel_id: int, request: Request):
    """Kirim pesan tes ke channel; sukses mengaktifkan channel."""
    nim = _require_session_nim(request)
    channel = await get_channel(nim, channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(
                code="NOT_FOUND", message="Channel tidak ditemukan", module="channels"
            ),
        )

    from app.modules.news import (
        dispatch_discord_webhook,
        dispatch_telegram_message,
        dispatch_webhook_notification,
    )

    config = channel["config"]
    channel_type = channel["type"]
    try:
        if channel_type == "discord":
            ok = await dispatch_discord_webhook(
                {"title": "Tes Channel Muara AI", "description": "Channel notifikasi aktif.", "link": "https://ubsi-api.muaraai.com"},
                config["url"],
            )
        elif channel_type == "telegram":
            ok = await dispatch_telegram_message(
                {"title": "Tes Channel Muara AI", "description": "Channel notifikasi aktif.", "link": "https://ubsi-api.muaraai.com"},
                config["bot_token"],
                config["chat_id"],
            )
        else:
            ok = await dispatch_webhook_notification(
                {"title": "Tes Channel Muara AI", "description": "Channel notifikasi aktif.", "link": "https://ubsi-api.muaraai.com"},
                config["url"],
                event="channel.test",
            )
    except Exception:
        ok = False

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(
                code="TEST_FAILED",
                message="Pengiriman tes gagal. Periksa kembali URL/token channel.",
                module="channels",
            ),
        )

    await set_channel_active(nim, channel_id, True)
    return success_response(data={"message": "Tes berhasil. Channel sekarang aktif.", "is_active": True})


@router.post("/trigger-reminder")
async def trigger_reminder(request: Request, body: ReminderRequest):
    """Kirim manual pengingat event ke semua channel aktif milik user."""
    nim = _require_session_nim(request)
    category = body.category.strip()

    from app.channels_db import list_channels

    channels = await list_channels(nim, mask=False)
    active_matching = [
        ch for ch in channels if ch["is_active"] and category in ch["categories"]
    ]

    # PWA Web Push: kategori terikat akun (bukan per-channel)
    from app.pwa_push_db import list_categories
    from app.pwa_webpush import dispatch_pwa_to_nim

    pwa_category_ok = category in (await list_categories(nim))
    if not active_matching and not pwa_category_ok:
        return success_response(
            data={
                "dispatched": 0,
                "message": f"Tidak ada channel aktif yang berlangganan event '{category}'",
            }
        )

    if category == "matkul-besok":
        payload = {
            "title": "Pengingat Kuliah Esok Hari - SIAKAD UBSI",
            "description": "Halo! Besok ada jadwal perkuliahan aktif. Siapkan perlengkapan, modul materi, dan hadir tepat waktu di ruang kelas.",
            "link": "https://ubsi-api.muaraai.com/dashboard/jadwal",
        }
    elif category in ("quiz-tugas", "tugas-baru"):
        payload = {
            "title": "Pengingat Tugas & Kuis - MyBest Elearning",
            "description": "Periksa pertemuan aktif di portal MyBest. Pastikan tugas mingguan dan kuis telah disubmit sebelum tenggat waktu.",
            "link": "https://ubsi-api.muaraai.com/dashboard/tugas",
        }
    elif category == "absen-kuliah":
        payload = {
            "title": "Sesi Presensi Perkuliahan Dibuka - MyBest",
            "description": "Sesi absensi perkuliahan telah dibuka. Silakan lakukan presensi kehadiran sekarang di portal MyBest.",
            "link": "https://ubsi-api.muaraai.com/dashboard/presensi",
        }
    elif category == "nilai-keluar":
        payload = {
            "title": "Pemberitahuan Nilai & KHS Semester - SIAKAD",
            "description": "Pembaruan nilai mata kuliah dan Kartu Hasil Studi (KHS) telah dipublikasikan di SIAKAD UBSI.",
            "link": "https://ubsi-api.muaraai.com/dashboard/nilai",
        }
    elif category == "jadwal-ujian":
        payload = {
            "title": "Pengingat Jadwal & Ruang Ujian - SIAKAD",
            "description": "Informasi jadwal ruang ujian semester (UTS / UAS) telah dirilis. Periksa jadwal dan persiapan ujian Anda.",
            "link": "https://ubsi-api.muaraai.com/dashboard/ujian",
        }
    else:
        payload = {
            "title": f"Notifikasi Event: {category}",
            "description": f"Pemberitahuan perkuliahan UBSI untuk mahasiswa NIM {nim}.",
            "link": "https://ubsi-api.muaraai.com/dashboard",
        }

    from app.modules.news import (
        dispatch_discord_webhook,
        dispatch_telegram_message,
        dispatch_webhook_notification,
    )

    async def dispatch_one(ch: dict) -> dict:
        cfg = ch["config"]
        try:
            if ch["type"] == "discord":
                ok = await dispatch_discord_webhook(payload, cfg["url"])
            elif ch["type"] == "telegram":
                ok = await dispatch_telegram_message(payload, cfg["bot_token"], cfg["chat_id"])
            else:
                ok = await dispatch_webhook_notification(payload, cfg["url"], event=f"reminder.{category}")
            return {"channel_id": ch["id"], "type": ch["type"], "success": ok}
        except Exception:
            return {"channel_id": ch["id"], "type": ch["type"], "success": False}

    results = await asyncio.gather(*(dispatch_one(ch) for ch in active_matching))
    dispatched = sum(1 for r in results if r["success"])

    # Fan-out PWA: push native ke semua device aktif milik NIM ini
    pwa_pushed = 0
    if pwa_category_ok:
        try:
            pwa_pushed = await dispatch_pwa_to_nim(
                nim,
                {
                    "title": payload["title"],
                    "body": payload.get("description", "")[:200],
                    "url": payload.get("link", "/dashboard"),
                    "tag": category,
                },
            )
        except Exception:
            pwa_pushed = 0

    total_dispatched = dispatched + pwa_pushed
    return success_response(
        data={
            "dispatched": total_dispatched,
            "webhook_dispatched": dispatched,
            "pwa_pushed": pwa_pushed,
            "total_channels": len(active_matching),
            "results": results,
            "message": f"Pengingat '{category}' berhasil dikirim ke {total_dispatched} tujuan aktif.",
        }
    )

