#!/usr/bin/env bash
# Backup otomatis 4x sehari DB core Mira (SQLite) + media uploads komunitas.
# Aman dijalankan saat aplikasi live (sqlite3 .backup memakai snapshot WAL).
# Cron: 30 3,9,15,21 * * * /opt/ubsi-api/scripts/backup_db.sh >> /home/ubuntu/backups/mira/backup.log 2>&1
set -euo pipefail

PATH="${PATH:-/usr/local/bin:/usr/bin:/bin}:/usr/local/bin:/usr/bin:/bin"

DB="${DB_PATH:-/opt/ubsi-api/data/ubsi.db}"
MEDIA_DIR="${MEDIA_DIR:-/opt/ubsi-api/data/social_media}"
DEST="${BACKUP_DIR:-/home/ubuntu/backups/mira}"
GDRIVE_DEST="${GDRIVE_DEST:-cg:AutoBackup/MuaraAI/Mira}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$DEST/mira-$STAMP.db"

# 1. Snapshot SQLite (aman saat live).
sqlite3 "$DB" ".backup '$OUT'"

# 2. Integrity check SEBELUM dikompres — backup korup tidak boleh dianggap berhasil.
if [ "$(sqlite3 "$OUT" 'PRAGMA integrity_check;')" != "ok" ]; then
    echo "$(date -Is) GAGAL: integritas $OUT tidak ok" >&2
    rm -f "$OUT"
    exit 1
fi

# 3. Arsipkan snapshot DB terverifikasi (+ media uploads komunitas jika ada).
if [ -d "$MEDIA_DIR" ]; then
    tar -czf "$OUT.tar.gz" -C "$DEST" "$(basename "$OUT")" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
else
    tar -czf "$OUT.tar.gz" -C "$DEST" "$(basename "$OUT")"
fi
rm -f "$OUT"

# 4. Off-site: unggah arsip ke Google Drive (cg:AutoBackup/MuaraAI/Mira).
if command -v rclone >/dev/null 2>&1; then
    rclone copyto "$OUT.tar.gz" "$GDRIVE_DEST/$(basename "$OUT.tar.gz")" \
        && rclone delete "$GDRIVE_DEST" --min-age 30d \
        && echo "$(date -Is) OFF-SITE OK: $GDRIVE_DEST/$(basename "$OUT.tar.gz")"
else
    echo "$(date -Is) rclone tidak ditemukan, lewati off-site" >&2
fi

# 5. Retensi lokal: buang arsip lebih tua dari KEEP_DAYS hari.
find "$DEST" -name 'mira-*.db.tar.gz' -mtime "+$KEEP_DAYS" -delete

SIZE=$(stat -c%s "$OUT.tar.gz")
echo "$(date -Is) OK: $OUT.tar.gz (${SIZE} bytes)"
