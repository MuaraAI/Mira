"""Registry perangkat per NIM untuk izin penggunaan kredensial tersimpan.

SQLite menyimpan status resmi tiap device. Status ``trusted`` yang sudah
tidak aktif 30 hari dilaporkan ``revoked`` saat dibaca, tanpa worker baru.
Redis hanya dipakai sebagai cache turunan yang dihapus pada setiap mutasi.
"""
import inspect
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from redis.asyncio import RedisError
from starlette.concurrency import run_in_threadpool

from app.cache import cache
from app.config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS account_devices (
    device_id   TEXT NOT NULL,
    nim         TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT 'Browser',
    user_agent  TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    first_seen  TEXT NOT NULL,
    last_seen   TEXT NOT NULL,
    approved_at TEXT,
    approved_by TEXT,
    PRIMARY KEY (device_id, nim)
);
CREATE INDEX IF NOT EXISTS idx_account_devices_nim ON account_devices(nim, status);
"""

_INACTIVITY_LIMIT = timedelta(days=30)
_INITIALIZED_PATHS: set[str] = set()


class LastTrustedDeviceError(RuntimeError):
    """Dilempar saat pencabutan akan menghilangkan satu-satunya device tepercaya."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    db_dir = os.path.dirname(settings.SQLITE_DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _sync_init() -> None:
    conn = _connect()
    try:
        conn.executescript(_SCHEMA)
        conn.commit()
    finally:
        conn.close()
    _INITIALIZED_PATHS.add(os.path.abspath(settings.SQLITE_DB_PATH))


async def init_account_devices_db() -> None:
    await run_in_threadpool(_sync_init)


def _ensure_schema() -> None:
    if os.path.abspath(settings.SQLITE_DB_PATH) not in _INITIALIZED_PATHS:
        _sync_init()


async def _get_cache_client() -> Any:
    client = cache.get_client()
    if inspect.isawaitable(client):
        return await client
    return client


def _device_cache_key(nim: str, device_id: str) -> str:
    return f"ubsi:acct:device:{nim}:{device_id}"


def _list_cache_key(nim: str) -> str:
    return f"ubsi:acct:devices:{nim}"


async def _purge_cache(nim: str, device_id: Optional[str] = None) -> None:
    keys = [_list_cache_key(nim)]
    if device_id is not None:
        key = _device_cache_key(nim, device_id)
        keys.append(key)
    keys.extend(f"{key}:{suffix}" for key in tuple(keys) for suffix in ("fresh", "lgg"))
    try:
        client = await _get_cache_client()
        await client.delete(*keys)
    except (RedisError, ConnectionError, OSError):
        return


def _is_expired(last_seen: str, now: datetime) -> bool:
    try:
        seen = datetime.fromisoformat(last_seen)
    except (TypeError, ValueError):
        return True
    if seen.tzinfo is None:
        seen = seen.replace(tzinfo=timezone.utc)
    return now - seen > _INACTIVITY_LIMIT


def _effective_status(status: str, last_seen: str, now: datetime) -> str:
    if status != "trusted":
        return status
    return "revoked" if _is_expired(last_seen, now) else "trusted"


def _sync_ensure_device(
    nim: str, device_id: str, label: str, user_agent: str, timestamp: str
) -> str:
    _ensure_schema()
    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT status FROM account_devices WHERE nim = ? AND device_id = ?",
            (nim, device_id),
        ).fetchone()
        if row is not None:
            status = row["status"]
            conn.execute(
                "UPDATE account_devices SET label = ?, user_agent = ?, last_seen = ? "
                "WHERE nim = ? AND device_id = ?",
                (label, user_agent, timestamp, nim, device_id),
            )
        else:
            trusted = conn.execute(
                "SELECT COUNT(*) AS total FROM account_devices "
                "WHERE nim = ? AND status = 'trusted'",
                (nim,),
            ).fetchone()["total"]
            status = "trusted" if trusted == 0 else "pending"
            conn.execute(
                "INSERT INTO account_devices "
                "(device_id, nim, label, user_agent, status, first_seen, last_seen) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (device_id, nim, label, user_agent, status, timestamp, timestamp),
            )
        conn.commit()
        return status
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


async def ensure_device(
    nim: str, device_id: str, *, label: str, user_agent: str
) -> str:
    timestamp = _now()
    status = await run_in_threadpool(
        _sync_ensure_device, nim, device_id, label, user_agent, timestamp
    )
    await _purge_cache(nim, device_id)
    return status


def _sync_get_status(nim: str, device_id: str, now: datetime) -> str:
    _ensure_schema()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT status, last_seen FROM account_devices "
            "WHERE nim = ? AND device_id = ?",
            (nim, device_id),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return "missing"
    return _effective_status(row["status"], row["last_seen"], now)


async def get_device_status(nim: str, device_id: str) -> str:
    now = datetime.now(timezone.utc)
    return await run_in_threadpool(_sync_get_status, nim, device_id, now)


def _sync_list_devices(nim: str, now: datetime) -> list[dict[str, Any]]:
    _ensure_schema()
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT device_id, label, user_agent, status, last_seen "
            "FROM account_devices WHERE nim = ? "
            "ORDER BY last_seen DESC, device_id ASC",
            (nim,),
        ).fetchall()
    finally:
        conn.close()
    return [
        {
            "device_id": row["device_id"],
            "label": row["label"],
            "user_agent": row["user_agent"],
            "status": _effective_status(row["status"], row["last_seen"], now),
            "last_seen": row["last_seen"],
        }
        for row in rows
    ]


async def list_devices(nim: str) -> list[dict[str, Any]]:
    return await run_in_threadpool(_sync_list_devices, nim, datetime.now(timezone.utc))


def _sync_approve_device(
    nim: str, device_id: str, approved_by: str, timestamp: str
) -> bool:
    _ensure_schema()
    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT status FROM account_devices WHERE nim = ? AND device_id = ?",
            (nim, device_id),
        ).fetchone()
        if row is None:
            conn.rollback()
            return False
        if row["status"] != "pending":
            conn.rollback()
            return row["status"] == "trusted"
        conn.execute(
            "UPDATE account_devices SET status = 'trusted', approved_at = ?, "
            "approved_by = ? WHERE nim = ? AND device_id = ?",
            (timestamp, approved_by, nim, device_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


async def approve_device(nim: str, device_id: str, approved_by: str) -> bool:
    trusted = await run_in_threadpool(
        _sync_approve_device, nim, device_id, approved_by, _now()
    )
    if trusted:
        await _purge_cache(nim, device_id)
    return trusted


def _sync_revoke_device(nim: str, device_id: str) -> bool:
    _ensure_schema()
    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT status FROM account_devices WHERE nim = ? AND device_id = ?",
            (nim, device_id),
        ).fetchone()
        if row is None or row["status"] == "revoked":
            conn.rollback()
            return False
        if row["status"] == "trusted":
            trusted = conn.execute(
                "SELECT COUNT(*) AS total FROM account_devices "
                "WHERE nim = ? AND status = 'trusted'",
                (nim,),
            ).fetchone()["total"]
            if trusted <= 1:
                conn.rollback()
                raise LastTrustedDeviceError(
                    "Device tepercaya terakhir tidak bisa dicabut"
                )
        conn.execute(
            "UPDATE account_devices SET status = 'revoked' "
            "WHERE nim = ? AND device_id = ?",
            (nim, device_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


async def revoke_device(nim: str, device_id: str) -> bool:
    changed = await run_in_threadpool(_sync_revoke_device, nim, device_id)
    if changed:
        await _purge_cache(nim, device_id)
    return changed
