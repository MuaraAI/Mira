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
