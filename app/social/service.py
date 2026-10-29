"""Logika bisnis Mira Komunitas.

Semua fungsi publik bersifat sinkron (sqlite3) dan dipanggil router lewat
threadpool. Setiap fungsi tulis mengembalikan `Outcome` berisi data respons
plus daftar `Event` realtime yang harus di-fan-out router setelah commit.

Identitas publik pengguna adalah `username`; NIM tidak pernah keluar dari
lapisan ini.
"""
import json
import re
import secrets
import sqlite3
import string
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

from app.social.db import transaction

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")
CHANNEL_NAME_RE = re.compile(r"^[a-z0-9-]{1,32}$")
MENTION_RE = re.compile(r"(?<![\w@])@([a-zA-Z0-9_]{3,24})\b")

# Key reaksi stabil di DB; frontend memetakan tiap key ke aset Fluent Emoji 3D.
REACTIONS = (
    "heart", "haha", "fire", "up", "wow", "sad",
    "pray", "clap", "party", "hundred", "eyes", "skull",
    "think", "love", "cool", "salute", "rocket", "check",
    "rofl", "sob", "melt", "sparkles",
)
ROLES = ("owner", "admin", "member")
ROLE_RANK = {"owner": 3, "admin": 2, "member": 1}

MAX_BODY = 2000
MAX_OWNED_SPACES = 10
MAX_JOINED_SPACES = 50
MAX_CHANNELS = 20
MAX_MEMBERS = 500
MAX_PINS = 50
PAGE_SIZE = 50
# Online = ada stream realtime aktif (is_online) dan heartbeat belum basi.
# Heartbeat stream tiap 20 detik; jendela 90 detik menoleransi worker yang mati tanpa sempat menulis offline.
ONLINE_WINDOW = timedelta(seconds=90)
MAX_PRESENCE_AUDIENCE = 300
MAX_RECENT_EDITS = 20
_INVITE_ALPHABET = string.ascii_letters + string.digits


class SocialError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


@dataclass
class Event:
    type: str
    recipients: list[str]
    payload: dict[str, Any]


@dataclass
class Outcome:
    data: Any
    events: list[Event] = field(default_factory=list)


# ---------------------------------------------------------------- helpers


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _is_online(row: sqlite3.Row) -> bool:
    seen = _parse_ts(row["last_seen_at"])
    return bool(row["is_online"] and seen and datetime.now(timezone.utc) - seen <= ONLINE_WINDOW)


def _clean(text: Optional[str], limit: int, field_name: str, required: bool = False) -> str:
    value = re.sub(r"\s+", " ", (text or "")).strip()
    if required and not value:
        raise SocialError("VALIDATION_ERROR", f"{field_name} wajib diisi")
    if len(value) > limit:
        raise SocialError("VALIDATION_ERROR", f"{field_name} maksimal {limit} karakter")
    return value


def _clean_body(body: str) -> str:
    # Pertahankan baris baru, buang spasi berlebih di ujung dan baris kosong beruntun.
    value = re.sub(r"\n{3,}", "\n\n", (body or "").replace("\r\n", "\n")).strip()
    if not value:
        raise SocialError("VALIDATION_ERROR", "Pesan tidak boleh kosong")
    if len(value) > MAX_BODY:
        raise SocialError("VALIDATION_ERROR", f"Pesan maksimal {MAX_BODY} karakter")
    return value


def _channel_name(raw: str) -> str:
    name = re.sub(r"[\s_]+", "-", (raw or "").strip().lower())
    name = re.sub(r"-{2,}", "-", name).strip("-")
    if not CHANNEL_NAME_RE.match(name):
        raise SocialError(
            "VALIDATION_ERROR",
            "Nama channel 1-32 karakter: huruf kecil, angka, dan tanda hubung",
        )
    return name


def _new_invite_code() -> str:
    return "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(10))


def _placeholders(items: Iterable[Any]) -> str:
    return ",".join("?" for _ in items)


def _public_profile(row: sqlite3.Row) -> dict[str, Any]:
    keys = row.keys()
    show_nim = bool(row["show_nim"]) if "show_nim" in keys else False
    show_class = bool(row["show_class"]) if "show_class" in keys else False
    avatar = row["avatar_preset"] if "avatar_preset" in keys else "mura-welcome"
    data = {
        "username": row["username"],
        "display_name": row["display_name"],
        "bio": row["bio"] or "",
        "campus_branch": row["campus_branch"] if "campus_branch" in keys else "UBSI Pontianak",
        "major": row["major"] if "major" in keys else "Informatika",
        "avatar": row["avatar"] if "avatar" in keys else None,
        "banner": row["banner"] if "banner" in keys else None,
        "avatar_preset": avatar,
        "avatar_url": f"/avatars/mura/{avatar}.png",
        "hide_id": not show_nim,
        "hide_class": not show_class,
        "e2ee_public_key": row["e2ee_public_key"] if "e2ee_public_key" in keys else None,
        "online": _is_online(row),
        "last_seen_at": row["last_seen_at"],
    }
    if show_nim:
        data["student_id"] = row["nim"]
    if show_class and "class_code" in keys and row["class_code"]:
        data["class_code"] = row["class_code"]
    return data


def _profiles_by_nim(conn: sqlite3.Connection, nims: Iterable[str]) -> dict[str, dict[str, Any]]:
    unique = list({n for n in nims if n})
    if not unique:
        return {}
    rows = conn.execute(
        f"SELECT * FROM social_profiles WHERE nim IN ({_placeholders(unique)})", unique
    ).fetchall()
    return {row["nim"]: _public_profile(row) for row in rows}


def _ghost(nim: str) -> dict[str, Any]:
    return {
        "username": "",
        "display_name": "Pengguna",
        "bio": "",
        "avatar": None,
        "banner": None,
        "online": False,
        "last_seen_at": None,
    }


def _require_profile(conn: sqlite3.Connection, nim: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM social_profiles WHERE nim = ?", (nim,)).fetchone()
    if not row:
        raise SocialError("PROFILE_REQUIRED", "Buat profil Komunitas dulu sebelum mulai mengobrol", 409)
    return row


def _nim_by_username(conn: sqlite3.Connection, username: str) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM social_profiles WHERE username = ?", ((username or "").lstrip("@"),)
    ).fetchone()
    if not row:
        raise SocialError("USER_NOT_FOUND", "Pengguna tidak ditemukan", 404)
    return row


def _space_role(conn: sqlite3.Connection, space_id: int, nim: str) -> Optional[str]:
    row = conn.execute(
        "SELECT role FROM social_members WHERE space_id = ? AND nim = ?", (space_id, nim)
    ).fetchone()
    return row["role"] if row else None


def _require_space_role(conn: sqlite3.Connection, space_id: int, nim: str, minimum: str = "member") -> str:
    role = _space_role(conn, space_id, nim)
    if role is None:
        raise SocialError("SPACE_NOT_FOUND", "Ruang tidak ditemukan atau kamu bukan anggota", 404)
    if ROLE_RANK[role] < ROLE_RANK[minimum]:
        raise SocialError("FORBIDDEN", "Aksi ini khusus admin ruang", 403)
    return role


def _space_members(conn: sqlite3.Connection, space_id: int) -> list[str]:
    return [r["nim"] for r in conn.execute("SELECT nim FROM social_members WHERE space_id = ?", (space_id,))]


