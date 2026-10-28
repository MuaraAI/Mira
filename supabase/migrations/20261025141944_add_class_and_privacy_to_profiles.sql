-- Migration: add_class_and_privacy_to_profiles

ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS class_code TEXT;
ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS show_nim BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS show_class BOOLEAN NOT NULL DEFAULT FALSE;
