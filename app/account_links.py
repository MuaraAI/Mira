"""Tautan kredensial kanonis per NIM dan provider.

SQLite menyimpan satu baris per pasangan (nim, provider). Secret dienkripsi
dengan Fernet yang sama seperti kredensial API key; Redis hanya cache turunan
yang ikut dihapus setiap ada mutasi.
"""
import inspect
import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

from cryptography.fernet import InvalidToken
from starlette.concurrency import run_in_threadpool

from app.api_keys_db import _get_fernet
from app.cache import cache
from app.config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS account_links (
    nim              TEXT NOT NULL,
    provider         TEXT NOT NULL,
    kind             TEXT NOT NULL,
    secret_encrypted TEXT NOT NULL,
    status           TEXT NOT NULL,
    linked_at        TEXT,
    updated_at       TEXT,
    PRIMARY KEY (nim, provider)
);
"""

_ALLOWED_KINDS = ("password", "oauth")
_ALLOWED_STATUSES = ("linked", "needs_relink", "unlinked")
logger = logging.getLogger("app.account_links")
_INITIALIZED_PATHS: set[str] = set()


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


async def init_account_links_db() -> None:
    await run_in_threadpool(_sync_init)


def _ensure_schema() -> None:
    if os.path.abspath(settings.SQLITE_DB_PATH) not in _INITIALIZED_PATHS:
        _sync_init()


def _cache_key(nim: str, provider: str) -> str:
    return f"ubsi:acct:link:{nim}:{provider}"


def _encrypt_secret(secret: str) -> str:
    return _get_fernet().encrypt(
        json.dumps({"secret": secret}).encode("utf-8")
    ).decode("utf-8")


def _decrypt_secret(encrypted: str) -> Optional[str]:
    try:
        data = json.loads(
            _get_fernet().decrypt(encrypted.encode("utf-8")).decode("utf-8")
        )
    except (InvalidToken, ValueError, UnicodeDecodeError):
        return None
    value = data.get("secret") if isinstance(data, dict) else None
    return value if isinstance(value, str) else None


async def _get_cache_client() -> Any:
    client = cache.get_client()
    if inspect.isawaitable(client):
        return await client
    return client


async def _purge_cache(nim: str, provider: str) -> None:
    key = _cache_key(nim, provider)
    try:
        client = await _get_cache_client()
        await client.delete(key, f"{key}:fresh", f"{key}:lgg")
    except Exception as exc:
        logger.warning("Purge cache tautan %s gagal: %s", key, exc)


async def _cache_link(nim: str, provider: str, status: str, encrypted: str) -> None:
    key = _cache_key(nim, provider)
    payload = json.dumps({"status": status, "secret_encrypted": encrypted})
    try:
        client = await _get_cache_client()
        await client.set(f"{key}:fresh", payload, ex=cache.default_ttl)
    except Exception as exc:
        logger.warning("Isi cache tautan %s gagal: %s", key, exc)


def _sync_read(nim: str, provider: str) -> Optional[dict[str, Any]]:
    _ensure_schema()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT status, secret_encrypted FROM account_links "
            "WHERE nim = ? AND provider = ?",
            (nim, provider),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return {"status": row["status"], "secret_encrypted": row["secret_encrypted"]}


async def _load_link(nim: str, provider: str) -> Optional[dict[str, Any]]:
    key = _cache_key(nim, provider)
    try:
        client = await _get_cache_client()
        raw = await client.get(f"{key}:fresh")
        cached = json.loads(raw) if raw else None
    except Exception as exc:
        # Cache bukan sumber kebenaran: gagal baca jatuh ke SQLite, bukan 500.
        logger.warning("Baca cache tautan %s gagal, jatuh ke SQLite: %s", key, exc)
        cached = None
    if isinstance(cached, dict):
        cached_status = cached.get("status")
        encrypted = cached.get("secret_encrypted")
        if cached_status in _ALLOWED_STATUSES and isinstance(encrypted, str):
            return {"status": cached_status, "secret_encrypted": encrypted}

    stored = await run_in_threadpool(_sync_read, nim, provider)
    if stored is not None:
        await _cache_link(nim, provider, stored["status"], stored["secret_encrypted"])
    return stored


async def get_link_status(nim: str, provider: str) -> Optional[str]:
    link = await _load_link(nim, provider)
    return link["status"] if link is not None else None


async def get_link_secret(nim: str, provider: str) -> Optional[str]:
    link = await _load_link(nim, provider)
    if link is None or link["status"] != "linked":
        return None
    return _decrypt_secret(link["secret_encrypted"])


def _sync_set_link(
    nim: str,
    provider: str,
    kind: str,
    encrypted: str,
    status: str,
    timestamp: str,
) -> None:
    _ensure_schema()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO account_links
                (nim, provider, kind, secret_encrypted, status, linked_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(nim, provider) DO UPDATE SET
                kind = excluded.kind,
                secret_encrypted = excluded.secret_encrypted,
                status = excluded.status,
                linked_at = CASE
                    WHEN account_links.status = 'unlinked' THEN excluded.updated_at
                    ELSE account_links.linked_at
                END,
                updated_at = excluded.updated_at
            """,
            (nim, provider, kind, encrypted, status, timestamp, timestamp),
        )
        conn.commit()
    finally:
        conn.close()


