import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.stats import _day, get_public_stats


@pytest.mark.asyncio
async def test_public_stats_does_not_require_auth(monkeypatch):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/v1/stats")
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "users" in response.json()["data"]


class FakeRedis:
    """Redis tiruan: dua hari data harian, counter permanen bisa diatur."""

    def __init__(self, requests_all=None, users_all=None, online=None):
        self.values = {"ubsi:stats:requests:all": requests_all} if requests_all is not None else {}
        self.sets = {"ubsi:stats:users:all": set(users_all or ())}
        self.online = dict(online or {})

    async def get(self, key):
        if key in self.values:
            return str(self.values[key])
        return "100" if ":requests:20" in key else None

    async def incrby(self, key, amount):
        self.values[key] = int(self.values.get(key) or 0) + amount

    async def scard(self, key):
        return len(self.sets[key]) if key in self.sets else 5

    async def smembers(self, key):
        return {"a", "b"}

    async def keys(self, pattern):
        if "requests:20" in pattern:
            return ["ubsi:stats:requests:2026-10-21", "ubsi:stats:requests:2026-10-22"]
        if "users:20" in pattern:
            return ["ubsi:stats:users:2026-10-21", "ubsi:stats:users:2026-10-22"]
        return []

    async def sunion(self, *keys):
        return {"user1", "user2"}

    async def sunionstore(self, dest, keys):
        self.sets[dest] = set(self.sets.get(dest, set())) | {"user1", "user2"}

    async def zremrangebyscore(self, key, low, high):
        self.online = {member: score for member, score in self.online.items() if score > high}

    async def zcard(self, key):
        return len(self.online)


async def _stats_with(fake):
    from unittest.mock import patch

    with patch("app.cache.cache.get_client", return_value=fake):
        return await get_public_stats()


class BranchFakeRedis(FakeRedis):
    """Redis tiruan: kode cabang mentah ("30", "05"), nama tampilan, dan data >30 hari."""

    async def keys(self, pattern):
        today = _day(0)
        expired = _day(32)
        if "branch:" in pattern:
            return [
                f"ubsi:stats:branch:30:{today}",
                f"ubsi:stats:branch:UBSI Pontianak:{today}",
                f"ubsi:stats:branch:05:{today}",
                f"ubsi:stats:branch:99:{expired}",
            ]
        return await super().keys(pattern)

    async def smembers(self, key):
        if ":05:" in key:
            return {"c"}
        return {"a", "b"}


@pytest.mark.asyncio
async def test_branch_code_and_display_name_are_merged():
    """Kode mentah SIAKAD ("30", "05") diterjemahkan, digabung, dan total_all_time tetap menghitung key >30 hari."""
    stats = await _stats_with(BranchFakeRedis())
    assert stats["branches"] == [
        {"name": "UBSI Pontianak", "active_users_30d": 2, "total_all_time": 2},
        {"name": "UBSI Bekasi", "active_users_30d": 1, "total_all_time": 1},
        {"name": "UBSI Cabang 99", "active_users_30d": 0, "total_all_time": 2},
    ]


@pytest.mark.asyncio
async def test_branch_all_time_persists_and_backfills_permanent_sets():
    """record_profile menulis set all-time permanen dan get_public_stats mem-backfill key harian."""
    from unittest.mock import patch
    from app.stats import record_profile

    class FullBranchRedis(FakeRedis):
        def __init__(self):
            super().__init__()
            today = _day(0)
            old_retained = _day(33)
            self.branch_sets = {
                "ubsi:stats:branch:all:UBSI Pontianak": {"perm1"},
                f"ubsi:stats:branch:30:{old_retained}": {"ret1"},
                f"ubsi:stats:branch:UBSI Pontianak:{today}": {"act1"},
            }
            self.expiries = {}

        async def sadd(self, key, *members):
            target = self.branch_sets.setdefault(key, set())
            target.update(members)
            return len(members)

        async def expire(self, key, ttl):
            self.expiries[key] = ttl
            return True

        async def keys(self, pattern):
            if "branch:" in pattern:
                return [k for k in sorted(self.branch_sets) if k.startswith("ubsi:stats:branch:")]
            if "program:" in pattern:
                return [k for k in sorted(self.branch_sets) if k.startswith("ubsi:stats:program:")]
            return await super().keys(pattern)

        async def smembers(self, key):
            if key in self.branch_sets:
                return set(self.branch_sets[key])
            return set()

    fake = FullBranchRedis()
    with patch("app.cache.cache.get_client", return_value=fake):
        await record_profile("12345678", "05", "Sistem Informasi")
        stats = await get_public_stats()

    assert "ubsi:stats:branch:all:UBSI Bekasi" in fake.branch_sets
    assert "ubsi:stats:branch:all:UBSI Bekasi" not in fake.expiries
    assert fake.branch_sets["ubsi:stats:branch:all:UBSI Pontianak"] == {"perm1", "ret1", "act1"}
    assert stats["branches"] == [
        {"name": "UBSI Pontianak", "active_users_30d": 1, "total_all_time": 3},
        {"name": "UBSI Bekasi", "active_users_30d": 1, "total_all_time": 1},
    ]


