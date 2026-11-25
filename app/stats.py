"""Privacy-preserving public usage counters backed by Redis."""
from __future__ import annotations

from collections import OrderedDict
import functools
import hashlib
import hmac
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.cache import cache
from app.config import settings
from app.modules.studentv2 import branch_display

_PREFIX = "ubsi:stats:"
_RETENTION_SECONDS = 35 * 86400
# Pengguna dianggap online bila ada request dalam jendela ini (dashboard polling tiap 60 detik).
_ONLINE_WINDOW_SECONDS = 5 * 60
_ALLOWED_STAT_MODULES = frozenset({
    "studentv2",
    "elearning",
    "elibrary",
    "news",
    "repository",
    "ejournal",
    "auth",
    "channels",
    "notifications",
    "tools",
    "stats",
    "docs",
    "ujian",
    "academic",
    "social",
    "lecturers",
})

# Pemetaan 2 digit awal NIM -> nama program studi dasar (terverifikasi dari dataset UBSI).
NIM_PROGRAM_NAMES: dict[str, str] = {
    "10": "Rekayasa Perangkat Lunak",
    "11": "Teknologi Informasi",
    "12": "Sistem Informasi",
    "13": "Teknologi Komputer",
    "15": "Informatika",
    "17": "Teknologi Informasi",
    "19": "Sistem Informasi",
    "21": "Administrasi Perkantoran",
    "22": "Administrasi Bisnis",
    "24": "Hukum Bisnis",
    "25": "Ilmu Hukum",
    "31": "Bahasa Inggris",
    "32": "Akuntansi",
    "33": "Sastra Inggris",
    "41": "Hubungan Masyarakat",
    "42": "Penyiaran",
    "43": "Periklanan",
    "44": "Ilmu Komunikasi",
    "63": "Akuntansi",
    "64": "Manajemen",
    "72": "Manajemen",
}

_PROGRAM_CAMPUS_SUFFIX_RE = re.compile(r"\s+Kampus\b.*$", re.IGNORECASE)
_INFERRED_SEEN_MAX = 2048
_inferred_seen: OrderedDict[tuple[int, str, str], None] = OrderedDict()


def normalize_program(value: str | None) -> str | None:
    """Normalisasi nama prodi dengan membuang akhiran 'Kampus Kota ...' agar PSDKU & utama menyatu."""
    normalized = " ".join((value or "").split())[:80]
    if not normalized:
        return None
    stripped = _PROGRAM_CAMPUS_SUFFIX_RE.sub("", normalized).strip()
    return stripped[:80] or normalized


def program_from_nim(nim: str | None) -> str | None:
    """Turunkan program studi dasar dari 2 digit pertama NIM UBSI 8+ digit."""
    raw = (nim or "").strip()
    if len(raw) < 8 or not raw.isdigit():
        return None
    return NIM_PROGRAM_NAMES.get(raw[:2])


def _remember_inferred(client: Any, day: str, user_id: str) -> bool:
    """Catat bahwa client+day+user_id sudah diproses; True jika baru pertama kali."""
    key = (id(client), day, user_id)
    if key in _inferred_seen:
        _inferred_seen.move_to_end(key)
        return False
    _inferred_seen[key] = None
    if len(_inferred_seen) > _INFERRED_SEEN_MAX:
        _inferred_seen.popitem(last=False)
    return True


def _day(offset: int = 0) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=offset)).isoformat()


@functools.lru_cache(maxsize=4)
def _digest_key(secret: str) -> bytes:
    return hashlib.sha256(secret.encode()).digest()


def _identity(value: str) -> str:
    return hmac.new(_digest_key(settings.API_KEY), value.encode(), hashlib.sha256).hexdigest()


