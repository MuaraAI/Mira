"""Lapisan koneksi Mira Social v3: Supabase Postgres (produksi) atau SQLite (lokal/test).

- Produksi: `SUPABASE_DB_URL` diisi (Supabase -> Connect -> Session pooler) -> psycopg3
  dengan SQL portable (placeholder '?', RETURNING, ON CONFLICT) — social 100% di Supabase.
- Lokal/test: kosongkan `SUPABASE_DB_URL` -> SQLite WAL di `SQLITE_DB_PATH`
  (Iron Rule: pytest 100% offline, tanpa jaringan).

Skema Supabase dikelola lewat migration (MCP Supabase / SQL editor), bukan dari file ini.
"""
import logging
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from app.config import settings

logger = logging.getLogger("app.social.db")


def using_postgres() -> bool:
    """True bila produksi terhubung Supabase lewat wire protocol Postgres."""
    return bool(getattr(settings, "SUPABASE_DB_URL", ""))


class _PgCursor:
    """Cursor psycopg: datetime -> string ISO 'Z' agar identik dengan output SQLite."""

    def __init__(self, cur: Any) -> None:
        self._cur = cur

    @staticmethod
    def _norm(row: Any) -> Any:
        if isinstance(row, dict):
            return {
                k: (
                    v.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                    if isinstance(v, datetime)
                    else v
                )
                for k, v in row.items()
            }
        return row

    def fetchone(self) -> Any:
        return self._norm(self._cur.fetchone())

    def fetchall(self) -> list[Any]:
        return [self._norm(r) for r in (self._cur.fetchall() or [])]

    def __iter__(self) -> Iterator[Any]:
        return iter(self.fetchall())


class _PgConn:
    """Koneksi psycopg tipis dengan placeholder gaya SQLite ('?'), kompatibel kode lama."""

    def __init__(self, conn: Any) -> None:
        self._conn = conn

    def execute(self, sql: str, params: Any = ()) -> _PgCursor:
        # SQLite memakai '?', psycopg '%s'; SQL kita tidak memuat literal '?' maupun '%'.
        cur = self._conn.execute(sql.replace("?", "%s"), tuple(params))
        return _PgCursor(cur)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def connect() -> Any:
    if using_postgres():
        import psycopg
        from psycopg.rows import dict_row

        conn = psycopg.connect(settings.SUPABASE_DB_URL, row_factory=dict_row, autocommit=False)
        # ponytail: pgbouncer transaction pooler tidak mendukung prepared statement.
        conn.prepare_threshold = None
        return _PgConn(conn)

    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def transaction() -> Iterator[Any]:
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


# Skema fallback SQLite (lokal/test). Supabase memakai migration tersendiri.
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

# Kolom yang ditambahkan setelah rilis pertama. Dijalankan idempoten saat startup
# (ALTER TABLE hanya bila kolom belum ada) supaya DB produksi lama ikut ter-upgrade.
_ADDED_COLUMNS = (
    ("social_profiles", "campus_branch", "TEXT NOT NULL DEFAULT 'UBSI Pontianak'"),
    ("social_profiles", "major", "TEXT NOT NULL DEFAULT 'Informatika'"),
    ("social_profiles", "class_code", "TEXT"),
    ("social_profiles", "avatar_preset", "TEXT NOT NULL DEFAULT 'mura-welcome'"),
    ("social_profiles", "show_nim", "INTEGER NOT NULL DEFAULT 0"),
    ("social_profiles", "show_class", "INTEGER NOT NULL DEFAULT 0"),
    ("social_profiles", "e2ee_public_key", "TEXT"),
    ("social_profiles", "avatar", "TEXT"),
    ("social_profiles", "banner", "TEXT"),
    ("social_profiles", "is_online", "INTEGER NOT NULL DEFAULT 0"),
    ("social_spaces", "campus_branch", "TEXT"),
    ("social_spaces", "avatar", "TEXT"),
    ("social_spaces", "banner", "TEXT"),
    ("social_messages", "card_type", "TEXT NOT NULL DEFAULT 'none'"),
    ("social_messages", "card_payload", "TEXT NOT NULL DEFAULT '{}'"),
    ("social_messages", "is_encrypted", "INTEGER NOT NULL DEFAULT 0"),
    ("social_messages", "encryption_nonce", "TEXT"),
    ("social_participants", "last_opened_at", "TEXT"),
)


def init_social_db() -> None:
    if using_postgres():
        logger.info("Mira Social v3: memakai Supabase Postgres (skema via migration).")
        return

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
