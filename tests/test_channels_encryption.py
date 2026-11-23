"""Config channel webhook harus terenkripsi at-rest di SQLite.

Token bot Telegram dan URL webhook Discord adalah rahasia; baris database
tidak boleh memuatnya sebagai teks biasa. Config lama (plaintext, pra-
2026-11-23) tetap harus bisa dibaca tanpa migrasi manual.
"""
import json
import sqlite3
import pytest

from app.cache import cache
from app.channels_db import (
    add_channel,
    init_db,
    list_active_by_category,
    list_channels,
)
from app.config import settings
from tests.test_login_guard import FakeRedis

NIM = "12345678"
_DISCORD = {"url": "https://discord.com/api/webhooks/1234567890123/abcdefghijklmnopqrstuvwxyz123456"}


@pytest.fixture
def env(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "channels.sqlite3"))
    monkeypatch.setattr(cache, "_client", FakeRedis())
    init_db()


@pytest.mark.asyncio
async def test_config_at_rest_is_not_plaintext(env):
    channel_id = await add_channel(NIM, "discord", ["berita-kampus"], _DISCORD)

    with sqlite3.connect(settings.SQLITE_DB_PATH) as conn:
        raw = conn.execute(
            "SELECT config FROM webhook_channels WHERE id = ?", (channel_id,)
        ).fetchone()[0]

    assert "discord.com/api/webhooks" not in raw
    assert raw.startswith("_enc:")
    listed = await list_channels(NIM, mask=False)
    assert listed[0]["config"] == _DISCORD


@pytest.mark.asyncio
async def test_legacy_plaintext_row_still_readable(env, monkeypatch):
    init_db()
    with sqlite3.connect(settings.SQLITE_DB_PATH) as conn:
        conn.execute(
            "INSERT INTO webhook_channels (nim, type, categories, config, is_active) VALUES (?, ?, ?, ?, 1)",
            (NIM, "telegram", json.dumps(["berita-kampus"]),
             json.dumps({"bot_token": "123456:abcdefghijklmnopqrstuvwxyz123456", "chat_id": "1"})),
        )
        conn.commit()

    listed = await list_channels(NIM)
    assert listed[0]["config"]["chat_id"] == "1"

    matched = await list_active_by_category("berita-kampus")
    assert matched and matched[0]["config"]["chat_id"] == "1"
