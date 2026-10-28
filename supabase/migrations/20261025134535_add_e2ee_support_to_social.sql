-- Migration: add_e2ee_support_to_social
-- E2EE DM Opsi 1: server hanya menyimpan ciphertext.

ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS encryption_nonce TEXT;
ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS e2ee_public_key TEXT;
