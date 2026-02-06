/**
 * User Profile Cache - Phase 4: Local SQLite Cache
 *
 * SQLite-based local cache for user profile, facts, and preferences.
 * Enables fast local reads and offline support with background sync to Supabase.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class UserProfileCache {
  constructor(dbPath = null) {
    // Default to app data directory
    if (!dbPath) {
      const userDataPath = app.getPath('userData');
      dbPath = path.join(userDataPath, 'user-profile-cache.db');
    }

    console.log(`[UserProfileCache] Initializing database: ${dbPath}`);

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database with WAL mode for better concurrency
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    // Initialize schema
    this.initSchema();

    console.log(`[UserProfileCache] Database initialized successfully`);
  }

  /**
   * Initialize database schema
   */
  initSchema() {
    const schemaPath = path.join(__dirname, 'userProfileSchema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    const statements = schema.split(';').filter((s) => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          this.db.exec(statement);
        } catch (err) {
          // Ignore "already exists" errors
          if (!err.message.includes('already exists')) {
            console.error('[UserProfileCache] Schema error:', err.message);
          }
        }
      }
    }
  }

  // ==================== USER PROFILE ====================

  /**
   * Get cached user profile
   * @param {string} userId - User ID
   * @returns {Object|null} User profile or null if not cached
   */
  getProfile(userId) {
    const stmt = this.db.prepare('SELECT * FROM user_profile WHERE user_id = ?');
    const row = stmt.get(userId);
    return row || null;
  }

  /**
   * Save user profile to cache
   * @param {Object} profile - User profile data from Supabase
   */
  saveProfile(profile) {
    if (!profile || !profile.id) {
      console.warn('[UserProfileCache] Cannot save profile without ID');
      return null;
    }

    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO user_profile (
        user_id, email, credits, subscription_status, subscription_tier,
        credit_reset_date, display_name, created_at, updated_at, last_synced_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      ON CONFLICT(user_id) DO UPDATE SET
        email = excluded.email,
        credits = excluded.credits,
        subscription_status = excluded.subscription_status,
        subscription_tier = excluded.subscription_tier,
        credit_reset_date = excluded.credit_reset_date,
        display_name = excluded.display_name,
        updated_at = excluded.updated_at,
        last_synced_at = excluded.last_synced_at,
        sync_status = 'synced'
    `);

    stmt.run(
      profile.id,
      profile.email || null,
      profile.credits || 0,
      profile.subscription_status || null,
      profile.subscription_tier || null,
      profile.credit_reset_date || null,
      profile.display_name || null,
      profile.created_at ? new Date(profile.created_at).getTime() : now,
      now,
      now
    );

    console.log(`[UserProfileCache] Profile saved for user: ${profile.id.slice(-6)}`);
    return this.getProfile(profile.id);
  }

  /**
   * Update credits locally (fast update without full sync)
   * @param {string} userId - User ID
   * @param {number} credits - New credit balance
   */
  updateCredits(userId, credits) {
    const stmt = this.db.prepare(`
      UPDATE user_profile
      SET credits = ?, updated_at = ?, sync_status = 'pending'
      WHERE user_id = ?
    `);
    stmt.run(credits, Date.now(), userId);
    console.log(`[UserProfileCache] Credits updated locally: ${credits}`);
  }

  /**
   * Check if we have a cached profile
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  hasProfile(userId) {
    const stmt = this.db.prepare('SELECT 1 FROM user_profile WHERE user_id = ?');
    return !!stmt.get(userId);
  }

  // ==================== FACTS CACHE ====================

  /**
   * Get cached facts for user
   * @param {string} userId - User ID
   * @param {string} category - Optional category filter
   * @returns {Array} Array of facts
   */
  getFacts(userId, category = null) {
    let stmt;
    if (category) {
      stmt = this.db.prepare(`
        SELECT * FROM facts_cache
        WHERE user_id = ? AND category = ?
        ORDER BY confidence DESC, updated_at DESC
      `);
      return stmt.all(userId, category);
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM facts_cache
        WHERE user_id = ?
        ORDER BY category, confidence DESC
      `);
      return stmt.all(userId);
    }
  }

  /**
   * Save facts to cache (bulk operation)
   * @param {string} userId - User ID
   * @param {Array} facts - Array of facts from Supabase
   */
  saveFacts(userId, facts) {
    if (!Array.isArray(facts) || facts.length === 0) return;

    const now = Date.now();
    const insertStmt = this.db.prepare(`
      INSERT INTO facts_cache (
        id, user_id, category, key, value, source, confidence,
        created_at, updated_at, last_synced_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      ON CONFLICT(user_id, category, key) DO UPDATE SET
        id = excluded.id,
        value = excluded.value,
        source = excluded.source,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at,
        last_synced_at = excluded.last_synced_at,
        sync_status = 'synced'
    `);

    const saveMany = this.db.transaction((facts) => {
      for (const fact of facts) {
        insertStmt.run(
          fact.id || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          userId,
          fact.category,
          fact.key,
          fact.value,
          fact.source || 'user',
          fact.confidence || 0.8,
          fact.created_at ? new Date(fact.created_at).getTime() : now,
          now,
          now
        );
      }
    });

    saveMany(facts);
    console.log(`[UserProfileCache] Saved ${facts.length} facts for user: ${userId.slice(-6)}`);
  }

  /**
   * Set a single fact (local-first)
   * @param {string} userId - User ID
   * @param {string} category - Fact category
   * @param {string} key - Fact key
   * @param {string} value - Fact value
   * @param {string} source - Source of fact
   * @returns {Object} The saved fact
   */
  setFact(userId, category, key, value, source = 'user') {
    const now = Date.now();
    const id = `local-${now}-${Math.random().toString(36).slice(2)}`;

    const stmt = this.db.prepare(`
      INSERT INTO facts_cache (
        id, user_id, category, key, value, source, confidence,
        created_at, updated_at, last_synced_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, 0.8, ?, ?, NULL, 'pending')
      ON CONFLICT(user_id, category, key) DO UPDATE SET
        value = excluded.value,
        source = excluded.source,
        updated_at = excluded.updated_at,
        sync_status = 'pending'
    `);

    stmt.run(id, userId, category, key, value, source, now, now);
    console.log(`[UserProfileCache] Fact set locally: ${category}.${key}`);

    // Return the fact
    const getStmt = this.db.prepare(
      'SELECT * FROM facts_cache WHERE user_id = ? AND category = ? AND key = ?'
    );
    return getStmt.get(userId, category, key);
  }

  /**
   * Search facts by keyword
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @returns {Array} Matching facts
   */
  searchFacts(userId, query) {
    const stmt = this.db.prepare(`
      SELECT * FROM facts_cache
      WHERE user_id = ?
        AND (category LIKE ? OR key LIKE ? OR value LIKE ?)
      ORDER BY confidence DESC
      LIMIT 50
    `);
    const pattern = `%${query}%`;
    return stmt.all(userId, pattern, pattern, pattern);
  }

  /**
   * Get facts pending sync
   * @param {string} userId - User ID
   * @returns {Array} Facts that need to be synced to Supabase
   */
  getPendingFacts(userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM facts_cache
      WHERE user_id = ? AND sync_status = 'pending'
    `);
    return stmt.all(userId);
  }

  /**
   * Mark facts as synced
   * @param {Array} factIds - Array of fact IDs to mark as synced
   */
  markFactsSynced(factIds) {
    if (!Array.isArray(factIds) || factIds.length === 0) return;

    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE facts_cache
      SET sync_status = 'synced', last_synced_at = ?
      WHERE id = ?
    `);

    const markMany = this.db.transaction((ids) => {
      for (const id of ids) {
        stmt.run(now, id);
      }
    });

    markMany(factIds);
  }

  // ==================== PREFERENCES CACHE ====================

  /**
   * Get cached preferences for user
   * @param {string} userId - User ID
   * @returns {Array} Array of preferences
   */
  getPreferences(userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM preferences_cache
      WHERE user_id = ?
      ORDER BY category, key
    `);
    return stmt.all(userId);
  }

  /**
   * Save preferences to cache (bulk operation)
   * @param {string} userId - User ID
   * @param {Array} preferences - Array of preferences from Supabase
   */
  savePreferences(userId, preferences) {
    if (!Array.isArray(preferences) || preferences.length === 0) return;

    const now = Date.now();
    const insertStmt = this.db.prepare(`
      INSERT INTO preferences_cache (
        user_id, key, value, category, created_at, updated_at, last_synced_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        category = excluded.category,
        updated_at = excluded.updated_at,
        last_synced_at = excluded.last_synced_at,
        sync_status = 'synced'
    `);

    const saveMany = this.db.transaction((prefs) => {
      for (const pref of prefs) {
        insertStmt.run(
          userId,
          pref.key,
          pref.value,
          pref.category || 'general',
          pref.created_at ? new Date(pref.created_at).getTime() : now,
          now,
          now
        );
      }
    });

    saveMany(preferences);
    console.log(`[UserProfileCache] Saved ${preferences.length} preferences for user: ${userId.slice(-6)}`);
  }

  /**
   * Set a single preference (local-first)
   */
  setPreference(userId, key, value, category = 'general') {
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO preferences_cache (
        user_id, key, value, category, created_at, updated_at, last_synced_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending')
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        category = excluded.category,
        updated_at = excluded.updated_at,
        sync_status = 'pending'
    `);

    stmt.run(userId, key, value, category, now, now);
    console.log(`[UserProfileCache] Preference set locally: ${key}`);
  }

  // ==================== CONVERSATION SUMMARIES ====================

  /**
   * Save a conversation summary
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID of the conversation
   * @param {string} summary - Brief summary of the conversation
   * @param {number} messageCount - Number of messages in the conversation
   * @param {Array} topics - Array of main topics discussed
   */
  saveConversationSummary(userId, sessionId, summary, messageCount = 0, topics = []) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO conversation_summaries (
        user_id, session_id, summary, message_count, topics, created_at, ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        summary = excluded.summary,
        message_count = excluded.message_count,
        topics = excluded.topics,
        ended_at = excluded.ended_at
    `);

    stmt.run(
      userId,
      sessionId,
      summary,
      messageCount,
      JSON.stringify(topics),
      now,
      now
    );

    console.log(`[UserProfileCache] Conversation summary saved for session: ${sessionId.slice(-6)}`);

    // Keep only the last 10 summaries per user (cleanup old ones)
    this.cleanupOldSummaries(userId, 10);
  }

  /**
   * Get recent conversation summaries for context
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of summaries to return
   * @returns {Array} Array of recent conversation summaries
   */
  getRecentSummaries(userId, limit = 3) {
    const stmt = this.db.prepare(`
      SELECT * FROM conversation_summaries
      WHERE user_id = ?
      ORDER BY ended_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(userId, limit);

    // Parse topics JSON
    return rows.map(row => ({
      ...row,
      topics: row.topics ? JSON.parse(row.topics) : []
    }));
  }

  /**
   * Get a specific conversation summary by session ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Conversation summary or null
   */
  getSummaryBySessionId(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM conversation_summaries WHERE session_id = ?
    `);

    const row = stmt.get(sessionId);
    if (!row) return null;

    return {
      ...row,
      topics: row.topics ? JSON.parse(row.topics) : []
    };
  }

  /**
   * Build context string from recent summaries for new conversations
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of summaries to include
   * @returns {string} Formatted context string
   */
  buildSummaryContext(userId, limit = 3) {
    const summaries = this.getRecentSummaries(userId, limit);

    if (summaries.length === 0) {
      return '';
    }

    const lines = summaries.map((s, i) => {
      const date = new Date(s.ended_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      return `${i + 1}. (${date}) ${s.summary}`;
    });

    return `Recent conversation history:\n${lines.join('\n')}`;
  }

  /**
   * Clean up old summaries, keeping only the most recent ones
   * @param {string} userId - User ID
   * @param {number} keepCount - Number of summaries to keep
   */
  cleanupOldSummaries(userId, keepCount = 10) {
    // Get IDs of summaries to keep
    const keepStmt = this.db.prepare(`
      SELECT id FROM conversation_summaries
      WHERE user_id = ?
      ORDER BY ended_at DESC
      LIMIT ?
    `);
    const keepIds = keepStmt.all(userId, keepCount).map(r => r.id);

    if (keepIds.length === 0) return;

    // Delete summaries not in the keep list
    const deleteStmt = this.db.prepare(`
      DELETE FROM conversation_summaries
      WHERE user_id = ? AND id NOT IN (${keepIds.map(() => '?').join(',')})
    `);

    const info = deleteStmt.run(userId, ...keepIds);
    if (info.changes > 0) {
      console.log(`[UserProfileCache] Cleaned up ${info.changes} old conversation summaries`);
    }
  }

  /**
   * Get total count of summaries for a user
   * @param {string} userId - User ID
   * @returns {number} Count of summaries
   */
  getSummaryCount(userId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM conversation_summaries WHERE user_id = ?
    `);
    return stmt.get(userId).count;
  }

  // ==================== SYNC LOG ====================

  /**
   * Log a sync operation
   */
  logSync(userId, operation, tableName, recordId, status, error = null) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_log (user_id, operation, table_name, record_id, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId, operation, tableName, recordId, status, error, Date.now());
  }

  /**
   * Get recent sync log entries
   */
  getSyncLog(userId, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_log
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit);
  }

  // ==================== UTILITIES ====================

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {};

    // Profile count
    stats.profiles = this.db.prepare('SELECT COUNT(*) as count FROM user_profile').get().count;

    // Facts count by status
    stats.facts = this.db
      .prepare('SELECT sync_status, COUNT(*) as count FROM facts_cache GROUP BY sync_status')
      .all();

    // Preferences count
    stats.preferences = this.db.prepare('SELECT COUNT(*) as count FROM preferences_cache').get()
      .count;

    // Recent sync log
    stats.recentSyncs = this.db
      .prepare('SELECT COUNT(*) as count FROM sync_log WHERE created_at > ?')
      .get(Date.now() - 24 * 60 * 60 * 1000).count;

    return stats;
  }

  /**
   * Clear all cached data for a user
   */
  clearUserCache(userId) {
    const deleteProfile = this.db.prepare('DELETE FROM user_profile WHERE user_id = ?');
    const deleteFacts = this.db.prepare('DELETE FROM facts_cache WHERE user_id = ?');
    const deletePrefs = this.db.prepare('DELETE FROM preferences_cache WHERE user_id = ?');
    const deleteLogs = this.db.prepare('DELETE FROM sync_log WHERE user_id = ?');

    const clearAll = this.db.transaction(() => {
      deleteProfile.run(userId);
      deleteFacts.run(userId);
      deletePrefs.run(userId);
      deleteLogs.run(userId);
    });

    clearAll();
    console.log(`[UserProfileCache] Cache cleared for user: ${userId.slice(-6)}`);
  }

  /**
   * Clean up old sync logs
   */
  cleanup(olderThanDays = 7) {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const stmt = this.db.prepare('DELETE FROM sync_log WHERE created_at < ?');
    const info = stmt.run(cutoff);

    console.log(`[UserProfileCache] Cleaned up ${info.changes} old sync log entries`);
    return info.changes;
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
    console.log(`[UserProfileCache] Database closed`);
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create the singleton instance
 * @returns {UserProfileCache}
 */
function getProfileCache() {
  if (!instance) {
    instance = new UserProfileCache();
  }
  return instance;
}

module.exports = { UserProfileCache, getProfileCache };
