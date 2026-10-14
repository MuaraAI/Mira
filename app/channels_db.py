"""SQLite WAL store untuk config channel notifikasi per-NIM.

Data ini durable: kalau Redis restart, daftar webhook user tetap aman.
Operasi sinkron dijalankan lewat run_in_threadpool agar tidak memblokir
event loop FastAPI.
"""
import json
import sqlite3
from typing import Any, Optional

from starlette.concurrency import run_in_threadpool

from app.config import settings

_ALLOWED_TYPES = ("discord", "telegram", "custom")
_MAX_CHANNELS_PER_NIM = 5

_SCHEMA = """
CREATE TABLE IF NOT EXISTS webhook_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nim TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('discord', 'telegram', 'custom')),
    categories TEXT NOT NULL DEFAULT '["berita-kampus"]',
    config TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_channels_nim ON webhook_channels(nim);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_db() -> None:
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


def init_db() -> None:
    """Publik: dipanggil saat startup dan di test sebelum pakai SQLite temp."""
    _init_db()


def _sync_add(nim: str, channel_type: str, categories: list[str], config: dict) -> int:
    conn = _connect()
    try:
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM webhook_channels WHERE nim = ?", (nim,)
        ).fetchone()["c"]
        if count >= _MAX_CHANNELS_PER_NIM:
            raise ValueError("Batas maksimal 5 channel per NIM")
        cursor = conn.execute(
            "INSERT INTO webhook_channels (nim, type, categories, config) VALUES (?, ?, ?, ?)",
            (nim, channel_type, json.dumps(categories), json.dumps(config)),
        )
        conn.commit()
        new_id = cursor.lastrowid
        return int(new_id) if new_id is not None else 0
    finally:
        conn.close()


def _sync_list(nim: str) -> list[dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT id, type, categories, config, is_active, created_at "
            "FROM webhook_channels WHERE nim = ? ORDER BY created_at DESC, id DESC",
            (nim,),
        ).fetchall()
        return [
            {
                "id": row["id"],
                "type": row["type"],
                "categories": json.loads(row["categories"]),
                "config": json.loads(row["config"]),
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def _sync_get(nim: str, channel_id: int) -> Optional[dict[str, Any]]:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT id, type, categories, config, is_active, created_at "
            "FROM webhook_channels WHERE nim = ? AND id = ?",
            (nim, channel_id),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "type": row["type"],
            "categories": json.loads(row["categories"]),
            "config": json.loads(row["config"]),
            "is_active": bool(row["is_active"]),
            "created_at": row["created_at"],
        }
    finally:
        conn.close()


def _sync_delete(nim: str, channel_id: int) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute(
            "DELETE FROM webhook_channels WHERE nim = ? AND id = ?", (nim, channel_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def _sync_set_active(nim: str, channel_id: int, active: bool) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute(
            "UPDATE webhook_channels SET is_active = ? WHERE nim = ? AND id = ?",
            (1 if active else 0, nim, channel_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def _sync_list_active_by_category(category: str) -> list[dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT id, nim, type, config FROM webhook_channels "
            "WHERE is_active = 1 ORDER BY id"
        ).fetchall()
        matched = []
        for row in rows:
            if category in json.loads(row["categories"]):
                matched.append(
                    {
                        "id": row["id"],
                        "nim": row["nim"],
                        "type": row["type"],
                        "config": json.loads(row["config"]),
                    }
                )
        return matched
    finally:
        conn.close()


async def add_channel(
    nim: str, channel_type: str, categories: list[str], config: dict
) -> int:
    if channel_type not in _ALLOWED_TYPES:
        raise ValueError("Tipe channel tidak valid")
    return await run_in_threadpool(_sync_add, nim, channel_type, categories, config)


async def list_channels(nim: str) -> list[dict[str, Any]]:
    return await run_in_threadpool(_sync_list, nim)


async def get_channel(nim: str, channel_id: int) -> Optional[dict[str, Any]]:
    return await run_in_threadpool(_sync_get, nim, channel_id)


async def delete_channel(nim: str, channel_id: int) -> bool:
    return await run_in_threadpool(_sync_delete, nim, channel_id)


async def set_channel_active(nim: str, channel_id: int, active: bool) -> bool:
    return await run_in_threadpool(_sync_set_active, nim, channel_id, active)


async def list_active_by_category(category: str) -> list[dict[str, Any]]:
    return await run_in_threadpool(_sync_list_active_by_category, category)
