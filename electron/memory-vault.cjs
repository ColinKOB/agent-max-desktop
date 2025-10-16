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
   * - Generate/retrieve encryption key
   * - Open database
   * - Create schema
   * - Load or create default identity
   */
  async initialize() {
    try {
      // Get encryption key from keychain
      this.encryptionKey = await this.keychain.initialize();
      console.log('✓ Encryption key ready');

      // Open database
      this.db = new Database(this.vaultPath, { verbose: null });
      this.db.pragma('journal_mode = WAL'); // Better concurrency
      this.db.pragma('foreign_keys = ON'); // Enforce constraints
      console.log('✓ Database opened:', this.vaultPath);

      // Create schema
      this._createSchema();
      console.log('✓ Schema initialized');

      // Load or create default identity
      this.currentIdentityId = this._loadOrCreateIdentity();
      console.log('✓ Identity loaded:', this.currentIdentityId);

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
   * Load existing identity or create a new one
   */
  _loadOrCreateIdentity() {
    const existing = this.db.prepare('SELECT id FROM identities ORDER BY created_at DESC LIMIT 1').get();

    if (existing) {
      return existing.id;
    }

    // Create new identity
    const id = uuidv4();
    this.db
      .prepare(
        `
      INSERT INTO identities (id, display_name)
      VALUES (?, ?)
    `
      )
      .run(id, null);

    return id;
  }

  /**
   * Encrypt sensitive data before storing
   */
  _encrypt(text) {
    if (!text) return null;

    const iv = crypto.randomBytes(16);
    const key = Buffer.from(this.encryptionKey, 'hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
    });
  }

  /**
   * Decrypt sensitive data
   */
  _decrypt(encrypted) {
    if (!encrypted) return null;

    try {
      const { iv, data } = JSON.parse(encrypted);
      const key = Buffer.from(this.encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));

      let decrypted = decipher.update(data, 'hex', 'utf8');
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

    this.db
      .prepare(
        `
      INSERT INTO messages (id, session_id, role, content)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(id, sid, role, content);

    return id;
  }

  getRecentMessages(count = 10, sessionId = null) {
    const sid = sessionId || this.currentSessionId;

    if (!sid) {
      return [];
    }

    return this.db
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
  }

  getAllMessagesForSession(sessionId) {
    return this.db
      .prepare(
        `
      SELECT * FROM messages 
      WHERE session_id = ?
      ORDER BY created_at ASC
    `
      )
      .all(sessionId);
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
        object,
        confidence,
        pii_level,
        consent_scope,
        source_msg_id,
        decay_halflife_days
      );

    return id;
  }

  getFact(category, predicate) {
    return this.db
      .prepare(
        `
      SELECT * FROM facts 
      WHERE identity_id = ? AND category = ? AND predicate = ?
    `
      )
      .get(this.currentIdentityId, category, predicate);
  }

  getAllFacts(category = null) {
    if (category) {
      return this.db
        .prepare(
          `
        SELECT * FROM facts 
        WHERE identity_id = ? AND category = ?
        ORDER BY confidence DESC, updated_at DESC
      `
        )
        .all(this.currentIdentityId, category);
    }

    return this.db
      .prepare(
        `
      SELECT * FROM facts 
      WHERE identity_id = ?
      ORDER BY category, confidence DESC
    `
      )
      .all(this.currentIdentityId);
  }

  updateFact(id, updates) {
    const { object, confidence, consent_scope, pii_level } = updates;

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
      .run(object, confidence, consent_scope, pii_level, id);

    return this.db.prepare('SELECT * FROM facts WHERE id = ?').get(id);
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
   * Full-text search in messages
   */
  searchMessages(query, limit = 10) {
    return this.db
      .prepare(
        `
      SELECT m.* FROM messages m
      JOIN messages_fts fts ON m.rowid = fts.rowid
      WHERE messages_fts MATCH ?
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
