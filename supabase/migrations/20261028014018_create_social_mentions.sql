-- Migration: create_social_mentions
-- Tabel mention (PR #114). WAJIB juga tercantum di _PG_EXTRA_TABLES (app/social/db.py)
-- agar startup otomatis membuatnya di environment baru.

CREATE TABLE IF NOT EXISTS social_mentions (
    message_id INTEGER NOT NULL REFERENCES social_messages(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL,
    nim TEXT NOT NULL,
    PRIMARY KEY (message_id, nim)
);
CREATE INDEX IF NOT EXISTS idx_social_mentions_nim ON social_mentions(nim, conversation_id);
ALTER TABLE social_mentions ENABLE ROW LEVEL SECURITY;
