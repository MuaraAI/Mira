from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest

from app.modules.news import _h1_slot as REAL_H1_SLOT  # sebelum di-patch fixture


def _tomorrow_name() -> str:
    """Nama hari besok (WIB) agar test tidak depend pada hari eksekusi."""
    days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    return days[(datetime.now(ZoneInfo("Asia/Jakarta")) + timedelta(days=1)).weekday()]


@pytest.fixture(autouse=True)
def temp_channel_db(monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "notifications.db"))
    from app.channels_db import init_db
    from app.pwa_push_db import init_pwa_db
    init_db()
    init_pwa_db()


@pytest.fixture(autouse=True)
def evening_window(monkeypatch):
    """Pengingat H-1 pakai slot 19:00/21:00 WIB; test tidak boleh bergantung jam eksekusi."""
    monkeypatch.setattr("app.modules.news._h1_window_open", lambda now=None: True)
    monkeypatch.setattr("app.modules.news._h1_slot", lambda now=None: 19)



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
        patch("app.modules.news.parse_schedule", return_value=[{"nama": "Dasar Pemrograman", "hari": _tomorrow_name(), "jam": "08:00", "ruang": "A1"}]),
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
        patch("app.modules.news.parse_schedule", return_value=[{"nama": "Dasar Pemrograman", "hari": _tomorrow_name(), "jam": "08:00", "ruang": "A1"}]),
        patch("app.modules.news.dispatch_webhook_notification", new=AsyncMock(return_value=True)) as dispatch,
        patch("app.modules.news.cache.get_client") as get_client,
    ):
        redis = AsyncMock()
        redis.get.return_value = None
        get_client.return_value = redis
        assert await _produce_user_category("matkul-besok") == 1


def test_validation_accepts_extended_notification_categories():
    from app.channel_validation import validate_channel_payload

    for cat in ("absen-kuliah", "nilai-keluar", "jadwal-ujian"):
        valid, err = validate_channel_payload(
            "discord",
            [cat],
            {"url": "https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz123456"},
        )
        assert valid is True
        assert err == ""


@pytest.mark.asyncio
async def test_user_notification_dispatches_nilai_keluar():
    from app.modules.news import _produce_user_category

    active_channel = {
        "id": 10,
        "nim": "15260767",
        "type": "custom",
        "categories": ["nilai-keluar"],
        "config": {"url": "https://example.com/webhook"},
    }
    mock_grades = [
        {"kode": "104", "nama": "Bahasa Inggris I", "grade": "A", "total": 88.5}
    ]
    with (
        patch("app.modules.news.list_active_by_category", new=AsyncMock(return_value=[active_channel])),
        patch("app.modules.news.session_store.get_credentials_for_nim", new=AsyncMock(return_value=("15260767", "sv", "el"))),
        patch("app.modules.studentv2.studentv2_client.fetch_page", new=AsyncMock(return_value="<html>grades</html>")),
        patch("app.modules.studentv2.parse_grades", return_value=mock_grades),
        patch("app.modules.news.dispatch_webhook_notification", new=AsyncMock(return_value=True)) as dispatch,
        patch("app.modules.news.cache.get_client") as get_client,
    ):
        redis = AsyncMock()
        redis.get.return_value = None
        get_client.return_value = redis
        assert await _produce_user_category("nilai-keluar") == 1
        dispatch.assert_awaited_once()
        payload = dispatch.call_args[0][0]
        assert payload["category"] == "nilai-keluar"
        assert "Grade A" in payload["description"]


