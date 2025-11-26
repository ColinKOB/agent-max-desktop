-- Agent Max Desktop State Store Schema
-- Phase 2: Local-First Migration
-- Stores run state, steps, and results locally for offline execution and restart resilience

-- Runs table: Stores run metadata and plan
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    user_id TEXT,
    message TEXT,
    status TEXT NOT NULL CHECK(status IN ('planning', 'executing', 'paused', 'complete', 'failed', 'cancelled')),
    current_step_index INTEGER DEFAULT -1,
    total_steps INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    plan_json TEXT,  -- Full plan from cloud (JSON)
    metadata_json TEXT,  -- Additional metadata (JSON)
    final_response TEXT,  -- Final AI response when run completes
    last_synced_at INTEGER,
    sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed'))
);

-- Migration: Add final_response column if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a try-catch approach in code

CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_sync ON runs(sync_status);
CREATE INDEX IF NOT EXISTS idx_runs_updated ON runs(updated_at DESC);

-- Steps table: Stores individual step definitions
CREATE TABLE IF NOT EXISTS steps (
    step_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    step_json TEXT NOT NULL,  -- Full step definition (JSON)
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'done', 'failed', 'skipped')),
    started_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_steps_run ON steps(run_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON steps(run_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_steps_run_index ON steps(run_id, step_index);

-- Step results table: Stores execution results
CREATE TABLE IF NOT EXISTS step_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    error TEXT,
    attempts INTEGER DEFAULT 1,
    execution_time_ms INTEGER,
    created_at INTEGER NOT NULL,
    synced_to_cloud BOOLEAN DEFAULT 0,
    synced_at INTEGER,
    FOREIGN KEY (step_id) REFERENCES steps(step_id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_results_step ON step_results(step_id);
CREATE INDEX IF NOT EXISTS idx_results_run ON step_results(run_id);
CREATE INDEX IF NOT EXISTS idx_results_sync ON step_results(synced_to_cloud, synced_at);

-- Sync queue table: Queues operations to sync to cloud
CREATE TABLE IF NOT EXISTS sync_queue (
    queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    step_index INTEGER,
    action TEXT NOT NULL CHECK(action IN ('report_result', 'update_status', 'complete_run')),
    payload_json TEXT NOT NULL,
    priority INTEGER DEFAULT 5,  -- 1=highest, 10=lowest
    created_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    last_attempt_at INTEGER,
    next_retry_at INTEGER,
    error TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_run ON sync_queue(run_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_retry ON sync_queue(next_retry_at);

-- Metadata table: Stores app-level metadata
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER NOT NULL
);

-- Insert initial metadata
INSERT OR IGNORE INTO metadata (key, value, updated_at) VALUES 
    ('schema_version', '1', strftime('%s', 'now')),
    ('created_at', strftime('%s', 'now'), strftime('%s', 'now'));
