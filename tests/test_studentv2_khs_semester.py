"""`/v1/studentv2/khs-semester`: KHS per semester + IPS + daftar semester."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.studentv2 import parse_khs_semester

_HTML = """
<div class="card-body">
  <form action="https://students.bsi.ac.id/mahasiswa/khs-semester" method="GET">
    <select class="form-select" name="semester" id="semester" required>
      <option value="" disabled>Pilih Semester</option>
      <option value="1" selected>Semester 1</option>
      <option value="2">Semester 2</option>
    </select>
  </form>
</div>
<table>
  <tr><th>No</th><th>Kode</th><th>Mata Kuliah</th><th>SKS</th><th>Nilai</th><th>Mutu</th><th>Ket</th></tr>
  <tr>
    <td>1</td><td>104</td><td>BAHASA INGGRIS I</td><td>2</td><td>A</td><td>8.0</td><td></td>
  </tr>
  <tr class="text-danger">
    <td colspan="2">BOBOT NILAI</td>
    <td>TOTAL MUTU<br>TOTAL SKS YANG TELAH DIAMBIL<br>INDEKS PRESTASI SEMESTER (IPS)</td>
    <td>8.0<br>2<br>4.00</td>
  </tr>
</table>
"""


def test_parse_khs_semester_reads_ips_and_options():
    data = parse_khs_semester(_HTML)

    assert data["semester"] == 1
    assert [s["semester"] for s in data["semesters"]] == [1, 2]
    assert data["semesters"][0]["selected"] is True
    assert data["items"][0]["kode"] == "104"
    assert data["items"][0]["nilai"] == "A"
    assert data["total_mutu"] == 8.0
    assert data["total_sks"] == 2
    assert data["ips"] == 4.0


def test_parse_khs_semester_empty_page():
    data = parse_khs_semester("<html><body><p>Tidak ada data</p></body></html>")
    assert data["items"] == []
    assert data["semesters"] == []
    assert data["semester"] is None
    assert data["ips"] is None


@pytest.mark.asyncio
async def test_endpoint_passes_semester_query(monkeypatch):
    fetched = {}

    async def fake_fetch(path, nim, password):
        fetched["path"] = path
        return _HTML

    monkeypatch.setattr("app.modules.studentv2.studentv2_client.fetch_page", fake_fetch)
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.set = AsyncMock()

    with patch("app.cache.cache.get_client", AsyncMock(return_value=mock_redis)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/studentv2/khs-semester?semester=2")

    assert res.status_code == 200
    assert "semester=2" in fetched["path"]
