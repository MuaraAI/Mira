"""Personal API Key Engine untuk Mahasiswa UBSI.

Format: muara_ubsi_<40_hex_chars>
Kredensial disimpan terenkripsi (Fernet AES-128-CBC + HMAC) menggunakan
kunci yang diturunkan dari master API_KEY server. Tidak ada password kampus
yang disimpan secara plaintext di database.
"""
import base64
import hashlib
import json
import secrets
import sqlite3
import re
from datetime import datetime, timezone
from typing import Any, Optional

from cryptography.fernet import Fernet
from starlette.concurrency import run_in_threadpool

from app.cache import cache
from app.config import settings

_MAX_KEYS_PER_NIM = 5
_KEY_PREFIX = "muara_ubsi_"
_REDIS_KEY_TTL = 86400  # 24 jam cache di Redis

_SCHEMA = """
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nim TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    encrypted_creds TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_nim ON api_keys(nim);
"""


def _legacy_get_fernet() -> Fernet:
    secret = settings.API_KEY
    if not secret:
        raise RuntimeError("API_KEY wajib disetel di file .env server!")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def _get_fernet() -> Fernet:
    secret = settings.API_KEY
    if not secret:
        raise RuntimeError("API_KEY wajib disetel di file .env server!")
    # Keyed BLAKE2b (RFC 7693) KDF dengan context 32-byte untuk kunci Fernet
    h = hashlib.blake2b(
        b"ubsi_fernet_credential_encryption_v1",
        key=secret.encode("utf-8"),
        digest_size=32,
    )
    key = base64.urlsafe_b64encode(h.digest())
    return Fernet(key)


def _connect() -> sqlite3.Connection:
    import os

    db_path = settings.SQLITE_DB_PATH
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
    except Exception:
        pass
    return conn


def init_api_keys_db() -> None:
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


def _hash_key(plain_key: str) -> str:
    # Keyed BLAKE2b (64-byte / 512-bit digest) kebal collision & length extension
    secret = settings.API_KEY.encode("utf-8") if settings.API_KEY else b""
    return hashlib.blake2b(plain_key.encode("utf-8"), key=secret, digest_size=64).hexdigest()


def _legacy_hash_key(plain_key: str) -> str:
    return hashlib.sha256(plain_key.encode("utf-8")).hexdigest()


def _mask_key(plain_key: str) -> str:
    if len(plain_key) > 20:
        return f"{plain_key[:16]}...{plain_key[-4:]}"
    return plain_key


