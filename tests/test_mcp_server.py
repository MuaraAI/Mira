import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.mcp_server import (
    server,
    _build_headers,
    ubsi_whoami,
    ubsi_get_schedule,
    ubsi_get_grades,
    ubsi_get_profile,
    ubsi_get_khs,
    ubsi_get_krs,
    ubsi_get_uts,
    ubsi_get_courses,
    ubsi_get_presence,
    ubsi_submit_presence,
    ubsi_get_quiz,
    ubsi_get_quiz_questions,
    ubsi_submit_quiz_answer,
)

@pytest.mark.asyncio
async def test_mcp_tool_listing():
    tools = await server.list_tools()
    tool_names = {t.name for t in tools}
    assert "ubsi_whoami" in tool_names
    assert "ubsi_get_schedule" in tool_names
    assert "ubsi_get_grades" in tool_names
    assert "ubsi_get_profile" in tool_names
    assert "ubsi_get_khs" in tool_names
    assert "ubsi_get_krs" in tool_names
    assert "ubsi_get_uts" in tool_names
    assert "ubsi_get_courses" in tool_names
    assert "ubsi_get_presence" in tool_names
    assert "ubsi_submit_presence" in tool_names
    assert "ubsi_get_quiz" in tool_names
    assert "ubsi_get_quiz_questions" in tool_names
    assert "ubsi_submit_quiz_answer" in tool_names
    assert "ubsi_list_channels" in tool_names
    assert "ubsi_trigger_reminder" in tool_names
    assert "ubsi_get_course_grades" in tool_names
    assert "ubsi_upload_assignment" in tool_names
    assert "ubsi_submit_assignment" in tool_names
    assert "ubsi_get_discussions" in tool_names
    assert "ubsi_get_discussion_comments" in tool_names
    assert "ubsi_submit_discussion_comment" in tool_names
    assert "ubsi_create_discussion" in tool_names
    assert "ubsi_get_elearning_profile" in tool_names
    assert "ubsi_get_makeup_classes" in tool_names
    assert "ubsi_get_elearning_guides" in tool_names
    assert "ubsi_get_uas" in tool_names
    assert "ubsi_get_academic_calendar" in tool_names
    assert "ubsi_get_prodi_contacts" in tool_names
    assert "ubsi_get_certificates" in tool_names
    assert "ubsi_get_lecturers" in tool_names
    assert len(tool_names) == 37

def test_mcp_credential_headers_isolation():
    # 1. Session token isolation
    h_sess = _build_headers(session_token="my_custom_session_token_123")
    assert h_sess["Authorization"] == "Bearer my_custom_session_token_123"
    assert "ubsi_session=my_custom_session_token_123" in h_sess["Cookie"]

    # 2. Personal API Key (muara_ubsi_...)
    h_personal = _build_headers(api_key="muara_ubsi_abcdef1234567890")
    assert h_personal["Authorization"] == "Bearer muara_ubsi_abcdef1234567890"
    assert h_personal["X-API-Key"] == "muara_ubsi_abcdef1234567890"

    # 3. Master Key / API Key
    h_master = _build_headers(api_key="master_secret_key_456")
    assert h_master["X-API-Key"] == "master_secret_key_456"
    assert h_master["Authorization"] == "Bearer master_secret_key_456"

    # 4. Unexpanded template literals should be stripped to empty
    h_literal = _build_headers(api_key="${UBSI_API_KEY}", session_token="${UBSI_SESSION_TOKEN}")
    assert "Authorization" not in h_literal
    assert "X-API-Key" not in h_literal
    assert "Cookie" not in h_literal

@pytest.mark.asyncio
async def test_mcp_read_tools():
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = MagicMock(return_value={
        "success": True,
        "data": [{"kode": "101", "nama": "PENDIDIKAN PANCASILA"}],
    })

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await ubsi_get_schedule(session_token="test_tok")
        data = json.loads(res)
        assert data["success"] is True
        assert data["data"][0]["kode"] == "101"