@pytest.mark.asyncio
async def test_user_notification_dispatches_jadwal_ujian():
    from app.modules.news import _produce_user_category

    active_channel = {
        "id": 11,
        "nim": "15260767",
        "type": "custom",
        "categories": ["jadwal-ujian"],
        "config": {"url": "https://example.com/webhook"},
    }
    with (
        patch("app.modules.news.list_active_by_category", new=AsyncMock(return_value=[active_channel])),
        patch("app.modules.news.session_store.get_credentials_for_nim", new=AsyncMock(return_value=("15260767", "sv", "el"))),
        patch("app.modules.studentv2.studentv2_client.fetch_page", new=AsyncMock(side_effect=["<html>uts</html>", "<html>uas</html>"])),
        patch("app.modules.studentv2.parse_uts", return_value={"jadwal_online_url": "https://uts.bsi.ac.id/jadwal", "soal_offline_url": None}),
        patch("app.modules.studentv2.parse_uas", return_value={"jadwal_online_url": None, "soal_offline_url": None}),
        patch("app.modules.news.dispatch_webhook_notification", new=AsyncMock(return_value=True)) as dispatch,
        patch("app.modules.news.cache.get_client") as get_client,
    ):
        redis = AsyncMock()
        redis.get.return_value = None
        get_client.return_value = redis
        assert await _produce_user_category("jadwal-ujian") == 1
        dispatch.assert_awaited_once()
        payload = dispatch.call_args[0][0]
        assert payload["category"] == "jadwal-ujian"
        assert "UTS" in payload["title"]


@pytest.mark.asyncio
async def test_worker_pushes_to_pwa_subscribers_without_any_webhook_channel():
    """Regresi: notifikasi otomatis dulu hanya ke webhook, pelanggan push PWA tidak pernah dapat."""
    from app.modules.news import _produce_user_category
    from app.pwa_push_db import add_subscription

    await add_subscription("15260225", "https://fcm.googleapis.com/fcm/send/abc", "k", "a", "HP")
    with (
        patch("app.modules.news.list_active_by_category", new=AsyncMock(return_value=[])),
        patch("app.modules.news.session_store.get_credentials_for_nim", new=AsyncMock(return_value=("15260225", "sp", "ep"))),
        patch("app.modules.news.studentv2_client.fetch_page", new=AsyncMock(return_value="<html/>")),
        patch("app.modules.news.parse_schedule", return_value=[{"nama": "Basis Data", "hari": _tomorrow_name(), "jam": "08:00", "ruang": "A1"}]),
        patch("app.pwa_webpush.dispatch_pwa_to_nim", new=AsyncMock(return_value=1)) as push,
        patch("app.modules.news.cache.get_client") as get_client,
    ):
        redis = AsyncMock()
        redis.get.return_value = None
        get_client.return_value = redis
        assert await _produce_user_category("matkul-besok") == 1

    push.assert_awaited_once()
    assert push.await_args.args[0] == "15260225"
    assert "Basis Data" in push.await_args.args[1]["body"]


@pytest.mark.asyncio
async def test_h1_reminder_is_skipped_outside_evening_window(monkeypatch):
    from app.modules.news import _produce_user_category
    from app.pwa_push_db import add_subscription

    monkeypatch.setattr("app.modules.news._h1_slot", lambda now=None: None)
    await add_subscription("15260225", "https://fcm.googleapis.com/fcm/send/abc", "k", "a", "HP")
    fetch = AsyncMock(return_value="<html/>")
    with (
        patch("app.modules.news.list_active_by_category", new=AsyncMock(return_value=[])),
        patch("app.modules.news.session_store.get_credentials_for_nim", new=AsyncMock(return_value=("15260225", "sp", "ep"))),
        patch("app.modules.news.studentv2_client.fetch_page", new=fetch),
        patch("app.modules.news.cache.get_client") as get_client,
    ):
        get_client.return_value = AsyncMock()
        assert await _produce_user_category("matkul-besok") == 0
    fetch.assert_not_awaited()


def test_h1_window_hours():
    _h1_window_open = REAL_H1_SLOT
    wib = ZoneInfo("Asia/Jakarta")
    assert not _h1_window_open(datetime(2026, 10, 20, 18, 0, tzinfo=wib))  # sebelum 19:00
    assert _h1_window_open(datetime(2026, 10, 20, 19, 0, tzinfo=wib))   # slot 1
    assert _h1_window_open(datetime(2026, 10, 20, 21, 30, tzinfo=wib))  # slot 2
    assert _h1_window_open(datetime(2026, 10, 20, 23, 59, tzinfo=wib))  # masih malam yang sama
    assert not _h1_window_open(datetime(2026, 10, 20, 0, 5, tzinfo=wib))
    assert not _h1_window_open(datetime(2026, 10, 20, 12, 0, tzinfo=wib))


