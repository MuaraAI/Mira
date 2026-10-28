-- Migration: add_media_presence_columns
-- Media custom (WebP via app/social/media.py) + status kehadiran + privasi tampilan.

ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS banner TEXT;
ALTER TABLE social_spaces   ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE social_spaces   ADD COLUMN IF NOT EXISTS banner TEXT;
ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS hide_nim  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS hide_class INTEGER NOT NULL DEFAULT 0;
