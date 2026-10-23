"""SQLite WAL store untuk PWA Web Push subscription per-NIM.

Data durable: kalau Redis restart, daftar HP mahasiswa tetap aman.
Operasi sinkron dijalankan lewat run_in_threadpool agar tidak memblokir
event loop FastAPI.
"""
import sqlite3
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.config import settings

_MAX_SUBSCRIPTIONS_PER_NIM = 10

_SCHEMA = """
CREATE TABLE IF NOT EXISTS pwa_push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nim TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pwa_push_nim ON pwa_push_subscriptions(nim);
CREATE INDEX IF NOT EXISTS idx_pwa_push_endpoint ON pwa_push_subscriptions(endpoint);
CREATE TABLE IF NOT EXISTS pwa_push_categories (
    nim TEXT NOT NULL,
    category TEXT NOT NULL,
    PRIMARY KEY (nim, category)
);
CREATE TABLE IF NOT EXISTS pwa_push_migrations (
    name TEXT PRIMARY KEY
);
"""

# Kategori yang ditambahkan setelah rilis awal: aktif otomatis untuk pelanggan lama (sekali saja).
_DEFAULT_ON_MIGRATIONS = {"kelas-mulai-default-on": "kelas-mulai"}

# Kategori PWA terikat akun (bukan per-device); default semua aktif saat subscribe.
from app.channel_validation import ALLOWED_CATEGORIES  # noqa: E402

DEFAULT_CATEGORIES: tuple[str, ...] = tuple(ALLOWED_CATEGORIES)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
    except Exception:
        pass
    return conn


def _init_db_sync() -> None:
    import os
    db_path = settings.SQLITE_DB_PATH
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = _connect()
    try:
        conn.executescript(_SCHEMA)
        for name, category in _DEFAULT_ON_MIGRATIONS.items():
            if conn.execute("SELECT 1 FROM pwa_push_migrations WHERE name = ?", (name,)).fetchone():
                continue
            conn.execute(
                "INSERT OR IGNORE INTO pwa_push_categories (nim, category) "
                "SELECT DISTINCT nim, ? FROM pwa_push_subscriptions",
                (category,),
            )
            conn.execute("INSERT OR IGNORE INTO pwa_push_migrations (name) VALUES (?)", (name,))
        conn.commit()
    finally:
        conn.close()


def init_pwa_db() -> None:
    _init_db_sync()


def _sync_add(nim: str, endpoint: str, p256dh: str, auth: str, device_name: str) -> int:
    conn = _connect()
    try:
        # Nonaktifkan endpoint lama dari NIM dan device_name yang sama
        # (anti notifikasi duplikat saat browser migrasi origin, misal ubsi-api.muaraai.com -> mira.muaraai.com)
        clean_device = device_name.strip() if device_name else ""
        if not clean_device:
            clean_device = "Browser"
        conn.execute(
            "UPDATE pwa_push_subscriptions SET is_active = 0 "
            "WHERE nim = ? AND device_name = ? COLLATE NOCASE AND endpoint != ?",
            (nim, clean_device, endpoint),
        )

        # Upsert atomik via ON CONFLICT: dua subscribe serentak tidak 500 IntegrityError.
        # Endpoint ikut pindah ke NIM terbaru (browser ganti akun dashboard).
        cursor = conn.execute(
            "INSERT INTO pwa_push_subscriptions (nim, endpoint, p256dh, auth, device_name) "
            "VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(endpoint) DO UPDATE SET nim = excluded.nim, p256dh = excluded.p256dh, "
            "auth = excluded.auth, device_name = excluded.device_name, is_active = 1, last_used_at = datetime('now')",
            (nim, endpoint, p256dh, auth, device_name),
        )
        new_id = int(cursor.lastrowid) if cursor.lastrowid is not None else 0

        # Seed kategori default HANYA untuk NIM yang belum punya preferensi sama sekali:
        # subscribe ulang tidak boleh menghidupkan kembali kategori yang dimatikan user.
        has_pref = conn.execute(
            "SELECT 1 FROM pwa_push_categories WHERE nim = ? LIMIT 1", (nim,)
        ).fetchone()
        if not has_pref:
            conn.executemany(
                "INSERT OR IGNORE INTO pwa_push_categories (nim, category) VALUES (?, ?)",
                [(nim, cat) for cat in DEFAULT_CATEGORIES],
            )

        # Kuota device: buang melebihi batas, terlama dulu (baris yang barusan di-upsert aman)
        stale = conn.execute(
            "SELECT id FROM pwa_push_subscriptions WHERE nim = ? AND is_active = 1 AND id != ? "
            "ORDER BY COALESCE(last_used_at, created_at) ASC LIMIT ?",
            (nim, new_id, max(0, _MAX_SUBSCRIPTIONS_PER_NIM - 1)),
        ).fetchall()
        active = conn.execute(
            "SELECT COUNT(*) AS c FROM pwa_push_subscriptions WHERE nim = ? AND is_active = 1",
            (nim,),
        ).fetchone()["c"]
        excess = int(active) - _MAX_SUBSCRIPTIONS_PER_NIM
        for row in stale[: max(0, excess)]:
            conn.execute("DELETE FROM pwa_push_subscriptions WHERE id = ?", (row["id"],))

        _cleanup_orphan_categories(conn)
        conn.commit()
        return new_id
    finally:
        conn.close()


