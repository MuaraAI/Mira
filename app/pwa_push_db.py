"""SQLite WAL store untuk PWA Web Push subscription per-NIM.

Data durable: kalau Redis restart, daftar HP mahasiswa tetap aman.
Operasi sinkron dijalankan lewat run_in_threadpool agar tidak memblokir
event loop FastAPI.
"""
import sqlite3
from typing import Any, Optional

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
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
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
        conn.commit()
    finally:
        conn.close()


def init_pwa_db() -> None:
    _init_db_sync()


def _sync_add(nim: str, endpoint: str, p256dh: str, auth: str, device_name: str) -> int:
    conn = _connect()
    try:
        existing = conn.execute(
            "SELECT id FROM pwa_push_subscriptions WHERE endpoint = ?",
            (endpoint,),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE pwa_push_subscriptions SET p256dh = ?, auth = ?, device_name = ?, is_active = 1, last_used_at = datetime('now') WHERE id = ?",
                (p256dh, auth, device_name, existing["id"]),
            )
            conn.commit()
            return existing["id"]

        count = conn.execute(
            "SELECT COUNT(*) AS c FROM pwa_push_subscriptions WHERE nim = ? AND is_active = 1",
            (nim,),
        ).fetchone()["c"]
        if count >= _MAX_SUBSCRIPTIONS_PER_NIM:
            oldest = conn.execute(
                "SELECT id FROM pwa_push_subscriptions WHERE nim = ? AND is_active = 1 ORDER BY last_used_at ASC, created_at ASC LIMIT 1",
                (nim,),
            ).fetchone()
            if oldest:
                conn.execute("DELETE FROM pwa_push_subscriptions WHERE id = ?", (oldest["id"],))

        cursor = conn.execute(
            "INSERT INTO pwa_push_subscriptions (nim, endpoint, p256dh, auth, device_name) VALUES (?, ?, ?, ?, ?)",
            (nim, endpoint, p256dh, auth, device_name),
        )
        conn.commit()
        new_id = cursor.lastrowid
        return int(new_id) if new_id is not None else 0
    finally:
        conn.close()


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
