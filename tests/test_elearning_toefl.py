"""TOEFL MyBest: tabel `copy-print-csv` di /toefl, kosong bila belum ada paket."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.elearning import parse_toefl

_HTML = """
<table id="copy-print-csv" class="table custom-table">
  <thead>
    <tr>
      <th><center>No</center></th>
      <th>Kode Mtk</th>
      <th>Kategori</th>
      <th>Materi</th>
      <th>Judul Materi</th>
      <th>Dosen</th>
      <th>Waktu</th>
      <th>Ujian Mulai</th>
      <th>Ujian Selesai</th>
      <th>Aksi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>TOE01</td>
      <td>Listening</td>
      <td>TOEFL Preparation</td>
      <td>Listening Comprehension</td>
      <td>NPR</td>
      <td>90 Menit</td>
      <td>02 Dec 2026 08:00 WIB</td>
      <td>02 Dec 2026 09:30 WIB</td>
      <td><a href="/cetak-ujian-pdf/tok123">Cetak Bukti</a></td>
    </tr>
    <tr>
      <td>2</td>
      <td>TOE01</td>
      <td>Structure</td>
      <td>TOEFL Preparation</td>
      <td>Structure and Written Expression</td>
      <td>NPR</td>
      <td>60 Menit</td>
      <td>09 Dec 2026 08:00 WIB</td>
      <td>09 Dec 2026 09:00 WIB</td>
      <td></td>
    </tr>
  </tbody>
</table>
"""


def test_parse_toefl_rows_and_link():
    rows = parse_toefl(_HTML)

    assert [row["no"] for row in rows] == [1, 2]
    first = rows[0]
    assert first["kode_mtk"] == "TOE01"
    assert first["kategori"] == "Listening"
    assert first["judul_materi"] == "Listening Comprehension"
    assert first["dosen"] == "NPR"
    assert first["ujian_mulai"] == "02 Dec 2026 08:00 WIB"
    assert first["aksi_url"] == "https://elearning.bsi.ac.id/cetak-ujian-pdf/tok123"
    assert rows[1]["aksi_url"] is None
    assert first["id"] != rows[1]["id"]


def test_parse_toefl_empty_table():
    empty = _HTML.replace(_HTML[_HTML.index("<tbody>") : _HTML.index("</tbody>") + 8], "<tbody></tbody>")
    assert parse_toefl(empty) == []


def test_parse_toefl_ignores_other_tables():
    html = """
    <table>
      <thead><tr><th>Kode</th><th>Mata Kuliah</th><th>Jadwal</th></tr></thead>
      <tbody><tr><td>894</td><td>Dasar Pemrograman</td><td>Sabtu 08:00</td></tr></tbody>
    </table>
    """
    assert parse_toefl(html) == []


@pytest.mark.asyncio
async def test_get_toefl_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "12345678")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), patch(
        "app.modules.elearning.pooled_elearning_client.fetch_page", return_value=_HTML
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/toefl")

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert len(body["data"]) == 2
    assert body["data"][0]["judul_materi"] == "Listening Comprehension"
