-- Agent Max User Profile Cache Schema
-- Phase 4: Local SQLite Cache for User Profile + Facts
-- Provides fast local reads and offline support

-- User profile cache: Stores user data from Supabase
CREATE TABLE IF NOT EXISTS user_profile (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    credits INTEGER DEFAULT 0,
    subscription_status TEXT,
    subscription_tier TEXT,
    credit_reset_date TEXT,
    display_name TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_synced_at INTEGER,
    sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_profile_email ON user_profile(email);
CREATE INDEX IF NOT EXISTS idx_profile_sync ON user_profile(sync_status);

-- Facts cache: Stores user facts from Supabase
CREATE TABLE IF NOT EXISTS facts_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    source TEXT DEFAULT 'user',
    confidence REAL DEFAULT 0.8,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_synced_at INTEGER,
    sync_status TEXT DEFAULT 'synced' CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed', 'local_only')),
    UNIQUE(user_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_facts_user ON facts_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_facts_category ON facts_cache(user_id, category);
CREATE INDEX IF NOT EXISTS idx_facts_sync ON facts_cache(sync_status);

-- Preferences cache: Stores user preferences from Supabase
CREATE TABLE IF NOT EXISTS preferences_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    category TEXT DEFAULT 'general',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_synced_at INTEGER,
    sync_status TEXT DEFAULT 'synced' CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed', 'local_only')),
    UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_prefs_user ON preferences_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_prefs_sync ON preferences_cache(sync_status);

-- Sync log: Tracks sync operations for debugging
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
    error TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user ON sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at DESC);

-- Conversation summaries: Stores brief summaries of past conversations
-- Used to provide context for new conversations without loading full message history
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    topics TEXT,  -- JSON array of main topics discussed
    created_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_user ON conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_ended ON conversation_summaries(user_id, ended_at DESC);

-- Metadata table for schema versioning
CREATE TABLE IF NOT EXISTS cache_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER NOT NULL
);

-- Insert initial metadata
INSERT OR IGNORE INTO cache_metadata (key, value, updated_at) VALUES
    ('schema_version', '2', strftime('%s', 'now') * 1000),
    ('created_at', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
