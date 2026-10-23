"""Notifikasi waktu-nyata untuk mahasiswa: kelas segera mulai, kelas dimulai, dan pengingat absen berulang.

Berjalan tiap menit (REALTIME_NOTIFY_INTERVAL). Hanya mahasiswa yang memilih kategori
`kelas-mulai` atau `absen-kuliah` (lewat webhook channel atau push PWA) yang diproses.

- Jadwal kuliah diambil dari SIAKAD sekali lalu di-cache di Redis, jadi pengecekan per menit murah.
- MyBest baru dibuka saat ada kelas yang sedang berlangsung dan hanya sesekali (lihat ABSEN_*),
  supaya tidak membebani server kampus.
- Setiap notifikasi punya kunci dedupe di Redis, jadi tidak terkirim dobel walau worker restart.
"""
import asyncio
import json
import logging
import re
import time
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from app.config import settings

logger = logging.getLogger("app.notifier")

WIB = ZoneInfo("Asia/Jakarta")
DAY_NAMES = ("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")

CATEGORY_CLASS = "kelas-mulai"
CATEGORY_ABSEN = "absen-kuliah"

CLASS_SOON_MINUTES = 15  # "segera mulai" dikirim saat kelas tinggal <= 15 menit
CLASS_NOW_WINDOW = 15  # "dimulai sekarang" dikirim dalam 15 menit pertama kelas

ABSEN_FIRST_CHECK_DELAY = 0  # cek presensi sejak kelas mulai
ABSEN_RECHECK_SECONDS = 180  # sesi absen belum dibuka dosen: cek lagi tiap 3 menit
ABSEN_REPEAT_SECONDS = 600  # sudah dikirim tapi belum absen: ingatkan lagi tiap 10 menit
ABSEN_MAX_REMINDERS = 4

SCHEDULE_CACHE_SECONDS = 6 * 3600
_TIME_RE = re.compile(r"(\d{1,2})[:.](\d{2})")


def parse_time_range(jam: Any) -> Optional[tuple[int, int]]:
    """'07:30 - 10:00' atau '07.30-10.00' -> (450, 600) menit sejak tengah malam."""
    times = [int(h) * 60 + int(m) for h, m in _TIME_RE.findall(str(jam or ""))]
    if len(times) < 2:
        return None
    start, end = times[0], times[1]
    if end <= start:  # data aneh, mis. lintas tengah malam: anggap durasi 2 jam
        end = start + 120
    return start, end


def _now_wib(now: Optional[datetime] = None) -> datetime:
    current = now or datetime.now(WIB)
    if current.tzinfo is None:
        return current.replace(tzinfo=WIB)
    return current.astimezone(WIB)


def today_classes(schedule: list[dict[str, Any]], now: Optional[datetime] = None) -> list[dict[str, Any]]:
    """Kelas hari ini (WIB) lengkap dengan start/end dalam menit, urut jam mulai."""
    current = _now_wib(now)
    today = DAY_NAMES[current.weekday()].lower()
    items: list[dict[str, Any]] = []
    for course in schedule:
        if str(course.get("hari", "")).strip().lower() != today:
            continue
        window = parse_time_range(course.get("jam"))
        if not window:
            continue
        items.append({**course, "start": window[0], "end": window[1]})
    return sorted(items, key=lambda c: c["start"])


def class_alerts_due(
    schedule: list[dict[str, Any]], now: Optional[datetime] = None
) -> list[tuple[dict[str, Any], str, int]]:
    """Daftar (kelas, tahap, menit) yang perlu diberi tahu sekarang.

    tahap 'soon': mulai dalam 1..CLASS_SOON_MINUTES menit. 'now': sudah mulai <= CLASS_NOW_WINDOW menit lalu
    dan belum selesai. Menit = sisa menit sampai mulai (soon) atau menit sejak mulai (now).
    """
    current = _now_wib(now)
    minute = current.hour * 60 + current.minute
    due: list[tuple[dict[str, Any], str, int]] = []
    for course in today_classes(schedule, current):
        until = course["start"] - minute
        since = minute - course["start"]
        if 0 < until <= CLASS_SOON_MINUTES:
            due.append((course, "soon", until))
        elif 0 <= since <= CLASS_NOW_WINDOW and minute < course["end"]:
            due.append((course, "now", since))
    return due


