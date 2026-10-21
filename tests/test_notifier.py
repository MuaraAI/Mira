"""Notifikasi waktu-nyata: kelas segera mulai, kelas dimulai, pengingat absen berulang."""
from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from app import notifier
from app.notifier import (
    WIB,
    absen_decision,
    active_classes,
    class_alert_text,
    class_alerts_due,
    parse_time_range,
)

# 2026-10-21 adalah hari Rabu.
SCHEDULE = [
    {"kode": "207", "nama": "LOGIKA DAN ALGORITMA", "hari": "Rabu", "jam": "07:30 - 10:00", "ruang": "R-401"},
    {"kode": "894", "nama": "DASAR PEMROGRAMAN", "hari": "Rabu", "jam": "13.00-15.00", "ruang": "LAB-2"},
    {"kode": "101", "nama": "AGAMA", "hari": "Kamis", "jam": "07:30-09:10", "ruang": "R-1"},
]


def at(hour: int, minute: int) -> datetime:
    return datetime(2026, 10, 21, hour, minute, tzinfo=WIB)


def test_parse_time_range_variants():
    assert parse_time_range("07:30 - 10:00") == (450, 600)
    assert parse_time_range("07.30-10.00") == (450, 600)
    assert parse_time_range("7:30-9:10") == (450, 550)
    assert parse_time_range("") is None
    assert parse_time_range("Jam belum tersedia") is None


def test_soon_alert_within_fifteen_minutes_only():
    assert class_alerts_due(SCHEDULE, at(7, 0)) == []
    due = class_alerts_due(SCHEDULE, at(7, 15))
    assert [(c["kode"], stage, minutes) for c, stage, minutes in due] == [("207", "soon", 15)]
    due = class_alerts_due(SCHEDULE, at(7, 29))
    assert [(c["kode"], stage, minutes) for c, stage, minutes in due] == [("207", "soon", 1)]


def test_now_alert_in_first_fifteen_minutes_of_class():
    due = class_alerts_due(SCHEDULE, at(7, 30))
    assert [(c["kode"], stage) for c, stage, _ in due] == [("207", "now")]
    assert class_alerts_due(SCHEDULE, at(7, 45))[0][1] == "now"
    assert class_alerts_due(SCHEDULE, at(7, 46)) == []


def test_other_days_are_ignored():
    # Kamis 07:20 tidak boleh memicu kelas hari Rabu maupun sebaliknya.
    thursday = datetime(2026, 10, 22, 7, 20, tzinfo=WIB)
    assert [c["kode"] for c, _, _ in class_alerts_due(SCHEDULE, thursday)] == ["101"]


def test_timezone_is_converted_to_wib():
    from datetime import timezone

    utc_time = datetime(2026, 10, 21, 0, 20, tzinfo=timezone.utc)  # 07:20 WIB
    assert [c["kode"] for c, _, _ in class_alerts_due(SCHEDULE, utc_time)] == ["207"]


def test_active_classes_only_during_class():
    assert active_classes(SCHEDULE, at(7, 29)) == []
    assert [c["kode"] for c in active_classes(SCHEDULE, at(9, 59))] == ["207"]
    assert active_classes(SCHEDULE, at(10, 0)) == []


def test_alert_text_mentions_course_time_and_room():
    title, body = class_alert_text(SCHEDULE[0], "soon", 12)
    assert title == "Kuliah 12 menit lagi: LOGIKA DAN ALGORITMA"
    assert "07:30 - 10:00" in body and "R-401" in body
    title, _ = class_alert_text(SCHEDULE[0], "now", 3)
    assert title.startswith("Kuliah dimulai sekarang")


def test_absen_waits_until_session_opens_then_reminds_then_stops_when_done():
    state, now = None, 1000.0
    action, state = absen_decision(state, session_open=False, now_ts=now)
    assert action == "wait" and state["next"] == now + notifier.ABSEN_RECHECK_SECONDS

    action, state = absen_decision(state, session_open=True, now_ts=now + 200)
    assert action == "remind" and state["sent"] == 1

    action, state = absen_decision(state, session_open=True, now_ts=now + 900)
    assert action == "remind" and state["sent"] == 2  # masih belum absen: ingatkan lagi

    action, state = absen_decision(state, session_open=False, now_ts=now + 1500)
    assert action == "done" and state["done"]  # sudah absen / sesi ditutup: berhenti
    assert absen_decision(state, session_open=True, now_ts=now + 2000)[0] == "done"


def test_absen_reminders_are_capped():
    state: dict = {}
    for i in range(notifier.ABSEN_MAX_REMINDERS):
        action, state = absen_decision(state, True, 1000.0 + i * 600)
        assert action == "remind"
    assert absen_decision(state, True, 9000.0)[0] == "done"


@pytest.mark.asyncio
async def test_class_alert_is_sent_once_and_released_when_nobody_receives(monkeypatch):
    claimed: set[str] = set()

    async def fake_claim(key: str, ttl: int) -> bool:
        if key in claimed:
            return False
        claimed.add(key)
        return True

    released: list[str] = []

    async def fake_release(key: str) -> None:
        claimed.discard(key)
        released.append(key)

    deliver = AsyncMock(return_value=1)
    monkeypatch.setattr(notifier, "_claim", fake_claim)
    monkeypatch.setattr(notifier, "_release", fake_release)
    monkeypatch.setattr(notifier, "deliver", deliver)

    assert await notifier._send_class_alerts("15260225", SCHEDULE, at(7, 20)) == 1
    assert await notifier._send_class_alerts("15260225", SCHEDULE, at(7, 21)) == 0  # menit berikutnya: sudah terkirim
    assert deliver.await_count == 1
    assert deliver.await_args.args[1] == "kelas-mulai"

    # Tidak ada tujuan yang menerima: klaim dilepas supaya dicoba lagi menit depan.
    deliver.return_value = 0
    assert await notifier._send_class_alerts("15260225", SCHEDULE, at(7, 30)) == 0
    assert released


