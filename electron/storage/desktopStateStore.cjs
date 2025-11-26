/**
 * Desktop State Store - Phase 2: Local-First Migration
 * 
 * SQLite-based persistent storage for run state, steps, and results.
 * Enables offline execution and desktop restart resilience.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class DesktopStateStore {
    constructor(dbPath = null) {
        // Default to app data directory
        if (!dbPath) {
            const userDataPath = app.getPath('userData');
            dbPath = path.join(userDataPath, 'agent-max-state.db');
        }

        console.log(`[DesktopStateStore] Initializing database: ${dbPath}`);
        
        // Ensure directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Open database with WAL mode for better concurrency
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        
        // Initialize schema
        this.initSchema();
        
        // Run migrations for existing databases
        this.runMigrations();
        
        console.log(`[DesktopStateStore] Database initialized successfully`);
    }

    /**
     * Initialize database schema
     */
    initSchema() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema (split by semicolon and execute each statement)
        const statements = schema.split(';').filter(s => s.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                this.db.exec(statement);
            }
        }
    }

    /**
     * Run database migrations for existing databases
     */
    runMigrations() {
        // Migration 1: Add final_response column to runs table
        try {
            // Check if column exists
            const tableInfo = this.db.prepare("PRAGMA table_info(runs)").all();
            const hasFinalResponse = tableInfo.some(col => col.name === 'final_response');
            
            if (!hasFinalResponse) {
                console.log('[DesktopStateStore] Running migration: adding final_response column');
                this.db.exec("ALTER TABLE runs ADD COLUMN final_response TEXT");
                console.log('[DesktopStateStore] Migration complete: final_response column added');
            }
        } catch (err) {
            console.error('[DesktopStateStore] Migration error:', err.message);
        }
    }

    // ==================== RUN OPERATIONS ====================

    /**
     * Create a new run
     */
    createRun(runId, plan) {
        const now = Date.now();
        const stmt = this.db.prepare(`
            INSERT INTO runs (
                run_id, plan_id, user_id, message, status,
                total_steps, created_at, updated_at, plan_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            runId,
            plan.plan_id || runId,
            plan.user_id || null,
            plan.message || null,
            'executing',
            plan.steps ? plan.steps.length : 0,
            now,
            now,
            JSON.stringify(plan)
        );

        console.log(`[DesktopStateStore] Created run: ${runId} (${plan.steps?.length || 0} steps)`);
        return this.getRun(runId);
    }

    /**
     * Update run status and metadata
     */
    updateRun(runId, updates) {
        const fields = [];
        const values = [];

        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.current_step_index !== undefined) {
            fields.push('current_step_index = ?');
            values.push(updates.current_step_index);
        }
        if (updates.completed_at !== undefined) {
            fields.push('completed_at = ?');
            values.push(updates.completed_at);
        }
        if (updates.metadata_json !== undefined) {
            fields.push('metadata_json = ?');
            values.push(JSON.stringify(updates.metadata_json));
        }
        if (updates.sync_status !== undefined) {
            fields.push('sync_status = ?');
            values.push(updates.sync_status);
        }
        if (updates.last_synced_at !== undefined) {
            fields.push('last_synced_at = ?');
            values.push(updates.last_synced_at);
        }
        if (updates.final_response !== undefined) {
            fields.push('final_response = ?');
            values.push(updates.final_response);
        }

        // Always update updated_at
        fields.push('updated_at = ?');
        values.push(Date.now());

        values.push(runId);

        const stmt = this.db.prepare(`
            UPDATE runs SET ${fields.join(', ')} WHERE run_id = ?
        `);

        stmt.run(...values);
        return this.getRun(runId);
    }

    /**
     * Get run by ID
     */
    getRun(runId) {
        const stmt = this.db.prepare('SELECT * FROM runs WHERE run_id = ?');
        const row = stmt.get(runId);
        
        if (!row) return null;

        // Parse JSON fields
        if (row.plan_json) row.plan = JSON.parse(row.plan_json);
        if (row.metadata_json) row.metadata = JSON.parse(row.metadata_json);
        
        return row;
    }

    /**
     * List active runs (executing or paused)
     */
    listActiveRuns() {
        const stmt = this.db.prepare(`
            SELECT * FROM runs 
            WHERE status IN ('executing', 'paused')
            ORDER BY updated_at DESC
        `);
        
        const rows = stmt.all();
        return rows.map(row => {
            if (row.plan_json) row.plan = JSON.parse(row.plan_json);
            if (row.metadata_json) row.metadata = JSON.parse(row.metadata_json);
            return row;
        });
    }

    /**
     * List all runs with optional filters
     */
    listRuns(filters = {}) {
        let query = 'SELECT * FROM runs WHERE 1=1';
        const params = [];

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.user_id) {
            query += ' AND user_id = ?';
            params.push(filters.user_id);
        }

        query += ' ORDER BY updated_at DESC';
        
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        
        return rows.map(row => {
            if (row.plan_json) row.plan = JSON.parse(row.plan_json);
            if (row.metadata_json) row.metadata = JSON.parse(row.metadata_json);
            return row;
        });
    }

    // ==================== STEP OPERATIONS ====================

    /**
     * Save a step
     */
    saveStep(runId, stepIndex, step) {
        const stepId = step.step_id || `${runId}_s${stepIndex}`;
        
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO steps (
                step_id, run_id, step_index, step_json, status
            ) VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
            stepId,
            runId,
            stepIndex,
            JSON.stringify(step),
            step.status || 'pending'
        );

        return this.getStep(stepId);
    }

    /**
     * Update step status
     */
    updateStepStatus(stepId, status, timestamps = {}) {
        const fields = ['status = ?'];
        const values = [status];

        if (timestamps.started_at !== undefined) {
            fields.push('started_at = ?');
            values.push(timestamps.started_at);
        }
        if (timestamps.completed_at !== undefined) {
            fields.push('completed_at = ?');
            values.push(timestamps.completed_at);
        }

        values.push(stepId);

        const stmt = this.db.prepare(`
            UPDATE steps SET ${fields.join(', ')} WHERE step_id = ?
        `);

        stmt.run(...values);
        return this.getStep(stepId);
    }

    /**
     * Get step by ID
     */
    getStep(stepId) {
        const stmt = this.db.prepare('SELECT * FROM steps WHERE step_id = ?');
        const row = stmt.get(stepId);
        
        if (!row) return null;
        if (row.step_json) row.step = JSON.parse(row.step_json);
        
        return row;
    }

    /**
     * Get next pending step for a run
     */
    getNextPendingStep(runId) {
        const stmt = this.db.prepare(`
            SELECT * FROM steps 
            WHERE run_id = ? AND status = 'pending'
            ORDER BY step_index ASC
            LIMIT 1
        `);
        
        const row = stmt.get(runId);
        if (!row) return null;
        
        if (row.step_json) row.step = JSON.parse(row.step_json);
        return row;
    }

    /**
     * List steps for a run
     */
    listSteps(runId) {
        const stmt = this.db.prepare(`
            SELECT * FROM steps 
            WHERE run_id = ?
            ORDER BY step_index ASC
        `);
        
        const rows = stmt.all(runId);
        return rows.map(row => {
            if (row.step_json) row.step = JSON.parse(row.step_json);
            return row;
        });
    }

    // ==================== RESULT OPERATIONS ====================

    /**
     * Save step result
     */
    saveStepResult(stepId, runId, stepIndex, result) {
        const stmt = this.db.prepare(`
            INSERT INTO step_results (
                step_id, run_id, step_index, success, stdout, stderr,
                exit_code, error, attempts, execution_time_ms, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            stepId,
            runId,
            stepIndex,
            result.success ? 1 : 0,
            result.stdout || null,
            result.stderr || null,
            result.exit_code || null,
            result.error || null,
            result.attempts || 1,
            result.execution_time_ms || null,
            Date.now()
        );

        return info.lastInsertRowid;
    }

    /**
     * Get step result
     */
    getStepResult(stepId) {
        const stmt = this.db.prepare(`
            SELECT * FROM step_results 
            WHERE step_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        return stmt.get(stepId);
    }

    /**
     * Get unsynced results
     */
    getUnsyncedResults(runId = null) {
        let query = 'SELECT * FROM step_results WHERE synced_to_cloud = 0';
        const params = [];

        if (runId) {
            query += ' AND run_id = ?';
            params.push(runId);
        }

        query += ' ORDER BY created_at ASC';

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Mark result as synced
     */
    markResultSynced(resultId) {
        const stmt = this.db.prepare(`
            UPDATE step_results 
            SET synced_to_cloud = 1, synced_at = ?
            WHERE result_id = ?
        `);
        
        stmt.run(Date.now(), resultId);
    }

    // ==================== SYNC QUEUE OPERATIONS ====================

    /**
     * Queue an action for sync
     */
    queueSync(runId, action, payload, priority = 5) {
        const stmt = this.db.prepare(`
            INSERT INTO sync_queue (
                run_id, step_index, action, payload_json, priority, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        const stepIndex = payload.step_index !== undefined ? payload.step_index : null;

        const info = stmt.run(
            runId,
            stepIndex,
            action,
            JSON.stringify(payload),
            priority,
            Date.now()
        );

        return info.lastInsertRowid;
    }

    /**
     * Get pending sync items
     */
    getPendingSyncs(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM sync_queue 
            WHERE status = 'pending' 
              AND (next_retry_at IS NULL OR next_retry_at <= ?)
            ORDER BY priority ASC, created_at ASC
            LIMIT ?
        `);
        
        const rows = stmt.all(Date.now(), limit);
        return rows.map(row => {
            if (row.payload_json) row.payload = JSON.parse(row.payload_json);
            return row;
        });
    }

    /**
     * Mark sync item as completed
     */
    markSyncCompleted(queueId) {
        const stmt = this.db.prepare(`
            UPDATE sync_queue 
            SET status = 'completed'
            WHERE queue_id = ?
        `);
        
        stmt.run(queueId);
    }

    /**
     * Mark sync item as failed and schedule retry
     */
    markSyncFailed(queueId, error, retryDelayMs = 5000) {
        const stmt = this.db.prepare(`
            UPDATE sync_queue 
            SET attempts = attempts + 1,
                last_attempt_at = ?,
                next_retry_at = ?,
                error = ?,
                status = CASE 
                    WHEN attempts + 1 >= max_attempts THEN 'failed'
                    ELSE 'pending'
                END
            WHERE queue_id = ?
        `);
        
        const now = Date.now();
        stmt.run(now, now + retryDelayMs, error, queueId);
    }

    // ==================== UTILITY OPERATIONS ====================

    /**
     * Get database statistics
     */
    getStats() {
        const stats = {};

        // Run counts by status
        const runStmt = this.db.prepare(`
            SELECT status, COUNT(*) as count 
            FROM runs 
            GROUP BY status
        `);
        stats.runs = runStmt.all();

        // Step counts by status
        const stepStmt = this.db.prepare(`
            SELECT status, COUNT(*) as count 
            FROM steps 
            GROUP BY status
        `);
        stats.steps = stepStmt.all();

        // Sync queue counts
        const syncStmt = this.db.prepare(`
            SELECT status, COUNT(*) as count 
            FROM sync_queue 
            GROUP BY status
        `);
        stats.sync_queue = syncStmt.all();

        // Unsynced results
        const unsyncedStmt = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM step_results 
            WHERE synced_to_cloud = 0
        `);
        stats.unsynced_results = unsyncedStmt.get().count;

        return stats;
    }

    /**
     * Clean up old completed runs
     */
    cleanup(olderThanDays = 7) {
        const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        
        const stmt = this.db.prepare(`
            DELETE FROM runs 
            WHERE status IN ('complete', 'failed', 'cancelled')
              AND completed_at < ?
        `);
        
        const info = stmt.run(cutoff);
        console.log(`[DesktopStateStore] Cleaned up ${info.changes} old runs`);
        
        return info.changes;
    }

    /**
     * Close database connection
     */
    close() {
        this.db.close();
        console.log(`[DesktopStateStore] Database closed`);
    }
}

module.exports = { DesktopStateStore };
