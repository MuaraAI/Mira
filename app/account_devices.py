"""Registry perangkat per NIM untuk izin penggunaan kredensial tersimpan.

SQLite menyimpan status resmi tiap device. Status ``trusted`` yang sudah
tidak aktif 30 hari dilaporkan ``revoked`` saat dibaca, tanpa worker baru.
Redis hanya dipakai sebagai cache turunan yang dihapus pada setiap mutasi.
"""
import inspect
import os
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException, Request, status
from redis.asyncio import RedisError
from starlette.concurrency import run_in_threadpool

from app.cache import cache
from app.config import settings
from app.envelope import error_response


logger = logging.getLogger("app.account_devices")

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

DEVICE_TOUCH_INTERVAL_SECONDS = 60
_TOUCH_INTERVAL = timedelta(seconds=DEVICE_TOUCH_INTERVAL_SECONDS)
_INACTIVITY_LIMIT = timedelta(days=30)
_INITIALIZED_PATHS: set[str] = set()


class LastTrustedDeviceError(RuntimeError):
    """Dilempar saat pencabutan akan menghilangkan satu-satunya device tepercaya."""


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


def _parse_last_seen(last_seen: str) -> Optional[datetime]:
    try:
        seen = datetime.fromisoformat(last_seen)
    except (TypeError, ValueError):
        return None
    if seen.tzinfo is None:
        seen = seen.replace(tzinfo=timezone.utc)
    return seen


def _effective_status(row: sqlite3.Row, now: datetime) -> str:
    if row["status"] != "trusted":
        return row["status"]
    seen = _parse_last_seen(row["last_seen"])
    if seen is None or now - seen > _INACTIVITY_LIMIT:
        return "revoked"
    return "trusted"


def _is_stale_trusted(row: sqlite3.Row, now: datetime) -> bool:
    return row["status"] == "trusted" and _effective_status(row, now) == "revoked"


def _needs_touch(row: sqlite3.Row, now: datetime) -> bool:
    if _is_stale_trusted(row, now):
        return True
    seen = _parse_last_seen(row["last_seen"])
    return seen is None or now - seen >= _TOUCH_INTERVAL


def _read_device(
    conn: sqlite3.Connection, nim: str, device_id: str
) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT status, last_seen FROM account_devices WHERE nim = ? AND device_id = ?",
        (nim, device_id),
    ).fetchone()


def _count_effective_trusted(conn: sqlite3.Connection, nim: str, now: datetime) -> int:
    rows = conn.execute(
        "SELECT status, last_seen FROM account_devices WHERE nim = ?", (nim,)
    ).fetchall()
    return sum(1 for row in rows if _effective_status(row, now) == "trusted")


def _sync_ensure_device(
    nim: str, device_id: str, label: str, user_agent: str, now: datetime
) -> str:
    _ensure_schema()
    conn = _connect()
    started = False
    try:
        row = _read_device(conn, nim, device_id)
        if row is not None and not _needs_touch(row, now):
            return _effective_status(row, now)

        conn.execute("BEGIN IMMEDIATE")
        started = True
        row = _read_device(conn, nim, device_id)
        if row is not None and not _needs_touch(row, now):
            conn.commit()
            started = False
            return _effective_status(row, now)

        timestamp = now.isoformat()
        if row is None:
            trusted = _count_effective_trusted(conn, nim, now)
            status = "trusted" if trusted == 0 else "pending"
            conn.execute(
                "INSERT INTO account_devices "
                "(device_id, nim, label, user_agent, status, first_seen, last_seen) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (device_id, nim, label, user_agent, status, timestamp, timestamp),
            )
        else:
            status = "pending" if _is_stale_trusted(row, now) else row["status"]
            conn.execute(
                "UPDATE account_devices SET status = ?, label = ?, user_agent = ?, "
                "last_seen = ? WHERE nim = ? AND device_id = ?",
                (status, label, user_agent, timestamp, nim, device_id),
            )
        conn.commit()
        started = False
        return status
    except Exception:
        if started:
            conn.rollback()
        raise
    finally:
        conn.close()


async def ensure_device(
    nim: str, device_id: str, *, label: str, user_agent: str
) -> str:
    now = datetime.now(timezone.utc)
    previous = await get_device_status(nim, device_id)
    status = await run_in_threadpool(
        _sync_ensure_device, nim, device_id, label, user_agent, now
    )
    await _purge_cache(nim, device_id)
    if previous == "missing" and status == "pending":
        # Perangkat baru menunggu izin: beri tahu pemilik akun, sekali per device.
        await _notify_pending_device(nim, device_id, label)
    return status


