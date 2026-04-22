
ALTER TABLE clair_channels ADD COLUMN IF NOT EXISTS custom_prompt TEXT NULL;

ALTER TABLE clair_appeal DROP COLUMN IF EXISTS text_normalized;
ALTER TABLE clair_appeal DROP COLUMN IF EXISTS duplicate_count;
ALTER TABLE clair_appeal DROP COLUMN IF EXISTS spam_reason_rule;
ALTER TABLE clair_appeal DROP COLUMN IF EXISTS org_com;

CREATE TABLE IF NOT EXISTS clair_assistant_sessions (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES clair_channels(id) ON DELETE CASCADE,
    session_token VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clair_assistant_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES clair_assistant_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
