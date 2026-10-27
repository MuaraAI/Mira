"""Peta mengajar dosen yang dikumpulkan kolektif dan anonim dari jadwal MyBest pengguna Mira.

Direktori SIAKAD hanya berisi kode + nama dosen. Setiap kali jadwal seorang mahasiswa diambil dari
MyBest, kelas-kelasnya (kode dosen, mapel, kelas, hari, jam, ruang) dicatat di sini sehingga profil
dosen bisa menampilkan semua kelas yang diampu dan apa yang sedang diajar sekarang.

Privasi: TIDAK ada NIM, nama mahasiswa, atau token yang disimpan; hanya jadwal mengajar yang memang
tercantum di kartu jadwal kelas. Baris yang tidak terlihat lagi > 45 hari (ganti semester) diabaikan.
"""
import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from starlette.concurrency import run_in_threadpool

from app.config import settings

STALE_DAYS = 45
_DAYS = {"senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"}
_KODE_RE = re.compile(r"^[A-Z0-9]{2,8}$")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS teaching_sessions (
    kode_dosen TEXT NOT NULL,
    kode_mtk TEXT NOT NULL,
    nama_mtk TEXT NOT NULL,
    kelas TEXT NOT NULL DEFAULT '',
    hari TEXT NOT NULL,
    jam TEXT NOT NULL DEFAULT '',
    ruang TEXT NOT NULL DEFAULT '',
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    PRIMARY KEY (kode_dosen, kode_mtk, kelas, hari, jam)
);
CREATE INDEX IF NOT EXISTS idx_teaching_dosen ON teaching_sessions(kode_dosen, last_seen);
"""


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_teaching_db() -> None:
    db_dir = os.path.dirname(settings.SQLITE_DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = _connect()
    try:
        conn.executescript(_SCHEMA)
        conn.commit()
    finally:
        conn.close()


def _rows(courses: Iterable[dict[str, Any]]) -> list[tuple]:
    rows = []
    for c in courses:
        kode = str(c.get("kode_dosen") or "").strip().upper()
        hari = str(c.get("hari") or "").strip()
        nama = str(c.get("nama") or "").strip()
        if not _KODE_RE.match(kode) or hari.lower() not in _DAYS or not nama:
            continue
        rows.append((
            kode,
            str(c.get("kode") or "").strip(),
            nama,
            str(c.get("kelas") or c.get("kode_gabung") or "").strip(),
            hari,
            str(c.get("jam") or "").strip(),
            str(c.get("ruang") or "").strip(),
        ))
    return rows


def record_courses(courses: Iterable[dict[str, Any]]) -> int:
    """Catat kelas dari satu jadwal MyBest (sinkron, cepat: beberapa baris)."""
    rows = _rows(courses)
    if not rows:
        return 0
    now = _now()
    conn = _connect()
    try:
        conn.executemany(
            "INSERT INTO teaching_sessions (kode_dosen, kode_mtk, nama_mtk, kelas, hari, jam, ruang, first_seen, last_seen) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(kode_dosen, kode_mtk, kelas, hari, jam) DO UPDATE SET "
            "nama_mtk = excluded.nama_mtk, ruang = excluded.ruang, last_seen = excluded.last_seen",
            [(*r, now, now) for r in rows],
        )
        conn.commit()
        return len(rows)
    finally:
        conn.close()


def _sessions_sync(kode_dosen: str) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc) - timedelta(days=STALE_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT kode_mtk, nama_mtk, kelas, hari, jam, ruang, last_seen FROM teaching_sessions "
            "WHERE kode_dosen = ? AND last_seen >= ? ORDER BY hari, jam",
            (kode_dosen.strip().upper(), since),
        ).fetchall()
        return [
            {
                "kode_mtk": r["kode_mtk"],
                "nama": r["nama_mtk"],
                "kelas": r["kelas"],
                "hari": r["hari"],
                "jam": r["jam"],
                "ruang": r["ruang"],
                "last_seen": r["last_seen"],
            }
            for r in rows
        ]
    finally:
        conn.close()


async def lecturer_sessions(kode_dosen: str) -> list[dict[str, Any]]:
    return await run_in_threadpool(_sessions_sync, kode_dosen)
