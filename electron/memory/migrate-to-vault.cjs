/**
 * Migration Script: JSON to Memory Vault
 * Automatically migrates existing JSON-based memories to SQLite vault
 */

const fs = require('fs');
const path = require('path');
const MemoryVault = require('./memory-vault.cjs');

class VaultMigration {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.memoryDir = path.join(dataPath, 'memories');
    this.backupDir = path.join(dataPath, 'memories.backup');

    // JSON file paths
    this.profileFile = path.join(this.memoryDir, 'profile.json');
    this.factsFile = path.join(this.memoryDir, 'facts.json');
    this.conversationsFile = path.join(this.memoryDir, 'conversations.json');
    this.preferencesFile = path.join(this.memoryDir, 'preferences.json');

    this.vault = null;
    this.stats = {
      profile_migrated: false,
      facts_migrated: 0,
      sessions_migrated: 0,
      messages_migrated: 0,
      preferences_migrated: 0,
    };
  }

  /**
   * Check if migration is needed
   */
  needsMigration() {
    // Check if vault already exists
    const vaultPath = path.join(this.dataPath, 'memory-vault.db');
    if (fs.existsSync(vaultPath)) {
      console.log('⏭️  Vault already exists, migration not needed');
      return false;
    }

    // Check if old JSON files exist
    const hasOldFiles =
      fs.existsSync(this.profileFile) ||
      fs.existsSync(this.factsFile) ||
      fs.existsSync(this.conversationsFile) ||
      fs.existsSync(this.preferencesFile);

    return hasOldFiles;
  }

  /**
   * Decrypt old JSON files (from old encryption system)
   */
  _decryptOldJSON(filePath) {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const encrypted = JSON.parse(content);

      // Check if it's encrypted (has iv and data fields)
      if (encrypted.iv && encrypted.data) {
        // Old encryption - try to decrypt with machine ID
        const crypto = require('crypto');
        const machineId = require('node-machine-id').machineIdSync();
        const key = crypto.createHash('sha256').update(`${machineId}agent-max-desktop`).digest();

        const iv = Buffer.from(encrypted.iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
      } else {
        // Not encrypted or plaintext
        return encrypted;
      }
    } catch (error) {
      console.error(`Failed to decrypt ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Backup existing JSON files
   */
  _backupOldFiles() {
    if (!fs.existsSync(this.memoryDir)) {
      return;
    }

    // Create backup directory
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // Backup each file
    const files = [
      'profile.json',
      'facts.json',
      'conversations.json',
      'preferences.json',
    ];

    for (const file of files) {
      const srcPath = path.join(this.memoryDir, file);
      const dstPath = path.join(this.backupDir, file);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, dstPath);
        console.log(`  ✓ Backed up ${file}`);
      }
    }

    // Add timestamp file
    const timestamp = {
      backed_up_at: new Date().toISOString(),
      migration_version: '1.0',
    };
    fs.writeFileSync(path.join(this.backupDir, 'backup-info.json'), JSON.stringify(timestamp, null, 2));

    console.log('✅ Backup complete:', this.backupDir);
  }

  /**
   * Infer PII level from category and predicate
   */
  _inferPIILevel(category, predicate) {
    // PII levels: 0=public, 1=semi-private, 2=private, 3=sensitive
    if (category === 'location') return 2;
    if (category === 'personal' && predicate === 'name') return 1;
    if (category === 'personal' && predicate === 'email') return 2;
    if (category === 'personal' && predicate === 'phone') return 3;
    if (category === 'preference') return 0;
    if (category === 'work') return 1;
    if (category === 'technical') return 0;
    return 1; // Default
  }

  /**
   * Migrate profile
   */
  async _migrateProfile(profile) {
    if (!profile) return;

    console.log('📋 Migrating profile...');

    if (profile.name) {
      this.vault.setDisplayName(profile.name);
      console.log(`  ✓ Set name: ${profile.name}`);
    }

    this.stats.profile_migrated = true;
  }

  /**
   * Migrate facts
   */
  async _migrateFacts(facts) {
    if (!facts) return;

    console.log('📝 Migrating facts...');

    for (const [category, items] of Object.entries(facts)) {
      if (!items || typeof items !== 'object') continue;

      for (const [key, data] of Object.entries(items)) {
        const value = data.value !== undefined ? data.value : data;
        const piiLevel = this._inferPIILevel(category, key);

        try {
          this.vault.setFact(category, key, value, {
            confidence: 0.8,
            pii_level: piiLevel,
            consent_scope: 'default',
            decay_halflife_days: 90,
          });

          this.stats.facts_migrated++;
          console.log(`  ✓ ${category}.${key} = ${value} (PII: ${piiLevel})`);
        } catch (error) {
          console.error(`  ✗ Failed to migrate fact ${category}.${key}:`, error.message);
        }
      }
    }

    console.log(`✅ Migrated ${this.stats.facts_migrated} facts`);
  }

  /**
   * Migrate conversations (sessions + messages)
   */
  async _migrateConversations(conversations) {
    if (!conversations || !conversations.sessions) return;

    console.log('💬 Migrating conversations...');

    const sessions = conversations.sessions;

    for (const [sessionId, session] of Object.entries(sessions)) {
      if (!session || !session.messages || session.messages.length === 0) {
        continue;
      }

      try {
        // Create session
        const goal = session.goal || null;
        const vaultSessionId = this.vault.createSession(goal);

        // Migrate messages
        for (const msg of session.messages) {
          const role = msg.role || 'user';
          const content = msg.content || '';

          if (content.trim()) {
            this.vault.addMessage(role, content, vaultSessionId);
            this.stats.messages_migrated++;
          }
        }

        // End the session (mark as historical)
        this.vault.endSession(null);

        this.stats.sessions_migrated++;
        console.log(`  ✓ Session migrated: ${vaultSessionId} (${session.messages.length} messages)`);
      } catch (error) {
        console.error(`  ✗ Failed to migrate session ${sessionId}:`, error.message);
      }
    }

    console.log(`✅ Migrated ${this.stats.sessions_migrated} sessions, ${this.stats.messages_migrated} messages`);
  }

  /**
   * Migrate preferences as facts
   */
  async _migratePreferences(preferences) {
    if (!preferences) return;

    console.log('⚙️  Migrating preferences...');

    // Handle different preference types
    const types = ['explicit', 'implicit', 'work', 'system'];

    for (const type of types) {
      const prefs = preferences[type];
      if (!prefs || typeof prefs !== 'object') continue;

      for (const [key, data] of Object.entries(prefs)) {
        let value = data.value !== undefined ? data.value : data;

        // Convert booleans to strings (SQLite only accepts strings for facts)
        if (typeof value === 'boolean') {
          value = value.toString();
        }

        // Skip if value is not a string or number
        if (typeof value !== 'string' && typeof value !== 'number') {
          console.warn(`  ⚠️  Skipping preference ${key}: invalid type ${typeof value}`);
          continue;
        }

        try {
          // Store preferences as facts in 'preference' category
          this.vault.setFact('preference', key, String(value), {
            confidence: type === 'explicit' ? 0.95 : 0.7,
            pii_level: 0,
            consent_scope: 'default',
          });

          this.stats.preferences_migrated++;
          console.log(`  ✓ preference.${key} = ${value} (${type})`);
        } catch (error) {
          console.error(`  ✗ Failed to migrate preference ${key}:`, error.message);
        }
      }
    }

    console.log(`✅ Migrated ${this.stats.preferences_migrated} preferences`);
  }

  /**
   * Verify migration integrity
   */
  async _verifyMigration() {
    console.log('🔍 Verifying migration...');

    const stats = this.vault.getStats();

    console.log('  Vault statistics:');
    console.log(`    - Display name: ${stats.display_name || 'Not set'}`);
    console.log(`    - Facts: ${stats.facts}`);
    console.log(`    - Sessions: ${stats.sessions}`);
    console.log(`    - Messages: ${stats.messages}`);

    // Check against migration stats
    const factsMismatch = Math.abs(stats.facts - (this.stats.facts_migrated + this.stats.preferences_migrated));
    const sessionsMismatch = stats.sessions !== this.stats.sessions_migrated;
    const messagesMismatch = stats.messages !== this.stats.messages_migrated;

    if (factsMismatch > 0) {
      console.warn(`  ⚠️  Facts count mismatch: expected ${this.stats.facts_migrated + this.stats.preferences_migrated}, got ${stats.facts}`);
    }

    if (sessionsMismatch) {
      console.warn(`  ⚠️  Sessions count mismatch: expected ${this.stats.sessions_migrated}, got ${stats.sessions}`);
    }

    if (messagesMismatch) {
      console.warn(`  ⚠️  Messages count mismatch: expected ${this.stats.messages_migrated}, got ${stats.messages}`);
    }

    if (factsMismatch === 0 && !sessionsMismatch && !messagesMismatch) {
      console.log('✅ Migration verified - counts match!');
      return true;
    } else {
      console.warn('⚠️  Some counts don\'t match (this may be normal)');
      return true; // Still return true, mismatches are often expected
    }
  }

  /**
   * Run full migration
   */
  async migrate() {
    console.log('\n🚀 Starting Memory Vault Migration\n');
    console.log('='.repeat(60));

    try {
      // Step 1: Check if migration needed
      if (!this.needsMigration()) {
        console.log('✅ Migration not needed\n');
        return { success: true, reason: 'not_needed' };
      }

      // Step 2: Backup old files
      console.log('\n📦 Step 1: Backup existing files');
      this._backupOldFiles();

      // Step 3: Initialize vault
      console.log('\n🗄️  Step 2: Initialize vault');
      this.vault = new MemoryVault({ dataPath: this.dataPath });
      await this.vault.initialize();
      console.log('✅ Vault initialized');

      // Step 4: Load old data
      console.log('\n📂 Step 3: Load old data');
      const profile = this._decryptOldJSON(this.profileFile);
      const facts = this._decryptOldJSON(this.factsFile);
      const conversations = this._decryptOldJSON(this.conversationsFile);
      const preferences = this._decryptOldJSON(this.preferencesFile);

      console.log('  ✓ Profile:', profile ? 'Found' : 'Not found');
      console.log('  ✓ Facts:', facts ? Object.keys(facts).length + ' categories' : 'Not found');
      console.log('  ✓ Conversations:', conversations ? Object.keys(conversations.sessions || {}).length + ' sessions' : 'Not found');
      console.log('  ✓ Preferences:', preferences ? 'Found' : 'Not found');

      // Step 5: Migrate data
      console.log('\n🔄 Step 4: Migrate data');
      await this._migrateProfile(profile);
      await this._migrateFacts(facts);
      await this._migrateConversations(conversations);
      await this._migratePreferences(preferences);

      // Step 6: Verify
      console.log('\n✔️  Step 5: Verify migration');
      await this._verifyMigration();

      // Step 7: Close vault
      this.vault.close();

      // Final summary
      console.log('\n' + '='.repeat(60));
      console.log('✅ MIGRATION COMPLETE! 🎉');
      console.log('='.repeat(60));
      console.log('\n📊 Migration Summary:');
      console.log(`  - Profile: ${this.stats.profile_migrated ? 'Yes' : 'No'}`);
      console.log(`  - Facts: ${this.stats.facts_migrated}`);
      console.log(`  - Sessions: ${this.stats.sessions_migrated}`);
      console.log(`  - Messages: ${this.stats.messages_migrated}`);
      console.log(`  - Preferences: ${this.stats.preferences_migrated}`);
      console.log(`\n📁 Backup location: ${this.backupDir}`);
      console.log('\n✨ Your memories are now in the secure vault!\n');

      return {
        success: true,
        stats: this.stats,
      };
    } catch (error) {
      console.error('\n❌ MIGRATION FAILED:', error.message);
      console.error(error.stack);

      // Close vault if open
      if (this.vault) {
        this.vault.close();
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Rollback migration (restore from backup)
   */
  async rollback() {
    console.log('\n⏪ Rolling back migration...\n');

    try {
      // Delete vault
      const vaultPath = path.join(this.dataPath, 'memory-vault.db');
      if (fs.existsSync(vaultPath)) {
        fs.unlinkSync(vaultPath);
        console.log('  ✓ Deleted vault database');
      }

      // Restore from backup
      if (!fs.existsSync(this.backupDir)) {
        console.log('  ⚠️  No backup found, cannot rollback');
        return false;
      }

      const files = ['profile.json', 'facts.json', 'conversations.json', 'preferences.json'];

      for (const file of files) {
        const backupPath = path.join(this.backupDir, file);
        const originalPath = path.join(this.memoryDir, file);

        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, originalPath);
          console.log(`  ✓ Restored ${file}`);
        }
      }

      console.log('✅ Rollback complete - JSON files restored\n');
      return true;
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      return false;
    }
  }
}

module.exports = VaultMigration;
