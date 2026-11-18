"""Tes modul CAPTCHA Mira: buat, verifikasi cocok/salah, sekali pakai."""
import json
from unittest.mock import AsyncMock

import pytest

from app.mira_captcha import create_challenge, verify_challenge


class FakeMiraRedis:
    """Redis mini dengan eval yang meniru Lua verifikasi Mira."""

    def __init__(self):
        self.kv: dict = {}

    async def setex(self, key, ttl, value):
        self.kv[key] = value

    async def eval(self, script, numkeys, key, arg=None):
        raw = self.kv.get(key)
        if raw is None:
            return -1
        stored = json.loads(raw)
        if stored.get("answer", "").upper() == (arg or "").upper():
            del self.kv[key]
            return raw
        return ""


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeMiraRedis()
    monkeypatch.setattr("app.cache.cache.get_client", AsyncMock(return_value=fake))
    return fake


@pytest.mark.asyncio
async def test_create_challenge_returns_image_and_stores_answer(fake_redis):
    challenge = await create_challenge()
    assert challenge["id"]
    assert challenge["image"].startswith("data:image/svg+xml;base64,")
    assert challenge["expires_in"] > 0
    key = f"ubsi:mira-captcha:{challenge['id']}"
    assert key in fake_redis.kv
    stored = json.loads(fake_redis.kv[key])
    assert len(stored["answer"]) == 5


@pytest.mark.asyncio
async def test_verify_accepts_correct_code_case_insensitive(fake_redis):
    challenge = await create_challenge()
    stored = json.loads(fake_redis.kv[f"ubsi:mira-captcha:{challenge['id']}"])
    code = stored["answer"]
    # case berbeda tetap diterima
    swapped = code.swapcase()
    assert await verify_challenge(challenge["id"], swapped) is True
    assert f"ubsi:mira-captcha:{challenge['id']}" not in fake_redis.kv  # sekali pakai


@pytest.mark.asyncio
async def test_verify_wrong_code_keeps_challenge_for_retry(fake_redis):
    challenge = await create_challenge()
    key = f"ubsi:mira-captcha:{challenge['id']}"
    stored = json.loads(fake_redis.kv[key])
    wrong = "ZZZZZ" if stored["answer"] != "ZZZZZ" else "YYYYY"
    assert await verify_challenge(challenge["id"], wrong) is False
    # tantangan tidak hilang: user cukup mengoreksi kode
    assert key in fake_redis.kv
    assert await verify_challenge(challenge["id"], stored["answer"]) is True


@pytest.mark.asyncio
async def test_verify_unknown_or_empty_fails(fake_redis):
    assert await verify_challenge("tidak-ada", "ABCDE") is False
    challenge = await create_challenge()
    assert await verify_challenge(challenge["id"], "") is False
    assert await verify_challenge("", "ABCDE") is False