def active_classes(schedule: list[dict[str, Any]], now: Optional[datetime] = None) -> list[dict[str, Any]]:
    """Kelas yang sedang berlangsung (mulai <= sekarang < selesai)."""
    current = _now_wib(now)
    minute = current.hour * 60 + current.minute
    return [c for c in today_classes(schedule, current) if c["start"] <= minute < c["end"]]


def class_alert_text(course: dict[str, Any], stage: str, minutes: int) -> tuple[str, str]:
    nama = str(course.get("nama") or "Mata kuliah").strip()
    jam = str(course.get("jam") or "").strip()
    ruang = str(course.get("ruang") or "").strip()
    detail = " | ".join(part for part in (jam, f"Ruang {ruang}" if ruang and ruang != "-" else "") if part)
    if stage == "soon":
        return f"Kuliah {minutes} menit lagi: {nama}", detail or "Segera bersiap menuju kelas."
    return f"Kuliah dimulai sekarang: {nama}", detail or "Kelas sudah dimulai."


def absen_decision(state: Optional[dict[str, Any]], session_open: bool, now_ts: float) -> tuple[str, dict[str, Any]]:
    """Keputusan pengingat absen untuk satu kelas.

    Return (aksi, state_baru) dengan aksi: 'remind' | 'wait' | 'done'.
    - sesi terbuka & belum absen: ingatkan sekarang lalu tiap ABSEN_REPEAT_SECONDS, maksimal ABSEN_MAX_REMINDERS.
    - sesi tidak terbuka setelah pernah diingatkan: mahasiswa sudah absen (atau sesi ditutup) -> selesai.
    - sesi belum pernah terbuka: cek lagi tiap ABSEN_RECHECK_SECONDS sampai kelas usai.
    """
    state = dict(state or {})
    if state.get("done"):
        return "done", state
    sent = int(state.get("sent", 0))
    if session_open:
        if sent >= ABSEN_MAX_REMINDERS:
            state["done"] = True
            return "done", state
        state["sent"] = sent + 1
        state["next"] = now_ts + ABSEN_REPEAT_SECONDS
        return "remind", state
    if sent > 0:
        state["done"] = True
        return "done", state
    state["next"] = now_ts + ABSEN_RECHECK_SECONDS
    return "wait", state


async def deliver(
    nim: str,
    category: str,
    title: str,
    body: str,
    link: str,
    *,
    tag: Optional[str] = None,
    ttl: int = 3600,
    channels: Optional[list[dict[str, Any]]] = None,
) -> int:
    """Kirim satu notifikasi ke semua tujuan NIM: webhook channel (kategori cocok) + push PWA."""
    from app.channels_db import list_active_by_category
    from app.modules.news import _dispatch_user_channel
    from app.pwa_push_db import list_categories
    from app.pwa_webpush import dispatch_pwa_to_nim

    if channels is None:
        channels = [c for c in await list_active_by_category(category) if str(c["nim"]) == nim]
    payload = {"category": category, "title": title, "description": body, "link": link}

    sent = 0
    if channels:
        results = await asyncio.gather(*(_dispatch_user_channel(c, payload) for c in channels), return_exceptions=True)
        sent += sum(1 for r in results if r is True)

    try:
        if category in await list_categories(nim):
            sent += await dispatch_pwa_to_nim(
                nim, {"title": title, "body": body[:200], "url": link, "tag": tag or category}, ttl=ttl
            )
    except Exception:
        logger.exception("PWA push gagal untuk NIM %s kategori %s", nim, category)
    return sent


async def _redis():
    from app.cache import cache

    return await cache.get_client()


async def _claim(key: str, ttl: int) -> bool:
    """Klaim atomik: True hanya untuk pemanggil pertama (dedupe lintas worker/restart)."""
    redis = await _redis()
    return bool(await redis.set(key, "1", nx=True, ex=ttl))


async def _release(key: str) -> None:
    redis = await _redis()
    await redis.delete(key)


async def get_schedule(nim: str, student_password: str) -> list[dict[str, Any]]:
    """Jadwal kuliah SIAKAD, di-cache beberapa jam per NIM."""
    from app.modules.studentv2 import parse_schedule, studentv2_client

    redis = await _redis()
    key = f"ubsi:notify:schedule:{nim}"
    cached = await redis.get(key)
    if cached:
        try:
            return json.loads(cached)
        except (TypeError, ValueError):
            pass
    raw = await studentv2_client.fetch_page("/mahasiswa/jadwal-kuliah", nim, student_password)
    schedule = parse_schedule(raw)
    await redis.set(key, json.dumps(schedule), ex=SCHEDULE_CACHE_SECONDS)
    return schedule