def _conversation(conn: sqlite3.Connection, nim: str, conversation_id: int) -> tuple[sqlite3.Row, Optional[str]]:
    """Ambil percakapan yang boleh diakses `nim`; kembalikan (row, role ruang atau None untuk DM)."""
    conv = conn.execute("SELECT * FROM social_conversations WHERE id = ?", (conversation_id,)).fetchone()
    if conv is not None:
        if conv["kind"] == "channel":
            role = _space_role(conn, conv["space_id"], nim)
            if role is not None:
                return conv, role
        elif conn.execute(
            "SELECT 1 FROM social_participants WHERE conversation_id = ? AND nim = ?",
            (conversation_id, nim),
        ).fetchone():
            return conv, None
    raise SocialError("CONVERSATION_NOT_FOUND", "Percakapan tidak ditemukan", 404)


def _recipients(conn: sqlite3.Connection, conv: sqlite3.Row) -> list[str]:
    if conv["kind"] == "channel":
        return _space_members(conn, conv["space_id"])
    return [r["nim"] for r in conn.execute(
        "SELECT nim FROM social_participants WHERE conversation_id = ?", (conv["id"],)
    )]


def _message_row(conn: sqlite3.Connection, nim: str, message_id: int) -> tuple[sqlite3.Row, sqlite3.Row, Optional[str]]:
    msg = conn.execute("SELECT * FROM social_messages WHERE id = ?", (message_id,)).fetchone()
    if not msg:
        raise SocialError("MESSAGE_NOT_FOUND", "Pesan tidak ditemukan", 404)
    conv, role = _conversation(conn, nim, msg["conversation_id"])
    return msg, conv, role


def _preview(body: str, limit: int = 120) -> str:
    flat = re.sub(r"\s+", " ", body).strip()
    return flat if len(flat) <= limit else flat[: limit - 1].rstrip() + "…"


