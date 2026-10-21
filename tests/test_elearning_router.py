import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.cache import cache
from app.limiter import limiter

FIXTURES = Path(__file__).parent / "fixtures"

@pytest.fixture(autouse=True)
def reset_clients():
    cache._client = None
    limiter._client = None
    yield
    cache._client = None
    limiter._client = None

@pytest.mark.asyncio
async def test_get_courses_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/courses")

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["data"]) == 6
        assert data["data"][0]["kode"] == "101"
        assert data["data"][0]["token_absen"] is not None

@pytest.mark.asyncio
async def test_get_assignments_with_token(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_html = (FIXTURES / "el_assignment_1.html").read_text(encoding="utf-8")
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/assignments?token=custom_token")

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "tasks" in data["data"]
        assert "submissions" in data["data"]

@pytest.mark.asyncio
async def test_get_grades_all_courses(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    sch_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")
    grades_html = (FIXTURES / "el_assignment_grades.html").read_text(encoding="utf-8")
    quiz_html = (FIXTURES / "el_exercise.html").read_text(encoding="utf-8")

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    async def fake_fetch(path, nim, password):
        if path == "/sch":
            return sch_html
        if path == "/exercise":
            return quiz_html
        if path.startswith("/assignment/"):
            return grades_html
        raise AssertionError(f"unexpected path {path}")

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", side_effect=fake_fetch):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/grades")

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    recap = data["data"]
    assert recap["total_tugas"] > 0
    assert recap["sudah_dinilai"] == recap["total_tugas"]
    assert len(recap["per_pertemuan"]) >= 1
    assert "121-PBO" in recap["per_matkul"] or "131-BASDAT" in recap["per_matkul"]

@pytest.mark.asyncio
async def test_get_grades_with_token(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    grades_html = (FIXTURES / "el_assignment_grades.html").read_text(encoding="utf-8")
    quiz_html = (FIXTURES / "el_exercise.html").read_text(encoding="utf-8")

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    async def fake_fetch(path, nim, password):
        if path == "/exercise":
            return quiz_html
        if path.startswith("/assignment/"):
            return grades_html
        raise AssertionError(f"unexpected path {path}")

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", side_effect=fake_fetch):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/grades?token=custom_token")

    assert res.status_code == 200
    recap = res.json()["data"]
    assert recap["total_tugas"] == 3
    assert recap["rata_nilai"] == 84.33
    assert recap["per_pertemuan"][0]["pertemuan"] == "Pertemuan 2"

@pytest.mark.asyncio
async def test_get_course_grades_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    sch_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")
    grades_html = (FIXTURES / "el_assignment_grades.html").read_text(encoding="utf-8")
    quiz_html = (FIXTURES / "el_exercise.html").read_text(encoding="utf-8")

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    async def fake_fetch(path, nim, password):
        if path == "/sch":
            return sch_html
        if path == "/exercise":
            return quiz_html
        if path.startswith("/assignment/"):
            return grades_html
        raise AssertionError(f"unexpected path {path}")

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", side_effect=fake_fetch):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res_courses = await ac.get("/v1/elearning/courses")
            assert res_courses.status_code == 200
            course_id = res_courses.json()["data"][0]["id"]

            res = await ac.get(f"/v1/elearning/courses/{course_id}/grades")

    assert res.status_code == 200
    recap = res.json()["data"]
    assert recap["total_tugas"] == 3
    assert len(recap["per_pertemuan"]) == 3

@pytest.mark.asyncio
async def test_get_course_grades_not_found(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    sch_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=sch_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/courses/nonexistent123/grades")

    assert res.status_code == 404
    body = res.json()
    detail = body.get("detail") or body.get("error") or body
    assert detail["code"] == "COURSE_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_presence_and_materials_and_quiz(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_absen_html = (FIXTURES / "el_absen_1.html").read_text(encoding="utf-8")
    mock_learning_html = (FIXTURES / "el_learning_1.html").read_text(encoding="utf-8")
    mock_quiz_html = (FIXTURES / "el_exercise.html").read_text(encoding="utf-8")

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis):
        with patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_absen_html):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                res_p = await ac.get("/v1/elearning/presence?token=test_tok")
            assert res_p.status_code == 200
            assert res_p.json()["success"] is True

        with patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_learning_html):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                res_m = await ac.get("/v1/elearning/materials?token=test_tok")
            assert res_m.status_code == 200
            assert res_m.json()["success"] is True

        with patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_quiz_html):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                res_q = await ac.get("/v1/elearning/quiz")
            assert res_q.status_code == 200
            assert res_q.json()["success"] is True

