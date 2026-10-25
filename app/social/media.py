"""Penyimpanan gambar profil/ruang (avatar dan banner) Mira Komunitas.

Klien sudah mengecilkan gambar jadi WebP sebelum upload, jadi server cukup
memvalidasi: tipe dari magic bytes (bukan header Content-Type), batas ukuran,
lalu menyimpan dengan nama hash isi (deduplikasi gratis, aman dari path traversal).
Gambar disajikan publik dengan cache immutable karena namanya tidak bisa ditebak
dan isinya tidak pernah berubah untuk nama yang sama.
"""
import hashlib
import os
import re
from pathlib import Path
from typing import Optional

from app.config import settings

MAX_BYTES = {"avatar": 300_000, "banner": 800_000}
MEDIA_ID_RE = re.compile(r"^[0-9a-f]{32}\.(webp|png|jpg)$")
_CONTENT_TYPES = {"webp": "image/webp", "png": "image/png", "jpg": "image/jpeg"}


class MediaError(ValueError):
    pass


def media_dir() -> Path:
    return Path(os.path.dirname(settings.SQLITE_DB_PATH) or ".") / "social_media"


def _detect(data: bytes) -> Optional[str]:
    if len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    return None


def save(data: bytes, kind: str) -> str:
    limit = MAX_BYTES.get(kind)
    if limit is None:
        raise MediaError("Jenis gambar tidak dikenal")
    if not data:
        raise MediaError("Berkas kosong")
    if len(data) > limit:
        raise MediaError(f"Gambar maksimal {limit // 1000} KB")
    ext = _detect(data)
    if ext is None:
        raise MediaError("Format gambar harus WebP, PNG, atau JPEG")
    media_id = f"{hashlib.sha256(data).hexdigest()[:32]}.{ext}"
    folder = media_dir()
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / media_id
    if not target.exists():
        tmp = target.with_suffix(".tmp")
        tmp.write_bytes(data)
        tmp.replace(target)
    return media_id


def path_for(media_id: str) -> Optional[Path]:
    if not MEDIA_ID_RE.match(media_id or ""):
        return None
    path = media_dir() / media_id
    return path if path.is_file() else None


def content_type(media_id: str) -> str:
    return _CONTENT_TYPES[media_id.rsplit(".", 1)[-1]]
