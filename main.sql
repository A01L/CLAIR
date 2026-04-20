    CREATE TABLE clair_users (
        id          SERIAL PRIMARY KEY,
        login       VARCHAR(50)  NOT NULL UNIQUE,
        password    TEXT         NOT NULL,
        full_name   VARCHAR(150),
        email       VARCHAR(100) UNIQUE,
        tg_push     BOOLEAN      DEFAULT FALSE
    );

    CREATE TABLE clair_channels (
        id           SERIAL PRIMARY KEY,
        uid          INTEGER NOT NULL,
        channel_key  VARCHAR(100) NOT NULL UNIQUE,
        name         VARCHAR(100) NOT NULL,

        CONSTRAINT fk_channels_user
            FOREIGN KEY (uid)
            REFERENCES clair_users (id)
            ON DELETE CASCADE
    );

    CREATE TABLE clair_appeal (
        id            SERIAL PRIMARY KEY,
        cid           INTEGER NOT NULL,
        rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
        emotion       VARCHAR(50),
        type          VARCHAR(50),
        status        VARCHAR(30),
        anomaly_type  VARCHAR(50),
        anomaly_com   TEXT,
        ai_com        TEXT,
        org_com       TEXT,

        CONSTRAINT fk_appeal_channel
            FOREIGN KEY (cid)
            REFERENCES clair_channels (id)
            ON DELETE CASCADE
    );


ALTER TABLE clair_users
ADD COLUMN last_login_at TIMESTAMP,
ADD COLUMN last_login_ip VARCHAR(100),
ADD COLUMN last_user_agent TEXT,
ADD COLUMN last_device_type VARCHAR(30),
ADD COLUMN last_browser VARCHAR(50),
ADD COLUMN last_os VARCHAR(50);


CREATE TABLE IF NOT EXISTS clair_login_logs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES clair_users(id) ON DELETE CASCADE,
    login_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address      VARCHAR(100),
    user_agent      TEXT,
    device_type     VARCHAR(30),
    browser         VARCHAR(50),
    os              VARCHAR(50),
    is_success      BOOLEAN NOT NULL DEFAULT true
); 



-- =========================
-- CHANNEL PROCESSING STATE
-- =========================
ALTER TABLE clair_channels
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS processing_pause_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS processing_paused_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS processing_resumed_at TIMESTAMPTZ NULL;

-- =========================
-- APPEAL HASH / SPAM META
-- =========================
ALTER TABLE clair_appeal
  ADD COLUMN IF NOT EXISTS text_normalized TEXT NULL,
  ADD COLUMN IF NOT EXISTS text_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS duplicate_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spam_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spam_reason_rule TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_clair_appeal_cid_created_at
  ON clair_appeal (cid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clair_appeal_text_hash
  ON clair_appeal (text_hash);

CREATE INDEX IF NOT EXISTS idx_clair_channels_processing_status
  ON clair_channels (processing_status); 