def _serialize_messages(conn: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    reply_ids = [r["reply_to_id"] for r in rows if r["reply_to_id"]]
    replies: dict[int, sqlite3.Row] = {}
    if reply_ids:
        for r in conn.execute(
            f"SELECT id, author_nim, body, deleted_at FROM social_messages WHERE id IN ({_placeholders(reply_ids)})",
            reply_ids,
        ):
            replies[r["id"]] = r

    reactions: dict[int, dict[str, list[str]]] = {}
    for r in conn.execute(
        f"SELECT r.message_id, r.reaction, p.username FROM social_reactions r "
        f"JOIN social_profiles p ON p.nim = r.nim WHERE r.message_id IN ({_placeholders(ids)}) "
        f"ORDER BY r.created_at, r.message_id",
        ids,
    ):
        reactions.setdefault(r["message_id"], {}).setdefault(r["reaction"], []).append(r["username"])

    profiles = _profiles_by_nim(
        conn, [r["author_nim"] for r in rows] + [r["author_nim"] for r in replies.values()]
    )

    out = []
    for r in rows:
        author = profiles.get(r["author_nim"]) or _ghost(r["author_nim"])
        reply = None
        if r["reply_to_id"]:
            target = replies.get(r["reply_to_id"])
            # Pesan yang dihapus hilang total, termasuk dari kutipan balasan.
            if target is not None and not target["deleted_at"]:
                target_author = profiles.get(target["author_nim"]) or _ghost(target["author_nim"])
                reply = {
                    "id": target["id"],
                    "author": {"username": target_author["username"], "display_name": target_author["display_name"]},
                    "preview": _preview(target["body"], 90),
                    "deleted": False,
                }
        deleted = bool(r["deleted_at"])
        keys = r.keys()
        card_type = r["card_type"] if "card_type" in keys else "none"
        card_payload = {}
        if "card_payload" in keys and r["card_payload"]:
            try:
                card_payload = json.loads(r["card_payload"]) if isinstance(r["card_payload"], str) else r["card_payload"]
            except Exception:
                card_payload = {}
        out.append(
            {
                "id": r["id"],
                "conversation_id": r["conversation_id"],
                "author": {"username": author["username"], "display_name": author["display_name"], "avatar": author["avatar"]},
                "body": "" if deleted else r["body"],
                "card_type": card_type,
                "card_payload": card_payload,
                "is_encrypted": bool(r["is_encrypted"]) if "is_encrypted" in keys else False,
                "encryption_nonce": r["encryption_nonce"] if "encryption_nonce" in keys else None,
                "reply_to": reply,
                "reactions": [
                    {"key": key, "count": len(users), "users": users}
                    for key, users in reactions.get(r["id"], {}).items()
                ],
                "pinned": bool(r["pinned_at"]) and not deleted,
                "created_at": r["created_at"],
                "edited_at": r["edited_at"],
                "deleted": deleted,
            }
        )
    return out


def _serialize_message(conn: sqlite3.Connection, message_id: int) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM social_messages WHERE id = ?", (message_id,)).fetchone()
    return _serialize_messages(conn, [row])[0]


def _store_mentions(conn: sqlite3.Connection, conv: sqlite3.Row, message_id: int, body: str, author_nim: str) -> None:
    conn.execute("DELETE FROM social_mentions WHERE message_id = ?", (message_id,))
    usernames = {m.lower() for m in MENTION_RE.findall(body)}
    if not usernames:
        return
    names = list(usernames)
    rows = conn.execute(
        f"SELECT nim FROM social_profiles WHERE username IN ({_placeholders(names)})", names
    ).fetchall()
    allowed = set(_recipients(conn, conv))
    for row in rows:
        if row["nim"] in allowed and row["nim"] != author_nim:
            conn.execute(
                "INSERT INTO social_mentions (message_id, conversation_id, nim) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                (message_id, conv["id"], row["nim"]),
            )


def _set_read(conn: sqlite3.Connection, conversation_id: int, nim: str, message_id: int) -> int:
    conn.execute(
        "INSERT INTO social_participants (conversation_id, nim, last_read_id) VALUES (?, ?, ?) "
        "ON CONFLICT(conversation_id, nim) DO UPDATE SET "
        "last_read_id = MAX(last_read_id, excluded.last_read_id)",
        (conversation_id, nim, message_id),
    )
    row = conn.execute(
        "SELECT last_read_id FROM social_participants WHERE conversation_id = ? AND nim = ?",
        (conversation_id, nim),
    ).fetchone()
    return int(row["last_read_id"])


def _channel_summary(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "kind": "channel",
        "space_id": row["space_id"],
        "name": row["name"],
        "topic": row["topic"],
        "position": row["position"],
        "admin_only": bool(row["admin_only"]) if "admin_only" in row.keys() else False,
    }


def _space_summary(conn: sqlite3.Connection, space: sqlite3.Row, role: Optional[str]) -> dict[str, Any]:
    member_count = conn.execute(
        "SELECT COUNT(*) AS c FROM social_members WHERE space_id = ?", (space["id"],)
    ).fetchone()["c"]
    keys = space.keys()
    data = {
        "id": space["id"],
        "name": space["name"],
        "description": space["description"],
        "campus_branch": space["campus_branch"] if "campus_branch" in keys else None,
        "is_public": bool(space["is_public"]),
        "avatar": space["avatar"],
        "banner": space["banner"],
        "member_count": member_count,
        "my_role": role,
        "created_at": space["created_at"],
    }
    if role is not None:
        data["invite_code"] = space["invite_code"]
    return data


def _space_detail(conn: sqlite3.Connection, space_id: int, role: str) -> dict[str, Any]:
    space = conn.execute("SELECT * FROM social_spaces WHERE id = ?", (space_id,)).fetchone()
    channels = conn.execute(
        "SELECT * FROM social_conversations WHERE space_id = ? ORDER BY position, id", (space_id,)
    ).fetchall()
    data = _space_summary(conn, space, role)
    data["channels"] = [_channel_summary(c) for c in channels]
    return data


# ---------------------------------------------------------------- profiles


def get_me(nim: str) -> Optional[dict[str, Any]]:
    with transaction() as conn:
        row = conn.execute("SELECT * FROM social_profiles WHERE nim = ?", (nim,)).fetchone()
        return _public_profile(row) if row else None


def upsert_me(
    nim: str,
    username: str,
    display_name: str,
    bio: str = "",
    campus_branch: Optional[str] = None,
    major: Optional[str] = None,
    class_code: Optional[str] = None,
    avatar_preset: Optional[str] = None,
    show_nim: Optional[bool] = None,
    show_class: Optional[bool] = None,
    e2ee_public_key: Optional[str] = None,
) -> Outcome:
    handle = (username or "").strip().lstrip("@").lower()
    if not USERNAME_RE.match(handle):
        raise SocialError("VALIDATION_ERROR", "Username 3-24 karakter: huruf kecil, angka, atau garis bawah")
    name = _clean(display_name, 40, "Nama tampilan", required=True)
    about = _clean(bio, 160, "Bio")
    branch = _clean(campus_branch or "UBSI Pontianak", 80, "Cabang kampus")
    prodi = _clean(major or "Informatika", 80, "Program studi")
    c_code = _clean(class_code, 20, "Kode kelas") if class_code else None
    avatar = _clean(avatar_preset or "mura-welcome", 40, "Avatar")
    pubkey = _clean(e2ee_public_key, 256, "Kunci publik E2EE") if e2ee_public_key else None
    with transaction() as conn:
        taken = conn.execute(
            "SELECT nim FROM social_profiles WHERE username = ?", (handle,)
        ).fetchone()
        if taken and taken["nim"] != nim:
            raise SocialError("USERNAME_TAKEN", "Username sudah dipakai, coba yang lain", 409)
        conn.execute(
            "INSERT INTO social_profiles (nim, username, display_name, bio, campus_branch, major, class_code, avatar_preset, show_nim, show_class, e2ee_public_key, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(nim) DO UPDATE SET username = excluded.username, "
            "display_name = excluded.display_name, bio = excluded.bio, "
            "campus_branch = COALESCE(excluded.campus_branch, social_profiles.campus_branch), "
            "major = COALESCE(excluded.major, social_profiles.major), "
            "class_code = COALESCE(excluded.class_code, social_profiles.class_code), "
            "avatar_preset = COALESCE(excluded.avatar_preset, social_profiles.avatar_preset), "
            "show_nim = COALESCE(excluded.show_nim, social_profiles.show_nim), "
            "show_class = COALESCE(excluded.show_class, social_profiles.show_class), "
            "e2ee_public_key = COALESCE(excluded.e2ee_public_key, social_profiles.e2ee_public_key)",
            (
                nim,
                handle,
                name,
                about,
                branch,
                prodi,
                c_code,
                avatar,
                bool(show_nim),
                bool(show_class),
                pubkey,
                _now(),
            ),
        )
        row = conn.execute("SELECT * FROM social_profiles WHERE nim = ?", (nim,)).fetchone()
        return Outcome(_public_profile(row))


def touch_seen(nim: str) -> None:
    with transaction() as conn:
        conn.execute("UPDATE social_profiles SET last_seen_at = ? WHERE nim = ?", (_now(), nim))


MURA_AVATAR_FILES = frozenset({
    "mura-buku-tumpuk.png",
    "mura_empty_library.png",
    "mura-empty.png",
    "mura-kuis.png",
    "mura_maintenance.png",
    "mura-nilai.png",
    "mura_stream_broken.png",
    "mura-tugas-done.png",
    "mura_welcome.png",
    "velnime-empty-search.png",
})


def _require_media(media_id: Optional[str]) -> Optional[str]:
    from app.social import media

    if media_id is None:
        return None
    # Preset maskot resmi Mura (disajikan langsung oleh landing page publik).
    if media_id.startswith("/avatars/mura/"):
        filename = media_id.split("/")[-1]
        if filename in MURA_AVATAR_FILES:
            return media_id
        raise SocialError("MEDIA_NOT_FOUND", "Preset maskot tidak dikenali", 404)
    if media.path_for(media_id) is None:
        raise SocialError("MEDIA_NOT_FOUND", "Gambar tidak ditemukan, unggah ulang", 404)
    return media_id


def set_profile_media(nim: str, changes: dict[str, Optional[str]]) -> Outcome:
    """`changes` hanya berisi field yang dikirim klien: {"avatar": id|None, "banner": id|None}."""
    with transaction() as conn:
        me = _require_profile(conn, nim)
        for field in ("avatar", "banner"):
            if field in changes:
                conn.execute(
                    f"UPDATE social_profiles SET {field} = ? WHERE nim = ?", (_require_media(changes[field]), nim)
                )
        row = conn.execute("SELECT * FROM social_profiles WHERE nim = ?", (nim,)).fetchone()
        profile = _public_profile(row)
        audience = _presence_audience(conn, nim)
        return Outcome(profile, [Event("profile.updated", audience, {"username": me["username"], "profile": profile})])


def _presence_audience(conn: sqlite3.Connection, nim: str) -> list[str]:
    """Siapa yang perlu tahu perubahan status/profil: lawan DM dan sesama anggota ruang."""
    rows = conn.execute(
        "SELECT DISTINCT p2.nim FROM social_participants p1 "
        "JOIN social_conversations c ON c.id = p1.conversation_id AND c.kind = 'dm' "
        "JOIN social_participants p2 ON p2.conversation_id = c.id "
        "WHERE p1.nim = ? "
        "UNION SELECT DISTINCT m2.nim FROM social_members m1 "
        "JOIN social_members m2 ON m2.space_id = m1.space_id WHERE m1.nim = ? "
        "LIMIT ?",
        (nim, nim, MAX_PRESENCE_AUDIENCE),
    ).fetchall()
    return [r["nim"] for r in rows]


def set_presence(nim: str, online: bool) -> Optional[Event]:
    """Dipanggil stream saat koneksi pertama dibuka / terakhir ditutup."""
    with transaction() as conn:
        row = conn.execute("SELECT username FROM social_profiles WHERE nim = ?", (nim,)).fetchone()
        now = _now()
        conn.execute(
            "UPDATE social_profiles SET is_online = ?, last_seen_at = ? WHERE nim = ?", (1 if online else 0, now, nim)
        )
        if not row:
            return None
        payload = {"username": row["username"], "online": online, "last_seen_at": now}
        return Event("presence", _presence_audience(conn, nim), payload)


def search_users(nim: str, query: str) -> list[dict[str, Any]]:
    q = (query or "").strip().lstrip("@").lower()
    if len(q) < 2:
        return []
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    with transaction() as conn:
        rows = conn.execute(
            "SELECT * FROM social_profiles WHERE nim != ? AND "
            "(username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\') "
            "ORDER BY (username LIKE ? ESCAPE '\\') DESC, username LIMIT 20",
            (nim, f"{escaped}%", f"%{escaped}%", f"{escaped}%"),
        ).fetchall()
        return [_public_profile(r) for r in rows]


def get_user(username: str) -> dict[str, Any]:
    with transaction() as conn:
        return _public_profile(_nim_by_username(conn, username))


def get_radar(
    nim: str,
    branch: Optional[str] = None,
    major: Optional[str] = None,
    limit: int = 30,
) -> list[dict[str, Any]]:
    """Daftar mahasiswa aktif per cabang/prodi untuk radar & direktori teman."""
    cap = max(1, min(limit, 50))
    query = "SELECT * FROM social_profiles WHERE nim != ?"
    params: list[Any] = [nim]
    if branch:
        query += " AND campus_branch = ?"
        params.append(branch)
    if major:
        query += " AND major = ?"
        params.append(major)
    query += " ORDER BY last_seen_at DESC LIMIT ?"
    params.append(cap)
    with transaction() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()
        return [_public_profile(r) for r in rows]


# ---------------------------------------------------------------- inbox


def inbox(nim: str) -> dict[str, Any]:
    """Satu panggilan untuk sidebar: DM, ruang, channel, unread, dan mention."""
    with transaction() as conn:
        me = conn.execute("SELECT * FROM social_profiles WHERE nim = ?", (nim,)).fetchone()
        dm_rows = conn.execute(
            "SELECT c.*, p.last_read_id FROM social_participants p "
            "JOIN social_conversations c ON c.id = p.conversation_id "
            "WHERE p.nim = ? AND c.kind = 'dm'",
            (nim,),
        ).fetchall()
        space_rows = conn.execute(
            "SELECT s.*, m.role FROM social_members m JOIN social_spaces s ON s.id = m.space_id "
            "WHERE m.nim = ? ORDER BY m.joined_at, s.id",
            (nim,),
        ).fetchall()
        space_ids = [s["id"] for s in space_rows]
        channel_rows = (
            conn.execute(
                f"SELECT c.*, COALESCE(p.last_read_id, 0) AS last_read_id FROM social_conversations c "
                f"LEFT JOIN social_participants p ON p.conversation_id = c.id AND p.nim = ? "
                f"WHERE c.space_id IN ({_placeholders(space_ids)}) ORDER BY c.position, c.id",
                [nim, *space_ids],
            ).fetchall()
            if space_ids
            else []
        )

        conv_ids = [r["id"] for r in dm_rows] + [r["id"] for r in channel_rows]
        unread: dict[int, int] = {}
        mentions: dict[int, int] = {}
        last_messages: dict[int, sqlite3.Row] = {}
        if conv_ids:
            ph = _placeholders(conv_ids)
            for r in conn.execute(
                f"SELECT c.id, COUNT(m.id) AS n FROM social_conversations c "
                f"LEFT JOIN social_participants p ON p.conversation_id = c.id AND p.nim = ? "
                f"JOIN social_messages m ON m.conversation_id = c.id "
                f"AND m.id > COALESCE(p.last_read_id, 0) AND m.author_nim != ? AND m.deleted_at IS NULL "
                f"WHERE c.id IN ({ph}) GROUP BY c.id",
                [nim, nim, *conv_ids],
            ):
                unread[r["id"]] = r["n"]
            for r in conn.execute(
                f"SELECT mt.conversation_id AS id, COUNT(*) AS n FROM social_mentions mt "
                f"LEFT JOIN social_participants p ON p.conversation_id = mt.conversation_id AND p.nim = mt.nim "
                f"WHERE mt.nim = ? AND mt.conversation_id IN ({ph}) "
                f"AND mt.message_id > COALESCE(p.last_read_id, 0) GROUP BY mt.conversation_id",
                [nim, *conv_ids],
            ):
                mentions[r["id"]] = r["n"]
            last_ids = [r["last_message_id"] for r in [*dm_rows, *channel_rows] if r["last_message_id"]]
            if last_ids:
                for r in conn.execute(
                    f"SELECT * FROM social_messages WHERE id IN ({_placeholders(last_ids)})", last_ids
                ):
                    last_messages[r["id"]] = r

        peers: dict[int, str] = {}
        peer_read: dict[int, int] = {}
        dm_ids = [r["id"] for r in dm_rows]
        if dm_ids:
            for r in conn.execute(
                f"SELECT conversation_id, nim, last_read_id FROM social_participants "
                f"WHERE conversation_id IN ({_placeholders(dm_ids)}) AND nim != ?",
                [*dm_ids, nim],
            ):
                peers[r["conversation_id"]] = r["nim"]
                peer_read[r["conversation_id"]] = r["last_read_id"]

        author_nims = [m["author_nim"] for m in last_messages.values()]
        profiles = _profiles_by_nim(conn, [*peers.values(), *author_nims, nim])

        def last_message(row: sqlite3.Row) -> Optional[dict[str, Any]]:
            msg = last_messages.get(row["last_message_id"])
            if msg is None:
                return None
            author = profiles.get(msg["author_nim"]) or _ghost(msg["author_nim"])
            return {
                "id": msg["id"],
                "author": {"username": author["username"], "display_name": author["display_name"]},
                "preview": "Pesan dihapus" if msg["deleted_at"] else _preview(msg["body"]),
                "deleted": bool(msg["deleted_at"]),
                "created_at": msg["created_at"],
            }

        dms = []
        for row in dm_rows:
            peer_nim = peers.get(row["id"], nim)
            is_saved = peer_nim == nim
            dms.append(
                {
                    "id": row["id"],
                    "kind": "dm",
                    "is_saved": is_saved,
                    "peer": profiles.get(peer_nim) or _ghost(peer_nim),
                    "last_message": last_message(row),
                    "last_read_id": row["last_read_id"],
                    "peer_last_read_id": row["last_read_id"] if is_saved else peer_read.get(row["id"], 0),
                    "unread": 0 if is_saved else unread.get(row["id"], 0),
                    "mentions": 0,
                }
            )
        dms.sort(key=lambda d: (not d["is_saved"], -(d["last_message"] or {}).get("id", 0), -d["id"]))

        channels_by_space: dict[int, list[dict[str, Any]]] = {}
        for row in channel_rows:
            item = _channel_summary(row)
            item.update(
                last_message=last_message(row),
                last_read_id=row["last_read_id"],
                unread=unread.get(row["id"], 0),
                mentions=mentions.get(row["id"], 0),
            )
            channels_by_space.setdefault(row["space_id"], []).append(item)

        spaces = []
        for s in space_rows:
            item = _space_summary(conn, s, s["role"])
            item["channels"] = channels_by_space.get(s["id"], [])
            item["unread"] = sum(c["unread"] for c in item["channels"])
            item["mentions"] = sum(c["mentions"] for c in item["channels"])
            spaces.append(item)

        return {"me": _public_profile(me) if me else None, "dms": dms, "spaces": spaces}


# ---------------------------------------------------------------- spaces


def create_space(
    nim: str,
    name: str,
    description: str = "",
    is_public: bool = False,
    campus_branch: Optional[str] = None,
) -> Outcome:
    title = _clean(name, 40, "Nama ruang", required=True)
    if len(title) < 2:
        raise SocialError("VALIDATION_ERROR", "Nama ruang minimal 2 karakter")
    about = _clean(description, 200, "Deskripsi")
    branch = _clean(campus_branch, 80, "Cabang kampus") if campus_branch else None
    with transaction() as conn:
        _require_profile(conn, nim)
        owned = conn.execute(
            "SELECT COUNT(*) AS c FROM social_spaces WHERE owner_nim = ?", (nim,)
        ).fetchone()["c"]
        if owned >= MAX_OWNED_SPACES:
            raise SocialError("SPACE_LIMIT", f"Maksimal {MAX_OWNED_SPACES} ruang yang kamu buat")
        joined = conn.execute("SELECT COUNT(*) AS c FROM social_members WHERE nim = ?", (nim,)).fetchone()["c"]
        if joined >= MAX_JOINED_SPACES:
            raise SocialError("SPACE_LIMIT", f"Maksimal bergabung di {MAX_JOINED_SPACES} ruang")
        space_id = conn.execute(
            "INSERT INTO social_spaces (name, description, owner_nim, invite_code, is_public, campus_branch) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            (title, about, nim, _new_invite_code(), bool(is_public), branch),
        ).fetchone()["id"]
        conn.execute(
            "INSERT INTO social_members (space_id, nim, role) VALUES (?, ?, 'owner')", (space_id, nim)
        )
        conn.execute(
            "INSERT INTO social_conversations (kind, space_id, name, topic) VALUES ('channel', ?, 'umum', ?)",
            (space_id, "Obrolan umum anggota ruang"),
        )
        detail = _space_detail(conn, int(space_id), "owner")
        return Outcome(detail, [Event("space.updated", [nim], {"space_id": space_id})])


def get_space(nim: str, space_id: int) -> dict[str, Any]:
    with transaction() as conn:
        role = _require_space_role(conn, space_id, nim)
        return _space_detail(conn, space_id, role)


def update_space(
    nim: str,
    space_id: int,
    name: Optional[str],
    description: Optional[str],
    is_public: Optional[bool],
    campus_branch: Optional[str] = None,
) -> Outcome:
    with transaction() as conn:
        role = _require_space_role(conn, space_id, nim, "admin")
        if name is not None:
            title = _clean(name, 40, "Nama ruang", required=True)
            if len(title) < 2:
                raise SocialError("VALIDATION_ERROR", "Nama ruang minimal 2 karakter")
            conn.execute("UPDATE social_spaces SET name = ? WHERE id = ?", (title, space_id))
        if description is not None:
            conn.execute(
                "UPDATE social_spaces SET description = ? WHERE id = ?",
                (_clean(description, 200, "Deskripsi"), space_id),
            )
        if is_public is not None:
            conn.execute("UPDATE social_spaces SET is_public = ? WHERE id = ?", (bool(is_public), space_id))
        if campus_branch is not None:
            branch = _clean(campus_branch, 80, "Cabang kampus") if campus_branch else None
            conn.execute("UPDATE social_spaces SET campus_branch = ? WHERE id = ?", (branch, space_id))
        detail = _space_detail(conn, space_id, role)
        return Outcome(detail, [Event("space.updated", _space_members(conn, space_id), {"space_id": space_id})])


def delete_space(nim: str, space_id: int) -> Outcome:
    with transaction() as conn:
        _require_space_role(conn, space_id, nim, "owner")
        members = _space_members(conn, space_id)
        # FK ON DELETE CASCADE ikut menghapus anggota, channel, pesan, reaksi, dan mention.
        conn.execute("DELETE FROM social_spaces WHERE id = ?", (space_id,))
        return Outcome({"deleted": True, "id": space_id}, [Event("space.removed", members, {"space_id": space_id})])


def discover_spaces(nim: str, query: str = "") -> list[dict[str, Any]]:
    q = (query or "").strip()
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    with transaction() as conn:
        rows = conn.execute(
            "SELECT s.*, (SELECT COUNT(*) FROM social_members m WHERE m.space_id = s.id) AS members, "
            "(SELECT COUNT(*) FROM social_members m JOIN social_profiles p ON p.nim = m.nim "
            " WHERE m.space_id = s.id AND p.is_online = 1 AND p.last_seen_at >= ?) AS online, "
            "(SELECT role FROM social_members m WHERE m.space_id = s.id AND m.nim = ?) AS my_role "
            "FROM social_spaces s WHERE s.is_public = 1 AND "
            "(s.name LIKE ? ESCAPE '\\' OR s.description LIKE ? ESCAPE '\\') "
            "ORDER BY members DESC, s.id DESC LIMIT 30",
            (
                (datetime.now(timezone.utc) - ONLINE_WINDOW).strftime("%Y-%m-%dT%H:%M:%SZ"),
                nim,
                f"%{escaped}%",
                f"%{escaped}%",
            ),
        ).fetchall()
        result = []
        for r in rows:
            item = {
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "is_public": True,
                "avatar": r["avatar"],
                "banner": r["banner"],
                "member_count": r["members"],
                "online_count": r["online"],
                "my_role": r["my_role"],
                "created_at": r["created_at"],
            }
            result.append(item)
        return result


def _join(conn: sqlite3.Connection, nim: str, space: sqlite3.Row) -> Outcome:
    _require_profile(conn, nim)
    space_id = space["id"]
    existing = _space_role(conn, space_id, nim)
    if existing:
        return Outcome(_space_detail(conn, space_id, existing))
    if conn.execute("SELECT COUNT(*) AS c FROM social_members WHERE space_id = ?", (space_id,)).fetchone()["c"] >= MAX_MEMBERS:
        raise SocialError("SPACE_FULL", f"Ruang sudah penuh ({MAX_MEMBERS} anggota)")
    if conn.execute("SELECT COUNT(*) AS c FROM social_members WHERE nim = ?", (nim,)).fetchone()["c"] >= MAX_JOINED_SPACES:
        raise SocialError("SPACE_LIMIT", f"Maksimal bergabung di {MAX_JOINED_SPACES} ruang")
    conn.execute("INSERT INTO social_members (space_id, nim, role) VALUES (?, ?, 'member')", (space_id, nim))
    # Anggota baru mulai dari kondisi "sudah dibaca" supaya riwayat lama tidak jadi tumpukan unread.
    conn.execute(
        "INSERT OR REPLACE INTO social_participants (conversation_id, nim, last_read_id) "
        "SELECT id, ?, COALESCE(last_message_id, 0) FROM social_conversations WHERE space_id = ?",
        (nim, space_id),
    )
    detail = _space_detail(conn, space_id, "member")
    return Outcome(detail, [Event("space.updated", _space_members(conn, space_id), {"space_id": space_id})])


def join_by_invite(nim: str, invite_code: str) -> Outcome:
    code = (invite_code or "").strip().rsplit("/", 1)[-1]
    with transaction() as conn:
        space = conn.execute("SELECT * FROM social_spaces WHERE invite_code = ?", (code,)).fetchone()
        if not space:
            raise SocialError("INVITE_INVALID", "Kode undangan tidak valid atau sudah diganti", 404)
        return _join(conn, nim, space)


def join_public(nim: str, space_id: int) -> Outcome:
    with transaction() as conn:
        space = conn.execute(
            "SELECT * FROM social_spaces WHERE id = ? AND is_public = 1", (space_id,)
        ).fetchone()
        if not space:
            raise SocialError("SPACE_NOT_FOUND", "Ruang publik tidak ditemukan", 404)
        return _join(conn, nim, space)


def leave_space(nim: str, space_id: int) -> Outcome:
    with transaction() as conn:
        role = _require_space_role(conn, space_id, nim)
        if role == "owner":
            raise SocialError("OWNER_CANNOT_LEAVE", "Pemilik tidak bisa keluar. Serahkan kepemilikan atau hapus ruang.")
        _remove_member(conn, space_id, nim)
        events = [
            Event("space.removed", [nim], {"space_id": space_id}),
            Event("space.updated", _space_members(conn, space_id), {"space_id": space_id}),
        ]
        return Outcome({"left": True, "id": space_id}, events)


def _remove_member(conn: sqlite3.Connection, space_id: int, nim: str) -> None:
    conn.execute("DELETE FROM social_members WHERE space_id = ? AND nim = ?", (space_id, nim))
    conn.execute(
        "DELETE FROM social_participants WHERE nim = ? AND conversation_id IN "
        "(SELECT id FROM social_conversations WHERE space_id = ?)",
        (nim, space_id),
    )


def reset_invite(nim: str, space_id: int) -> Outcome:
    with transaction() as conn:
        role = _require_space_role(conn, space_id, nim, "admin")
        conn.execute("UPDATE social_spaces SET invite_code = ? WHERE id = ?", (_new_invite_code(), space_id))
        return Outcome(_space_detail(conn, space_id, role))


def set_space_media(nim: str, space_id: int, changes: dict[str, Optional[str]]) -> Outcome:
    with transaction() as conn:
        role = _require_space_role(conn, space_id, nim, "admin")
        for field in ("avatar", "banner"):
            if field in changes:
                conn.execute(
                    f"UPDATE social_spaces SET {field} = ? WHERE id = ?", (_require_media(changes[field]), space_id)
                )
        detail = _space_detail(conn, space_id, role)
        return Outcome(detail, [Event("space.updated", _space_members(conn, space_id), {"space_id": space_id})])


def invite_preview(nim: str, invite_code: str) -> dict[str, Any]:
    """Kartu preview link undangan di dalam chat (siapa pun yang memegang kode boleh melihat)."""
    code = (invite_code or "").strip()
    with transaction() as conn:
        space = conn.execute("SELECT * FROM social_spaces WHERE invite_code = ?", (code,)).fetchone()
        if not space:
            raise SocialError("INVITE_INVALID", "Link undangan tidak valid atau sudah diganti", 404)
        role = _space_role(conn, space["id"], nim)
        data = _space_summary(conn, space, role)
        data.pop("invite_code", None)
        data["online_count"] = conn.execute(
            "SELECT COUNT(*) AS c FROM social_members m JOIN social_profiles p ON p.nim = m.nim "
            "WHERE m.space_id = ? AND p.is_online = 1 AND p.last_seen_at >= ?",
            (space["id"], (datetime.now(timezone.utc) - ONLINE_WINDOW).strftime("%Y-%m-%dT%H:%M:%SZ")),
        ).fetchone()["c"]
        data["joined"] = role is not None
        return data


def list_members(nim: str, space_id: int) -> list[dict[str, Any]]:
    with transaction() as conn:
        _require_space_role(conn, space_id, nim)
        rows = conn.execute(
            "SELECT p.*, m.role, m.joined_at FROM social_members m "
            "JOIN social_profiles p ON p.nim = m.nim WHERE m.space_id = ?",
            (space_id,),
        ).fetchall()
        members = [{**_public_profile(r), "role": r["role"], "joined_at": r["joined_at"]} for r in rows]
        members.sort(key=lambda m: (-ROLE_RANK[m["role"]], not m["online"], m["display_name"].lower()))
        return members


def set_member_role(nim: str, space_id: int, username: str, role: str) -> Outcome:
    if role not in ROLES:
        raise SocialError("VALIDATION_ERROR", "Role tidak dikenal")
    with transaction() as conn:
        _require_space_role(conn, space_id, nim, "owner")
        target = _nim_by_username(conn, username)
        current = _space_role(conn, space_id, target["nim"])
        if current is None:
            raise SocialError("USER_NOT_FOUND", "Pengguna bukan anggota ruang ini", 404)
        if target["nim"] == nim:
            raise SocialError("VALIDATION_ERROR", "Tidak bisa mengubah role sendiri")
        if role == "owner":
            conn.execute("UPDATE social_members SET role = 'admin' WHERE space_id = ? AND nim = ?", (space_id, nim))
            conn.execute("UPDATE social_spaces SET owner_nim = ? WHERE id = ?", (target["nim"], space_id))
        conn.execute(
            "UPDATE social_members SET role = ? WHERE space_id = ? AND nim = ?", (role, space_id, target["nim"])
        )
        return Outcome(
            {"username": target["username"], "role": role},
            [Event("space.updated", _space_members(conn, space_id), {"space_id": space_id})],
        )


def kick_member(nim: str, space_id: int, username: str) -> Outcome:
    with transaction() as conn:
        my_role = _require_space_role(conn, space_id, nim, "admin")
        target = _nim_by_username(conn, username)
        their_role = _space_role(conn, space_id, target["nim"])
        if their_role is None:
            raise SocialError("USER_NOT_FOUND", "Pengguna bukan anggota ruang ini", 404)
        if ROLE_RANK[their_role] >= ROLE_RANK[my_role]:
            raise SocialError("FORBIDDEN", "Kamu tidak bisa mengeluarkan anggota dengan role setara atau lebih tinggi", 403)
        _remove_member(conn, space_id, target["nim"])
        return Outcome(
            {"removed": True, "username": target["username"]},
            [
                Event("space.removed", [target["nim"]], {"space_id": space_id}),
                Event("space.updated", _space_members(conn, space_id), {"space_id": space_id}),
            ],
        )


# ---------------------------------------------------------------- channels


def create_channel(nim: str, space_id: int, name: str, topic: str = "") -> Outcome:
    channel = _channel_name(name)
    about = _clean(topic, 120, "Topik")
    with transaction() as conn:
        _require_space_role(conn, space_id, nim, "admin")
        rows = conn.execute(
            "SELECT name, position FROM social_conversations WHERE space_id = ?", (space_id,)
        ).fetchall()
        if len(rows) >= MAX_CHANNELS:
            raise SocialError("CHANNEL_LIMIT", f"Maksimal {MAX_CHANNELS} channel per ruang")
        if any(r["name"] == channel for r in rows):
            raise SocialError("CHANNEL_EXISTS", "Nama channel sudah dipakai di ruang ini", 409)
        position = max((r["position"] for r in rows), default=0) + 1
        conv_id = conn.execute(
            "INSERT INTO social_conversations (kind, space_id, name, topic, position) VALUES ('channel', ?, ?, ?, ?) RETURNING id",
            (space_id, channel, about, position),
        ).fetchone()["id"]
        row = conn.execute("SELECT * FROM social_conversations WHERE id = ?", (conv_id,)).fetchone()
        return Outcome(
            _channel_summary(row),
            [Event("space.updated", _space_members(conn, space_id), {"space_id": space_id})],
        )


def update_channel(
    nim: str,
    conversation_id: int,
    name: Optional[str],
    topic: Optional[str],
    admin_only: Optional[bool] = None,
) -> Outcome:
    with transaction() as conn:
        conv, _ = _conversation(conn, nim, conversation_id)
        if conv["kind"] != "channel":
            raise SocialError("VALIDATION_ERROR", "Hanya channel ruang yang bisa diubah")
        _require_space_role(conn, conv["space_id"], nim, "admin")
        if name is not None:
            channel = _channel_name(name)
            clash = conn.execute(
                "SELECT 1 FROM social_conversations WHERE space_id = ? AND name = ? AND id != ?",
                (conv["space_id"], channel, conversation_id),
            ).fetchone()
            if clash:
                raise SocialError("CHANNEL_EXISTS", "Nama channel sudah dipakai di ruang ini", 409)
            conn.execute("UPDATE social_conversations SET name = ? WHERE id = ?", (channel, conversation_id))
        if topic is not None:
            conn.execute(
                "UPDATE social_conversations SET topic = ? WHERE id = ?",
                (_clean(topic, 120, "Topik"), conversation_id),
            )
        if admin_only is not None:
            conn.execute(
                "UPDATE social_conversations SET admin_only = ? WHERE id = ?", (1 if admin_only else 0, conversation_id)
            )
        row = conn.execute("SELECT * FROM social_conversations WHERE id = ?", (conversation_id,)).fetchone()
        return Outcome(
            _channel_summary(row),
            [Event("space.updated", _space_members(conn, conv["space_id"]), {"space_id": conv["space_id"]})],
        )


def reorder_channels(nim: str, space_id: int, ids: list[int]) -> Outcome:
    """Atur urutan channel (admin). `ids` harus berisi tepat semua channel ruang ini."""
    with transaction() as conn:
        _require_space_role(conn, space_id, nim, "admin")
        current = {r["id"] for r in conn.execute("SELECT id FROM social_conversations WHERE space_id = ?", (space_id,))}
        if set(ids) != current or len(ids) != len(current):
            raise SocialError("VALIDATION_ERROR", "Daftar channel tidak cocok dengan channel di ruang ini")
        for position, cid in enumerate(ids):
            conn.execute("UPDATE social_conversations SET position = ? WHERE id = ?", (position, cid))
        detail = _space_detail(conn, space_id, _space_role(conn, space_id, nim) or "admin")
        return Outcome(detail, [Event("space.updated", _space_members(conn, space_id), {"space_id": space_id})])


def delete_channel(nim: str, conversation_id: int) -> Outcome:
    with transaction() as conn:
        conv, _ = _conversation(conn, nim, conversation_id)
        if conv["kind"] != "channel":
            raise SocialError("VALIDATION_ERROR", "Hanya channel ruang yang bisa dihapus")
        _require_space_role(conn, conv["space_id"], nim, "admin")
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM social_conversations WHERE space_id = ?", (conv["space_id"],)
        ).fetchone()["c"]
        if total <= 1:
            raise SocialError("VALIDATION_ERROR", "Ruang wajib punya minimal satu channel")
        conn.execute("DELETE FROM social_conversations WHERE id = ?", (conversation_id,))
        return Outcome(
            {"deleted": True, "id": conversation_id},
            [Event("space.updated", _space_members(conn, conv["space_id"]), {"space_id": conv["space_id"]})],
        )


