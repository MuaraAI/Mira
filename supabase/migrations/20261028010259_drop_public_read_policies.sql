-- Migration: drop_public_read_policies
-- Policy "Allow read X USING (true)" membuat anon key (yang publik di bundle
-- frontend) bisa membaca seluruh isi chat via PostgREST. Backend konek sebagai
-- pemilik tabel (bypass RLS), frontend tidak memakai PostgREST — deny-all aman.

DROP POLICY IF EXISTS "Allow read conversations" ON social_conversations;
DROP POLICY IF EXISTS "Allow read friendships"   ON social_friendships;
DROP POLICY IF EXISTS "Allow read members"       ON social_members;
DROP POLICY IF EXISTS "Allow read messages"      ON social_messages;
DROP POLICY IF EXISTS "Allow read participants"  ON social_participants;
DROP POLICY IF EXISTS "Allow read profiles"      ON social_profiles;
DROP POLICY IF EXISTS "Allow read reactions"     ON social_reactions;
DROP POLICY IF EXISTS "Allow read spaces"        ON social_spaces;
