import json
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.channel_validation import validate_channel_payload
from app.channels_db import (
    add_channel,
    delete_channel,
    get_channel,
    list_channels,
    set_channel_active,
)
from app.envelope import error_response, success_response

router = APIRouter(prefix="/v1/channels", tags=["channels"])


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
async def create_channel(request: Request, body: dict):
    nim = _require_session_nim(request)

    channel_type = str(body.get("type", "")).strip().lower()
    categories = body.get("categories") or []
    config = body.get("config") or {}

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