# ---------------------------------------------------------------- direct messages


def open_dm(nim: str, username: str) -> Outcome:
    with transaction() as conn:
        _require_profile(conn, nim)
        peer = _nim_by_username(conn, username)
        pair = sorted([nim, peer["nim"]])
        key = f"{pair[0]}:{pair[1]}"
        conv = conn.execute("SELECT * FROM social_conversations WHERE dm_key = ?", (key,)).fetchone()
        if conv is None:
            conv_id = conn.execute(
                "INSERT INTO social_conversations (kind, dm_key) VALUES ('dm', ?) RETURNING id", (key,)
            ).fetchone()["id"]
            for member in set(pair):
                conn.execute(
                    "INSERT INTO social_participants (conversation_id, nim) VALUES (?, ?) ON CONFLICT DO NOTHING",
                    (conv_id, member),
                )
        else:
            conv_id = conv["id"]
        return Outcome(
            {"id": conv_id, "kind": "dm", "is_saved": peer["nim"] == nim, "peer": _public_profile(peer)}
        )


# ---------------------------------------------------------------- messages


def list_messages(
    nim: str,
    conversation_id: int,
    before: Optional[int] = None,
    after: Optional[int] = None,
    limit: int = PAGE_SIZE,
) -> dict[str, Any]:
    limit = max(1, min(limit, 100))
    with transaction() as conn:
        conv, role = _conversation(conn, nim, conversation_id)
        if after is not None:
            rows = conn.execute(
                "SELECT * FROM social_messages WHERE conversation_id = ? AND id > ? AND deleted_at IS NULL "
                "ORDER BY id LIMIT ?",
                (conversation_id, after, limit + 1),
            ).fetchall()
            has_more = len(rows) > limit
            rows = rows[:limit]
        else:
            params: list[Any] = [conversation_id]
            clause = ""
            if before is not None:
                clause = "AND id < ?"
                params.append(before)
            rows = conn.execute(
                f"SELECT * FROM social_messages WHERE conversation_id = ? AND deleted_at IS NULL {clause} "
                f"ORDER BY id DESC LIMIT ?",
                [*params, limit + 1],
            ).fetchall()
            has_more = len(rows) > limit
            rows = list(reversed(rows[:limit]))

        peer_last_read_id = None
        if conv["kind"] == "dm":
            peer = conn.execute(
                "SELECT last_read_id FROM social_participants WHERE conversation_id = ? AND nim != ?",
                (conversation_id, nim),
            ).fetchone()
            peer_last_read_id = peer["last_read_id"] if peer else None
        mine = conn.execute(
            "SELECT last_read_id, last_opened_at FROM social_participants WHERE conversation_id = ? AND nim = ?",
            (conversation_id, nim),
        ).fetchone()
        recent_edits: list[dict[str, Any]] = []
        if before is None and after is None:
            recent_edits = _recent_edits(conn, conversation_id, nim, mine["last_opened_at"] if mine else None)
            conn.execute(
                "INSERT INTO social_participants (conversation_id, nim, last_opened_at) VALUES (?, ?, ?) "
                "ON CONFLICT(conversation_id, nim) DO UPDATE SET last_opened_at = excluded.last_opened_at",
                (conversation_id, nim, _now()),
            )
        return {
            "conversation_id": conversation_id,
            "messages": _serialize_messages(conn, rows),
            "has_more": has_more,
            "my_role": role,
            "last_read_id": mine["last_read_id"] if mine else 0,
            "peer_last_read_id": peer_last_read_id,
            "recent_edits": recent_edits,
        }