@pytest.mark.asyncio
async def test_public_stats_cached_flag_false_on_cache_miss():
    from unittest.mock import AsyncMock, patch

    with (
        patch("app.modules.stats.cache.get_fresh", AsyncMock(return_value=None)),
        patch("app.modules.stats.cache.set", AsyncMock()),
        patch("app.modules.stats.get_public_stats", AsyncMock(return_value={"users": {}, "branches": []})),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/v1/stats")
    assert response.status_code == 200
    assert response.json()["cached"] is False


@pytest.mark.asyncio
async def test_public_stats_has_averages_and_all_time_totals():
    data = await _stats_with(FakeRedis())

    # Rata-rata dan total all-time berada langsung di dalam 'users' dan 'requests'
    assert data["users"]["average_per_day"] == 5
    assert data["users"]["total_all_time"] == 2
    assert data["requests"]["average_per_day"] == 100
    assert data["requests"]["total_all_time"] == 200


@pytest.mark.asyncio
async def test_all_time_totals_never_drop_below_permanent_counters():
    # Key harian lama sudah kedaluwarsa: counter permanen lebih besar dari sisa data harian.
    fake = FakeRedis(requests_all=9000, users_all={"old1", "old2", "old3"})
    data = await _stats_with(fake)

    assert data["requests"]["total_all_time"] == 9000
    assert data["users"]["total_all_time"] == 5  # 3 lama + 2 dari key harian


@pytest.mark.asyncio
async def test_permanent_request_counter_catches_up_with_daily_keys():
    fake = FakeRedis(requests_all=50)
    data = await _stats_with(fake)

    assert data["requests"]["total_all_time"] == 200
    assert fake.values["ubsi:stats:requests:all"] == 200


@pytest.mark.asyncio
async def test_online_now_counts_only_recent_users():
    import time

    now = time.time()
    fake = FakeRedis(online={"fresh": now - 30, "idle": now - 3600})
    data = await _stats_with(fake)

    assert data["users"]["online_now"] == 1


def test_normalize_program():
    from app.stats import normalize_program

    assert normalize_program("Informatika Kampus Kota Pontianak") == "Informatika"
    assert normalize_program("Sistem Informasi Kampus Kota Pontianak") == "Sistem Informasi"
    assert normalize_program("Sistem Informasi Akuntansi Kampus Kota Pontianak") == "Sistem Informasi Akuntansi"
    assert normalize_program("Sistem Informasi Akuntansi Kampus Bogor") == "Sistem Informasi Akuntansi"
    assert normalize_program("Sistem Informasi") == "Sistem Informasi"
    assert normalize_program("") is None


@pytest.mark.asyncio
async def test_programs_merge_campus_suffix_and_include_all_time_backfill():
    from unittest.mock import patch
    from app.stats import record_profile

    class ProgramFakeRedis(FakeRedis):
        def __init__(self):
            super().__init__()
            today = _day(0)
            old_retained = _day(33)
            self.data_sets = {
                f"ubsi:stats:program:Informatika Kampus Kota Pontianak:{old_retained}": {"ret1"},
                f"ubsi:stats:program:Informatika Kampus Kota Pontianak:{today}": {"act1", "act2"},
                f"ubsi:stats:program:Sistem Informasi Kampus Kota Pontianak:{today}": {"si_ptk"},
                f"ubsi:stats:program:Sistem Informasi:{today}": {"si_bks"},
                "ubsi:stats:program:all:Informatika Kampus Kota Pontianak": {"perm_if"},
            }
            self.expiries = {}

        async def sadd(self, key, *members):
            target = self.data_sets.setdefault(key, set())
            target.update(members)
            return len(members)

        async def expire(self, key, ttl):
            self.expiries[key] = ttl
            return True

        async def keys(self, pattern):
            if "program:" in pattern:
                return [k for k in sorted(self.data_sets) if k.startswith("ubsi:stats:program:")]
            if "branch:" in pattern:
                return [k for k in sorted(self.data_sets) if k.startswith("ubsi:stats:branch:")]
            return await super().keys(pattern)

        async def smembers(self, key):
            return set(self.data_sets.get(key, set()))

    fake = ProgramFakeRedis()
    with patch("app.cache.cache.get_client", return_value=fake):
        await record_profile("12345678", "Pontianak", "Sistem Informasi Akuntansi Kampus Kota Pontianak")
        stats = await get_public_stats()

    assert "ubsi:stats:program:all:Sistem Informasi" in fake.data_sets
    assert "ubsi:stats:program:all:Sistem Informasi" not in fake.expiries
    assert "ubsi:stats:program:all:Sistem Informasi Akuntansi" in fake.data_sets
    assert "ubsi:stats:branch:all:UBSI Pontianak" in fake.data_sets
    assert stats["programs"] == [
        {"name": "Informatika", "active_users_30d": 2, "total_all_time": 4},
        {"name": "Sistem Informasi", "active_users_30d": 2, "total_all_time": 2},
        {"name": "Sistem Informasi Akuntansi", "active_users_30d": 1, "total_all_time": 1},
    ]


class AttrFakeRedis(FakeRedis):
    """Redis tiruan dengan dukungan hash (`user_attr`) & `srem` untuk deduplikasi dan 30d aktif."""

    def __init__(self, *, active_30d: set[str] | None = None, retained_days: list[str] | None = None):
        super().__init__(users_all=set(active_30d or ()))
        self.sets = {"ubsi:stats:users:all": set(active_30d or ())}
        self.hashes: dict[str, dict[str, str]] = {}
        self.expiries: dict[str, int] = {}
        self._active_30d = set(active_30d or ())
        self._retained_days = retained_days if retained_days is not None else [_day(0)]

    async def hget(self, key, field):
        return self.hashes.get(key, {}).get(field)

    async def hset(self, key, field, value):
        self.hashes.setdefault(key, {})[field] = value
        return 1

    async def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    async def sadd(self, key, *members):
        target = self.sets.setdefault(key, set())
        target.update(members)
        return len(members)

    async def srem(self, key, *members):
        target = self.sets.get(key)
        if not target:
            return 0
        before = len(target)
        target.difference_update(members)
        return before - len(target)

    async def expire(self, key, ttl):
        self.expiries[key] = ttl
        return True

    async def keys(self, pattern):
        if "branch:" in pattern:
            return [k for k in sorted(self.sets) if k.startswith("ubsi:stats:branch:")]
        if "program:" in pattern:
            return [k for k in sorted(self.sets) if k.startswith("ubsi:stats:program:")]
        if "requests:20" in pattern:
            return [f"ubsi:stats:requests:{d}" for d in self._retained_days]
        if "users:20" in pattern:
            return [f"ubsi:stats:users:{d}" for d in self._retained_days]
        return []

    async def smembers(self, key):
        return set(self.sets.get(key, set()))

    async def sunion(self, keys):
        out = set()
        for k in keys:
            if k.startswith("ubsi:stats:users:"):
                out |= self._active_30d
        return out

    async def sunionstore(self, dest, keys):
        self.sets[dest] = set(self.sets.get(dest, set())) | self._active_30d
        return len(self.sets[dest])


@pytest.mark.asyncio
async def test_record_profile_deduplicates_previous_branch_and_program():
    from unittest.mock import patch
    from app.stats import _identity, record_profile

    fake = AttrFakeRedis()
    nim = "19000001"
    uid = _identity(nim)
    with patch("app.cache.cache.get_client", return_value=fake):
        await record_profile(nim, "05", "Sistem Informasi")
        await record_profile(nim, "30", "Informatika Kampus Kota Pontianak")
        stats = await get_public_stats()

    assert uid not in fake.sets.get("ubsi:stats:branch:all:UBSI Bekasi", set())
    assert uid in fake.sets["ubsi:stats:branch:all:UBSI Pontianak"]
    assert uid not in fake.sets.get("ubsi:stats:program:all:Sistem Informasi", set())
    assert uid in fake.sets["ubsi:stats:program:all:Informatika"]
    assert fake.hashes["ubsi:stats:user_attr:branch"][uid] == "UBSI Pontianak"
    assert fake.hashes["ubsi:stats:user_attr:program"][uid] == "Informatika"
    assert sum(b["total_all_time"] for b in stats["branches"]) == 1
    assert stats["branches"] == [
        {"name": "UBSI Pontianak", "active_users_30d": 1, "total_all_time": 1}
    ]
    assert stats["programs"] == [
        {"name": "Informatika", "active_users_30d": 1, "total_all_time": 1}
    ]


@pytest.mark.asyncio
async def test_record_profile_permanent_only_skips_daily_key():
    from unittest.mock import patch
    from app.stats import _identity, record_profile

    fake = AttrFakeRedis()
    nim = "12345678"
    uid = _identity(nim)
    with patch("app.cache.cache.get_client", return_value=fake):
        await record_profile(nim, "30", "Informatika", record_daily=False)

    assert any(k.startswith("ubsi:stats:branch:all:") for k in fake.sets)
    assert not any(k.startswith("ubsi:stats:branch:UBSI Pontianak:") for k in fake.sets)
    assert not any(k.startswith("ubsi:stats:program:Informatika:") for k in fake.sets)
    assert fake.hashes["ubsi:stats:user_attr:branch"][uid] == "UBSI Pontianak"
    assert fake.hashes["ubsi:stats:user_attr:program"][uid] == "Informatika"


@pytest.mark.asyncio
async def test_active_30d_counts_permanently_attributed_active_users():
    from unittest.mock import patch
    from app.stats import _identity

    active_uid = _identity("15000001")
    idle_uid = _identity("15000002")
    fake = AttrFakeRedis(active_30d={active_uid})
    fake.sets["ubsi:stats:users:all"].update({active_uid, idle_uid})
    # Terdaftar di set permanen saja (mis. tercatat >30 hari lalu), bukan di key harian cabang/prodi.
    fake.sets["ubsi:stats:branch:all:UBSI Pontianak"] = {active_uid, idle_uid}
    fake.sets["ubsi:stats:program:all:Informatika"] = {active_uid, idle_uid}

    with patch("app.cache.cache.get_client", return_value=fake):
        stats = await get_public_stats()

    assert stats["branches"] == [
        {"name": "UBSI Pontianak", "active_users_30d": 1, "total_all_time": 2}
    ]
    assert stats["programs"] == [
        {"name": "Informatika", "active_users_30d": 1, "total_all_time": 2}
    ]


@pytest.mark.asyncio
async def test_has_profile_attr_states():
    from unittest.mock import AsyncMock, patch
    from app.stats import _identity, has_profile_attr

    fake = AttrFakeRedis()
    nim = "19000002"
    with patch("app.cache.cache.get_client", return_value=fake):
        assert await has_profile_attr(nim, "program") is False
        await fake.hset("ubsi:stats:user_attr:program", _identity(nim), "Sistem Informasi")
        assert await has_profile_attr(nim, "program") is True

    mock_client = AsyncMock()
    with patch("app.cache.cache.get_client", return_value=mock_client):
        assert await has_profile_attr(nim, "program") is None

    with patch("app.cache.cache.get_client", side_effect=RuntimeError("redis down")):
        assert await has_profile_attr(nim, "program") is None
