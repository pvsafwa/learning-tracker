-- 001_init: users (allowlist + roles), sessions, and per-user learning data.
-- Emails are stored lowercased by the application layer; a plain UNIQUE works.

-- ── Identity & allowlist ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  google_sub    TEXT UNIQUE,
  name          TEXT,
  picture       TEXT,
  role          TEXT NOT NULL DEFAULT 'user'    CHECK (role IN ('user','admin')),
  status        TEXT NOT NULL DEFAULT 'allowed' CHECK (status IN ('allowed','disabled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- ── Session store (connect-pg-simple) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "session" (
  sid    VARCHAR NOT NULL COLLATE "default",
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON "session" (expire);

-- ── Per-user progress ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress (
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id        TEXT NOT NULL,
  rel_path        TEXT,
  started_at      TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  watch_seconds   DOUBLE PRECISION NOT NULL DEFAULT 0,
  resume_seconds  DOUBLE PRECISION NOT NULL DEFAULT 0,
  percent         DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

-- Media durations are a property of the file, not the user: shared globally.
CREATE TABLE IF NOT EXISTS durations (
  video_id   TEXT PRIMARY KEY,
  seconds    DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily activity rollup for the dashboard (streaks, heatmap, time invested).
CREATE TABLE IF NOT EXISTS activity (
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day             DATE NOT NULL,
  watch_seconds   DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- ── Active-learning data ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id   TEXT NOT NULL,
  t          DOUBLE PRECISION,
  text       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','bookmark')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_user_video ON notes (user_id, video_id);

-- Flashcards keep a rich SM-2 "srs" sub-object, so we store the card document as
-- JSONB and pull out the columns we actually query/sort on.
CREATE TABLE IF NOT EXISTS cards (
  id         TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id   TEXT,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards (user_id);

CREATE TABLE IF NOT EXISTS goals (
  id         TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);

CREATE TABLE IF NOT EXISTS achievements (
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