def _recent_edits(conn: sqlite3.Connection, conversation_id: int, nim: str, since: Optional[str]) -> list[dict[str, Any]]:
    """Pesan orang lain yang diedit sejak `nim` terakhir membuka percakapan ini."""
    if not since:
        return []
    rows = conn.execute(
        "SELECT m.id, m.body, m.edited_at, p.username, p.display_name FROM social_messages m "
        "LEFT JOIN social_profiles p ON p.nim = m.author_nim "
        "WHERE m.conversation_id = ? AND m.author_nim != ? AND m.deleted_at IS NULL "
        "AND m.edited_at IS NOT NULL AND m.edited_at > ? ORDER BY m.edited_at DESC LIMIT ?",
        (conversation_id, nim, since, MAX_RECENT_EDITS),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "author": {"username": r["username"] or "", "display_name": r["display_name"] or "Pengguna"},
            "preview": _preview(r["body"], 90),
            "edited_at": r["edited_at"],
        }
        for r in rows
    ]


def send_message(
    nim: str,
    conversation_id: int,
    body: str,
    reply_to_id: Optional[int] = None,
    card_type: str = "none",
    card_payload: Optional[dict[str, Any]] = None,
    is_encrypted: bool = False,
    encryption_nonce: Optional[str] = None,
) -> Outcome:
    text = _clean_body(body)
    c_type = card_type if card_type in ("none", "nilai", "jadwal", "tugas") else "none"
    c_json = json.dumps(card_payload or {}, separators=(",", ":"))
    nonce = _clean(encryption_nonce, 128, "Nonce") if is_encrypted and encryption_nonce else None
    with transaction() as conn:
        _require_profile(conn, nim)
        conv, role = _conversation(conn, nim, conversation_id)
        if conv["kind"] == "channel" and "admin_only" in conv.keys() and conv["admin_only"] and ROLE_RANK.get(role or "member", 1) < ROLE_RANK["admin"]:
            raise SocialError("CHANNEL_READ_ONLY", "Channel ini khusus pengumuman: hanya admin yang bisa mengirim pesan", 403)
        if reply_to_id is not None:
            target = conn.execute(
                "SELECT conversation_id FROM social_messages WHERE id = ?", (reply_to_id,)
            ).fetchone()
            if not target or target["conversation_id"] != conversation_id:
                raise SocialError("VALIDATION_ERROR", "Pesan yang dibalas tidak ada di percakapan ini")
        message_id = conn.execute(
            "INSERT INTO social_messages (conversation_id, author_nim, body, reply_to_id, card_type, card_payload, is_encrypted, encryption_nonce, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
            (conversation_id, nim, text, reply_to_id, c_type, c_json, bool(is_encrypted), nonce, _now()),
        ).fetchone()["id"]
        conn.execute(
            "UPDATE social_conversations SET last_message_id = ? WHERE id = ?", (message_id, conversation_id)
        )
        _store_mentions(conn, conv, int(message_id), text, nim)
        _set_read(conn, conversation_id, nim, int(message_id))
        message = _serialize_message(conn, int(message_id))
        mentioned = [
            r["nim"] for r in conn.execute("SELECT nim FROM social_mentions WHERE message_id = ?", (message_id,))
        ]
        payload = {"conversation_id": conversation_id, "space_id": conv["space_id"], "message": message}
        events = [Event("message.created", _recipients(conn, conv), {**payload, "mentioned": False})]
        if mentioned:
            # Penerima yang di-mention mendapat flag terpisah agar badge mention akurat.
            others = [n for n in events[0].recipients if n not in mentioned]
            events = [
                Event("message.created", others, {**payload, "mentioned": False}),
                Event("message.created", mentioned, {**payload, "mentioned": True}),
            ]
        return Outcome(message, events)