def _sync_create_api_key(
    nim: str, name: str, studentv2_pass: str, elearning_pass: str
) -> dict[str, Any]:
    conn = _connect()
    try:
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM api_keys WHERE nim = ? AND is_active = 1",
            (nim,),
        ).fetchone()["c"]
        if count >= _MAX_KEYS_PER_NIM:
            raise ValueError(f"Batas maksimal {_MAX_KEYS_PER_NIM} API Key per NIM tercapai")

        plain_key = f"{_KEY_PREFIX}{secrets.token_hex(20)}"
        key_hash = _hash_key(plain_key)
        key_prefix = _mask_key(plain_key)

        f = _get_fernet()
        creds_payload = json.dumps(
            {"studentv2_pass": studentv2_pass, "elearning_pass": elearning_pass}
        ).encode("utf-8")
        encrypted_creds = f.encrypt(creds_payload).decode("utf-8")

        now_iso = datetime.now(timezone.utc).isoformat()
        cursor = conn.execute(
            """
            INSERT INTO api_keys (nim, name, key_hash, key_prefix, encrypted_creds, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (nim, name.strip(), key_hash, key_prefix, encrypted_creds, now_iso),
        )
        conn.commit()
        key_id = cursor.lastrowid
        return {
            "id": key_id,
            "nim": nim,
            "name": name.strip(),
            "key": plain_key,
            "prefix": key_prefix,
            "created_at": now_iso,
            "key_hash": key_hash,
            "studentv2_pass": studentv2_pass,
            "elearning_pass": elearning_pass,
        }
    finally:
        conn.close()


async def create_api_key(
    nim: str, name: str, studentv2_pass: str, elearning_pass: str
) -> dict[str, Any]:
    res = await run_in_threadpool(
        _sync_create_api_key, nim, name, studentv2_pass, elearning_pass
    )
    # Cache ke Redis agar lookup otentikasi super cepat (sub-1ms)
    try:
        client = await cache.get_client()
        redis_key = f"ubsi:apikey:{res['key_hash']}"
        cache_data = json.dumps(
            {
                "nim": res["nim"],
                "studentv2_pass": res["studentv2_pass"],
                "elearning_pass": res["elearning_pass"],
            }
        )
        await client.set(redis_key, cache_data, ex=_REDIS_KEY_TTL)
    except Exception:
        pass

    # Jangan kirim hash dan credential internal ke client
    return {
        "id": res["id"],
        "nim": res["nim"],
        "name": res["name"],
        "key": res["key"],
        "prefix": res["prefix"],
        "created_at": res["created_at"],
    }


def _sync_list_api_keys(nim: str) -> list[dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT id, nim, name, key_prefix, is_active, created_at, last_used_at
            FROM api_keys
            WHERE nim = ? AND is_active = 1
            ORDER BY id DESC
            """,
            (nim,),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "nim": r["nim"],
                "name": r["name"],
                "prefix": r["key_prefix"],
                "is_active": bool(r["is_active"]),
                "created_at": r["created_at"],
                "last_used_at": r["last_used_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


async def list_api_keys(nim: str) -> list[dict[str, Any]]:
    return await run_in_threadpool(_sync_list_api_keys, nim)


def _sync_credentials_for_nim(nim: str) -> Optional[tuple[str, str, str]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT encrypted_creds FROM api_keys WHERE nim = ? AND is_active = 1 ORDER BY last_used_at DESC, id DESC",
            (nim,),
        ).fetchall()
        f = _get_fernet()
        for row in rows:
            try:
                data = json.loads(f.decrypt(row["encrypted_creds"].encode("utf-8")).decode("utf-8"))
            except Exception:
                continue
            if data.get("studentv2_pass") and data.get("elearning_pass"):
                return nim, str(data["studentv2_pass"]), str(data["elearning_pass"])
        return None
    finally:
        conn.close()


async def get_credentials_for_nim(nim: str) -> Optional[tuple[str, str, str]]:
    """Resolve encrypted credentials for background jobs without exposing them to clients."""
    return await run_in_threadpool(_sync_credentials_for_nim, nim)


def _sync_revoke_api_key(nim: str, key_id: int) -> Optional[str]:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT key_hash FROM api_keys WHERE id = ? AND nim = ? AND is_active = 1",
            (key_id, nim),
        ).fetchone()
        if not row:
            return None
        key_hash = row["key_hash"]
        conn.execute("UPDATE api_keys SET is_active = 0 WHERE id = ?", (key_id,))
        conn.commit()
        return key_hash
    finally:
        conn.close()


async def revoke_api_key(nim: str, key_id: int) -> bool:
    key_hash = await run_in_threadpool(_sync_revoke_api_key, nim, key_id)
    if not key_hash:
        return False
    try:
        client = await cache.get_client()
        await client.delete(f"ubsi:apikey:{key_hash}")
    except Exception:
        pass
    return True


def _sync_resolve_api_key(
    key_hash: str, plain_key: Optional[str] = None
) -> Optional[dict[str, Any]]:
    try:
        conn = _connect()
    except Exception:
        return None

    try:
        row = conn.execute(
            "SELECT id, nim, encrypted_creds, is_active FROM api_keys WHERE key_hash = ? AND is_active = 1",
            (key_hash,),
        ).fetchone()

        migrated_from_legacy = False
        # Fallback check untuk key lama (SHA256)
        if not row and plain_key:
            legacy_hash = _legacy_hash_key(plain_key)
            row = conn.execute(
                "SELECT id, nim, encrypted_creds, is_active FROM api_keys WHERE key_hash = ? AND is_active = 1",
                (legacy_hash,),
            ).fetchone()
            if row:
                migrated_from_legacy = True

        if not row:
            return None

        # Dekripsi dengan Fernet baru, fallback ke Fernet lama bila perlu
        f = _get_fernet()
        data = None
        try:
            raw = f.decrypt(row["encrypted_creds"].encode("utf-8")).decode("utf-8")
            data = json.loads(raw)
        except Exception:
            try:
                f_leg = _legacy_get_fernet()
                raw = f_leg.decrypt(row["encrypted_creds"].encode("utf-8")).decode("utf-8")
                data = json.loads(raw)
                migrated_from_legacy = True
            except Exception:
                return None

        now_iso = datetime.now(timezone.utc).isoformat()

        # Seamless migration: jika key lama terdeteksi, perbarui ke BLAKE2b hash & re-enkripsi
        if migrated_from_legacy and plain_key:
            try:
                new_encrypted = f.encrypt(json.dumps(data).encode("utf-8")).decode("utf-8")
                conn.execute(
                    "UPDATE api_keys SET key_hash = ?, encrypted_creds = ?, last_used_at = ? WHERE id = ?",
                    (key_hash, new_encrypted, now_iso, row["id"]),
                )
                conn.commit()
            except Exception:
                pass
        else:
            try:
                conn.execute(
                    "UPDATE api_keys SET last_used_at = ? WHERE id = ?",
                    (now_iso, row["id"]),
                )
                conn.commit()
            except Exception:
                pass

        return {
            "nim": row["nim"],
            "studentv2_pass": data.get("studentv2_pass", ""),
            "elearning_pass": data.get("elearning_pass", ""),
        }
    except Exception:
        return None
    finally:
        conn.close()


async def resolve_api_key(plain_key: str) -> Optional[dict[str, Any]]:
    if not plain_key or not re.fullmatch(r"muara_ubsi_[0-9a-f]{40}", plain_key):
        return None

    key_hash = _hash_key(plain_key)
    redis_key = f"ubsi:apikey:{key_hash}"

    # 1. Cek Redis. Cache payload tetap terenkripsi agar password kampus tidak plaintext.
    try:
        client = await cache.get_client()
        cached = await client.get(redis_key)
        if cached:
            blob = cached if isinstance(cached, bytes) else cached.encode("utf-8")
            raw = _get_fernet().decrypt(blob).decode("utf-8")
            return json.loads(raw)
    except Exception:
        pass

    # 2. Cek SQLite & Decrypt (dengan auto migration jika legacy)
    resolved = await run_in_threadpool(_sync_resolve_api_key, key_hash, plain_key)
    if not resolved:
        return None

    # 3. Re-populate Redis
    try:
        client = await cache.get_client()
        encrypted = _get_fernet().encrypt(json.dumps(resolved).encode("utf-8")).decode("utf-8")
        await client.set(redis_key, encrypted, ex=_REDIS_KEY_TTL)
    except Exception:
        pass

    return resolved