@pytest.mark.asyncio
async def test_mcp_presence_and_quiz_write_tools():
    mock_resp_presence = AsyncMock()
    mock_resp_presence.status_code = 200
    mock_resp_presence.json = MagicMock(return_value={
        "success": True,
        "data": {
            "success": True,
            "status": "Hadir",
            "message": "Presensi berhasil dicatat.",
        },
    })

    mock_resp_quiz = AsyncMock()
    mock_resp_quiz.status_code = 200
    mock_resp_quiz.json = MagicMock(return_value={
        "success": True,
        "data": {
            "success": True,
            "id_soal": "501",
            "data_jawab": "501_B",
            "message": "Jawaban berhasil dikirim.",
        },
    })

    with patch("httpx.AsyncClient.post", return_value=mock_resp_presence):
        res_p = await ubsi_submit_presence(token="tok_class_123", session_token="tok_sess")
        parsed_p = json.loads(res_p)
        assert parsed_p["success"] is True
        assert parsed_p["data"]["status"] == "Hadir"

    with patch("httpx.AsyncClient.post", return_value=mock_resp_quiz):
        res_q = await ubsi_submit_quiz_answer(
            id_soal="501", data_jawab="501_B", session_token="tok_sess"
        )
        parsed_q = json.loads(res_q)
        assert parsed_q["success"] is True
        assert parsed_q["data"]["id_soal"] == "501"

    # Test assignment upload tool
    mock_resp_upload = AsyncMock()
    mock_resp_upload.status_code = 200
    mock_resp_upload.json = MagicMock(return_value={
        "success": True,
        "data": {
            "success": True,
            "filename": "tugas_15260767.pdf",
            "message": "Berkas berhasil diunggah.",
        },
    })
    from app.mcp_server import ubsi_upload_assignment, ubsi_get_course_grades
    with patch("httpx.AsyncClient.post", return_value=mock_resp_upload):
        res_up = await ubsi_upload_assignment(
            token_tugas="tok_tugas_123",
            filename="tugas_15260767.pdf",
            file_base64="ZHVtbXk=",
            session_token="tok_sess",
        )
        parsed_up = json.loads(res_up)
        assert parsed_up["success"] is True
        assert parsed_up["data"]["filename"] == "tugas_15260767.pdf"

    # Test course grades tool
    mock_resp_cgrades = AsyncMock()
    mock_resp_cgrades.status_code = 200
    mock_resp_cgrades.json = MagicMock(return_value={
        "success": True,
        "data": {
            "total_tugas": 3,
            "rata_nilai": 88.5,
            "per_pertemuan": [],
        },
    })
    with patch("httpx.AsyncClient.get", return_value=mock_resp_cgrades):
        res_cg = await ubsi_get_course_grades(course_id="894", session_token="tok_sess")
        parsed_cg = json.loads(res_cg)
        assert parsed_cg["success"] is True
        assert parsed_cg["data"]["rata_nilai"] == 88.5

    # Test submit assignment link tool
    mock_resp_submit = AsyncMock()
    mock_resp_submit.status_code = 200
    mock_resp_submit.json = MagicMock(return_value={
        "success": True,
        "data": {
            "status": "success",
            "message": "Tugas berhasil dikumpulkan ke MyBest",
            "link_tugas": "https://drive.google.com/file/d/123",
        },
    })
    from app.mcp_server import ubsi_submit_assignment
    with patch("httpx.AsyncClient.post", return_value=mock_resp_submit):
        res_sub = await ubsi_submit_assignment(
            token_send="tok_send_123",
            link_tugas="https://drive.google.com/file/d/123",
            session_token="tok_sess",
        )
        parsed_sub = json.loads(res_sub)
        assert parsed_sub["success"] is True
        assert "Tugas berhasil" in parsed_sub["data"]["message"]

    # Test discussions tools
    mock_resp_disc = AsyncMock()
    mock_resp_disc.status_code = 200
    mock_resp_disc.json = MagicMock(return_value={
        "success": True,
        "data": {
            "threads": [
                {
                    "id_chat": "24776",
                    "judul": "TASK 4",
                    "isi": "Make two sentences",
                    "penulis": "Tarina Dashela",
                    "total_komentar": 65,
                }
            ]
        },
    })
    from app.mcp_server import ubsi_get_discussions, ubsi_get_discussion_comments, ubsi_submit_discussion_comment
    with patch("httpx.AsyncClient.get", return_value=mock_resp_disc):
        res_d = await ubsi_get_discussions(token="tok_disc_123", session_token="tok_sess")
        parsed_d = json.loads(res_d)
        assert parsed_d["success"] is True
        assert parsed_d["data"]["threads"][0]["judul"] == "TASK 4"

    mock_resp_comm = AsyncMock()
    mock_resp_comm.status_code = 200
    mock_resp_comm.json = MagicMock(return_value={
        "success": True,
        "data": [
            {
                "nim": "15260767",
                "nama": "YUKEN VELINO",
                "komentar": "Invitation text here",
                "tanggal": "2026-10-13 09:32:46",
                "is_self": True,
            }
        ],
    })
    with patch("httpx.AsyncClient.get", return_value=mock_resp_comm):
        res_c = await ubsi_get_discussion_comments(token="tok_kom_123", session_token="tok_sess")
        parsed_c = json.loads(res_c)
        assert parsed_c["success"] is True
        assert parsed_c["data"][0]["nama"] == "YUKEN VELINO"

    mock_resp_post_comm = AsyncMock()
    mock_resp_post_comm.status_code = 200
    mock_resp_post_comm.json = MagicMock(return_value={
        "success": True,
        "data": {"status": "success", "message": "Komentar berhasil dikirim"},
    })
    with patch("httpx.AsyncClient.post", return_value=mock_resp_post_comm):
        res_pc = await ubsi_submit_discussion_comment(
            token_komentar="tok_kom_123",
            id_chat="24776",
            komentar="Jawaban diskusi saya",
            session_token="tok_sess",
        )
        parsed_pc = json.loads(res_pc)
        assert parsed_pc["success"] is True
        assert "Komentar berhasil" in parsed_pc["data"]["message"]

    mock_resp_create_disc = AsyncMock()
    mock_resp_create_disc.status_code = 200
    mock_resp_create_disc.json = MagicMock(return_value={
        "success": True,
        "data": {"status": "success", "message": "Topik diskusi berhasil dibuat"},
    })
    from app.mcp_server import ubsi_create_discussion
    with patch("httpx.AsyncClient.post", return_value=mock_resp_create_disc):
        res_cd = await ubsi_create_discussion(
            token_course="tok_course_123",
            judul="Topik Baru",
            chat="Isi topik baru",
            session_token="tok_sess",
        )
        parsed_cd = json.loads(res_cd)
        assert parsed_cd["success"] is True
        assert "Topik diskusi berhasil" in parsed_cd["data"]["message"]

    # Test elearning profile tool
    mock_resp_prof = AsyncMock()
    mock_resp_prof.status_code = 200
    mock_resp_prof.json = MagicMock(return_value={
        "success": True,
        "data": {"nama": "YUKEN VELINO", "email": "yuken@test.com"},
    })
    from app.mcp_server import ubsi_get_elearning_profile, ubsi_get_makeup_classes, ubsi_get_elearning_guides
    with patch("httpx.AsyncClient.get", return_value=mock_resp_prof):
        res_prof = await ubsi_get_elearning_profile(session_token="tok_sess")
        parsed_prof = json.loads(res_prof)
        assert parsed_prof["success"] is True
        assert parsed_prof["data"]["nama"] == "YUKEN VELINO"

    # Test makeup classes tool
    mock_resp_mu = AsyncMock()
    mock_resp_mu.status_code = 200
    mock_resp_mu.json = MagicMock(return_value={"success": True, "data": []})
    with patch("httpx.AsyncClient.get", return_value=mock_resp_mu):
        res_mu = await ubsi_get_makeup_classes(session_token="tok_sess")
        parsed_mu = json.loads(res_mu)
        assert parsed_mu["success"] is True
        assert isinstance(parsed_mu["data"], list)

    # Test elearning guides tool
    mock_resp_gd = AsyncMock()
    mock_resp_gd.status_code = 200
    mock_resp_gd.json = MagicMock(return_value={
        "success": True,
        "data": [{"judul": "Panduan MyBest", "format": "PDF"}],
    })
    with patch("httpx.AsyncClient.get", return_value=mock_resp_gd):
        res_gd = await ubsi_get_elearning_guides(session_token="tok_sess")
        parsed_gd = json.loads(res_gd)
        assert parsed_gd["success"] is True
        assert len(parsed_gd["data"]) == 1

    # Test SIAKAD additions: calendar, UAS, prodi-contacts, certificates, lecturers
    from app.mcp_server import (
        ubsi_get_uas,
        ubsi_get_academic_calendar,
        ubsi_get_prodi_contacts,
        ubsi_get_certificates,
        ubsi_get_lecturers,
    )
    mock_resp_siakad = AsyncMock()
    mock_resp_siakad.status_code = 200
    mock_resp_siakad.json = MagicMock(return_value={
        "success": True,
        "data": {"title": "Kalender Akademik", "pdf_url": "https://test.pdf"},
    })
    with patch("httpx.AsyncClient.get", return_value=mock_resp_siakad):
        res_cal = await ubsi_get_academic_calendar(session_token="tok_sess")
        assert json.loads(res_cal)["success"] is True

        res_uas = await ubsi_get_uas(session_token="tok_sess")
        assert json.loads(res_uas)["success"] is True

        res_pc = await ubsi_get_prodi_contacts(session_token="tok_sess")
        assert json.loads(res_pc)["success"] is True

        res_cert = await ubsi_get_certificates(session_token="tok_sess")
        assert json.loads(res_cert)["success"] is True

        res_lec = await ubsi_get_lecturers(search="AAA", session_token="tok_sess")
        assert json.loads(res_lec)["success"] is True