async def set_link(
    nim: str,
    provider: str,
    *,
    kind: str,
    secret: str,
    status: str = "linked",
) -> None:
    if kind not in _ALLOWED_KINDS:
        raise ValueError(f"Jenis tautan tidak dikenal: {kind}")
    if status not in _ALLOWED_STATUSES:
        raise ValueError(f"Status tautan tidak dikenal: {status}")

    timestamp = _now()
    await run_in_threadpool(
        _sync_set_link, nim, provider, kind, _encrypt_secret(secret), status, timestamp
    )
    await _purge_cache(nim, provider)


def _sync_mark_needs_relink(nim: str, provider: str, timestamp: str) -> bool:
    _ensure_schema()
    conn = _connect()
    try:
        cursor = conn.execute(
            "UPDATE account_links SET status = 'needs_relink', updated_at = ? "
            "WHERE nim = ? AND provider = ? AND status != 'unlinked'",
            (timestamp, nim, provider),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def _sync_mark_needs_relink_if_matches(
    nim: str, provider: str, attempted: str, timestamp: str
) -> bool:
    _ensure_schema()
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT secret_encrypted, status FROM account_links WHERE nim = ? AND provider = ?",
            (nim, provider),
        ).fetchone()
        if row is None or row["status"] == "unlinked":
            return False
        stored = _decrypt_secret(row["secret_encrypted"])
        if not stored or stored != attempted:
            return False
        cursor = conn.execute(
            "UPDATE account_links SET status = 'needs_relink', updated_at = ? "
            "WHERE nim = ? AND provider = ? AND status != 'unlinked'",
            (timestamp, nim, provider),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


async def mark_needs_relink_if_matches(
    nim: str, attempted_password: str, provider: str = "siakad"
) -> bool:
    """Tandai perlu-taut-ulang hanya bila yang ditolak kampus adalah secret tersimpan.

    Login memverifikasi password yang baru saja diketik user, jadi penolakan bisa
    berasal dari salah ketik, bukan dari password tersimpan. Tanpa pembandingan
    ini, satu salah ketik mengunci SIAKAD untuk seluruh akun.
    """
    timestamp = _now()
    changed = await run_in_threadpool(
        _sync_mark_needs_relink_if_matches, nim, provider, attempted_password, timestamp
    )
    if changed:
        await _purge_cache(nim, provider)
    return changed


async def mark_needs_relink(nim: str, provider: str = "siakad") -> None:
    timestamp = _now()
    changed = await run_in_threadpool(_sync_mark_needs_relink, nim, provider, timestamp)
    if changed:
        await _purge_cache(nim, provider)


def _sync_unlink(nim: str, provider: str, timestamp: str) -> bool:
    _ensure_schema()
    conn = _connect()
    try:
        cursor = conn.execute(
            "UPDATE account_links SET status = 'unlinked', secret_encrypted = '', "
            "updated_at = ? WHERE nim = ? AND provider = ? AND status != 'unlinked'",
            (timestamp, nim, provider),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


async def unlink(nim: str, provider: str) -> bool:
    timestamp = _now()
    changed = await run_in_threadpool(_sync_unlink, nim, provider, timestamp)
    if changed:
        await _purge_cache(nim, provider)
    return changed


def _sync_import_legacy(nim: str, encrypted: str, timestamp: str) -> bool:
    _ensure_schema()
    conn = _connect()
    try:
        cursor = conn.execute(
            """
            INSERT OR IGNORE INTO account_links
                (nim, provider, kind, secret_encrypted, status, linked_at, updated_at)
            VALUES (?, 'siakad', 'password', ?, 'linked', ?, ?)
            """,
            (nim, encrypted, timestamp, timestamp),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


async def import_legacy_siakad(nim: str, password: str) -> bool:
    if not password:
        return False

    timestamp = _now()
    imported = await run_in_threadpool(
        _sync_import_legacy, nim, _encrypt_secret(password), timestamp
    )
    if imported:
        await _purge_cache(nim, "siakad")
    return imported
