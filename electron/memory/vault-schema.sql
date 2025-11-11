-- Memory Vault Schema
-- SQLite database for encrypted, structured memory storage
-- Version: 1.0

-- Identities (users/profiles)
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_identities_created ON identities(created_at);

-- Sessions (conversation threads)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  title TEXT,
  goal TEXT,
  FOREIGN KEY(identity_id) REFERENCES identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_identity ON sessions(identity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);

-- Messages (chat transcript)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Facts (normalized, atomic knowledge with provenance)
CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  category TEXT NOT NULL,           -- 'personal', 'location', 'preference', 'work', 'technical'
  predicate TEXT NOT NULL,          -- 'lives_in', 'likes_language', 'uses_editor'
  object TEXT NOT NULL,             -- 'Philadelphia', 'Python', 'VSCode'
  confidence REAL NOT NULL DEFAULT 0.8 CHECK(confidence >= 0 AND confidence <= 1),
  pii_level INTEGER NOT NULL DEFAULT 1 CHECK(pii_level >= 0 AND pii_level <= 3),
  consent_scope TEXT NOT NULL DEFAULT 'default' CHECK(consent_scope IN ('default', 'analytics_off', 'never_upload')),
  source_msg_id TEXT,               -- Provenance: which message led to this fact
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_reinforced_at TEXT,          -- Last time this fact was used successfully
  decay_halflife_days REAL NOT NULL DEFAULT 90.0,
  FOREIGN KEY(identity_id) REFERENCES identities(id) ON DELETE CASCADE,
  FOREIGN KEY(source_msg_id) REFERENCES messages(id) ON DELETE SET NULL,
  UNIQUE(identity_id, category, predicate) ON CONFLICT REPLACE
);

CREATE INDEX IF NOT EXISTS idx_facts_identity ON facts(identity_id);
CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_predicate ON facts(predicate);
CREATE INDEX IF NOT EXISTS idx_facts_confidence ON facts(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_facts_pii ON facts(pii_level);
CREATE INDEX IF NOT EXISTS idx_facts_consent ON facts(consent_scope);

-- Embeddings (for semantic search - Phase 2)
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  ref_type TEXT NOT NULL CHECK(ref_type IN ('message', 'fact', 'note')),
  ref_id TEXT NOT NULL,             -- Foreign key to messages.id, facts.id, or notes.id
  model TEXT NOT NULL DEFAULT 'simple-hash',
  dim INTEGER NOT NULL DEFAULT 384,
  vec BLOB,                         -- Binary float32 array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ref_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_ref ON embeddings(ref_type, ref_id);

-- Notes (summaries and rollups)
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  kind TEXT NOT NULL,               -- 'session_summary', 'rolling_profile', 'user_note'
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_session_id TEXT,           -- If this is a session summary
  FOREIGN KEY(identity_id) REFERENCES identities(id) ON DELETE CASCADE,
  FOREIGN KEY(source_session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_identity ON notes(identity_id);
CREATE INDEX IF NOT EXISTS idx_notes_kind ON notes(kind);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);

-- Full-text search - DISABLED for encrypted content
-- FTS only on non-PII metadata (session titles, not message content)
-- Messages and notes content is encrypted, so we can't FTS it safely
-- Future: add FTS on session.title and session.goal only

-- Session FTS (safe - non-encrypted metadata only)
CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
  title,
  goal,
  content=sessions,
  content_rowid=rowid
);

-- Triggers for sessions FTS (safe metadata only)
CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON sessions BEGIN
  INSERT INTO sessions_fts(rowid, title, goal) 
  VALUES (new.rowid, COALESCE(new.title, ''), COALESCE(new.goal, ''));
END;

CREATE TRIGGER IF NOT EXISTS sessions_ad AFTER DELETE ON sessions BEGIN
  INSERT INTO sessions_fts(sessions_fts, rowid, title, goal) 
  VALUES('delete', old.rowid, old.title, old.goal);
END;

CREATE TRIGGER IF NOT EXISTS sessions_au AFTER UPDATE ON sessions BEGIN
  INSERT INTO sessions_fts(sessions_fts, rowid, title, goal) 
  VALUES('delete', old.rowid, old.title, old.goal);
  INSERT INTO sessions_fts(rowid, title, goal) 
  VALUES (new.rowid, new.title, new.goal);
END;

-- Metadata table for vault state and configuration
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial metadata
INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1.0');
INSERT OR IGNORE INTO meta (key, value) VALUES ('created_at', datetime('now'));
INSERT OR IGNORE INTO meta (key, value) VALUES ('encryption_mode', 'field-level');
INSERT OR IGNORE INTO meta (key, value) VALUES ('selector_version', '1');
INSERT OR IGNORE INTO meta (key, value) VALUES ('migration_complete', '0');