async def _set_user_program(
    client: Any,
    day: str,
    user_id: str,
    program_name: str,
    *,
    authoritative: bool,
) -> None:
    """Catat prodi pengguna pada set harian & permanen tanpa double-count saat naik dari NIM fallback."""
    hget = getattr(client, "hget", None)
    hset = getattr(client, "hset", None)
    srem = getattr(client, "srem", None)
    user_prog_key = f"{_PREFIX}user:program"
    auth_hash_key = f"{_PREFIX}user:program_auth"

    previous: str | None = None
    prev_auth: bool = False
    if hget is not None:
        raw_prev = await hget(user_prog_key, user_id)
        if isinstance(raw_prev, str) and raw_prev:
            previous = raw_prev
        raw_auth = await hget(auth_hash_key, user_id)
        prev_auth = raw_auth == "1"

    if not authoritative and (previous or prev_auth):
        # Jangan menimpa prodi yang sudah ada dengan tebakan awalan NIM.
        return

    if authoritative and previous and previous != program_name and srem is not None:
        await srem(f"{_PREFIX}program:{previous}:{day}", user_id)
        await srem(f"{_PREFIX}program:all:{previous}", user_id)

    key = f"{_PREFIX}program:{program_name}:{day}"
    await client.sadd(key, user_id)
    await client.expire(key, _RETENTION_SECONDS)
    await client.sadd(f"{_PREFIX}program:all:{program_name}", user_id)

    if hset is not None:
        await hset(user_prog_key, user_id, program_name)
        if authoritative:
            await hset(auth_hash_key, user_id, "1")


async def record_request(module: str, nim: str | None = None) -> None:
    safe_module = module if module in _ALLOWED_STAT_MODULES else "other"
    day = _day()
    try:
        client = await cache.get_client()
        request_key = f"{_PREFIX}requests:{day}"
        await client.incr(request_key)
        await client.expire(request_key, _RETENTION_SECONDS)
        module_key = f"{_PREFIX}requests:{safe_module}:{day}"
        await client.incr(module_key)
        await client.expire(module_key, _RETENTION_SECONDS)
        # Counter all-time permanen (tanpa expire): untuk total kumulatif publik.
        await client.incr(f"{_PREFIX}requests:all")
        if nim:
            user_id = _identity(nim)
            user_key = f"{_PREFIX}users:{day}"
            await client.sadd(user_key, user_id)
            await client.expire(user_key, _RETENTION_SECONDS)
            # Set unik all-time permanen (isi HMAC, bukan NIM mentah).
            await client.sadd(f"{_PREFIX}users:all", user_id)
            await client.zadd(f"{_PREFIX}online", {user_id: time.time()})
            inferred = program_from_nim(nim)
            if inferred and _remember_inferred(client, day, user_id):
                await _set_user_program(client, day, user_id, inferred, authoritative=False)
    except Exception:
        pass


async def record_profile(
    nim: str,
    branch: str | None,
    program: str | None,
    *,
    authoritative_program: bool = True,
) -> None:
    day = _day()
    try:
        client = await cache.get_client()
        user_id = _identity(nim)
        norm_branch = branch_display(" ".join((branch or "").split())[:80])
        if norm_branch:
            bkey = f"{_PREFIX}branch:{norm_branch}:{day}"
            await client.sadd(bkey, user_id)
            await client.expire(bkey, _RETENTION_SECONDS)
            # Set permanen per cabang (tanpa expire) agar total_all_time tidak ikut kedaluwarsa.
            await client.sadd(f"{_PREFIX}branch:all:{norm_branch}", user_id)

        norm_program = normalize_program(program)
        if norm_program:
            await _set_user_program(
                client,
                day,
                user_id,
                norm_program,
                authoritative=authoritative_program,
            )
    except Exception:
        pass


async def _collect_dimension_stats(
    client: Any,
    dimension: str,
    valid_30d_days: set[str],
    normalizer: Callable[[str], str | None],
) -> list[dict[str, Any]]:
    """Kumpulkan statistik aktif 30 hari & kumulatif all-time dengan normalisasi + backfill."""
    keys = await _iter_keys(client, f"{_PREFIX}{dimension}:*:*")
    grouped_30d: dict[str, set[str]] = {}
    retained: dict[str, set[str]] = {}
    perm_members: dict[str, set[str]] = {}
    all_time: dict[str, set[str]] = {}

    for key in keys:
        parts = key.split(":")
        if len(parts) < 5:
            continue
        if parts[3] == "all":
            raw_name = ":".join(parts[4:])
            name = normalizer(raw_name) or raw_name
            members = set(await client.smembers(key))
            perm_members.setdefault(name, set()).update(members)
            all_time.setdefault(name, set()).update(members)
            continue

        raw_name = ":".join(parts[3:-1])
        name = normalizer(raw_name) or raw_name
        members = set(await client.smembers(key))
        retained.setdefault(name, set()).update(members)
        all_time.setdefault(name, set()).update(members)
        if parts[-1] in valid_30d_days:
            grouped_30d.setdefault(name, set()).update(members)

    sadd = getattr(client, "sadd", None)
    if sadd is not None:
        for name, ids in retained.items():
            missing = ids - perm_members.get(name, set())
            if missing:
                await sadd(f"{_PREFIX}{dimension}:all:{name}", *missing)

    items = [
        {
            "name": name,
            "active_users_30d": len(grouped_30d.get(name, set())),
            "total_all_time": max(len(grouped_30d.get(name, set())), len(all_ids)),
        }
        for name, all_ids in all_time.items()
        if all_ids or grouped_30d.get(name)
    ]
    items.sort(
        key=lambda item: (item["active_users_30d"], item["total_all_time"]),
        reverse=True,
    )
    return items


