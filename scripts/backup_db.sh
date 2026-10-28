#!/usr/bin/env bash
# Backup harian DB core Mira (SQLite) + media uploads komunitas.
# Aman dijalankan saat aplikasi live (sqlite3 .backup memakai snapshot WAL).
# Cron: 30 3 * * * /opt/ubsi-api/scripts/backup_db.sh >> /home/ubuntu/backups/mira/backup.log 2>&1
set -euo pipefail

DB="${DB_PATH:-/opt/ubsi-api/data/ubsi.db}"
MEDIA_DIR="/opt/ubsi-api/data/social_media"
DEST="${BACKUP_DIR:-/home/ubuntu/backups/mira}"
KEEP_DAYS=14

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

# 3. Arsipkan DB + media uploads (avatar/banner komunitas) jadi satu paket.
tar -czf "$OUT.tar.gz" -C "$(dirname "$DB")" "$(basename "$DB")" -C / opt/ubsi-api/data/social_media 2>/dev/null || \
    tar -czf "$OUT.tar.gz" -C "$(dirname "$DB")" "$(basename "$DB")"
rm -f "$OUT"

# 4. Retensi: buang arsip lebih tua dari KEEP_DAYS hari.
find "$DEST" -name 'mira-*.db.tar.gz' -mtime "+$KEEP_DAYS" -delete

SIZE=$(stat -c%s "$OUT.tar.gz")
echo "$(date -Is) OK: $OUT.tar.gz (${SIZE} bytes)"
