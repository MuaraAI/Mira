# Supabase Migrations — Mira Social

Folder ini adalah **cermin resmi** migration Supabase project `duzehjktvbuqczjubshy`
(ap-southeast-1). Nama file = `<version>_<name>.sql` persis seperti riwayat
migration di Supabase.

## Aturan WAJIB
1. **Setiap perubahan skema Supabase WAJIB** disertai file baru di folder ini
   (ikuti format versi `YYYYMMDDHHMMSS_nama_snake_case.sql`), di-commit di PR yang sama.
2. **Jalankan migration via MCP** (`supabase-mira` → `apply_migration`) — jangan
   langsung via psql, agar history Supabase tetap sinkron dengan folder ini.
3. **Skema ganda**: tabel/kolom yang sama juga WAJIB ada di jalur SQLite
   (`app/social/db.py` → `_CREATE` / `_ADDED_COLUMNS` / `_PG_EXTRA_TABLES`).
   Lupa salah satu sisi = 500 `UndefinedTable`/`UndefinedColumn` di produksi.
4. Semua tabel baru: `ENABLE ROW LEVEL SECURITY` **tanpa policy permissive** —
   backend konek sebagai owner (bypass RLS); anon/public harus selalu ditolak.

## Isi
| Version | Nama | Ringkas |
|---|---|---|
| 20261025132707 | create_mira_social_schema | 8 tabel social dasar + index |
| 20261025132728 | enable_realtime_and_policies | realtime + RLS (policy read publik kini dicabut) |
| 20261025134535 | add_e2ee_support_to_social | E2EE DM + kunci publik profil |
| 20261025140002 | add_branch_to_social_spaces | campus_branch di spaces |
| 20261025141944 | add_class_and_privacy_to_profiles | class_code + show_nim/show_class |
| 20261026025151 | add_media_presence_columns | avatar/banner/presensi/privasi |
| 20261028010259 | drop_public_read_policies | cabut 8 policy read anon (kebocoran) |
| 20261028014018 | create_social_mentions | tabel mention + index + RLS |