async def _credentials(nim: str) -> Optional[tuple[str, str, str]]:
    from app.session_store import session_store

    credentials = await session_store.get_credentials_for_nim(nim)
    if not credentials:
        from app.api_keys_db import get_credentials_for_nim

        credentials = await get_credentials_for_nim(nim)
    return credentials


async def _send_class_alerts(nim: str, schedule: list[dict[str, Any]], current: datetime) -> int:
    sent = 0
    date_key = current.date().isoformat()
    for course, stage, minutes in class_alerts_due(schedule, current):
        key = f"ubsi:notify:class:{nim}:{date_key}:{course.get('kode')}:{course.get('jam')}:{stage}"
        if not await _claim(key, 129600):
            continue
        title, body = class_alert_text(course, stage, minutes)
        try:
            delivered = await deliver(
                nim, CATEGORY_CLASS, title, body, "https://ubsi-api.muaraai.com/dashboard/jadwal",
                tag=f"kelas-{course.get('kode')}", ttl=600,
            )
        except Exception:
            await _release(key)  # claim jangan nyangkut 36 jam karena error tak terduga
            raise
        if delivered:
            sent += 1
        else:
            await _release(key)  # belum ada yang terkirim: coba lagi di menit berikutnya
    return sent


async def _send_absen_reminders(
    nim: str, schedule: list[dict[str, Any]], elearning_password: str, current: datetime
) -> int:
    from app.modules.elearning import parse_courses, pooled_elearning_client

    live = active_classes(schedule, current)
    if not live:
        return 0

    redis = await _redis()
    date_key = current.date().isoformat()
    now_ts = time.time()
    pending: list[tuple[dict[str, Any], str, dict[str, Any]]] = []
    for course in live:
        key = f"ubsi:notify:absen:{nim}:{date_key}:{course.get('kode')}:{course.get('jam')}"
        raw = await redis.get(key)
        state = json.loads(raw) if raw else {}
        if state.get("done") or float(state.get("next", 0)) > now_ts:
            continue
        pending.append((course, key, state))
    if not pending:
        return 0

    raw_courses = await pooled_elearning_client.fetch_page("/sch", nim, elearning_password)
    mybest = parse_courses(raw_courses)
    by_kode = {str(c.get("kode", "")).strip(): c for c in mybest if c.get("kode")}
    by_name = {str(c.get("nama", "")).strip().lower(): c for c in mybest}

    sent = 0
    for course, key, state in pending:
        sent += await _absen_process_course(
            nim, course, key, state, elearning_password, now_ts, by_kode, by_name
        )
    return sent


async def _absen_process_course(
    nim: str, course: dict[str, Any], key: str, state: dict[str, Any],
    elearning_password: str, now_ts: float,
    by_kode: dict[str, dict[str, Any]], by_name: dict[str, dict[str, Any]],
) -> int:
    from app.modules.elearning import (
        _record_date,
        extract_clean_token,
        inspect_session_status,
        parse_courses,
        parse_presence_rekap,
        pooled_elearning_client,
    )

    redis = await _redis()
    sent_flag = 0
    match = by_kode.get(str(course.get("kode", "")).strip()) or by_name.get(str(course.get("nama", "")).strip().lower())
    token = match.get("token_absen") if match else None
    if not token:
        # Tidak ada token absen: tetap tulis state agar tidak fetch MyBest tiap menit
        await redis.set(key, json.dumps({**state, "next": now_ts + ABSEN_RECHECK_SECONDS}), ex=86400)
        return 0
    html = await pooled_elearning_client.fetch_page(f"/absen-mhs/{token}", nim, elearning_password)
    session_open = bool(inspect_session_status(html).get("can_submit"))
    if session_open:
        # Form absen/komentar bisa tetap terrender WALAU user sudah absen ->
        # jangan percaya can_submit mentah. Cek rekap AJAX: ada baris hadir
        # bertanggal hari ini = sudah absen, hentikan pengingat permanen.
        m_rekap = re.findall(r"rekap-side/([^\"'\s]+)", html)
        if m_rekap:
            rekap_tok = extract_clean_token(m_rekap[0])
            raw_rekap = await pooled_elearning_client.fetch_page(
                f"/rekap-side/{rekap_tok}", nim, elearning_password
            )
            today = datetime.fromtimestamp(now_ts, WIB).date()
            for record in parse_presence_rekap(raw_rekap):
                status_absen = (record.get("status_absen") or "").lower()
                if (
                    _record_date(record.get("tanggal", "")) == (today.year, today.month, today.day)
                    and "hadir" in status_absen
                    and "tidak" not in status_absen
                ):
                    # Sudah absen: tandai selesai, jangan ganggu lagi hari ini.
                    await redis.set(key, json.dumps({**state, "done": True}), ex=86400)
                    return 0
    action, new_state = absen_decision(state, session_open, now_ts)
    if action == "remind":
        nama = str(course.get("nama") or "Kuliah").strip()
        count = int(new_state.get("sent", 1))
        title = f"Belum absen: {nama}" if count > 1 else f"Absen sudah dibuka: {nama}"
        body = "Kamu belum presensi. Segera absen sebelum sesi ditutup." if count > 1 else "Sesi presensi dibuka di MyBest. Tekan untuk absen sekarang."
        link = "https://ubsi-api.muaraai.com/dashboard/presensi?" + _query({"kode": course.get("kode", ""), "mk": nama})
        delivered = await deliver(nim, CATEGORY_ABSEN, title, body, link, tag=f"absen-{course.get('kode')}", ttl=900)
        if not delivered:
            # Tak ada tujuan yang menerima: jangan hitung sebagai pengingat terkirim.
            new_state["sent"] = int(state.get("sent", 0))
        else:
            sent_flag = 1
    await redis.set(key, json.dumps(new_state), ex=86400)
    return sent_flag


