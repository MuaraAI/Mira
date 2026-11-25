from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.elearning import inspect_session_status, parse_presence, submit_presence


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


def test_inspect_prefers_dedicated_absen_form_over_komentar_mhs():
    html = """
    <div class="info-tiles"><div class="stats-detail"><h5>ALGORITMA</h5><p>Matakuliah</p></div></div>
    <form method="POST" action="/komentar-mhs"><input type="hidden" name="_token" value="tok1"></form>
    <form method="POST" action="/simpan-absen"><input type="hidden" name="_token" value="tok2"><input type="hidden" name="id" value="42"></form>
    """
    status = inspect_session_status(html)
    assert status["can_submit"] is True
    assert status["form_action"] == "/simpan-absen"
    assert status["form_inputs"]["id"] == "42"


@pytest.mark.asyncio
async def test_submit_presence_302_unverified_when_form_remains_open():
    open_html = (FIXTURES / "el_absen_pengganti_open.html").read_text(encoding="utf-8")
    post_resp = MagicMock(status_code=302, headers={"location": "/absen-mhs/tok123"}, text="", url="https://elearning.bsi.ac.id/komentar-mhs")

    fetch_mock = AsyncMock(side_effect=[open_html, open_html])
    post_mock = AsyncMock(return_value=post_resp)

    with (
        patch("app.modules.elearning.pooled_elearning_client.fetch_page", fetch_mock),
        patch("app.modules.elearning.pooled_elearning_client.post_page", post_mock),
        patch("app.modules.elearning.invalidate_elearning_user_cache", AsyncMock()),
    ):
        result = await submit_presence("12345678", "password-dummy", "tok123")

    assert result["success"] is False
    assert result["status"] == "UNVERIFIED"
    sent_payload = post_mock.await_args.kwargs["data"]
    assert sent_payload["nilai"] == "1"
    assert sent_payload["komentar"] == "Pengajaran sesuai."


@pytest.mark.asyncio
async def test_submit_presence_302_rejected_when_upstream_returns_alert_danger():
    open_html = (FIXTURES / "el_absen_pengganti_open.html").read_text(encoding="utf-8")
    err_html = '<html><body><div class="alert alert-danger">Waktu presensi sudah berakhir.</div></body></html>'
    post_resp = MagicMock(status_code=302, headers={"location": "/absen-mhs/tok123"}, text="", url="https://elearning.bsi.ac.id/komentar-mhs")

    with (
        patch("app.modules.elearning.pooled_elearning_client.fetch_page", AsyncMock(side_effect=[open_html, err_html])),
        patch("app.modules.elearning.pooled_elearning_client.post_page", AsyncMock(return_value=post_resp)),
        patch("app.modules.elearning.invalidate_elearning_user_cache", AsyncMock()),
    ):
        result = await submit_presence("12345678", "password-dummy", "tok123")

    assert result["success"] is False
    assert result["status"] == "REJECTED"
    assert "Waktu presensi sudah berakhir" in result["message"]


@pytest.mark.asyncio
async def test_submit_presence_302_verified_when_form_closes():
    open_html = (FIXTURES / "el_absen_pengganti_open.html").read_text(encoding="utf-8")
    closed_html = (FIXTURES / "el_absen_1.html").read_text(encoding="utf-8")
    post_resp = MagicMock(status_code=302, headers={"location": "/absen-mhs/tok123"}, text="", url="https://elearning.bsi.ac.id/komentar-mhs")

    with (
        patch("app.modules.elearning.pooled_elearning_client.fetch_page", AsyncMock(side_effect=[open_html, closed_html])),
        patch("app.modules.elearning.pooled_elearning_client.post_page", AsyncMock(return_value=post_resp)),
        patch("app.modules.elearning.invalidate_elearning_user_cache", AsyncMock()),
    ):
        result = await submit_presence("12345678", "password-dummy", "tok123")

    assert result["success"] is True
    assert result["status"] == "Hadir"
