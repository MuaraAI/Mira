"""Alias jadwal: /v1/studentv2/schedule dijawab dari MyBest saat SIAKAD gagal.

Latar belakang: sejak kampus mewajibkan CAPTCHA, login SIAKAD sering terhalang
sementara user belum login ulang. Jadwal MyBest punya skema yang sama
(parse_courses vs parse_schedule), jadi endpoint bisa menjawab sendiri.
100% offline (Iron Rule #2).
"""
from unittest.mock import patch, AsyncMock
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

FIXTURES = Path(__file__).parent / "fixtures"


class FakeRedis:
    """Mini in-memory Redis untuk test offline."""

    def __init__(self):
        self.kv: dict = {}
        self.sets: dict = {}

    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, value, ex=None):
        self.kv[key] = value

    async def expire(self, key, ttl):
        return key in self.kv or key in self.sets


    def pipeline(self, transaction=True):
        parent = self

        class _Pipe:
            def __init__(self):
                self.ops = []

            def incr(self, key):
                self.ops.append(("incr", key))
                return self

            def expire(self, key, ttl):
                self.ops.append(("expire", key, ttl))
                return self

            async def execute(self):
                results = []
                for op in self.ops:
                    if op[0] == "incr":
                        results.append(await parent.incr(op[1]))
                    elif op[0] == "expire":
                        results.append(await parent.expire(op[1], op[2]))
                return results

        return _Pipe()

    async def sadd(self, key, member):
        self.sets.setdefault(key, set()).add(member)
        return 1

    async def srem(self, key, member):
        if key in self.sets:
            self.sets[key].discard(member)
        return 1

    async def smembers(self, key):
        return set(self.sets.get(key, set()))

    async def ping(self):
        return True

    async def aclose(self):
        pass

    async def incr(self, key):
        self.kv[key] = int(self.kv.get(key, 0)) + 1
        return self.kv[key]


@pytest.fixture(autouse=True)
def reset_redis_clients(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    monkeypatch.setattr("app.cache.cache._client", fake)
    monkeypatch.setattr("app.limiter.limiter._client", fake)
    yield fake


@pytest.fixture(autouse=True)
def tmp_sqlite(monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "test_ubsi.db"))
    from app.channels_db import init_db

    init_db()


@pytest.fixture(autouse=True)
def mock_campus_login(monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.verify_live_credentials",
        AsyncMock(return_value=(True, True)),
    )


async def _login_with_both_creds(ac: AsyncClient) -> str:
    res = await ac.post(
        "/v1/auth/login",
        json={"nim": "12345678", "studentv2_pass": "sv_pass", "elearning_pass": "el_pass"},
    )
    assert res.status_code == 200
    token = res.cookies.get("ubsi_session")
    assert token
    return token


@pytest.mark.asyncio
async def test_schedule_falls_back_to_elearning_when_siakad_fails(reset_redis_clients):
    sch_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")

    def _siakad_down(*args, **kwargs):
        raise RuntimeError("SIAKAD down: simulasi kegagalan upstream")

    async def _fake_el_fetch(path: str, nim: str, password: str) -> str:
        assert path == "/exercise"
        return sch_html

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = await _login_with_both_creds(ac)
        with (
            patch(
                "app.modules.studentv2.studentv2_client.fetch_page",
                side_effect=_siakad_down,
            ),
            patch(
                "app.modules.elearning.pooled_elearning_client.fetch_page",
                side_effect=_fake_el_fetch,
            ),
        ):
            res = await ac.get(
                "/v1/studentv2/schedule",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body.get("source") == "elearning"
    assert len(body["data"]) == 6
    assert body["data"][0]["hari"] == "Jumat"


@pytest.mark.asyncio
async def test_schedule_prefers_siakad_when_healthy(reset_redis_clients):
    siakad_html = (
        "<table><tr><th>Kode</th></tr></table>"  # tidak dipakai: parse di-mock
    )
    schedule_data = [
        {
            "id": "s1",
            "kode": "TIF-101",
            "nama": "Dasar Pemrograman",
            "hari": "Senin",
            "jam": "07:30-09:10",
            "sks": 3,
            "kelompok_praktek": None,
            "ruang": "R-101",
            "kode_dosen": "ABC",
        }
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = await _login_with_both_creds(ac)
        with (
            patch(
                "app.modules.studentv2.parse_schedule",
                return_value=schedule_data,
            ),
            patch(
                "app.modules.studentv2.studentv2_client.fetch_page",
                return_value=siakad_html,
            ) as siakad_fetch,
            patch(
                "app.modules.elearning.pooled_elearning_client.fetch_page"
            ) as el_fetch,
        ):
            res = await ac.get(
                "/v1/studentv2/schedule",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body.get("source") is None  # jawaban dari sumber utama
    assert body["data"][0]["kode"] == "TIF-101"
    assert siakad_fetch.called
    assert not el_fetch.called


@pytest.mark.asyncio
async def test_schedule_alias_also_cached_under_primary_key(reset_redis_clients):
    """Jawaban alias harus mengisi cache kunci utama agar request berikutnya instan."""
    sch_html = (FIXTURES / "el_sch.html").read_text(encoding="utf-8")

    def _siakad_down(*args, **kwargs):
        raise RuntimeError("SIAKAD down")

    async def _fake_el_fetch(path: str, nim: str, password: str) -> str:
        return sch_html

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        token = await _login_with_both_creds(ac)
        with (
            patch(
                "app.modules.studentv2.studentv2_client.fetch_page",
                side_effect=_siakad_down,
            ),
            patch(
                "app.modules.elearning.pooled_elearning_client.fetch_page",
                side_effect=_fake_el_fetch,
            ),
        ):
            first = await ac.get(
                "/v1/studentv2/schedule",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert first.status_code == 200
            assert first.json().get("source") == "elearning"

        # Sumber utama masih mati, tapi cache alias harus menjawab cached=True
        second = await ac.get(
            "/v1/studentv2/schedule",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert second.status_code == 200
        body = second.json()
        assert body["success"] is True
        assert body.get("cached") is True
        assert len(body["data"]) == 6