def edit_message(nim: str, message_id: int, body: str) -> Outcome:
    text = _clean_body(body)
    with transaction() as conn:
        msg, conv, _ = _message_row(conn, nim, message_id)
        if msg["author_nim"] != nim:
            raise SocialError("FORBIDDEN", "Hanya pengirim yang bisa mengedit pesan", 403)
        if msg["deleted_at"]:
            raise SocialError("MESSAGE_NOT_FOUND", "Pesan sudah dihapus", 404)
        conn.execute(
            "UPDATE social_messages SET body = ?, edited_at = ? WHERE id = ?", (text, _now(), message_id)
        )
        _store_mentions(conn, conv, message_id, text, nim)
        message = _serialize_message(conn, message_id)
        payload = {"conversation_id": conv["id"], "message": message, "change": "edited"}
        return Outcome(message, [Event("message.updated", _recipients(conn, conv), payload)])


def delete_message(nim: str, message_id: int) -> Outcome:
    with transaction() as conn:
        msg, conv, role = _message_row(conn, nim, message_id)
        is_moderator = role is not None and ROLE_RANK[role] >= ROLE_RANK["admin"]
        if msg["author_nim"] != nim and not is_moderator:
            raise SocialError("FORBIDDEN", "Kamu tidak bisa menghapus pesan ini", 403)
        conn.execute(
            "UPDATE social_messages SET body = '', deleted_at = ?, pinned_at = NULL WHERE id = ?",
            (_now(), message_id),
        )
        conn.execute("DELETE FROM social_reactions WHERE message_id = ?", (message_id,))
        conn.execute("DELETE FROM social_mentions WHERE message_id = ?", (message_id,))
        # Preview daftar chat mundur ke pesan terakhir yang masih ada.
        conn.execute(
            "UPDATE social_conversations SET last_message_id = "
            "(SELECT MAX(id) FROM social_messages WHERE conversation_id = ? AND deleted_at IS NULL) WHERE id = ?",
            (conv["id"], conv["id"]),
        )
        message = _serialize_message(conn, message_id)
        payload = {"conversation_id": conv["id"], "message": message, "change": "deleted"}
        return Outcome(message, [Event("message.updated", _recipients(conn, conv), payload)])


