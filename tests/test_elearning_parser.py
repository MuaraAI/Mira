from pathlib import Path
import pytest
from app.modules.elearning import (
    solve_captcha,
    parse_courses,
    parse_assignments,
    parse_presence,
    parse_materials,
    parse_quiz,
    inspect_session_status,
    parse_quiz_questions,
)

FIXTURES = Path(__file__).parent / "fixtures"

def test_solve_captcha():
    # Legacy math captcha
    assert solve_captcha("Berapa hasil dari 4 + 3?") == 7
    assert solve_captcha("Berapa hasil dari 1 + 5?") == 6
    assert solve_captcha("12 + 15") == 27
    assert solve_captcha("Berapa hasil dari 10 + 0?") == 10

    # New SVG text captcha
    svg_sample = "<svg><text x='30'>4</text><text x='68'>E</text><text x='101'>7</text></svg>"
    assert solve_captcha(svg_sample) == "4E7"

def test_parse_courses():
    html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")
    courses = parse_courses(html)
    assert len(courses) == 6
    first = courses[0]
    assert first["kode"] != ""
    assert first["nama"] != ""
    assert isinstance(first["sks"], int)
    assert first["hari"] != ""
    assert first["jam"] != ""
    assert first["kelompok_praktek"] is None
    assert "jadwal" in first
    assert first["jadwal"]["hari"] == first["hari"]
    assert "tokens" in first
    assert first["tokens"]["absen"] == first["token_absen"]
    assert first["token_absen"] is not None
    assert first["token_assignment"] is not None
    assert first["token_learning"] is not None

def test_parse_assignments():
    html = (FIXTURES / "el_assignment_1.html").read_text(encoding="utf-8")
    data = parse_assignments(html)
    assert "tasks" in data
    assert "submissions" in data
    assert isinstance(data["tasks"], list)
    assert isinstance(data["submissions"], list)

    # Active tasks with download links and upload tokens
    html_act = (FIXTURES / "el_assignment_active.html").read_text(encoding="utf-8")
    data_act = parse_assignments(html_act)
    tasks = data_act["tasks"]
    assert len(tasks) == 2
    assert tasks[0]["kode"] == "894-DP"
    assert "Rekursif" in tasks[0]["judul"]
    assert "Fibonacci" in tasks[0]["deskripsi"]
    assert "storage/soal" in tasks[0]["file_soal_url"]
    assert "tokentugas5" in tasks[0]["token_tugas"]
    assert len(data_act["submissions"]) == 1
    assert data_act["submissions"][0]["nilai"] == 95.0

def test_parse_assignments_grades_rows():
    html = (FIXTURES / "el_assignment_grades.html").read_text(encoding="utf-8")
    data = parse_assignments(html)
    subs = data["submissions"]
    assert len(subs) == 3

    first = subs[0]
    assert first["kode"] == "121-PBO"
    assert first["judul"] == "Implementasi Class"
    assert first["pertemuan"] == "Pertemuan 3"
    assert first["nilai"] == 90.0
    assert first["link_tugas"].startswith("https://elearning.bsi.ac.id/")

    graded = [s for s in subs if s["nilai"] is not None]
    assert len(graded) == 3

def test_parse_presence():
    html = (FIXTURES / "el_absen_1.html").read_text(encoding="utf-8")
    presence = parse_presence(html)
    assert isinstance(presence, dict)
    assert presence["kode_mtk"] == "101"
    assert presence["matakuliah"] == "PENDIDIKANPANCASILA"
    assert presence["dosen"] == "BDM"
    assert presence["ruang"] == "EL2-P1"
    assert presence["status_sesi"] == "Sudah Selesai"
    assert isinstance(presence["riwayat"], list)

def test_parse_materials():
    html = (FIXTURES / "el_learning_1.html").read_text(encoding="utf-8")
    materials = parse_materials(html)
    assert isinstance(materials, list)
    assert len(materials) >= 1
    assert materials[0]["file_url"] != ""

def test_parse_quiz():
    html = (FIXTURES / "el_exercise.html").read_text(encoding="utf-8")
    quizzes = parse_quiz(html)
    assert isinstance(quizzes, list)
    assert len(quizzes) >= 1
    first = quizzes[0]
    assert first["paket"] == "LATIHAN"
    assert first["status_aksi"] == "Ujian Lewat"

def test_inspect_session_status():
    html_selesai = (FIXTURES / "el_absen_1.html").read_text(encoding="utf-8")
    status_selesai = inspect_session_status(html_selesai)
    assert status_selesai["status_raw"] == "Sudah Selesai"
    assert status_selesai["can_submit"] is False
    assert status_selesai["kode_mtk"] == "101"
    assert status_selesai["dosen"] == "BDM"
    assert status_selesai["ruang"] == "EL2-P1"

    html_active = (FIXTURES / "el_absen_active.html").read_text(encoding="utf-8")
    status_active = inspect_session_status(html_active)
    assert status_active["status_raw"] == "Absen Masuk"
    assert status_active["can_submit"] is True
    assert status_active["kode_mtk"] == "101"
    assert "simpan-absen" in (status_active["form_action"] or "")
    assert status_active["form_inputs"].get("token_kelas") == "test_token_absen_123"

def test_parse_quiz_questions():
    html_ujian = (FIXTURES / "el_halaman_ujian.html").read_text(encoding="utf-8")
    result = parse_quiz_questions(html_ujian)
    assert result["csrf_token"] == "mock_csrf_exam_token_456"
    assert result["waktu_akhir"] == "2026-10-25 12:00:00"
    assert result["total_soal"] == 3
    assert len(result["daftar_soal"]) == 3
    assert result["daftar_soal"][0]["id_soal"] == "501"

    current = result["current_soal"]
    assert current is not None
    assert "branch baru" in current["pertanyaan"]
    assert len(current["opsi"]) == 4
    assert current["opsi"][1]["key"] == "B"
    assert current["opsi"][1]["data_jawab"] == "501_B"
