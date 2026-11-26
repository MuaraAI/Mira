from pathlib import Path
from app.modules.studentv2 import (
    parse_schedule,
    parse_grades,
    parse_news,
    parse_announcements,
    parse_profile,
    parse_khs,
    parse_krs,
    parse_uts,
)

FIXTURES = Path(__file__).parent / "fixtures"

def test_parse_schedule():
    html = (FIXTURES / "sv2_jadwal.html").read_text(encoding="utf-8")
    courses = parse_schedule(html)
    assert len(courses) == 6
    first = courses[0]
    assert first["kode"] != ""
    assert first["nama"] != ""
    assert first["hari"] != ""
    assert first["jam"] != ""
    assert isinstance(first["sks"], int)
    assert first["ruang"] != ""
    assert first["id"] != ""

def test_parse_grades():
    html = (FIXTURES / "sv2_nilai_murni.html").read_text(encoding="utf-8")
    grades = parse_grades(html)
    assert len(grades) == 6
    first = grades[0]
    assert first["kode"] != ""
    assert first["nama"] != ""
    assert isinstance(first["sks"], int)
    assert "total" in first
    assert "grade" in first
    assert first["id"] != ""

def test_parse_news():
    html = (FIXTURES / "sv2_berita.html").read_text(encoding="utf-8")
    news = parse_news(html)
    assert len(news) > 50
    first = news[0]
    assert first["title"] != ""
    assert first["pdf_url"].startswith("http")
    assert first["date"] != ""
    assert first["id"] != ""

def test_parse_announcements():
    html = (FIXTURES / "sv2_beranda.html").read_text(encoding="utf-8")
    items = parse_announcements(html)
    assert len(items) >= 1
    first = items[0]
    assert first["title"] != ""
    assert first["pdf_url"].startswith("http")
    assert first["id"] != ""

def test_parse_profile():
    html = (FIXTURES / "sv2_data_pribadi.html").read_text(encoding="utf-8")
    profile = parse_profile(html)
    assert profile["nim"] == "12345678"
    assert profile["nama"] == "MAHASISWA DUMMY"
    # Data pribadi tidak boleh ikut tersimpan: hanya data akademik.
    assert "tempat_lahir" not in profile
    assert "desa_kelurahan" not in profile
    assert "rt_rw" not in profile
    assert "alamat" not in profile
    assert "telepon" not in profile
    assert "agama" not in profile
    assert "Informatika" in profile["program_studi"]
    assert profile["semester_aktif"] == "1"
    assert profile["status_aktif"] == "Aktif"
    # Kode cabang SIAKAD diterjemahkan menjadi nama tampilan di sumber.
    assert profile["lokasi_cabang"] == "UBSI Pontianak"


def test_class_label_and_branch_display():
    from app.modules.studentv2 import branch_display, class_label

    # Kode dikenal -> nama; kode angka asing -> "UBSI Cabang <code>"; nama teks & building code -> ternormalisasi; kosong -> None.
    assert branch_display("30") == "UBSI Pontianak"
    assert branch_display("05") == "UBSI Bekasi"
    assert branch_display("04") == "UBSI Bekasi"
    assert branch_display("03") == "UBSI Tangerang"
    assert branch_display("07") == "UBSI Kramat 98"
    assert branch_display("01") == "UBSI Margonda"
    assert branch_display("02") == "UBSI Fatmawati"
    assert branch_display("27") == "UBSI BSD"
    assert branch_display("UBSI Cabang 27") == "UBSI BSD"
    assert branch_display("99") == "UBSI Cabang 99"
    assert branch_display("UBSI Pontianak") == "UBSI Pontianak"
    assert branch_display("Pontianak") == "UBSI Pontianak"
    assert branch_display("Bekasi") == "UBSI Bekasi"
    assert branch_display("Kaliabang") == "UBSI Bekasi"
    assert branch_display("Cut Mutia") == "UBSI Bekasi"
    assert branch_display("Solo") == "UBSI Surakarta"
    assert branch_display("Bogor A") == "UBSI Bogor"
    assert branch_display("Depok 1") == "UBSI Depok"
    assert branch_display("Tangerang A") == "UBSI Tangerang"
    assert branch_display("BSD, Tangerang") == "UBSI BSD"
    assert branch_display("Kramat, Jakarta") == "UBSI Kramat 98"
    assert branch_display("Dewisartika A") == "UBSI Dewi Sartika"
    assert branch_display("Sukabumi (Veteran)") == "UBSI Sukabumi"
    assert branch_display("N1") == "UBSI BSD"
    assert branch_display("P1") == "UBSI Pontianak"
    assert branch_display("B2") == "UBSI Kramat 98"
    assert branch_display("Kampus Kota Pontianak") == "UBSI Pontianak"
    assert branch_display("Margonda") == "UBSI Margonda"
    assert branch_display("") is None
    assert branch_display(None) is None

    # Prioritas label kelas: kelompok ujian KRS > kelas.lokal > kelas saja.
    assert class_label(krs={"kelompok_ujian": "15.1A.01.A"}) == "15.1A.01.A"
    assert class_label(profile={"kelas": "1A", "lokal": "01"}) == "1A.01"
    assert class_label(profile={"kelas": "1A"}) == "1A"
    assert class_label() is None


