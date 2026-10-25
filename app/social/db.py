"""Skema SQLite WAL untuk Mira Komunitas.

Satu file DB dengan fitur lain (settings.SQLITE_DB_PATH). Semua tabel diberi
prefix `social_` supaya tidak bentrok. Koneksi dibuat per operasi, sama seperti
channels_db, sehingga aman dipanggil dari threadpool mana pun.
"""
import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from app.config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS social_profiles (
    nim TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS social_spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
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

-- Anggota DM (membership) sekaligus read-state untuk DM dan channel.
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


# Kolom yang ditambahkan setelah rilis pertama. Dijalankan idempoten saat startup
# (ALTER TABLE hanya bila kolom belum ada) supaya DB produksi lama ikut ter-upgrade.
_ADDED_COLUMNS = (
    ("social_profiles", "avatar", "TEXT"),
    ("social_profiles", "banner", "TEXT"),
    ("social_profiles", "is_online", "INTEGER NOT NULL DEFAULT 0"),
    ("social_spaces", "avatar", "TEXT"),
    ("social_spaces", "banner", "TEXT"),
    ("social_participants", "last_opened_at", "TEXT"),
)


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """Satu koneksi per operasi service: commit kalau sukses, rollback kalau error."""
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
    db_dir = os.path.dirname(settings.SQLITE_DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = connect()
    try:
        conn.executescript(_SCHEMA)
        for table, column, ddl in _ADDED_COLUMNS:
            existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
            if column not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
        conn.commit()
    finally:
        conn.close()