def _cleanup_orphan_categories(conn: sqlite3.Connection) -> None:
    """Buang kategori milik NIM yang sudah tidak punya device (anti tabel tumbuh monoton)."""
    conn.execute(
        "DELETE FROM pwa_push_categories WHERE nim NOT IN (SELECT nim FROM pwa_push_subscriptions)"
    )


async def add_subscription(nim: str, endpoint: str, p256dh: str, auth: str, device_name: str) -> int:
    return await run_in_threadpool(_sync_add, nim, endpoint, p256dh, auth, device_name)


def _sync_list(nim: str, active_only: bool = False) -> list[dict[str, Any]]:
    conn = _connect()
    try:
        query = "SELECT id, nim, endpoint, device_name, is_active, created_at FROM pwa_push_subscriptions WHERE nim = ?"
        if active_only:
            query += " AND is_active = 1"
        query += " ORDER BY created_at DESC, id DESC"
        rows = conn.execute(query, (nim,)).fetchall()
        return [
            {
                "id": r["id"],
                "device_name": r["device_name"],
                "endpoint": r["endpoint"],
                "is_active": bool(r["is_active"]),
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


async def list_subscriptions(nim: str, active_only: bool = False) -> list[dict[str, Any]]:
    return await run_in_threadpool(_sync_list, nim, active_only)


def _sync_remove(nim: str, device_id: int) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute(
            "DELETE FROM pwa_push_subscriptions WHERE id = ? AND nim = ?",
            (device_id, nim),
        )
        _cleanup_orphan_categories(conn)
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


async def remove_subscription(nim: str, device_id: int) -> bool:
    return await run_in_threadpool(_sync_remove, nim, device_id)


def _sync_get_active_by_nim(nim: str) -> list[dict[str, str]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT endpoint, p256dh, auth FROM pwa_push_subscriptions WHERE nim = ? AND is_active = 1",
            (nim,),
        ).fetchall()
        return [
            {
                "endpoint": r["endpoint"],
                "p256dh": r["p256dh"],
                "auth": r["auth"],
            }
            for r in rows
        ]
    finally:
        conn.close()


async def get_active_subscriptions_for_nim(nim: str) -> list[dict[str, str]]:
    return await run_in_threadpool(_sync_get_active_by_nim, nim)


def _sync_prune(endpoint: str) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute(
            "DELETE FROM pwa_push_subscriptions WHERE endpoint = ?",
            (endpoint,),
        )
        _cleanup_orphan_categories(conn)
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


async def prune_subscription(endpoint: str) -> bool:
    return await run_in_threadpool(_sync_prune, endpoint)


def _sync_deactivate(endpoint: str) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute(
            "UPDATE pwa_push_subscriptions SET is_active = 0 WHERE endpoint = ?",
            (endpoint,),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


async def deactivate_subscription(endpoint: str) -> bool:
    return await run_in_threadpool(_sync_deactivate, endpoint)


def _sync_set_categories(nim: str, categories: list[str]) -> None:
    invalid = [c for c in categories if c not in ALLOWED_CATEGORIES]
    if invalid:
        raise ValueError(f"Kategori tidak dikenal: {', '.join(invalid)}")
    conn = _connect()
    try:
        conn.execute("DELETE FROM pwa_push_categories WHERE nim = ?", (nim,))
        conn.executemany(
            "INSERT OR IGNORE INTO pwa_push_categories (nim, category) VALUES (?, ?)",
            [(nim, cat) for cat in categories],
        )
        conn.commit()
    finally:
        conn.close()


async def set_categories(nim: str, categories: list[str]) -> None:
    await run_in_threadpool(_sync_set_categories, nim, categories)


def _sync_list_categories(nim: str) -> list[str]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT category FROM pwa_push_categories WHERE nim = ?", (nim,)
        ).fetchall()
        return [r["category"] for r in rows]
    finally:
        conn.close()


async def list_categories(nim: str) -> list[str]:
    return await run_in_threadpool(_sync_list_categories, nim)


def _sync_nims_with_category(category: str) -> list[str]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT DISTINCT s.nim FROM pwa_push_subscriptions s "
            "JOIN pwa_push_categories c ON c.nim = s.nim "
            "WHERE s.is_active = 1 AND c.category = ?",
            (category,),
        ).fetchall()
        return [r["nim"] for r in rows]
    finally:
        conn.close()


async def list_nims_with_category(category: str) -> list[str]:
    return await run_in_threadpool(_sync_nims_with_category, category)