def _query(params: dict[str, Any]) -> str:
    from urllib.parse import urlencode

    return urlencode({k: str(v) for k, v in params.items()})


async def process_nim(nim: str, want_class: bool, want_absen: bool, current: Optional[datetime] = None) -> int:
    credentials = await _credentials(nim)
    if not credentials:
        return 0
    _, student_password, elearning_password = credentials
    now = _now_wib(current)
    schedule = await get_schedule(nim, student_password)
    sent = 0
    if want_class:
        sent += await _send_class_alerts(nim, schedule, now)
    if want_absen:
        sent += await _send_absen_reminders(nim, schedule, elearning_password, now)
    return sent


async def collect_targets() -> dict[str, tuple[bool, bool]]:
    """NIM -> (ingin kelas-mulai, ingin absen-kuliah), dari webhook channel dan push PWA."""
    from app.channels_db import list_active_by_category
    from app.pwa_push_db import list_nims_with_category

    targets: dict[str, list[bool]] = {}
    for index, category in enumerate((CATEGORY_CLASS, CATEGORY_ABSEN)):
        nims = {str(c["nim"]) for c in await list_active_by_category(category)}
        try:
            nims |= {str(n) for n in await list_nims_with_category(category)}
        except Exception:
            logger.exception("Gagal membaca pelanggan push PWA untuk kategori %s", category)
        for nim in nims:
            targets.setdefault(nim, [False, False])[index] = True
    return {nim: (flags[0], flags[1]) for nim, flags in targets.items()}


async def run_realtime_cycle(current: Optional[datetime] = None) -> int:
    # Leader lock: produksi jalan --workers 2, cukup satu worker per siklus (anti dobel push/scrape)
    interval = max(30, int(getattr(settings, "REALTIME_NOTIFY_INTERVAL", 60)))
    cycle = int(time.time()) // interval
    if not await _claim(f"ubsi:worker:realtime:{cycle}", interval * 2):
        return 0
    targets = await collect_targets()
    if not targets:
        return 0
    semaphore = asyncio.Semaphore(5)

    async def one(nim: str, flags: tuple[bool, bool]) -> int:
        async with semaphore:
            try:
                return await asyncio.wait_for(process_nim(nim, flags[0], flags[1], current), timeout=60)
            except Exception:
                logger.exception("Notifikasi realtime gagal untuk NIM %s", nim)
                return 0

    results = await asyncio.gather(*(one(nim, flags) for nim, flags in targets.items()))
    return sum(results)


async def realtime_notification_worker() -> None:
    interval = max(30, int(getattr(settings, "REALTIME_NOTIFY_INTERVAL", 60)))
    while True:
        try:
            await run_realtime_cycle()
        except Exception:
            logger.exception("Realtime notification cycle failed")
        await asyncio.sleep(interval)