def test_ubsi_official_catalog_structure():
    from app.ubsi_catalog import UBSI_CAMPUSES, UBSI_PROGRAMS

    assert len(UBSI_CAMPUSES) == 28
    campus_names = {c["name"] for c in UBSI_CAMPUSES}
    assert {"UBSI Kramat 98", "UBSI BSD", "UBSI Pontianak", "UBSI Kaliabang"}.issubset(campus_names)
    prodi_by_code = {p["code"]: p["name"] for p in UBSI_PROGRAMS if p["code"]}
    assert prodi_by_code["15"] == "Informatika"
    assert prodi_by_code["19"] == "Sistem Informasi"
    assert prodi_by_code["44"] == "Ilmu Komunikasi"

def test_parse_khs():
    html = (FIXTURES / "sv2_khs.html").read_text(encoding="utf-8")
    khs = parse_khs(html)
    assert "items" in khs
    assert "ipk" in khs
    assert "total_sks" in khs
    assert "total_mutu" in khs
    assert khs["ipk"] == 0.0

    # Test populated KHS
    import re
    html_populated = re.sub(
        r"0\s*<br>\s*0\s*<br>\s*0\.00",
        "72.0 <br>\n 18 <br>\n 3.85",
        html
    )
    khs_pop = parse_khs(html_populated)
    assert khs_pop["total_mutu"] == 72.0
    assert khs_pop["total_sks"] == 18
    assert khs_pop["ipk"] == 3.85

def test_parse_krs():
    html = (FIXTURES / "sv2_krs.html").read_text(encoding="utf-8")
    krs = parse_krs(html)
    assert len(krs["items"]) == 6
    assert krs["total_sks"] == 18
    assert krs["semester"] == 1
    assert krs["kelompok_ujian"] == "15.1A.01.A"
    assert krs["can_print"] is True
    assert krs["cetak_url"] == "/v1/studentv2/krs/print"
    assert krs["items"][0]["kode"] == "101"

def test_parse_uts():
    html = (FIXTURES / "sv2_uts.html").read_text(encoding="utf-8")
    uts = parse_uts(html)
    assert uts["jadwal_online_url"] is not None
    assert "uts-jadwal" in uts["jadwal_online_url"]
    assert uts["soal_offline_url"] is not None
    assert "drive.google.com" in uts["soal_offline_url"]

def test_parse_grades_meta_gate_and_items():
    from app.modules.studentv2 import parse_grades_meta

    # Halaman gerbang rilis: shell + SweetAlert, tanpa tabel
    gated = """
    <html><body><div class="side-menu">menu</div>
    <script>Swal.fire({ icon: 'error', title: 'Oops...', text: 'Nilai Murni dapat dilihat pada tanggal 07 September 2026, Pukul 17:00 WIB', });</script>
    </body></html>
    """
    meta = parse_grades_meta(gated)
    assert meta["items"] == []
    assert "dapat dilihat" in meta["gate"]

    # Halaman normal (fixture tabel) -> tanpa gate, items terisi
    normal = (FIXTURES / "sv2_nilai_murni.html").read_text(encoding="utf-8")
    meta2 = parse_grades_meta(normal)
    assert meta2["gate"] is None
    assert len(meta2["items"]) >= 1