@pytest.mark.asyncio
async def test_post_presence_active_session(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_active_html = (FIXTURES / "el_absen_active.html").read_text(encoding="utf-8")
    mock_post_resp = AsyncMock()
    mock_post_resp.status_code = 200
    mock_post_resp.headers = {}
    mock_post_resp.url = "https://elearning.bsi.ac.id/absen-mhs/tok_active_123"
    mock_post_resp.text = "OK"

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_active_html), \
         patch("app.modules.elearning.pooled_elearning_client.post_page", return_value=mock_post_resp):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/v1/elearning/presence?token=tok_active_123")

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["success"] is True
    assert body["data"]["status"] == "Hadir"

@pytest.mark.asyncio
async def test_post_presence_inactive_session(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_selesai_html = (FIXTURES / "el_absen_1.html").read_text(encoding="utf-8")

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_selesai_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/v1/elearning/presence?token=tok_selesai_123")

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["success"] is False
    assert body["data"]["status"] == "Sudah Selesai"

@pytest.mark.asyncio
async def test_get_quiz_questions(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_ujian_html = (FIXTURES / "el_halaman_ujian.html").read_text(encoding="utf-8")

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_ujian_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/quiz/questions?token=quiz_tok_123")

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert data["total_soal"] == 3
    assert len(data["daftar_soal"]) == 3
    assert "branch baru" in data["current_soal"]["pertanyaan"]

@pytest.mark.asyncio
async def test_get_quiz_questions_ssrf_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/elearning/quiz/questions?quiz_url=http://127.0.0.1:8000/admin")
    # Must be rejected with 422 (validation error on pattern) or 400
    assert res.status_code in (400, 422)


@pytest.mark.asyncio
async def test_get_quiz_questions_rejects_path_traversal_and_protocol_relative():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        for evil in (
            "/halaman-ujian/../../admin",
            "//evil.example.com/halaman-ujian/x",
            "/halaman-ujian/x%00/etc",
        ):
            res = await ac.get(f"/v1/elearning/quiz/questions?quiz_url={evil}")
            assert res.status_code in (400, 422), f"{evil} harus ditolak"


@pytest.mark.asyncio
async def test_get_quiz_questions_accepts_valid_campus_path(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")
    mock_ujian_html = (FIXTURES / "el_halaman_ujian.html").read_text(encoding="utf-8")
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1
    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_ujian_html) as mock_fetch:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/quiz/questions?quiz_url=%2Fhalaman-ujian%2FeyJpdi0")
    assert res.status_code == 200
    # Path kampus sah harus diteruskan utuh ke upstream
    called_path = mock_fetch.call_args[0][0]
    assert called_path == "/halaman-ujian/eyJpdi0"


@pytest.mark.asyncio
async def test_post_quiz_answer(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_post_resp = AsyncMock()
    mock_post_resp.text = "1"

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.post_page", return_value=mock_post_resp):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/v1/elearning/quiz/answer",
                json={"id_soal": "501", "data_jawab": "501_B", "csrf_token": "token123"},
            )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["success"] is True
    assert body["data"]["id_soal"] == "501"
    assert body["data"]["data_jawab"] == "501_B"

@pytest.mark.asyncio
async def test_post_upload_assignment(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_upload_resp = AsyncMock()
    mock_upload_resp.status_code = 200

    mock_form_html = """
    <form action="/simpan-tugas" method="POST" enctype="multipart/form-data">
        <input type="hidden" name="_token" value="csrf123">
        <input type="file" name="file">
    </form>
    """

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_form_html), \
         patch("app.modules.elearning.pooled_elearning_client.post_multipart", return_value=mock_upload_resp):

        import base64
        fake_b64 = base64.b64encode(b"%PDF-1.4 sample content").decode("utf-8")

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/v1/elearning/assignments/upload",
                json={
                    "token_tugas": "tok_upload_123",
                    "filename": "tugas_p5.pdf",
                    "file_base64": fake_b64,
                    "catatan": "Tugas selesai",
                },
            )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["success"] is True
    assert body["data"]["filename"] == "tugas_p5.pdf"

@pytest.mark.asyncio
async def test_download_assignment_file_safe_url(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.content = b"%PDF-1.4 file content here"
    mock_resp.headers = {"content-type": "application/pdf"}

    with patch("app.modules.elearning.pooled_elearning_client.download_file", return_value=mock_resp):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get(
                "/v1/elearning/assignments/download?file_url=https://elearning.bsi.ac.id/storage/soal/tugas1.pdf"
            )

    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "tugas1.pdf" in res.headers.get("content-disposition", "")
    assert res.content == b"%PDF-1.4 file content here"

@pytest.mark.asyncio
async def test_download_assignment_file_ssrf_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            "/v1/elearning/assignments/download?file_url=http://127.0.0.1:8000/internal-secret"
        )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_URL"

@pytest.mark.asyncio
async def test_download_assignment_file_with_id_and_file(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.content = b"%PDF-1.7 official assignment PDF content"
    mock_resp.headers = {"content-type": "application/pdf"}

    with patch("app.modules.elearning.pooled_elearning_client.download_assignment_post", return_value=mock_resp):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get(
                "/v1/elearning/assignments/download?id=tok_id_123&file=soal_pertemuan_4.pdf"
            )

    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "soal_pertemuan_4.pdf" in res.headers.get("content-disposition", "")
    assert res.content == b"%PDF-1.7 official assignment PDF content"

@pytest.mark.asyncio
async def test_download_material_file_with_id_and_file(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.content = b"%PDF-1.7 official material PDF content"
    mock_resp.headers = {"content-type": "application/pdf"}

    with patch("app.modules.elearning.pooled_elearning_client.download_material_post", return_value=mock_resp):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get(
                "/v1/elearning/materials/download?id=tok_id_123&file=materi_ptik_2.pdf"
            )

    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "materi_ptik_2.pdf" in res.headers.get("content-disposition", "")
    assert res.content == b"%PDF-1.7 official material PDF content"

@pytest.mark.asyncio
async def test_submit_assignment_link_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_res = {
        "status": "success",
        "message": "Tugas berhasil dikumpulkan ke MyBest",
        "id_tugas": "46814",
        "kd_mtk": "894",
        "link_tugas": "https://drive.google.com/file/d/14wUrOkCVbx",
    }

    mock_redis = AsyncMock()
    mock_redis.keys.return_value = ["ubsi:elearning:assignments:15260767"]
    mock_redis.delete.return_value = 1

    with patch("app.modules.elearning.pooled_elearning_client.submit_assignment_link", return_value=mock_res), \
         patch("app.cache.cache.get_client", return_value=mock_redis):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/v1/elearning/assignments/submit",
                json={
                    "token_send": "tok_send_46814",
                    "link_tugas": "https://drive.google.com/file/d/14wUrOkCVbx",
                },
            )

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["status"] == "success"
    assert data["data"]["link_tugas"] == "https://drive.google.com/file/d/14wUrOkCVbx"


@pytest.mark.asyncio
async def test_submit_assignment_link_upstream_redirect_to_login_fails(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")
    from fastapi import HTTPException

    with patch("app.modules.elearning.pooled_elearning_client.submit_assignment_link", side_effect=HTTPException(status_code=502, detail={"error": {"code": "SUBMIT_FAILED"}})):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/v1/elearning/assignments/submit",
                json={
                    "token_send": "tok_send_46814",
                    "link_tugas": "https://drive.google.com/file/d/14wUrOkCVbx",
                },
            )
    assert res.status_code == 502


@pytest.mark.asyncio
async def test_submit_assignment_link_invalid_url(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/v1/elearning/assignments/submit",
            json={
                "token_send": "tok_send_46814",
                "link_tugas": "bukan_url_valid",
            },
        )

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_URL"


@pytest.mark.asyncio
async def test_submit_assignment_link_rejects_userinfo_and_private_targets():
    evil_links = [
        "https://user:pass@drive.google.com/file/d/x",
        "http://localhost/tugas.pdf",
        "http://127.0.0.1/tugas.pdf",
        "http://192.168.1.10/tugas.pdf",
        "ftp://drive.google.com/tugas.pdf",
    ]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        for evil in evil_links:
            res = await ac.post(
                "/v1/elearning/assignments/submit",
                json={"token_send": "tok_send_46814", "link_tugas": evil},
            )
            assert res.status_code == 400, f"{evil} harus ditolak"
            assert res.json()["error"]["code"] == "INVALID_URL"


@pytest.mark.asyncio
async def test_get_discussions_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_html = """
    <div class="task-block">
        <div class="task-name">TASK 4 - English Discussion</div>
        <div class="task-desc">Make two sentences about invitation.</div>
        <span class="badge-info">Tarina Dashela</span>
        <span class="badge-primary">2026-10-13 07:25:49</span>
        <input type="hidden" name="id_chat" value="24776">
        <a href="/form-komentarmhs/tok_kom_456"><span class="badge">65</span></a>
    </div>
    """
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/discussions?token=custom_diskusi_token")

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["data"]["threads"]) == 1
    assert data["data"]["threads"][0]["judul"] == "TASK 4 - English Discussion"
    assert data["data"]["threads"][0]["penulis"] == "Tarina Dashela"
    assert data["data"]["threads"][0]["total_komentar"] == 65

@pytest.mark.asyncio
async def test_get_discussion_comments_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_html = """
    <ul>
        <li class="chat-left">
            <div class="chat-avatar"><div class="chat-name">15260847</div></div>
            <div class="chat-text">
                <div class="chat-name">RENKYNA AFTANIA NASUTION</div>
                <p>Hello here is my response.</p>
                <div class="chat-hour">2026-10-13 11:53:44</div>
            </div>
        </li>
        <li class="chat-right">
            <div class="chat-avatar"><div class="chat-name">15260767</div></div>
            <div class="chat-text">
                <div class="chat-name">YUKEN VELINO</div>
                <p>My invitation and response.</p>
                <div class="chat-hour">2026-10-13 12:00:00</div>
            </div>
        </li>
    </ul>
    """
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/discussions/comments?token=tok_kom_456")

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["data"]) == 2
    assert data["data"][0]["nim"] == "15260847"
    assert data["data"][0]["is_self"] is False
    assert data["data"][1]["nim"] == "15260767"
    assert data["data"][1]["is_self"] is True

