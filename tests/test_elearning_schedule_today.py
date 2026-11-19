"""Jadwal MyBest: kartu "Jadwal Kuliah Hari Ini" tidak memuat nama hari.

MyBest memisah `/sch` menjadi dua seksi. Kartu di seksi hari ini hanya memuat
jam, bukan nama hari, sehingga parser lama menghasilkan `hari: ""`. Dashboard
menyaring jadwal "hari ini" berdasarkan field itu, jadi kelas hari ini hilang
dan sesi absen tidak pernah muncul.
"""
from pathlib import Path

from app.modules.elearning import parse_courses

FIXTURES = Path(__file__).parent / "fixtures"


def test_today_card_takes_day_from_section_title():
    courses = parse_courses((FIXTURES / "el_sch_today_section.html").read_text(encoding="utf-8"))

    today = [c for c in courses if c["nama"].startswith("DASAR PEMROGRAMAN")]
    assert today, "kartu hari ini harus terbaca"
    assert today[0]["hari"] == "Kamis", "hari diambil dari judul seksi, bukan dibiarkan kosong"
    assert today[0]["jam"] == "07:30-10:50"
    assert today[0]["token_absen"], "sesi absen hari ini harus ikut terbaca"


def test_other_day_cards_keep_their_own_day():
    courses = parse_courses((FIXTURES / "el_sch_today_section.html").read_text(encoding="utf-8"))

    by_name = {c["nama"].split()[0]: c["hari"] for c in courses}
    assert by_name["BAHASA"] == "Selasa"
    assert by_name["LOGIKA"] == "Rabu"
    assert by_name["PENDIDIKAN"] == "Jumat"


def test_html_comment_does_not_leak_as_day():
    """Komentar HTML memuat frasa serupa; judul seksi harus dibaca dari elemen."""
    courses = parse_courses((FIXTURES / "el_sch_today_section.html").read_text(encoding="utf-8"))
    assert all(c["hari"] != "ATAS" for c in courses)