def toggle_reaction(nim: str, message_id: int, reaction: str) -> Outcome:
    if reaction not in REACTIONS:
        raise SocialError("VALIDATION_ERROR", "Reaksi tidak dikenal")
    with transaction() as conn:
        _require_profile(conn, nim)
        msg, conv, _ = _message_row(conn, nim, message_id)
        if msg["deleted_at"]:
            raise SocialError("MESSAGE_NOT_FOUND", "Pesan sudah dihapus", 404)
        removed = conn.execute(
            "DELETE FROM social_reactions WHERE message_id = ? AND nim = ? AND reaction = ?",
            (message_id, nim, reaction),
        ).rowcount
        if not removed:
            conn.execute(
                "INSERT INTO social_reactions (message_id, nim, reaction) VALUES (?, ?, ?)",
                (message_id, nim, reaction),
            )
        message = _serialize_message(conn, message_id)
        payload = {"conversation_id": conv["id"], "message": message, "change": "reaction"}
        return Outcome(message, [Event("message.updated", _recipients(conn, conv), payload)])


def set_pinned(nim: str, message_id: int, pinned: bool) -> Outcome:
    with transaction() as conn:
        msg, conv, role = _message_row(conn, nim, message_id)
        if conv["kind"] == "channel" and ROLE_RANK[role or "member"] < ROLE_RANK["admin"]:
            raise SocialError("FORBIDDEN", "Pin pesan di channel khusus admin ruang", 403)
        if msg["deleted_at"]:
            raise SocialError("MESSAGE_NOT_FOUND", "Pesan sudah dihapus", 404)
        if pinned and not msg["pinned_at"]:
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM social_messages WHERE conversation_id = ? AND pinned_at IS NOT NULL",
                (conv["id"],),
            ).fetchone()["c"]
            if count >= MAX_PINS:
                raise SocialError("PIN_LIMIT", f"Maksimal {MAX_PINS} pesan tersemat")
        conn.execute(
            "UPDATE social_messages SET pinned_at = ? WHERE id = ?", (_now() if pinned else None, message_id)
        )
        message = _serialize_message(conn, message_id)
        payload = {"conversation_id": conv["id"], "message": message, "change": "pinned"}
        return Outcome(message, [Event("message.updated", _recipients(conn, conv), payload)])