@pytest.mark.asyncio
async def test_post_discussion_comment_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_redis = AsyncMock()
    mock_redis.keys.return_value = ["ubsi:elearning:discussions:15260767"]
    mock_redis.delete.return_value = 1

    with patch("app.modules.elearning.pooled_elearning_client.post_discussion_comment", return_value={"status": "success", "message": "OK"}), \
         patch("app.cache.cache.get_client", return_value=mock_redis):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/v1/elearning/discussions/comments",
                json={
                    "token_komentar": "tok_kom_456",
                    "id_chat": "24776",
                    "komentar": "Tanggapan forum saya.",
                },
            )

    assert res.status_code == 200
    assert res.json()["success"] is True

@pytest.mark.asyncio
async def test_get_elearning_profile_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_html = """
    <form>
        <input name="name" value="YUKEN VELINO" />
        <input name="email" value="yuken@test.com" />
    </form>
    """
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/profile")

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["nama"] == "YUKEN VELINO"
    assert data["data"]["email"] == "yuken@test.com"

@pytest.mark.asyncio
async def test_get_makeup_classes_success(monkeypatch):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    mock_html = """
    <table>
        <tr><th>Kode</th><th>Mata Kuliah</th><th>Jadwal</th></tr>
        <tr><td>894</td><td>Dasar Pemrograman</td><td>Sabtu 08:00</td></tr>
    </table>
    """
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1

    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", return_value=mock_html):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/v1/elearning/makeups")

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["kode"] == "894"

