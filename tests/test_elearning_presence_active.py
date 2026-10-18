from pathlib import Path

from app.modules.elearning import inspect_session_status, parse_presence


FIXTURES = Path(__file__).parent / "fixtures"


def test_inspect_active_presence_exposes_submit_form_and_metadata():
    html = (FIXTURES / "el_absen_active.html").read_text(encoding="utf-8")
    status = inspect_session_status(html)
    assert status["can_submit"] is True
    assert status["matakuliah"] == "PENDIDIKAN PANCASILA"
    assert status["hari"] == "Jumat"
    assert status["form_action"].endswith("/simpan-absen")
    assert status["form_inputs"]["token_kelas"] == "test_token_absen_123"


def test_parse_active_presence_keeps_history_and_session_metadata():
    html = (FIXTURES / "el_absen_active.html").read_text(encoding="utf-8")
    presence = parse_presence(html)
    assert presence["status_sesi"] == "Absen Masuk"
    assert presence["matakuliah"] == "PENDIDIKAN PANCASILA"
    assert presence["total_kehadiran"] == 1
    assert presence["riwayat"][0]["status_absen"] == "Hadir"
