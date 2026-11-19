"""Notifikasi: riwayat kuis lama tidak boleh dikirim, absen butuh bukti rekap.

Dua bug produksi yang dikunci di sini:
1. MyBest menyimpan riwayat kuis ("Cetak Bukti", "Ujian Lewat") selamanya di
   /exercise. Tanpa filter status, riwayat itu terkirim sebagai "Kuis Baru"
   setiap kali TTL claim habis.
2. Pengingat absen dulu tetap terkirim walau mahasiswa sudah presensi, karena
   kegagalan membaca rekap ditelan diam-diam lalu jatuh ke cek sesi kampus.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.modules.news import _news_digest_due, _quiz_is_actionable


@pytest.mark.parametrize(
    "status,deadline,expected",
    [
        ("Cetak Bukti", "25 Sep 2026 11:05 WIB", False),
        ("Ujian Lewat", "06 Nov 2026 11:10 WIB", False),
        ("Kerjakan", "31 Dec 2026 10:00 WIB", True),
        ("Mulai Ujian", "31 Dec 2026 10:00 WIB", True),
    ],
)
def test_only_actionable_quizzes_are_notified(status, deadline, expected):
    quiz = {"status_aksi": status, "ujian_mulai": "01 Dec 2026 10:00 WIB", "ujian_selesai": deadline}
    assert _quiz_is_actionable(quiz) is expected


def test_quiz_without_status_uses_deadline():
    expired = {"ujian_selesai": "01 Sep 2026 10:00 WIB"}
    upcoming = {"ujian_selesai": "31 Dec 2026 10:00 WIB"}
    assert _quiz_is_actionable(expired) is False
    assert _quiz_is_actionable(upcoming) is True


def test_news_digest_only_after_digest_hour():
    morning = datetime(2026, 11, 19, 8, 0, tzinfo=ZoneInfo("Asia/Jakarta"))
    evening = datetime(2026, 11, 19, 20, 0, tzinfo=ZoneInfo("Asia/Jakarta"))
    assert _news_digest_due(morning) is False
    assert _news_digest_due(evening) is True
