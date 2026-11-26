#!/usr/bin/env python3
"""Backfill & deduplikasi statistik cabang/prodi (/v1/stats) secara aman & anonim.

Mode bawaan adalah dry-run (tanpa modifikasi Redis maupun permintaan ke kampus).
Gunakan ``--apply`` untuk menormalisasi/mendeduplikasi key Redis, memulihkan dari
cache yang ada, dan melengkapi atribut cabang/prodi akun berkredensial aktif.

Tidak pernah mencetak NIM, nama, email, atau password ke stdout/stderr.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable, Optional

from scrapling.parser import Adaptor

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app import api_keys_db  # noqa: E402
from app.account_links import get_link_secret  # noqa: E402
from app.cache import cache  # noqa: E402
from app.config import settings  # noqa: E402
from app.modules.elearning import (  # noqa: E402
    _extract_absen_profile_fields,
    _first_absen_token,
    extract_branch_from_courses,
    extract_branch_from_kelas,
    parse_courses,
    pooled_elearning_client,
)
from app.modules.studentv2 import branch_display, parse_profile, studentv2_client  # noqa: E402
from app.session_store import session_store  # noqa: E402
from app.stats import (  # noqa: E402
    _PREFIX,
    _RETENTION_SECONDS,
    _day,
    _identity,
    get_public_stats,
    normalize_program,
    record_profile,
)

_DIMENSIONS: tuple[tuple[str, Callable[[str], Optional[str]]], ...] = (
    ("branch", lambda raw: branch_display(raw) or None),
    ("program", lambda raw: normalize_program(raw) or None),
)


def _norm_for(normalizer: Callable[[str], Optional[str]], raw: str) -> str:
    cleaned = " ".join((raw or "").split())[:80]
    return (normalizer(cleaned) if cleaned else None) or cleaned


def _collect_known_nims_sync(db_path: str) -> tuple[set[str], set[str], set[str]]:
    """Ambil himpunan NIM unik dari SQLite tanpa mengekspos PII."""
    known: set[str] = set()
    ak_active: set[str] = set()
    al_linked: set[str] = set()
    if not Path(db_path).exists():
        return known, ak_active, al_linked

    conn = sqlite3.connect(db_path)
    try:
        for query in (
            "SELECT DISTINCT nim FROM account_links",
            "SELECT DISTINCT nim FROM api_keys",
            "SELECT DISTINCT nim FROM webhook_channels",
            "SELECT DISTINCT nim FROM pwa_push_subscriptions",
            "SELECT DISTINCT nim FROM account_devices",
        ):
            try:
                known |= {str(r[0]) for r in conn.execute(query) if r[0]}
            except sqlite3.Error:
                pass
        try:
            ak_active = {
                str(r[0]) for r in conn.execute("SELECT DISTINCT nim FROM api_keys WHERE is_active = 1") if r[0]
            }
        except sqlite3.Error:
            pass
        try:
            al_linked = {
                str(r[0])
                for r in conn.execute(
                    "SELECT DISTINCT nim FROM account_links WHERE provider = 'siakad' AND status = 'linked'"
                )
                if r[0]
            }
        except sqlite3.Error:
            pass
    finally:
        conn.close()
    return known, ak_active, al_linked


async def _collect_known_nims_and_creds(
    client: Any,
) -> tuple[set[str], dict[str, tuple[str, str]]]:
    """Kumpulkan seluruh NIM dikenal dan pasangan (elearning_pass, siakad_pass) aktif."""
    known, ak_active, al_linked = _collect_known_nims_sync(settings.SQLITE_DB_PATH)
    creds_map: dict[str, list[str]] = defaultdict(lambda: ["", ""])

    sess_nims: set[str] = set()
    async for key in client.scan_iter("ubsi:session_index:*"):
        nim = key.split(":")[-1]
        if nim.isdigit() and await client.scard(key) > 0:
            sess_nims.add(nim)
    known |= sess_nims

    for pat in ("ubsi:campus_sess:*", "ubsi:devnotif:*"):
        async for key in client.scan_iter(pat):
            for part in key.split(":"):
                if part.isdigit() and len(part) >= 8:
                    known.add(part)

    try:
        from app.social.db import connect as social_connect

        sc = social_connect()
        try:
            for row in sc.execute("SELECT nim FROM social_profiles").fetchall():
                if row and row["nim"]:
                    known.add(str(row["nim"]))
        finally:
            sc.close()
    except Exception:
        pass

    for nim in sess_nims:
        resolved = await session_store.get_credentials_for_nim(nim)
        if resolved:
            _, sv_pass, el_pass = resolved
            if el_pass:
                creds_map[nim][0] = el_pass
            if sv_pass:
                creds_map[nim][1] = sv_pass

    for nim in ak_active:
        if creds_map[nim][0] and creds_map[nim][1]:
            continue
        resolved = await api_keys_db.get_credentials_for_nim(nim)
        if resolved:
            _, sv_pass, el_pass = resolved
            if not creds_map[nim][0] and el_pass:
                creds_map[nim][0] = el_pass
            if not creds_map[nim][1] and sv_pass:
                creds_map[nim][1] = sv_pass

    if settings.SIAKAD_ENABLED:
        for nim in al_linked:
            if not creds_map[nim][1]:
                sv_secret = await get_link_secret(nim, "siakad")
                if sv_secret:
                    creds_map[nim][1] = sv_secret

    active_creds = {
        nim: (pair[0], pair[1]) for nim, pair in creds_map.items() if pair[0] or pair[1]
    }
    return known, active_creds


async def _scan_dimension_state(
    client: Any,
    dimension: str,
    normalizer: Callable[[str], Optional[str]],
) -> dict[str, Any]:
    buckets: dict[str, set[str]] = defaultdict(set)
    key_buckets: list[tuple[str, str, set[str]]] = []
    daily_latest: dict[str, tuple[str, str]] = {}

    async for key in client.scan_iter(f"{_PREFIX}{dimension}:*:*"):
        parts = key.split(":")
        if len(parts) < 5:
            continue
        members = set(await client.smembers(key))
        if not members:
            continue
        if parts[3] == "all":
            raw_name = ":".join(parts[4:])
            name = _norm_for(normalizer, raw_name)
            key_buckets.append((key, raw_name, name, "all", members))
            buckets[name] |= members
            continue
        day_str = parts[-1]
        raw_name = ":".join(parts[3:-1])
        name = _norm_for(normalizer, raw_name)
        key_buckets.append((key, raw_name, name, day_str, members))
        buckets[name] |= members
        for uid in members:
            prev = daily_latest.get(uid)
            if prev is None or day_str > prev[0]:
                daily_latest[uid] = (day_str, name)

    user_buckets: dict[str, set[str]] = defaultdict(set)
    for name, members in buckets.items():
        for uid in members:
            user_buckets[uid].add(name)

    raw_attr = await client.hgetall(f"{_PREFIX}user_attr:{dimension}")
    existing_attr = {
        uid: _norm_for(normalizer, val) for uid, val in raw_attr.items() if val and val.strip()
    }
    covered = set(user_buckets.keys()) | set(existing_attr.keys())
    multi_users = {uid for uid, bset in user_buckets.items() if len(bset) > 1}
    return {
        "buckets": buckets,
        "key_buckets": key_buckets,
        "daily_latest": daily_latest,
        "user_buckets": user_buckets,
        "existing_attr": existing_attr,
        "covered": covered,
        "multi_users": multi_users,
    }


async def _phase1_audit_and_dedup(
    client: Any,
    all_users: set[str],
    apply: bool,
) -> dict[str, dict[str, Any]]:
    states: dict[str, dict[str, Any]] = {}
    for dim, normalizer in _DIMENSIONS:
        state = await _scan_dimension_state(client, dim, normalizer)
        states[dim] = state
        miss = len(all_users - state["covered"])
        print(
            f"[Phase 1:{dim}] covered={len(state['covered'])}/{len(all_users)} "
            f"missing={miss} multi_bucket_users={len(state['multi_users'])}"
        )

        if not apply:
            continue

        attr_key = f"{_PREFIX}user_attr:{dim}"
        buckets = state["buckets"]
        daily_latest = state["daily_latest"]
        existing_attr = state["existing_attr"]

        deduped = 0
        backfilled_attr = 0
        for uid, bset in state["user_buckets"].items():
            if uid in existing_attr and len(bset) <= 1 and existing_attr[uid] in bset:
                canon = existing_attr[uid]
                await client.hset(attr_key, uid, canon)
                await client.sadd(f"{_PREFIX}{dim}:all:{canon}", uid)
                continue

            if uid in existing_attr and existing_attr[uid] in bset:
                canon = existing_attr[uid]
            elif uid in daily_latest:
                canon = daily_latest[uid][1]
            else:
                canon = max(bset, key=lambda name: (len(buckets[name]), name))

            await client.hset(attr_key, uid, canon)
            await client.sadd(f"{_PREFIX}{dim}:all:{canon}", uid)
            if uid not in existing_attr:
                backfilled_attr += 1
            if len(bset) > 1:
                deduped += 1
                for key, _raw_name, bname, _day_or_all, members in state["key_buckets"]:
                    if bname != canon and uid in members:
                        await client.srem(key, uid)
                        members.discard(uid)
                        buckets[bname].discard(uid)
                buckets[canon].add(uid)
                state["user_buckets"][uid] = {canon}
            state["existing_attr"][uid] = canon
            state["covered"].add(uid)

        migrated_keys = 0
        for key, raw_name, norm_name, day_or_all, members in state["key_buckets"]:
            if not norm_name or raw_name == norm_name or not members:
                continue
            target_key = (
                f"{_PREFIX}{dim}:all:{norm_name}"
                if day_or_all == "all"
                else f"{_PREFIX}{dim}:{norm_name}:{day_or_all}"
            )
            await client.sadd(target_key, *members)
            if day_or_all != "all":
                await client.expire(target_key, _RETENTION_SECONDS)
            await client.delete(key)
            migrated_keys += 1

        state["multi_users"] = {uid for uid, bs in state["user_buckets"].items() if len(bs) > 1}
        print(
            f"[Phase 1:{dim} applied] user_attr_added={backfilled_attr} "
            f"multi_deduped={deduped} raw_keys_migrated={migrated_keys}"
        )
    return states


async def _extract_from_existing_cache(nim: str) -> tuple[Optional[str], Optional[str]]:
    found_b: Optional[str] = None
    found_p: Optional[str] = None
    for mod, name in (
        ("studentv2", "profile-academic"),
        ("studentv2", "profile"),
        ("elearning", "courses-v3"),
        ("elearning", "courses-v2"),
        ("elearning", "courses"),
        ("elearning", "presence"),
    ):
        pair = await cache.fresh_or_stale(cache.make_key(mod, name, nim=nim))
        if not pair:
            continue
        data = pair[0]
        if mod == "studentv2" and isinstance(data, dict):
            found_b = found_b or branch_display(data.get("lokasi_cabang"))
            found_p = found_p or normalize_program(data.get("program_studi"))
        elif name.startswith("courses") and isinstance(data, list):
            found_b = found_b or extract_branch_from_courses(data)
        elif name == "presence" and isinstance(data, dict):
            found_b = found_b or extract_branch_from_kelas(data.get("kelas"))
            found_p = found_p or normalize_program(data.get("prodi"))
    return found_b, found_p


async def _fetch_live_for_account(
    nim: str,
    el_pass: str,
    sv_pass: str,
    need_branch: bool,
    need_program: bool,
) -> tuple[Optional[str], Optional[str], str]:
    branch: Optional[str] = None
    program: Optional[str] = None
    sources: list[str] = []

    if el_pass and (need_branch or need_program):
        try:
            sch_html = await pooled_elearning_client.fetch_page("/sch", nim, el_pass)
            courses = parse_courses(sch_html)
            branch = extract_branch_from_courses(courses)
            if branch:
                sources.append("mybest-sch")
            if need_program or not branch:
                token = _first_absen_token(courses)
                if token:
                    absen_html = await pooled_elearning_client.fetch_page(
                        f"/absen-mhs/{token}", nim, el_pass
                    )
                    kelas, prodi = _extract_absen_profile_fields(Adaptor(absen_html))
                    if not branch:
                        branch = extract_branch_from_kelas(kelas)
                    norm_prodi = normalize_program(prodi)
                    if norm_prodi:
                        program = norm_prodi
                        sources.append("mybest-absen")
        except Exception as exc:
            sources.append(f"mybest-err:{type(exc).__name__}")

    if sv_pass and settings.SIAKAD_ENABLED and ((need_branch and not branch) or (need_program and not program)):
        try:
            sv_html = await studentv2_client.fetch_page("/mahasiswa/data-pribadi", nim, sv_pass)
            prof = parse_profile(sv_html)
            if need_branch and not branch:
                branch = branch_display(prof.get("lokasi_cabang"))
            if need_program and not program:
                program = normalize_program(prof.get("program_studi"))
            if branch or program:
                sources.append("siakad")
        except Exception as exc:
            sources.append(f"siakad-err:{type(exc).__name__}")

    return branch, program, "+".join(sources) or "none"


async def run_backfill(args: argparse.Namespace) -> int:
    client = await cache.get_client()
    try:
        all_users = set(await client.smembers(f"{_PREFIX}users:all"))
        valid_30d_days = {_day(offset) for offset in range(30)}
        last_active_day: dict[str, str] = {}
        async for key in client.scan_iter(f"{_PREFIX}users:20*"):
            day_str = key.split(":")[-1]
            if day_str not in valid_30d_days:
                continue
            for uid in await client.smembers(key):
                prev = last_active_day.get(uid)
                if prev is None or day_str > prev:
                    last_active_day[uid] = day_str

        print(f"[Setup] total_all_time_users={len(all_users)} active_30d_days={len(last_active_day)}")
        states = await _phase1_audit_and_dedup(client, all_users, apply=args.apply)

        known_nims, active_creds = await _collect_known_nims_and_creds(client)
        miss_branch = all_users - states["branch"]["covered"]
        miss_prog = all_users - states["program"]["covered"]

        # Phase 2: zero-hit recovery dari cache Redis yang sudah ada
        cache_recovered = 0
        for nim in sorted(known_nims):
            uid = _identity(nim)
            if uid not in all_users:
                continue
            want_b = uid in miss_branch
            want_p = uid in miss_prog
            if not want_b and not want_p:
                continue
            found_b, found_p = await _extract_from_existing_cache(nim)
            rec_b = found_b if want_b else None
            rec_p = found_p if want_p else None
            if not rec_b and not rec_p:
                continue
            cache_recovered += 1
            if args.apply:
                last_day = last_active_day.get(uid)
                await record_profile(nim, rec_b, rec_p, day=last_day, record_daily=bool(last_day))
                if rec_b:
                    states["branch"]["covered"].add(uid)
                if rec_p:
                    states["program"]["covered"].add(uid)
        print(f"[Phase 2] zero_hit_cache_recovered={cache_recovered}")

        # Phase 3: gentle live campus fetch untuk akun aktif yang masih kosong
        miss_branch = all_users - states["branch"]["covered"]
        miss_prog = all_users - states["program"]["covered"]
        reverify_uids: set[str] = set()
        if args.reverify_branches:
            reverify_uids = {
                uid
                for uid, bname in states["branch"]["existing_attr"].items()
                if bname != "UBSI Pontianak"
            }

        targets: list[tuple[str, str, str, str, bool, bool]] = []
        expired_no_creds = 0
        for uid in sorted(miss_branch | miss_prog | states["branch"]["multi_users"] | reverify_uids):
            matching_nim = next((n for n in known_nims if _identity(n) == uid), None)
            if not matching_nim or matching_nim not in active_creds:
                if uid in (miss_branch | miss_prog | states["branch"]["multi_users"]):
                    expired_no_creds += 1
                continue
            el_pass, sv_pass = active_creds[matching_nim]
            targets.append(
                (
                    matching_nim,
                    uid,
                    el_pass,
                    sv_pass,
                    uid in miss_branch or uid in states["branch"]["multi_users"] or uid in reverify_uids,
                    uid in miss_prog,
                )
            )

        if args.limit > 0:
            targets = targets[: args.limit]

        el_eligible = sum(1 for t in targets if t[2])
        sv_eligible = sum(1 for t in targets if t[3])
        print(
            f"[Phase 3] miss_branch={len(miss_branch)} miss_program={len(miss_prog)} "
            f"reverify_branches={len(reverify_uids)} "
            f"eligible_live_fetch={len(targets)} (el={el_eligible}, sv={sv_eligible}) "
            f"no_active_creds={expired_no_creds}"
        )

        if args.apply and targets:
            fetched_ok = 0
            fetched_fail = 0
            total = len(targets)
            for idx, (nim, uid, el_pass, sv_pass, want_b, want_p) in enumerate(targets, start=1):
                if idx > 1 and args.delay > 0:
                    await asyncio.sleep(args.delay)
                branch, program, src = await _fetch_live_for_account(
                    nim, el_pass, sv_pass, need_branch=want_b, need_program=want_p
                )
                if branch or program:
                    last_day = last_active_day.get(uid)
                    await record_profile(
                        nim,
                        branch if want_b else None,
                        program if want_p else None,
                        day=last_day,
                        record_daily=bool(last_day),
                    )
                    fetched_ok += 1
                    print(f"[{idx}/{total}] ok branch={branch or '-'} program={program or '-'} src={src}")
                else:
                    fetched_fail += 1
                    print(f"[{idx}/{total}] miss branch=- program=- src={src}")
            print(f"[Phase 3 applied] ok={fetched_ok} miss_or_err={fetched_fail}")

        # Phase 4: invalidasi cache /v1/stats dan cetak ringkasan terbaru
        if args.apply:
            await client.delete("ubsi:stats:public:fresh", "ubsi:stats:public:lgg")
        summary = await get_public_stats()
        print(
            "[Phase 4] summary="
            + json.dumps(
                {
                    "apply": args.apply,
                    "users": summary.get("users"),
                    "branches": summary.get("branches"),
                    "programs": summary.get("programs"),
                    "updated_at": summary.get("updated_at"),
                },
                ensure_ascii=False,
            )
        )
        return 0
    finally:
        for obj in (pooled_elearning_client, studentv2_client, session_store):
            close_fn = getattr(obj, "close", None)
            if callable(close_fn):
                res = close_fn()
                if asyncio.iscoroutine(res):
                    await res
        aclose = getattr(client, "aclose", None)
        if callable(aclose):
            await aclose()


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill & deduplikasi statistik cabang/prodi Mira (/v1/stats)")
    parser.add_argument("--apply", action="store_true", help="Terapkan perubahan ke Redis dan ambil data akun aktif yang kosong")
    parser.add_argument("--reverify-branches", action="store_true", help="Verifikasi ulang cabang non-Pontianak dari MyBest/SIAKAD")
    parser.add_argument("--delay", type=float, default=1.5, help="Jeda antar permintaan akun ke portal kampus (detik, default: 1.5)")
    parser.add_argument("--limit", type=int, default=0, help="Batasi jumlah akun fetch live (0 = semua akun memenuhi syarat)")
    args = parser.parse_args()
    return asyncio.run(run_backfill(args))


if __name__ == "__main__":
    raise SystemExit(main())
