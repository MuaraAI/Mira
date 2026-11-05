from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.elearning import _parse_date_any, parse_makeup_classes


CARD_HTML = """
<div class="jadwal-card">
  <div class="jadwal-header">Kuliah Pengganti</div>
  <div class="jadwal-title">LOGIKA DAN ALGORITMA</div>
  <span class="jadwal-kelas-pill">Kelas : 15.1B.30</span>
  <div class="jadwal-info-row"><span class="jadwal-info-label">Kode MTK :</span><span class="jadwal-info-val">0896</span></div>
  <div class="jadwal-info-row"><span class="jadwal-info-label">Tanggal Pengganti :</span><span class="jadwal-info-val">Kamis, 05 November 2026</span></div>
  <div class="jadwal-info-row"><span class="jadwal-info-label">Jam :</span><span class="jadwal-info-val">19:00 - 20:40</span></div>
  <div class="jadwal-info-row"><span class="jadwal-info-label">Ruang :</span><span class="jadwal-info-val">EN2-P1</span></div>
  <div class="jadwal-info-row"><span class="jadwal-info-label">Dosen :</span><span class="jadwal-info-val">ABC</span></div>
  <a href="https://elearning.bsi.ac.id/absen-mhs/eyJpdiI6IkpengGanti==">Masuk Kelas</a>
</div>
"""

TABLE_HTML = """
<table>
  <thead><tr><th>No</th><th>Kode MTK</th><th>Mata Kuliah</th><th>Tanggal</th><th>Jam Masuk</th><th>Jam Keluar</th><th>Ruang</th><th>Keterangan</th><th>Aksi</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>0712</td><td>ENTREPRENEURSHIP</td><td>2026-11-07</td><td>08:00</td><td>09:40</td><td>302</td><td>Dosen dinas</td>
        <td><a href="/absen-pengganti/eyJtoken123">Absen</a></td></tr>
  </tbody>
</table>
"""


def test_parse_date_any_formats():
    assert _parse_date_any("2026-11-05") == "2026-11-05"
    assert _parse_date_any("05/11/2026") == "2026-11-05"
    assert _parse_date_any("Kamis, 5 Nopember 2026") == "2026-11-05"
    assert _parse_date_any("Jumat 06 Nov 2026 13:20") == "2026-11-06"
    assert _parse_date_any("Senin") is None


def test_parse_makeup_card_layout():
    rows = parse_makeup_classes(CARD_HTML)
    assert len(rows) == 1
    r = rows[0]
    assert r["kode"] == "0896"
    assert r["mata_kuliah"] == "LOGIKA DAN ALGORITMA"
    assert r["tanggal"] == "2026-11-05"
    assert r["hari"] == "Kamis"
    assert r["jam"] == "19:00-20:40"
    assert r["ruang"] == "EN2-P1"
    assert r["dosen"] == "ABC"
    assert r["absen_path"] == "absen-mhs"
    assert r["token_absen"].startswith("eyJ")


def test_parse_makeup_table_with_headers_and_absen_link():
    rows = parse_makeup_classes(TABLE_HTML)
    assert len(rows) == 1
    r = rows[0]
    assert r["kode"] == "0712"
    assert r["mata_kuliah"] == "ENTREPRENEURSHIP"
    assert r["tanggal"] == "2026-11-07"
    assert r["hari"] == "Sabtu"
    assert r["jam"] == "08:00-09:40"
    assert r["ruang"] == "302"
    assert r["keterangan"] == "Dosen dinas"
    assert r["absen_path"] == "absen-pengganti"
    assert r["token_absen"] == "eyJtoken123"


FIXTURES = __import__("pathlib").Path(__file__).parent / "fixtures"


def test_parse_makeup_live_kp_card():
    """Layout asli MyBest /kuliah-pengganti (div.kp-card)."""
    rows = parse_makeup_classes((FIXTURES / "el_kuliah_pengganti.html").read_text(encoding="utf-8"))
    assert len(rows) == 1
    r = rows[0]
    assert r["mata_kuliah"] == "DASAR PEMROGRAMAN"
    assert r["kode"] == "894"
    assert r["kelas"] == "DPG.15.1B.30.A"
    assert r["jenis"] == "Kelas Praktek"
    assert r["tanggal"] == "2026-11-05"
    assert r["tanggal_asal"] == "2026-10-27"
    assert r["hari"] == "Kamis"
    assert r["jam"] == "07:30-10:50"
    assert r["ruang"] == "307-P1"
    assert r["dosen"] == "MDK"
    assert r["sks"] == 4
    assert r["kelompok_praktek"] == "DPG.15.1B.30.A"
    assert r["keterangan"] == "Panitia Pemuda digital di harris"
    assert r["absen_path"] == "absen-mhs-pengganti"
    assert r["token_absen"] == "eyJpdiI6IlBFTkdHQU5USSJ9"
    assert r["token_learning"] == "eyJpdiI6Ik1BVEVSSSJ9"


def test_absen_pengganti_open_detected():
    """Absen dibuka = ada form /komentar-mhs, tombolnya cuma "Kirim" (bukan "Absen Masuk")."""
    from app.modules.elearning import inspect_session_status, parse_presence

    html = (FIXTURES / "el_absen_pengganti_open.html").read_text(encoding="utf-8")
    p = parse_presence(html)
    assert p["can_submit"] is True
    assert p["status_sesi"] == "Absen Masuk"
    assert p["matakuliah"] == "DASAR PEMROGRAMAN"
    s = inspect_session_status(html)
    assert s["can_submit"] is True
    assert s["form_action"] == "/komentar-mhs"
    assert s["status_raw"] == "Absen Masuk"


def test_closed_session_ignores_modal_kirim_button():
    from app.modules.elearning import parse_presence

    html = """
    <div class="col-xl-3"><button class="btn btn-danger btn-rounded">Belum Mulai</button></div>
    <div class="modal"><form action="/store/kuisoner-mpd"><button class="btn btn-info">Kirim</button></form></div>
    """
    p = parse_presence(html)
    assert p["status_sesi"] == "Belum Mulai"
    assert p["can_submit"] is False


def test_parse_makeup_empty_page():
    assert parse_makeup_classes("<div>Tidak ada kuliah pengganti</div>") == []


@pytest.mark.asyncio
async def test_presence_uses_makeup_absen_path(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "12345678")
    monkeypatch.setenv("ELEARNING_PASS", "secret")
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1
    fetch = AsyncMock(return_value="<html><table></table></html>")

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", fetch):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/presence", params={"token": "eyJabc", "path": "absen-pengganti"})
            bad = await ac.get("/v1/elearning/presence", params={"token": "eyJabc", "path": "../logout"})

    assert res.status_code == 200
    assert fetch.await_args_list[0].args[0] == "/absen-pengganti/eyJabc"
    assert bad.status_code == 422