@pytest.mark.asyncio
async def test_get_guides_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/elearning/guides")

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["data"]) >= 3
    assert data["data"][0]["format"] == "PDF"


async def _get_all_assignments(monkeypatch, fake_fetch, saved):
    monkeypatch.setenv("ELEARNING_NIM", "15260767")
    monkeypatch.setenv("ELEARNING_PASS", "secret")

    async def fake_set(key, payload, ttl=None):
        saved[key] = payload

    async def no_lgg(key):
        return None

    monkeypatch.setattr(cache, "set", fake_set)
    monkeypatch.setattr(cache, "get_lgg", no_lgg)
    monkeypatch.setattr(cache, "fresh_or_stale", no_lgg)
    monkeypatch.setattr("app.modules.elearning.asyncio.sleep", AsyncMock())

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.incr.return_value = 1
    with patch("redis.asyncio.from_url", return_value=mock_redis), \
         patch("app.modules.elearning.pooled_elearning_client.fetch_page", side_effect=fake_fetch):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            return await ac.get("/v1/elearning/assignments")


@pytest.mark.asyncio
async def test_assignments_retry_course_that_fails_once(monkeypatch):
    sch_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")
    task_html = (FIXTURES / "el_assignment_grades.html").read_text(encoding="utf-8")
    seen: dict[str, int] = {}

    async def flaky_fetch(path, nim, password):
        if path == "/sch":
            return sch_html
        seen[path] = seen.get(path, 0) + 1
        if seen[path] == 1:
            raise RuntimeError("MyBest sedang sibuk")
        return task_html

    saved: dict = {}
    res = await _get_all_assignments(monkeypatch, flaky_fetch, saved)
    data = res.json()["data"]
    assert res.status_code == 200
    assert data["failed_courses"] == []
    assert data["submissions"], "data harus tetap muncul setelah retry"
    assert saved, "hasil lengkap boleh di-cache"


@pytest.mark.asyncio
async def test_assignments_report_failed_courses_and_skip_cache(monkeypatch):
    sch_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")

    async def broken_fetch(path, nim, password):
        if path == "/sch":
            return sch_html
        raise RuntimeError("MyBest down")

    saved: dict = {}
    res = await _get_all_assignments(monkeypatch, broken_fetch, saved)
    data = res.json()["data"]
    assert res.status_code == 200
    assert data["tasks"] == []
    assert data["failed_courses"], "mata kuliah yang gagal harus dilaporkan, bukan dianggap kosong"
    assert not any(k.endswith("all") or "assignments" in k for k in saved), "hasil parsial tidak boleh di-cache"
