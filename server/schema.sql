-- DIC platform database (SQLite; the same file runs on Cloudflare D1).
-- Every statement is safe to run again: the Node server applies this file on
-- start, and on D1 you run it once with `wrangler d1 execute` (see README).
-- Times are milliseconds since 1970 (UTC).

-- People who have signed in with an email code.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,      -- lower case
  display_name  TEXT NOT NULL DEFAULT '',  -- shown on Team-up and in chat
  banned        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);

-- The one-time sign-in code most recently sent to each address (hashed).
CREATE TABLE IF NOT EXISTS login_codes (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- Signed-in browsers. Only a hash of each token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- ------------------------------------------------------------- registration
CREATE TABLE IF NOT EXISTS teams (
  id               TEXT PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,   -- invite code teammates join with
  name             TEXT NOT NULL,
  track            TEXT NOT NULL,          -- id from src/form.js
  captain_id       TEXT NOT NULL,
  repo_url         TEXT NOT NULL DEFAULT '',
  project_title    TEXT NOT NULL DEFAULT '',
  project_summary  TEXT NOT NULL DEFAULT '',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

-- One row per person registering. The "About you" answers are JSON, keyed
-- by the questions in src/form.js, so questions can change without a
-- migration.
CREATE TABLE IF NOT EXISTS participants (
  user_id         TEXT PRIMARY KEY,
  profile         TEXT NOT NULL DEFAULT '{}',
  team_choice     TEXT NOT NULL DEFAULT '',     -- '' (not chosen yet) | team | none
  team_id         TEXT,
  track_pref      TEXT NOT NULL DEFAULT '',     -- for people without a team yet
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | submitted
  consent_at      INTEGER,
  submitted_at    INTEGER,
  joined_team_at  INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS participants_team ON participants (team_id);

-- ------------------------------------------------------------------ Team-up
-- kind: 'team' = a team looking for members; 'solo' = a person looking for a team.
-- removed: NULL, 'author' (deleted by its writer) or 'moderator'.
CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  track       TEXT NOT NULL,          -- track id or 'any'
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  skills      TEXT NOT NULL DEFAULT '[]',
  contact     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',  -- open | closed
  removed     TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_created ON posts (created_at);

CREATE TABLE IF NOT EXISTS replies (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  body        TEXT NOT NULL,
  removed     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS replies_post ON replies (post_id, created_at);

-- Discussion channels. Numeric ids, so clients can ask for "everything after N".
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  body        TEXT NOT NULL,
  removed     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_channel ON messages (channel, id);

CREATE TABLE IF NOT EXISTS reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,         -- post | reply | message
  target_id    TEXT NOT NULL,
  reason       TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  resolved_at  INTEGER,
  resolved_by  TEXT
);

-- ------------------------------------------------------------------ upkeep
-- Fixed-window counters for rate limits (sign-in codes, posting, chatbot).
CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT PRIMARY KEY,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL
);

-- What admins changed, and when.
CREATE TABLE IF NOT EXISTS admin_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
