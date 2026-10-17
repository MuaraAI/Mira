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
