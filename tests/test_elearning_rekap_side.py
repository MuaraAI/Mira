import json
import pytest
from app.modules.elearning import parse_presence_rekap


def test_parse_presence_rekap_extracts_datatable_items():
    raw_response = {
        "draw": 0,
        "recordsTotal": 2,
        "recordsFiltered": 2,
        "data": [
            {
                "id": 10210,
                "kd_mtk": "101",
                "nm_mtk": "PENDIDIKAN PANCASILA",
                "tgl_ajar_masuk": "2026-09-25",
                "pertemuan": 1,
                "berita_acara": "1. Membahas RPS\n2. Materi 1",
                "rangkuman": "Pentingnya Pancasila",
                "kd_dosen": "BDM",
                "no_ruang": "EL2-P1",
                "status_hadir": '<a href="javascript:void(0)" class="btn btn-primary">Hadir</a>',
            },
            {
                "id": 10211,
                "kd_mtk": "101",
                "nm_mtk": "PENDIDIKAN PANCASILA",
                "tgl_ajar_masuk": "2026-10-02",
                "pertemuan": 2,
                "berita_acara": "Diskusi kelompok",
                "rangkuman": "Pancasila dalam sejarah",
                "kd_dosen": "BDM",
                "no_ruang": "EL2-P1",
                "status_hadir": "Hadir",
            },
        ],
    }

    records = parse_presence_rekap(json.dumps(raw_response))
    assert len(records) == 2
    assert records[0]["status_absen"] == "Hadir"
    assert records[0]["pertemuan"] == "1"
    assert records[0]["tanggal"] == "2026-09-25"
    assert records[0]["dosen"] == "BDM"
    assert records[1]["status_absen"] == "Hadir"
    assert records[1]["pertemuan"] == "2"