async def _notify_pending_device(nim: str, device_id: str, label: str) -> None:
    """Kabari pemilik akun lewat kanal yang sudah ada; kegagalan tidak menghalangi login."""
    from app.notifier import deliver

    marker = f"ubsi:devnotif:{nim}:{device_id}"
    try:
        client = await _get_cache_client()
        if not await client.set(marker, "1", nx=True, ex=7 * 24 * 3600):
            return
    except (RedisError, ConnectionError, OSError):
        pass
    except Exception:
        logger.debug("Penanda notifikasi perangkat tidak bisa ditulis", exc_info=True)
    try:
        await deliver(
            nim,
            "perangkat-baru",
            "Perangkat baru minta akses SIAKAD",
            f"{label} baru saja login dan menunggu izin. Buka Sesi & Keamanan untuk mengizinkan.",
            "/dashboard/sesi",
            tag="perangkat-baru",
        )
    except Exception:
        logger.warning("Notifikasi perangkat baru gagal untuk %s", nim, exc_info=True)


def _sync_get_status(nim: str, device_id: str, now: datetime) -> str:
    _ensure_schema()
    conn = _connect()
    try:
        row = _read_device(conn, nim, device_id)
    finally:
        conn.close()
    if row is None:
        return "missing"
    return _effective_status(row, now)


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
            "status": _effective_status(row, now),
            "last_seen": row["last_seen"],
        }
        for row in rows
    ]


async def list_devices(nim: str) -> list[dict[str, Any]]:
    return await run_in_threadpool(_sync_list_devices, nim, datetime.now(timezone.utc))


def _sync_approve_device(
    nim: str, device_id: str, approved_by: str, now: datetime
) -> bool:
    _ensure_schema()
    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = _read_device(conn, nim, device_id)
        if row is None or row["status"] == "revoked":
            conn.rollback()
            return False
        if row["status"] == "trusted" and not _is_stale_trusted(row, now):
            conn.rollback()
            return True
        timestamp = now.isoformat()
        conn.execute(
            "UPDATE account_devices SET status = 'trusted', approved_at = ?, "
            "approved_by = ?, last_seen = ? WHERE nim = ? AND device_id = ?",
            (timestamp, approved_by, timestamp, nim, device_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


async def approve_device(nim: str, device_id: str, approved_by: str) -> bool:
    now = datetime.now(timezone.utc)
    trusted = await run_in_threadpool(
        _sync_approve_device, nim, device_id, approved_by, now
    )
    if trusted:
        await _purge_cache(nim, device_id)
    return trusted


def _sync_revoke_device(nim: str, device_id: str, now: datetime) -> bool:
    _ensure_schema()
    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = _read_device(conn, nim, device_id)
        if row is None or row["status"] == "revoked":
            conn.rollback()
            return False
        if _effective_status(row, now) == "trusted":
            trusted = _count_effective_trusted(conn, nim, now)
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
    now = datetime.now(timezone.utc)
    changed = await run_in_threadpool(_sync_revoke_device, nim, device_id, now)
    if changed:
        await _purge_cache(nim, device_id)
    return changed


def _device_gate_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=error_response(
            code="SIAKAD_DEVICE_PENDING", message=message, module="studentv2"
        ),
    )


async def require_trusted_device(request: Request) -> str:
    """Wajibkan cookie perangkat `trusted` sebelum akses lanjut.

    Hanya cookie `mira_device` yang dipercaya; device_id dari payload sesi
    tidak pernah dipakai untuk gerbang. Selain status `trusted`, gerbang
    melempar 403 SIAKAD_DEVICE_PENDING dengan pesan sesuai status perangkat.
    """
    nim = str(getattr(request.state, "nim", "") or "")
    device_id = str(getattr(request.state, "device_cookie_id", "") or "")
    if not nim or not device_id:
        raise _device_gate_error(
            "Sesi ini tidak punya cookie perangkat. Login ulang untuk mendaftarkan perangkat."
        )
    device_status = await get_device_status(nim, device_id)
    if device_status == "trusted":
        return device_id
    if device_status == "pending":
        message = (
            "Perangkat ini belum diizinkan. Izinkan perangkat dari halaman "
            "Sesi & Keamanan di dashboard Mira."
        )
    elif device_status == "revoked":
        message = (
            "Perangkat ini telah dicabut. Izinkan ulang dari perangkat tepercaya lain."
        )
    else:
        message = (
            "Perangkat ini belum terdaftar. Login ulang untuk mendaftarkannya."
        )
    raise _device_gate_error(message)


