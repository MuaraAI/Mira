-- Migration: create_mira_social_schema
-- 8 tabel dasar Mira Social v3. (Mirror riwayat Supabase; rekonstruksi skema live.)

CREATE TABLE IF NOT EXISTS social_profiles (
    nim TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    campus_branch TEXT NOT NULL DEFAULT 'UBSI Pontianak',
    major TEXT NOT NULL DEFAULT 'Informatika',
    avatar_preset TEXT NOT NULL DEFAULT 'mura_welcome',
    bio TEXT NOT NULL DEFAULT '',
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_spaces (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    campus_branch TEXT,
    owner_nim TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_members (
    space_id BIGINT NOT NULL REFERENCES social_spaces(id) ON DELETE CASCADE,
    nim TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, nim)
);

CREATE TABLE IF NOT EXISTS social_conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('dm', 'channel')),
    space_id BIGINT REFERENCES social_spaces(id) ON DELETE CASCADE,
    name TEXT,
    topic TEXT NOT NULL DEFAULT '',
    dm_key TEXT UNIQUE,
    last_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_participants (
    conversation_id BIGINT NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
    nim TEXT NOT NULL,
    last_read_id BIGINT NOT NULL DEFAULT 0,
    last_opened_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, nim)
);

CREATE TABLE IF NOT EXISTS social_friendships (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_nim TEXT NOT NULL,
    friend_nim TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_nim, friend_nim)
);

CREATE TABLE IF NOT EXISTS social_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
    author_nim TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    reply_to_id BIGINT REFERENCES social_messages(id) ON DELETE SET NULL,
    pinned_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_reactions (
    message_id BIGINT NOT NULL REFERENCES social_messages(id) ON DELETE CASCADE,
    nim TEXT NOT NULL,
    reaction TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, nim, reaction)
);

CREATE INDEX IF NOT EXISTS idx_social_messages_conv ON social_messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_social_profiles_branch ON social_profiles(campus_branch);
CREATE INDEX IF NOT EXISTS idx_social_profiles_class ON social_profiles(campus_branch, major, class_code);
CREATE INDEX IF NOT EXISTS idx_social_spaces_branch ON social_spaces(campus_branch);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_friendships_user ON social_friendships(user_nim, friend_nim);

-- RLS deny-all: backend (owner) bypass; anon/authenticated via PostgREST ditolak.
ALTER TABLE social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_reactions ENABLE ROW LEVEL SECURITY;

-- Realtime untuk frontend (payload penuh; akses tetap dikontrol RLS).
ALTER PUBLICATION supabase_realtime ADD TABLE social_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE social_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE social_reactions;