@pytest.mark.asyncio
async def test_deliver_fans_out_to_webhook_and_pwa(monkeypatch):
    webhook = AsyncMock(return_value=True)
    pwa = AsyncMock(return_value=2)
    monkeypatch.setattr("app.modules.news._dispatch_user_channel", webhook)
    monkeypatch.setattr("app.pwa_push_db.list_categories", AsyncMock(return_value=["kelas-mulai"]))
    monkeypatch.setattr("app.pwa_webpush.dispatch_pwa_to_nim", pwa)

    channels = [{"id": 1, "nim": "1", "type": "discord", "config": {"url": "https://discord.com/api/webhooks/1/x"}}]
    sent = await notifier.deliver("1", "kelas-mulai", "Judul", "Isi", "https://x/y", ttl=600, channels=channels)

    assert sent == 3
    webhook.assert_awaited_once()
    payload = pwa.await_args.args[1]
    assert payload["title"] == "Judul" and payload["url"] == "https://x/y" and payload["tag"] == "kelas-mulai"
    assert pwa.await_args.kwargs["ttl"] == 600


@pytest.mark.asyncio
async def test_deliver_skips_pwa_when_category_disabled(monkeypatch):
    pwa = AsyncMock(return_value=1)
    monkeypatch.setattr("app.pwa_push_db.list_categories", AsyncMock(return_value=["berita-kampus"]))
    monkeypatch.setattr("app.pwa_webpush.dispatch_pwa_to_nim", pwa)
    assert await notifier.deliver("1", "kelas-mulai", "t", "b", "/x", channels=[]) == 0
    pwa.assert_not_awaited()


@pytest.mark.asyncio
async def test_collect_targets_merges_webhook_and_pwa(monkeypatch):
    async def fake_channels(category: str):
        return [{"nim": "111"}] if category == "kelas-mulai" else []

    async def fake_pwa(category: str):
        return ["222"] if category == "kelas-mulai" else ["111", "333"]

    monkeypatch.setattr("app.channels_db.list_active_by_category", fake_channels)
    monkeypatch.setattr("app.pwa_push_db.list_nims_with_category", fake_pwa)
    assert await notifier.collect_targets() == {
        "111": (True, True),
        "222": (True, False),
        "333": (False, True),
    }


@pytest.mark.asyncio
async def test_absen_reminder_flow_repeats_then_stops(monkeypatch):
    store: dict[str, str] = {}

    class FakeRedis:
        async def get(self, key):
            return store.get(key)

        async def set(self, key, value, ex=None, nx=False):
            store[key] = value
            return True

    async def fake_redis():
        return FakeRedis()

    class FakeMyBest:
        open_now = True

        async def fetch_page(self, path, nim, password):
            return "<sch/>" if path == "/sch" else "<absen/>"

    mybest = FakeMyBest()
    deliver = AsyncMock(return_value=1)
    monkeypatch.setattr(notifier, "_redis", fake_redis)
    monkeypatch.setattr(notifier, "deliver", deliver)
    monkeypatch.setattr("app.modules.elearning.pooled_elearning_client", mybest)
    monkeypatch.setattr("app.modules.elearning.parse_courses", lambda html: [{"kode": "207", "nama": "LOGIKA", "token_absen": "tok"}])
    monkeypatch.setattr("app.modules.elearning.inspect_session_status", lambda html: {"can_submit": mybest.open_now})

    clock = {"t": 1_000_000.0}
    monkeypatch.setattr(notifier.time, "time", lambda: clock["t"])

    during = at(8, 0)
    assert await notifier._send_absen_reminders("1", SCHEDULE, "pw", during) == 1
    assert deliver.await_args.args[2].startswith("Absen sudah dibuka")

    # 1 menit kemudian: belum waktunya cek lagi, tidak ada permintaan ke MyBest dan tidak ada notifikasi.
    clock["t"] += 60
    assert await notifier._send_absen_reminders("1", SCHEDULE, "pw", during) == 0

    # 10 menit kemudian, masih belum absen: pengingat kedua dengan nada "Belum absen".
    clock["t"] += 600
    assert await notifier._send_absen_reminders("1", SCHEDULE, "pw", during) == 1
    assert deliver.await_args.args[2].startswith("Belum absen")

    # Mahasiswa sudah absen (form hilang): berhenti dan tidak mengirim apa pun lagi.
    mybest.open_now = False
    clock["t"] += 600
    assert await notifier._send_absen_reminders("1", SCHEDULE, "pw", during) == 0
    clock["t"] += 600
    mybest.open_now = True
    assert await notifier._send_absen_reminders("1", SCHEDULE, "pw", during) == 0
    assert deliver.await_count == 2


@pytest.mark.asyncio
async def test_absen_does_not_touch_mybest_outside_class_hours(monkeypatch):
    fetch = AsyncMock()
    monkeypatch.setattr("app.modules.elearning.pooled_elearning_client.fetch_page", fetch)
    assert await notifier._send_absen_reminders("1", SCHEDULE, "pw", at(11, 0)) == 0
    fetch.assert_not_awaited()