def list_pins(nim: str, conversation_id: int) -> list[dict[str, Any]]:
    with transaction() as conn:
        _conversation(conn, nim, conversation_id)
        rows = conn.execute(
            "SELECT * FROM social_messages WHERE conversation_id = ? AND pinned_at IS NOT NULL "
            "AND deleted_at IS NULL ORDER BY pinned_at DESC",
            (conversation_id,),
        ).fetchall()
        return _serialize_messages(conn, rows)


def search_messages(nim: str, conversation_id: int, query: str) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if len(q) < 2:
        return []
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    with transaction() as conn:
        _conversation(conn, nim, conversation_id)
        rows = conn.execute(
            "SELECT * FROM social_messages WHERE conversation_id = ? AND deleted_at IS NULL "
            "AND body LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 30",
            (conversation_id, f"%{escaped}%"),
        ).fetchall()
        return _serialize_messages(conn, rows)


def mark_read(nim: str, conversation_id: int, message_id: int) -> Outcome:
    with transaction() as conn:
        me = _require_profile(conn, nim)
        conv, _ = _conversation(conn, nim, conversation_id)
        upper = conv["last_message_id"] or 0
        last_read = _set_read(conn, conversation_id, nim, min(max(message_id, 0), upper))
        recipients = _recipients(conn, conv) if conv["kind"] == "dm" else [nim]
        payload = {"conversation_id": conversation_id, "username": me["username"], "last_read_id": last_read}
        return Outcome({"last_read_id": last_read}, [Event("conversation.read", recipients, payload)])


def typing(nim: str, conversation_id: int) -> Outcome:
    with transaction() as conn:
        me = _require_profile(conn, nim)
        conv, _ = _conversation(conn, nim, conversation_id)
        recipients = [n for n in _recipients(conn, conv) if n != nim]
        payload = {
            "conversation_id": conversation_id,
            "user": {"username": me["username"], "display_name": me["display_name"]},
        }
        return Outcome({"ok": True}, [Event("typing", recipients, payload)])
