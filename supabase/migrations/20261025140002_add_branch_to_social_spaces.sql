-- Migration: add_branch_to_social_spaces

ALTER TABLE social_spaces ADD COLUMN IF NOT EXISTS campus_branch TEXT;
