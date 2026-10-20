from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture(autouse=True)
def temp_channel_db(monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "notifications.db"))
    from app.channels_db import init_db
    init_db()



@pytest.mark.asyncio
async def test_schedule_notification_payload_uses_tomorrow_courses():
    from app.modules.news import build_schedule_notification

    now = datetime(2026, 10, 20, 8, 0, tzinfo=timezone.utc)
    payload = build_schedule_notification(
        [
            {"nama": "Dasar Pemrograman", "hari": "Rabu", "jam": "08:00 - 10:30", "ruang": "A1"},
            {"nama": "Bahasa Inggris", "hari": "Kamis", "jam": "10:30 - 12:00", "ruang": "B2"},
        ],
        now=now,
    )

    assert payload is not None
    assert payload["category"] == "matkul-besok"
    assert "Dasar Pemrograman" in payload["description"]
    assert "A1" in payload["description"]
    assert "Bahasa Inggris" not in payload["description"]


@pytest.mark.asyncio
async def test_poll_user_notifications_dispatches_schedule_for_active_user():
    from app.modules.news import poll_user_notifications

    active_channel = {
        "id": 7,
        "nim": "15260767",
        "type": "custom",
        "categories": ["matkul-besok"],
        "config": {"url": "https://example.com/webhook"},
    }
    with (
        patch("app.modules.news.list_active_by_category", new=AsyncMock(return_value=[active_channel])),
        patch(
            "app.modules.news.session_store.get_credentials_for_nim",
            new=AsyncMock(return_value=("15260767", "student-pass", "elearning-pass")),
        ),
        patch(
            "app.modules.news.studentv2_client.fetch_page",
            new=AsyncMock(return_value="<html>schedule</html>"),
        ),
        patch("app.modules.news.parse_schedule", return_value=[{"nama": "Dasar Pemrograman", "hari": "Rabu", "jam": "08:00", "ruang": "A1"}]),
        patch("app.modules.news.dispatch_webhook_notification", new=AsyncMock(return_value=True)) as dispatch,
        patch("app.modules.news.cache.get_client") as get_client,
    ):
        redis = AsyncMock()
        redis.get.return_value = None
        get_client.return_value = redis
        count = await poll_user_notifications()

    assert count == 1
    dispatch.assert_awaited_once()


def test_channel_response_masks_delivery_secrets():
    from app.channels_db import mask_channel_config

    masked = mask_channel_config(
        "discord",
        {"url": "https://discord.com/api/webhooks/1234567890123/abcdefghijklmnopqrstuvwxyz123456"},
    )

    assert masked["url"].startswith("https://discord.com/api/webhooks/")
    assert "abcdefghijklmnopqrstuvwxyz123456" not in masked["url"]

    telegram = mask_channel_config(
        "telegram", {"bot_token": "123456:abcdefghijklmnopqrstuvwxyzABCDEFGHIJ", "chat_id": "-100123"}
    )
    assert telegram["bot_token"] != "123456:abcdefghijklmnopqrstuvwxyzABCDEFGHIJ"
    assert telegram["chat_id"] == "-100123"


@pytest.mark.asyncio
async def test_user_notification_falls_back_to_personal_api_key_credentials():
    from app.modules.news import _produce_user_category

    active_channel = {
        "id": 8,
        "nim": "15260767",
        "type": "custom",
        "categories": ["matkul-besok"],
        "config": {"url": "https://example.com/webhook"},
    }
    with (
        patch("app.modules.news.list_active_by_category", new=AsyncMock(return_value=[active_channel])),
        patch("app.modules.news.session_store.get_credentials_for_nim", new=AsyncMock(return_value=None)),
        patch("app.api_keys_db.get_credentials_for_nim", new=AsyncMock(return_value=("15260767", "student-pass", "elearning-pass"))),
        patch("app.modules.news.studentv2_client.fetch_page", new=AsyncMock(return_value="<html>schedule</html>")),
        patch("app.modules.news.parse_schedule", return_value=[{"nama": "Dasar Pemrograman", "hari": "Rabu", "jam": "08:00", "ruang": "A1"}]),
        patch("app.modules.news.dispatch_webhook_notification", new=AsyncMock(return_value=True)),
        patch("app.modules.news.cache.get_client") as get_client,
    ):
        redis = AsyncMock()
        redis.get.return_value = None
        get_client.return_value = redis
        assert await _produce_user_category("matkul-besok") == 1
