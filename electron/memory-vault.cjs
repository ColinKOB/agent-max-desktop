/**
 * Memory Vault - SQLite-based encrypted memory storage
 * Replaces JSON-based memory system with structured, indexed, searchable database
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const VaultKeychain = require('./vault-keychain.cjs');

class MemoryVault {
  constructor(options = {}) {
    // Allow custom data path for testing
    if (options.dataPath) {
      this.appDataPath = options.dataPath;
    } else {
      const { app } = require('electron');
      this.appDataPath = app.getPath('userData');
    }
    
    this.vaultPath = path.join(this.appDataPath, 'memory-vault.db');
    this.schemaPath = path.join(__dirname, 'vault-schema.sql');
    this.keychain = new VaultKeychain();
    this.db = null;
    this.encryptionKey = null;
    this.currentIdentityId = null;
    this.currentSessionId = null;
  }

  /**
   * Initialize the vault
   * - Generate/retrieve encryption key AND identity_id from keychain
   * - Open database
   * - Create schema
   * - Store identity_id in meta table
   */
  async initialize() {
    try {
      // Get/generate identity_id from keychain (single source of truth)
      let identityId = await this.keychain.getIdentityId();
      if (!identityId) {
        identityId = uuidv4();
        await this.keychain.storeIdentityId(identityId);
        console.log('✓ Generated new identity ID');
      } else {
        console.log('✓ Retrieved existing identity ID');
      }
      this.currentIdentityId = identityId;

      // Get encryption key from keychain
      this.encryptionKey = await this.keychain.initialize();
      console.log('✓ Encryption key ready');

      // Convert hex key to Buffer for encryption
      this.encryptionKeyBuffer = Buffer.from(this.encryptionKey, 'hex');

      // Open database
      this.db = new Database(this.vaultPath, { verbose: null });
      
      // Set critical PRAGMAs
      this.db.pragma('journal_mode = WAL'); // Better concurrency
      this.db.pragma('synchronous = NORMAL'); // Balance safety/speed (FULL for migrations)
      this.db.pragma('busy_timeout = 5000'); // Wait up to 5s on lock
      this.db.pragma('foreign_keys = ON'); // Enforce constraints
      
      console.log('✓ Database opened:', this.vaultPath);

      // Create schema FIRST (creates meta table)
      this._createSchema();
      console.log('✓ Schema initialized');
      
      // THEN run integrity check (needs meta table)
      const integrityResult = this.db.pragma('integrity_check');
      if (integrityResult.length > 0 && integrityResult[0].integrity_check !== 'ok') {
        console.error('⚠️  Database integrity check failed:', integrityResult);
        this._setMeta('integrity_failed', '1');
        this._setMeta('integrity_error', JSON.stringify(integrityResult));
        throw new Error('Database integrity check failed');
      } else {
        console.log('✓ Database integrity OK');
        this._setMeta('last_integrity_check', new Date().toISOString());
      }

      // Store identity_id in meta table (if not exists)
      const storedId = this._getMeta('identity_id');
      if (!storedId) {
        this._setMeta('identity_id', this.currentIdentityId);
      } else if (storedId !== this.currentIdentityId) {
        console.warn('⚠️  Identity ID mismatch - using keychain version');
        this._setMeta('identity_id', this.currentIdentityId);
      }

      // Load or create identity record
      this._ensureIdentity();
      console.log('✓ Identity ensured:', this.currentIdentityId.slice(-6));

      return true;
    } catch (error) {
      console.error('Failed to initialize vault:', error);
      throw error;
    }
  }

  /**
   * Create database schema from SQL file
   */
  _createSchema() {
    const schema = fs.readFileSync(this.schemaPath, 'utf8');
    this.db.exec(schema);
  }

  /**
   * Ensure identity exists in identities table
   */
  _ensureIdentity() {
    const existing = this.db.prepare('SELECT id FROM identities WHERE id = ?').get(this.currentIdentityId);

    if (!existing) {
      this.db
        .prepare('INSERT INTO identities (id, display_name) VALUES (?, ?)')
        .run(this.currentIdentityId, null);
    }
  }

  /**
   * Get meta value
   */
  _getMeta(key) {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  /**
   * Set meta value
   */
  _setMeta(key, value) {
    this.db
      .prepare(
        `INSERT INTO meta (key, value, updated_at) 
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .run(key, String(value));
  }

  /**
   * Get all meta as object
   */
  _getAllMeta() {
    const rows = this.db.prepare('SELECT key, value FROM meta').all();
    const meta = {};
    for (const row of rows) {
      meta[row.key] = row.value;
    }
    return meta;
  }

  /**
   * Encrypt field (field-level encryption, not whole-record)
   */
  _encryptField(text) {
    if (!text) return null;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKeyBuffer, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Store as "iv:data" for easy parsing
    return `${iv.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt field
   */
  _decryptField(encrypted) {
    if (!encrypted) return null;
    if (!encrypted.includes(':')) return encrypted; // Not encrypted (migration case)

    try {
      const [ivStr, data] = encrypted.split(':');
      const iv = Buffer.from(ivStr, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKeyBuffer, iv);
      let decrypted = decipher.update(data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  // ============================================
  // IDENTITY MANAGEMENT
  // ============================================

  getIdentity() {
    return this.db
      .prepare(
        `
      SELECT * FROM identities WHERE id = ?
    `
      )
      .get(this.currentIdentityId);
  }

  updateIdentity(updates) {
    const { display_name } = updates;

    this.db
      .prepare(
        `
      UPDATE identities 
      SET display_name = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `
      )
      .run(display_name, this.currentIdentityId);

    return this.getIdentity();
  }

  setDisplayName(name) {
    return this.updateIdentity({ display_name: name });
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  createSession(goal = null) {
    const id = uuidv4();

    this.db
      .prepare(
        `
      INSERT INTO sessions (id, identity_id, goal)
      VALUES (?, ?, ?)
    `
      )
      .run(id, this.currentIdentityId, goal);

    this.currentSessionId = id;
    return id;
  }

  getCurrentSession() {
    if (!this.currentSessionId) {
      return null;
    }

    return this.db
      .prepare(
        `
      SELECT * FROM sessions WHERE id = ?
    `
      )
      .get(this.currentSessionId);
  }

  endSession(summary = null) {
    if (!this.currentSessionId) {
      return;
    }

    this.db
      .prepare(
        `
      UPDATE sessions 
      SET ended_at = datetime('now'),
          title = ?
      WHERE id = ?
    `
      )
      .run(summary, this.currentSessionId);

    this.currentSessionId = null;
  }

  getAllSessions(limit = 50) {
    return this.db
      .prepare(
        `
      SELECT * FROM sessions 
      WHERE identity_id = ?
      ORDER BY started_at DESC 
      LIMIT ?
    `
      )
      .all(this.currentIdentityId, limit);
  }

  // ============================================
  // MESSAGE MANAGEMENT
  // ============================================

  addMessage(role, content, sessionId = null) {
    const sid = sessionId || this.currentSessionId;

    if (!sid) {
      throw new Error('No active session');
    }

    const id = uuidv4();

    // Encrypt message content (field-level encryption)
    const encryptedContent = this._encryptField(content);

    this.db
      .prepare(
        `
      INSERT INTO messages (id, session_id, role, content)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(id, sid, role, encryptedContent);

    return id;
  }

  getRecentMessages(count = 10, sessionId = null) {
    const sid = sessionId || this.currentSessionId;

    if (!sid) {
      return [];
    }

    const messages = this.db
      .prepare(
        `
      SELECT * FROM messages 
      WHERE session_id = ?
      ORDER BY created_at DESC 
      LIMIT ?
    `
      )
      .all(sid, count)
      .reverse(); // Oldest first

    // Decrypt message content
    return messages.map((msg) => ({
      ...msg,
      content: this._decryptField(msg.content),
    }));
  }

  getAllMessagesForSession(sessionId) {
    const messages = this.db
      .prepare(
        `
      SELECT * FROM messages 
      WHERE session_id = ?
      ORDER BY created_at ASC
    `
      )
      .all(sessionId);

    // Decrypt message content
    return messages.map((msg) => ({
      ...msg,
      content: this._decryptField(msg.content),
    }));
  }

  // ============================================
  // FACT MANAGEMENT
  // ============================================

  setFact(category, predicate, object, options = {}) {
    const {
      confidence = 0.8,
      pii_level = 1,
      consent_scope = 'default',
      source_msg_id = null,
      decay_halflife_days = 90,
    } = options;

    const id = uuidv4();

    // Encrypt fact value (field-level encryption)
    const encryptedObject = this._encryptField(object);

    // UPSERT: Insert or replace if exists
    this.db
      .prepare(
        `
      INSERT INTO facts (
        id, identity_id, category, predicate, object,
        confidence, pii_level, consent_scope, source_msg_id, decay_halflife_days,
        last_reinforced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(identity_id, category, predicate) 
      DO UPDATE SET 
        object = excluded.object,
        confidence = excluded.confidence,
        updated_at = datetime('now'),
        source_msg_id = excluded.source_msg_id
    `
      )
      .run(
        id,
        this.currentIdentityId,
        category,
        predicate,
        encryptedObject,
        confidence,
        pii_level,
        consent_scope,
        source_msg_id,
        decay_halflife_days
      );

    return id;
  }

  getFact(category, predicate) {
    const fact = this.db
      .prepare(
        `
      SELECT * FROM facts 
      WHERE identity_id = ? AND category = ? AND predicate = ?
    `
      )
      .get(this.currentIdentityId, category, predicate);

    if (fact) {
      fact.object = this._decryptField(fact.object);
    }
    return fact;
  }

  getAllFacts(category = null) {
    let facts;
    
    if (category) {
      facts = this.db
        .prepare(
          `
        SELECT * FROM facts 
        WHERE identity_id = ? AND category = ?
        ORDER BY confidence DESC, updated_at DESC
      `
        )
        .all(this.currentIdentityId, category);
    } else {
      facts = this.db
        .prepare(
          `
        SELECT * FROM facts 
        WHERE identity_id = ?
        ORDER BY category, confidence DESC
      `
        )
        .all(this.currentIdentityId);
    }

    // Decrypt fact values
    return facts.map((f) => ({
      ...f,
      object: this._decryptField(f.object),
    }));
  }

  updateFact(id, updates) {
    const { object, confidence, consent_scope, pii_level } = updates;

    // Encrypt object if provided
    const encryptedObject = object ? this._encryptField(object) : null;

    this.db
      .prepare(
        `
      UPDATE facts 
      SET object = COALESCE(?, object),
          confidence = COALESCE(?, confidence),
          consent_scope = COALESCE(?, consent_scope),
          pii_level = COALESCE(?, pii_level),
          updated_at = datetime('now')
      WHERE id = ?
    `
      )
      .run(encryptedObject, confidence, consent_scope, pii_level, id);

    const fact = this.db.prepare('SELECT * FROM facts WHERE id = ?').get(id);
    if (fact) {
      fact.object = this._decryptField(fact.object);
    }
    return fact;
  }

  deleteFact(id) {
    return this.db
      .prepare(
        `
      DELETE FROM facts WHERE id = ?
    `
      )
      .run(id);
  }

  reinforceFact(id) {
    this.db
      .prepare(
        `
      UPDATE facts 
      SET last_reinforced_at = datetime('now'),
          confidence = MIN(1.0, confidence * 1.05)
      WHERE id = ?
    `
      )
      .run(id);
  }

  /**
   * Reinforce multiple facts (after successful use)
   * @param {string[]} factIds - Array of fact IDs to reinforce
   */
  reinforceFacts(factIds) {
    if (!factIds || factIds.length === 0) return;

    // Cap at 25 facts per call (prevent runaway writes)
    const MAX_REINFORCEMENTS = 25;
    if (factIds.length > MAX_REINFORCEMENTS) {
      console.warn(`⚠️  Capping reinforcement to ${MAX_REINFORCEMENTS} facts (${factIds.length} requested)`);
      factIds = factIds.slice(0, MAX_REINFORCEMENTS);
    }

    // De-duplicate IDs (idempotency)
    const uniqueIds = [...new Set(factIds)];

    // Use transaction for atomic operation
    const updateStmt = this.db.prepare(
      `UPDATE facts 
       SET last_reinforced_at = datetime('now'),
           confidence = MIN(1.0, confidence * 1.05)
       WHERE id = ?`
    );

    const reinforceMany = this.db.transaction((ids) => {
      for (const id of ids) {
        updateStmt.run(id);
      }
    });

    reinforceMany(uniqueIds);
    
    console.log(`✓ Reinforced ${uniqueIds.length} facts`);
  }

  /**
   * Calculate relevance score with decay
   */
  getFactRelevance(fact) {
    const now = new Date();
    const lastReinforced = fact.last_reinforced_at
      ? new Date(fact.last_reinforced_at)
      : new Date(fact.created_at);

    const ageDays = (now - lastReinforced) / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-ageDays / fact.decay_halflife_days);

    return fact.confidence * decay;
  }

  // ============================================
  // SEARCH & RETRIEVAL
  // ============================================

  /**
   * Search messages by content (fallback: LIKE since content is encrypted)
   * Note: FTS disabled for encrypted content - this is a simple fallback
   * For production: decrypt and search in memory or use session FTS
   */
  searchMessages(query, limit = 10) {
    // Since messages are encrypted, we can't FTS them
    // Fallback: search in decrypted content (slower but safe)
    const allMessages = this.db
      .prepare(
        `
      SELECT * FROM messages 
      WHERE session_id IN (
        SELECT id FROM sessions WHERE identity_id = ?
      )
      ORDER BY created_at DESC
      LIMIT 100
    `
      )
      .all(this.currentIdentityId);

    // Decrypt and filter
    const queryLower = query.toLowerCase();
    const results = allMessages
      .map((msg) => ({
        ...msg,
        content: this._decryptField(msg.content),
      }))
      .filter((msg) => msg.content.toLowerCase().includes(queryLower))
      .slice(0, limit);

    return results;
  }

  /**
   * Search sessions by title/goal (uses FTS - safe, not encrypted)
   */
  searchSessions(query, limit = 10) {
    return this.db
      .prepare(
        `
      SELECT s.* FROM sessions s
      JOIN sessions_fts fts ON s.rowid = fts.rowid
      WHERE sessions_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `
      )
      .all(query, limit);
  }

  /**
   * Search facts by keyword
   */
  searchFacts(query) {
    return this.db
      .prepare(
        `
      SELECT * FROM facts 
      WHERE identity_id = ? 
        AND (
          category LIKE ? OR 
          predicate LIKE ? OR 
          object LIKE ?
        )
      ORDER BY confidence DESC
    `
      )
      .all(this.currentIdentityId, `%${query}%`, `%${query}%`, `%${query}%`);
  }

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  exportVault() {
    return {
      identity: this.getIdentity(),
      facts: this.getAllFacts(),
      sessions: this.getAllSessions(100),
      metadata: this.db.prepare('SELECT * FROM vault_metadata').all(),
      exported_at: new Date().toISOString(),
    };
  }

  importVault(data) {
    // TODO: Implement import with conflict resolution
    throw new Error('Import not yet implemented');
  }

  // ============================================
  // STATISTICS
  // ============================================

  getStats() {
    const identity = this.getIdentity();

    const factCount = this.db
      .prepare('SELECT COUNT(*) as count FROM facts WHERE identity_id = ?')
      .get(this.currentIdentityId).count;

    const sessionCount = this.db
      .prepare('SELECT COUNT(*) as count FROM sessions WHERE identity_id = ?')
      .get(this.currentIdentityId).count;

    const messageCount = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM messages m
      JOIN sessions s ON m.session_id = s.id
      WHERE s.identity_id = ?
    `
      )
      .get(this.currentIdentityId).count;

    return {
      display_name: identity.display_name,
      facts: factCount,
      sessions: sessionCount,
      messages: messageCount,
      vault_path: this.vaultPath,
    };
  }

  // ============================================
  // UTILITIES
  // ============================================

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Backup the vault database
   */
  backup(backupPath) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.backup(backupPath);
    console.log('✓ Vault backed up to:', backupPath);
  }
}

module.exports = MemoryVault;
