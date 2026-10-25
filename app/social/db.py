"""Supabase Postgres HTTP / PostgREST Client untuk Mira Social v3.

Menggunakan httpx murni (sudah terpasang di dependencies) untuk berinteraksi langsung
dengan REST API Supabase tanpa menambahkan library pihak ketiga yang membengkakkan memori.
Bekerja mulus di cloud Supabase (`duzehjktvbuqczjubshy`).
"""
import logging
import os
import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator, Optional
import httpx

from app.config import settings

logger = logging.getLogger("app.social.db")

_client: Optional[httpx.AsyncClient] = None


def get_headers() -> dict[str, str]:
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or ""
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def is_configured() -> bool:
    return bool(settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY))


def get_supabase_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1",
            headers=get_headers(),
            timeout=10.0,
        )
    return _client


async def close_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


# Skema fallback jika mode offline / testing tanpa koneksi Supabase
_SCHEMA = """
CREATE TABLE IF NOT EXISTS social_profiles (
    nim TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    campus_branch TEXT NOT NULL DEFAULT 'UBSI Pontianak',
    major TEXT NOT NULL DEFAULT 'Informatika',
    class_code TEXT,
    avatar_preset TEXT NOT NULL DEFAULT 'mura-welcome',
    show_nim INTEGER NOT NULL DEFAULT 0,
    show_class INTEGER NOT NULL DEFAULT 0,
    e2ee_public_key TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS social_spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    campus_branch TEXT,
    owner_nim TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS social_members (
    space_id INTEGER NOT NULL REFERENCES social_spaces(id) ON DELETE CASCADE,
    nim TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (space_id, nim)
);
CREATE INDEX IF NOT EXISTS idx_social_members_nim ON social_members(nim);

CREATE TABLE IF NOT EXISTS social_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('channel', 'dm')),
    space_id INTEGER REFERENCES social_spaces(id) ON DELETE CASCADE,
    name TEXT,
    topic TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    dm_key TEXT UNIQUE,
    last_message_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_social_conv_space ON social_conversations(space_id);

CREATE TABLE IF NOT EXISTS social_participants (
    conversation_id INTEGER NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
    nim TEXT NOT NULL,
    last_read_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (conversation_id, nim)
);
CREATE INDEX IF NOT EXISTS idx_social_participants_nim ON social_participants(nim);

CREATE TABLE IF NOT EXISTS social_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
    author_nim TEXT NOT NULL,
    body TEXT NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'none',
    card_payload TEXT NOT NULL DEFAULT '{}',
    is_encrypted INTEGER NOT NULL DEFAULT 0,
    encryption_nonce TEXT,
    reply_to_id INTEGER,
    pinned_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    edited_at TEXT,
    deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_social_messages_conv ON social_messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS social_reactions (
    message_id INTEGER NOT NULL REFERENCES social_messages(id) ON DELETE CASCADE,
    nim TEXT NOT NULL,
    reaction TEXT NOT NULL,
    PRIMARY KEY (message_id, nim, reaction)
);

CREATE TABLE IF NOT EXISTS social_mentions (
    message_id INTEGER NOT NULL REFERENCES social_messages(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL,
    nim TEXT NOT NULL,
    PRIMARY KEY (message_id, nim)
);
CREATE INDEX IF NOT EXISTS idx_social_mentions_nim ON social_mentions(nim, conversation_id);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_social_db() -> None:
    if is_configured():
        logger.info("Supabase Mira Social v3 aktif (Host: %s)", settings.SUPABASE_URL)
        return

    db_dir = os.path.dirname(settings.SQLITE_DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = connect()
    try:
        conn.executescript(_SCHEMA)
        for alter_sql in (
            "ALTER TABLE social_profiles ADD COLUMN campus_branch TEXT NOT NULL DEFAULT 'UBSI Pontianak'",
            "ALTER TABLE social_profiles ADD COLUMN major TEXT NOT NULL DEFAULT 'Informatika'",
            "ALTER TABLE social_profiles ADD COLUMN avatar_preset TEXT NOT NULL DEFAULT 'mura-default'",
            "ALTER TABLE social_messages ADD COLUMN card_type TEXT NOT NULL DEFAULT 'none'",
            "ALTER TABLE social_messages ADD COLUMN card_payload TEXT NOT NULL DEFAULT '{}'",
            "ALTER TABLE social_profiles ADD COLUMN e2ee_public_key TEXT",
            "ALTER TABLE social_messages ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE social_messages ADD COLUMN encryption_nonce TEXT",
            "ALTER TABLE social_spaces ADD COLUMN campus_branch TEXT",
            "ALTER TABLE social_profiles ADD COLUMN class_code TEXT",
            "ALTER TABLE social_profiles ADD COLUMN show_nim INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE social_profiles ADD COLUMN show_class INTEGER NOT NULL DEFAULT 0",
        ):
            try:
                conn.execute(alter_sql)
            except sqlite3.OperationalError:
                pass
        conn.commit()
    finally:
        conn.close()
