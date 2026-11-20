import json
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.elearning import (
    fetch_quiz_questions,
    parse_quiz,
    parse_quiz_questions,
    submit_quiz_answer,
)

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def exercise_html() -> str:
    return (FIXTURES / "el_exercise_2026_11.html").read_text(encoding="utf-8")


@pytest.fixture
def exam_html() -> str:
    return (FIXTURES / "el_exercise_show_2026_11.html").read_text(encoding="utf-8")


def test_parse_quiz_splits_period_and_classifies_status(exercise_html):
    quizzes = parse_quiz(exercise_html)

    assert len(quizzes) == 8
    active = quizzes[-1]
    assert active["status_aksi"] == "Mulai Ujian"
    assert active["status"] == "aktif"
    assert active["ujian_mulai"] == "20 Nov 2026 10:30"
    assert active["ujian_selesai"] == "20 Nov 2026 11:30"
    assert active["quiz_url"].startswith("/exercise-show/")

    expired = quizzes[5]
    assert expired["status_aksi"] == "Ujian Lewat"
    assert expired["status"] == "lewat"
    assert expired["ujian_mulai"] == "30 Oct 2026 10:40"
    assert expired["ujian_selesai"] == "30 Oct 2026 11:10"
    assert expired["quiz_url"] is None

    completed = quizzes[0]
    assert completed["status"] == "selesai"
    assert completed["token_bukti"]
    assert completed["quiz_url"] is None


def test_parse_quiz_questions_uses_real_question_id_and_option_payload(exam_html):
    result = parse_quiz_questions(exam_html)

    assert result["csrf_token"] == "dummy-csrf-token"
    assert result["total_soal"] == 10
    assert result["daftar_soal"][0] == {"no": 1, "id_soal": "104643"}

    current = result["current_soal"]
    assert current is not None
    assert current["id_soal"] == "104643"
    assert "format suara" in current["pertanyaan"].lower()
    assert [o["key"] for o in current["opsi"]] == ["A", "B", "C", "D", "E"]
    assert current["opsi"][0]["text"] == "MIDI"
    assert current["opsi"][0]["data_jawab"] == "A/104643/269441"


class FakeResponse:
    def __init__(self, status_code: int, text: str):
        self.status_code = status_code
        self.text = text


@pytest.mark.asyncio
async def test_fetch_quiz_questions_uses_exercise_show_route(monkeypatch, exam_html):
    calls: list[str] = []

    async def fake_fetch(path, nim, password):
        calls.append(path)
        return FakeResponse(200, exam_html)

    monkeypatch.setattr(
        "app.modules.elearning.pooled_elearning_client.fetch_page_response", fake_fetch
    )

    result = await fetch_quiz_questions("12345678", "secret", token="tok-aktif")

    assert calls == ["/exercise-show/tok-aktif"]
    assert result["current_soal"]["id_soal"] == "104643"


@pytest.mark.asyncio
async def test_fetch_quiz_question_parses_get_soal_fragment(monkeypatch):
    from app.modules.elearning import fetch_quiz_question

    fragment = (
        "<div id='nomerurut' class='soal' data-id='2'>2. Soal kedua</div>"
        "<div class='jawab ' soal-id='104647' data-id='104647' data-jawab='B/104647/2'>"
        "<span class='option-badge'>B</span><div class='pilihan'>Jawaban B</div></div>"
    )

    class FakeResp:
        status_code = 200
        text = json.dumps({"html": fragment})

    async def fake_fetch(path, nim, password):
        assert path == "/get-soal?id_soal=104647&no_urut=2"
        return FakeResp()

    monkeypatch.setattr(
        "app.modules.elearning.pooled_elearning_client.fetch_page_response", fake_fetch
    )

    result = await fetch_quiz_question("12345678", "secret", "104647", 2)

    assert result["id_soal"] == "104647"
    assert result["opsi"][0]["data_jawab"] == "B/104647/2"


@pytest.mark.asyncio
async def test_finish_quiz_validates_path(monkeypatch):
    from app.modules.elearning import finish_quiz

    with pytest.raises(Exception):
        await finish_quiz("12345678", "secret", "https://evil.example.com/selesai")

    class FakeResp:
        status_code = 200
        text = "OK"

    async def fake_fetch(path, nim, password):
        assert path.startswith("/selesai-ujian/")
        return FakeResp()

    monkeypatch.setattr(
        "app.modules.elearning.pooled_elearning_client.fetch_page_response", fake_fetch
    )
    result = await finish_quiz("12345678", "secret", "/selesai-ujian/tok-selesai")
    assert result["success"] is True


@pytest.mark.asyncio
async def test_fetch_quiz_questions_falls_back_to_halaman_ujian(monkeypatch, exam_html):
    calls: list[str] = []

    async def fake_fetch(path, nim, password):
        calls.append(path)
        if path.startswith("/exercise-show/"):
            return FakeResponse(404, "<title>Not Found</title>")
        return FakeResponse(200, exam_html)

    monkeypatch.setattr(
        "app.modules.elearning.pooled_elearning_client.fetch_page_response", fake_fetch
    )

    result = await fetch_quiz_questions("12345678", "secret", token="tok-lama")

    assert calls == ["/exercise-show/tok-lama", "/halaman-ujian/tok-lama"]
    assert result["current_soal"] is not None


@pytest.mark.asyncio
async def test_fetch_quiz_questions_prefers_explicit_quiz_url(monkeypatch, exam_html):
    calls: list[str] = []

    async def fake_fetch(path, nim, password):
        calls.append(path)
        return FakeResponse(200, exam_html)

    monkeypatch.setattr(
        "app.modules.elearning.pooled_elearning_client.fetch_page_response", fake_fetch
    )

    await fetch_quiz_questions(
        "12345678", "secret", token="ignored", quiz_url="/exercise-show/tok-persis"
    )

    assert calls == ["/exercise-show/tok-persis"]


@pytest.mark.asyncio
async def test_submit_quiz_answer_sends_full_option_payload(monkeypatch):
    post = AsyncMock(return_value=FakeResponse(200, "2"))
    monkeypatch.setattr(
        "app.modules.elearning.pooled_elearning_client.post_page", post
    )

    result = await submit_quiz_answer(
        "12345678", "secret", "104643", "A/104643/269441", "dummy-csrf-token"
    )

    post.assert_awaited_once()
    _, kwargs = post.await_args
    assert kwargs["data"] == {"get_jawab": "A/104643/269441"}
    assert kwargs["headers"] == {"X-CSRF-TOKEN": "dummy-csrf-token"}
    assert result["success"] is True


@pytest.mark.asyncio
async def test_router_accepts_token_ujian_alias(monkeypatch):
    from app.modules.elearning import require_elearning_creds

    captured = {}

    async def fake_fetch(nim, password, token=None, quiz_url=None):
        captured.update(token=token, quiz_url=quiz_url)
        return {"csrf_token": None, "total_soal": 0, "daftar_soal": [], "current_soal": None}

    monkeypatch.setattr("app.modules.elearning.fetch_quiz_questions", fake_fetch)
    app.dependency_overrides[require_elearning_creds] = lambda: ("12345678", "secret")
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/v1/elearning/quiz/questions?token_ujian=tok-alias")
    finally:
        app.dependency_overrides.pop(require_elearning_creds, None)

    assert response.status_code == 200
    assert captured["token"] == "tok-alias"
