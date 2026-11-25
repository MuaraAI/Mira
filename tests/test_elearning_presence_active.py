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


def test_parse_presence_detects_mhs_absen_form_even_with_kirim_button():
    html = """
    <div class="info-tiles"><div class="stats-detail"><h5>ENTREPRENEURSHIP</h5><p>Matakuliah</p></div></div>
    <div class="col-xl-3">
      <form method="POST" action="/mhs-absen">
        <input type="hidden" name="_token" value="tok_dummy">
        <input type="hidden" name="id" value="99">
        <button type="submit" class="btn btn-primary">Kirim</button>
      </form>
    </div>
    """
    presence = parse_presence(html)
    assert presence["can_submit"] is True
    assert presence["status_sesi"] == "Absen Masuk"


@pytest.mark.asyncio
async def test_submit_presence_verified_when_mhs_absen_transitions_to_komentar_mhs():
    """Setelah POST /mhs-absen sukses, MyBest 2026 mengganti form absen dengan /komentar-mhs (200 via redirect)."""
    before_html = """
    <div class="info-tiles"><div class="stats-detail"><h5>ENTREPRENEURSHIP</h5><p>Matakuliah</p></div></div>
    <div class="info-tiles"><div class="stats-detail"><h5>SDF</h5><p>Dosen</p></div></div>
    <div class="info-tiles"><div class="stats-detail"><h5>303-P1</h5><p>Ruang</p></div></div>
    <form method="POST" action="/mhs-absen">
      <input type="hidden" name="_token" value="tok_dummy">
      <input type="hidden" name="kd_mtk" value="712">
      <button type="submit" class="btn btn-primary">Absen Masuk</button>
    </form>
    """
    after_html = (FIXTURES / "el_absen_pengganti_open.html").read_text(encoding="utf-8")
    post_resp = MagicMock(status_code=200, headers={}, text=after_html, url="https://elearning.bsi.ac.id/absen-mhs/tok123")
    invalidate_mock = AsyncMock()

    with (
        patch("app.modules.elearning.pooled_elearning_client.fetch_page", AsyncMock(return_value=before_html)),
        patch("app.modules.elearning.pooled_elearning_client.post_page", AsyncMock(return_value=post_resp)),
        patch("app.modules.elearning.invalidate_elearning_user_cache", invalidate_mock),
    ):
        result = await submit_presence("12345678", "password-dummy", "tok123")

    assert result["success"] is True
    assert result["status"] == "Hadir"
    invalidate_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_submit_presence_unverified_when_mhs_absen_remains_open_and_rekap_empty():
    """Bila form /mhs-absen tetap muncul dan /rekap-side tidak mencatat hari ini, tetap UNVERIFIED."""
    open_mhs_html = """
    <div class="info-tiles"><div class="stats-detail"><h5>ENTREPRENEURSHIP</h5><p>Matakuliah</p></div></div>
    <form method="POST" action="/mhs-absen">
      <input type="hidden" name="_token" value="tok_dummy">
      <button type="submit" class="btn btn-primary">Absen Masuk</button>
    </form>
    <script>var ajax = 'https://elearning.bsi.ac.id/rekap-side/REKAPTOK';</script>
    """
    post_resp = MagicMock(status_code=200, headers={}, text=open_mhs_html, url="https://elearning.bsi.ac.id/absen-mhs/tok123")
    fetch_mock = AsyncMock(side_effect=[open_mhs_html, '{"data": []}'])

    with (
        patch("app.modules.elearning.pooled_elearning_client.fetch_page", fetch_mock),
        patch("app.modules.elearning.pooled_elearning_client.post_page", AsyncMock(return_value=post_resp)),
        patch("app.modules.elearning.invalidate_elearning_user_cache", AsyncMock()),
    ):
        result = await submit_presence("12345678", "password-dummy", "tok123")

    assert result["success"] is False
    assert result["status"] == "UNVERIFIED"


@pytest.mark.asyncio
async def test_submit_presence_rejected_on_mybest_flash_jam_or_flash_error():
    before_html = """
    <div class="info-tiles"><div class="stats-detail"><h5>ENTREPRENEURSHIP</h5><p>Matakuliah</p></div></div>
    <form method="POST" action="/mhs-absen"><input type="hidden" name="_token" value="tok"></form>
    """
    for flash_html, expected_msg in [
        ('<div class="flash-jam" data-flashjam="Waktu absen belum dimulai"></div>', "Waktu absen belum dimulai"),
        ('<div class="flash-error" data-flasherror="Anda sudah melakukan absen"></div>', "Anda sudah melakukan absen"),
    ]:
        post_resp = MagicMock(
            status_code=200,
            headers={},
            text=f"<html><body>{flash_html}{before_html}</body></html>",
            url="https://elearning.bsi.ac.id/absen-mhs/tok123",
        )
        with (
            patch("app.modules.elearning.pooled_elearning_client.fetch_page", AsyncMock(return_value=before_html)),
            patch("app.modules.elearning.pooled_elearning_client.post_page", AsyncMock(return_value=post_resp)),
            patch("app.modules.elearning.invalidate_elearning_user_cache", AsyncMock()),
        ):
            result = await submit_presence("12345678", "password-dummy", "tok123")
        assert result["success"] is False
        assert result["status"] == "REJECTED"
        assert expected_msg in result["message"]


@pytest.mark.asyncio
async def test_submit_presence_verified_on_mybest_flash_tambah():
    open_html = (FIXTURES / "el_absen_pengganti_open.html").read_text(encoding="utf-8")
    after_html = f'<div class="flash-tambah" data-flashdata="Absen Masuk"></div>{open_html}'
    post_resp = MagicMock(status_code=200, headers={}, text=after_html, url="https://elearning.bsi.ac.id/absen-mhs/tok123")

    with (
        patch("app.modules.elearning.pooled_elearning_client.fetch_page", AsyncMock(return_value=open_html)),
        patch("app.modules.elearning.pooled_elearning_client.post_page", AsyncMock(return_value=post_resp)),
        patch("app.modules.elearning.invalidate_elearning_user_cache", AsyncMock()),
    ):
        result = await submit_presence("12345678", "password-dummy", "tok123")

    assert result["success"] is True
    assert result["status"] == "Hadir"


@pytest.mark.asyncio
async def test_submit_presence_verified_via_rekap_side_when_komentar_remains_open():
    import json
    from datetime import datetime, timedelta, timezone

    today_wib = datetime.now(timezone(timedelta(hours=7))).strftime("%Y-%m-%d")
    open_html = (FIXTURES / "el_absen_pengganti_open.html").read_text(encoding="utf-8")
    post_resp = MagicMock(status_code=200, headers={}, text=open_html, url="https://elearning.bsi.ac.id/absen-mhs/tok123")
    rekap_json = json.dumps({
        "data": [{
            "id": 1001,
            "status_hadir": '<a class="btn btn-primary">Hadir</a>',
            "tgl_ajar_masuk": today_wib,
            "nm_mtk": "DASAR PEMROGRAMAN",
            "pertemuan": "10",
        }]
    })
    fetch_mock = AsyncMock(side_effect=[open_html, rekap_json])

    with (
        patch("app.modules.elearning.pooled_elearning_client.fetch_page", fetch_mock),
        patch("app.modules.elearning.pooled_elearning_client.post_page", AsyncMock(return_value=post_resp)),
        patch("app.modules.elearning.invalidate_elearning_user_cache", AsyncMock()),
    ):
        result = await submit_presence("12345678", "password-dummy", "tok123")

    assert result["success"] is True
    assert result["status"] == "Hadir"