@pytest.mark.asyncio
async def test_h1_reminder_sends_once_per_slot(monkeypatch):
    """Slot 19:00 dan 21:00 masing-masing kirim sekali: dedupe key per slot, bukan per hari."""
    from app.modules.news import _produce_user_category

    class FakeRedis:
        def __init__(self):
            self.kv: dict = {}

        async def get(self, key):
            return self.kv.get(key)

        async def set(self, key, value, ex=None, nx=False):
            if nx and key in self.kv:
                return False
            self.kv[key] = value
            return True

    redis = FakeRedis()
    fetch = AsyncMock(return_value="<html/>")
    with (
        patch("app.modules.news.list_active_by_category", new=AsyncMock(return_value=[])),
        patch("app.pwa_push_db.list_nims_with_category", new=AsyncMock(return_value=["15260767"])),
        patch("app.modules.news.session_store.get_credentials_for_nim", new=AsyncMock(return_value=("15260767", "sp", "ep"))),
        patch("app.modules.news.studentv2_client.fetch_page", new=fetch),
        patch("app.modules.news.parse_schedule", return_value=[{"nama": "Dasar Pemrograman", "hari": _tomorrow_name(), "jam": "08:00", "ruang": "A1"}]),
        patch("app.modules.news.build_schedule_notification", return_value={"title": "Jadwal Besok", "description": "Ada kelas", "link": "x"}),
        patch("app.notifier.deliver", new=AsyncMock(return_value=2)),
        patch("app.modules.news.cache.get_client", new=AsyncMock(return_value=redis)),
        patch("app.modules.news._h1_slot", return_value=19),
    ):
        assert await _produce_user_category("matkul-besok") == 1
        assert await _produce_user_category("matkul-besok") == 0  # slot sama: dedupe

    with (
        patch("app.modules.news.list_active_by_category", new=AsyncMock(return_value=[])),
        patch("app.pwa_push_db.list_nims_with_category", new=AsyncMock(return_value=["15260767"])),
        patch("app.modules.news.session_store.get_credentials_for_nim", new=AsyncMock(return_value=("15260767", "sp", "ep"))),
        patch("app.modules.news.studentv2_client.fetch_page", new=fetch),
        patch("app.modules.news.parse_schedule", return_value=[{"nama": "Dasar Pemrograman", "hari": _tomorrow_name(), "jam": "08:00", "ruang": "A1"}]),
        patch("app.modules.news.build_schedule_notification", return_value={"title": "Jadwal Besok", "description": "Ada kelas", "link": "x"}),
        patch("app.notifier.deliver", new=AsyncMock(return_value=2)),
        patch("app.modules.news.cache.get_client", new=AsyncMock(return_value=redis)),
        patch("app.modules.news._h1_slot", return_value=21),
    ):
        assert await _produce_user_category("matkul-besok") == 1  # slot baru: kirim lagi


@pytest.mark.asyncio
async def test_existing_pwa_subscribers_get_new_kelas_mulai_category_once(tmp_path, monkeypatch):
    import sqlite3

    from app.pwa_push_db import init_pwa_db, list_categories

    db = str(tmp_path / "legacy.db")
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", db)
    conn = sqlite3.connect(db)
    conn.executescript(
        """
        CREATE TABLE pwa_push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, nim TEXT NOT NULL,
          endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, device_name TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_used_at TEXT);
        CREATE TABLE pwa_push_categories (nim TEXT NOT NULL, category TEXT NOT NULL, PRIMARY KEY (nim, category));
        INSERT INTO pwa_push_subscriptions (nim, endpoint, p256dh, auth, device_name) VALUES ('1', 'https://x/1', 'k', 'a', 'HP');
        INSERT INTO pwa_push_categories VALUES ('1', 'berita-kampus');
        """
    )
    conn.commit()
    conn.close()

    init_pwa_db()
    assert set(await list_categories("1")) == {"berita-kampus", "kelas-mulai"}

    # Pengguna mematikan kategori itu: migrasi tidak boleh menyalakannya lagi saat server restart.
    from app.pwa_push_db import set_categories

    await set_categories("1", ["berita-kampus"])
    init_pwa_db()
    assert set(await list_categories("1")) == {"berita-kampus"}
