-- Migration: enable_realtime_and_policies
-- Menyiapkan realtime + policy read publik (SAAT INI SUDAH DICABUT oleh
-- migration 20261028010259_drop_public_read_policies karena kebocoran data).

-- (realtime publication sudah di-set di create_mira_social_schema)

-- KEBIJAKAN LAMA (SUDAH DIHAPUS — dipertahankan di sini hanya sebagai catatan
-- riwayat. JANGAN dibuat ulang: membuat isi chat terbaca oleh anon key publik):
--   CREATE POLICY "Allow read messages"    ON social_messages     FOR SELECT USING (true);
--   CREATE POLICY "Allow read profiles"    ON social_profiles     FOR SELECT USING (true);
--   CREATE POLICY "Allow read spaces"      ON social_spaces       FOR SELECT USING (true);
--   CREATE POLICY "Allow read members"     ON social_members      FOR SELECT USING (true);
--   CREATE POLICY "Allow read conversations" ON social_conversations FOR SELECT USING (true);
--   CREATE POLICY "Allow read participants" ON social_participants FOR SELECT USING (true);
--   CREATE POLICY "Allow read friendships" ON social_friendships  FOR SELECT USING (true);
--   CREATE POLICY "Allow read reactions"   ON social_reactions    FOR SELECT USING (true);