async def _sum_requests(client: Any, days: int) -> int:
    total = 0
    for offset in range(days):
        value = await client.get(f"{_PREFIX}requests:{_day(offset)}")
        total += int(value or 0)
    return total


async def _iter_keys(client: Any, pattern: str) -> list[str]:
    # SCAN non-blocking: KEYS O(N) memblokir event loop Redis di traffic tinggi.
    scan = getattr(client, "scan_iter", None)
    if scan is not None:
        return [key async for key in scan(match=pattern)]
    return sorted(await client.keys(pattern))  # fallback FakeRedis test suite


async def get_public_stats() -> dict[str, Any]:
    try:
        client = await cache.get_client()

        # 1. Hari aktif riil dari key tanggal yang masih tersimpan (retensi 35 hari).
        all_req_keys = await _iter_keys(client, f"{_PREFIX}requests:20*")
        req_vals = [int(await client.get(k) or 0) for k in all_req_keys]
        active_days = max(1, len([v for v in req_vals if v > 0]))

        all_user_keys = await _iter_keys(client, f"{_PREFIX}users:20*")
        daily_user_counts = [await client.scard(k) for k in all_user_keys]

        # Total all-time memakai counter permanen agar tidak turun saat key harian kedaluwarsa.
        # Counter dinaikkan ke jumlah harian bila tertinggal (data sebelum counter permanen ada).
        all_requests_key = f"{_PREFIX}requests:all"
        total_requests_all = int(await client.get(all_requests_key) or 0)
        retained_requests = sum(req_vals)
        if retained_requests > total_requests_all:
            await client.incrby(all_requests_key, retained_requests - total_requests_all)
            total_requests_all = retained_requests

        all_users_key = f"{_PREFIX}users:all"
        if all_user_keys:
            await client.sunionstore(all_users_key, [all_users_key, *all_user_keys])
        total_users_all = await client.scard(all_users_key)

        online_key = f"{_PREFIX}online"
        await client.zremrangebyscore(online_key, 0, time.time() - _ONLINE_WINDOW_SECONDS)
        online_now = await client.zcard(online_key)

        # 2. Pengguna (rolling window + rata-rata harian riil + total unik all-time)
        users: dict[str, Any] = {}
        for label, days in (("active_24h", 1), ("active_7d", 7), ("active_30d", 30)):
            keys = [f"{_PREFIX}users:{_day(offset)}" for offset in range(days)]
            members = await client.sunion(keys) if keys else set()
            users[label] = len(members)
        users["average_per_day"] = round(sum(daily_user_counts) / active_days)
        users["total_all_time"] = total_users_all
        users["online_now"] = online_now

        # 3. Request (rolling window + rata-rata harian riil + total all-time)
        requests_data = {
            "total_24h": await _sum_requests(client, 1),
            "total_7d": await _sum_requests(client, 7),
            "total_30d": await _sum_requests(client, 30),
            "average_per_day": round(total_requests_all / active_days),
            "total_all_time": total_requests_all,
        }

        valid_30d_days = {_day(offset) for offset in range(30)}
        branches = await _collect_dimension_stats(
            client,
            "branch",
            valid_30d_days,
            lambda raw: branch_display(raw) or raw,
        )
        programs = await _collect_dimension_stats(
            client,
            "program",
            valid_30d_days,
            lambda raw: normalize_program(raw) or raw,
        )

        return {
            "service": "Mira API",
            "status": "operational",
            "period": "rolling_30_days",
            "users": users,
            "requests": requests_data,
            "branches": branches,
            "programs": programs,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        return {"service": "Mira API", "status": "operational", "users": {}, "requests": {}, "branches": [], "programs": []}
