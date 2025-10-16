/**
 * Vault Integration
 * Handles migration, initialization, and fallback logic
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const MemoryVault = require('./memory-vault.cjs');
const VaultMigration = require('./migrate-to-vault.cjs');
const SecureVaultIPCHandlers = require('./vault-ipc-handlers-secure.cjs');

class VaultIntegration {
  constructor() {
    this.vault = null;
    this.ipcHandlers = null;
    this.migrated = false;
    this.appDataPath = app.getPath('userData');
    this.vaultPath = path.join(this.appDataPath, 'memory-vault.db');
    this.migrationLogPath = path.join(this.appDataPath, 'vault-migration.log');
  }

  /**
   * Initialize vault (with migration if needed)
   */
  async initialize() {
    console.log('\n🗄️  Initializing Memory Vault...\n');

    try {
      // Check if migration is needed
      const needsMigration = this._needsMigration();

      if (needsMigration) {
        console.log('📦 Detecting old memory system - migration required');
        await this._runMigration();
      } else if (!fs.existsSync(this.vaultPath)) {
        console.log('✨ Fresh installation - initializing new vault');
      } else {
        console.log('✓ Vault exists - loading');
      }

      // Initialize vault
      this.vault = new MemoryVault();
      await this.vault.initialize();

      // Register secure IPC handlers
      this.ipcHandlers = new SecureVaultIPCHandlers(this.vault);
      this.ipcHandlers.register();

      console.log('✅ Memory Vault initialized successfully\n');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize vault:', error);
      console.error(error.stack);

      // Log error
      this._logError('Initialization failed', error);

      // Fallback to old system if vault fails
      console.warn('⚠️  Falling back to old memory system');
      return false;
    }
  }

  /**
   * Check if migration is needed
   */
  _needsMigration() {
    // Vault already exists - no migration needed
    if (fs.existsSync(this.vaultPath)) {
      return false;
    }

    // Check for old memory files
    const memoryDir = path.join(this.appDataPath, 'memories');
    if (!fs.existsSync(memoryDir)) {
      return false;
    }

    const oldFiles = [
      'profile.json',
      'facts.json',
      'conversations.json',
      'preferences.json',
    ];

    // If any old file exists, migration is needed
    return oldFiles.some((file) => fs.existsSync(path.join(memoryDir, file)));
  }

  /**
   * Run migration from old system to vault (atomic with transaction)
   */
  async _runMigration() {
    console.log('\n🔄 Starting automatic migration...\n');

    try {
      const migration = new VaultMigration(this.appDataPath);
      const result = await migration.migrate();

      if (result.success) {
        console.log('✅ Migration completed successfully');
        this.migrated = true;
        this._logMigration(result);

        // Mark migration complete in meta table
        const vault = new MemoryVault();
        await vault.initialize();
        vault._setMeta('migration_complete', '1');
        vault._setMeta('migrated_at', new Date().toISOString());
        vault.close();

        return true;
      } else {
        console.error('❌ Migration failed:', result.error);
        this._logError('Migration failed', new Error(result.error));

        // Clean up failed migration
        if (fs.existsSync(this.vaultPath)) {
          fs.unlinkSync(this.vaultPath);
        }

        return false;
      }
    } catch (error) {
      console.error('❌ Migration error:', error);
      this._logError('Migration error', error);

      // Clean up failed migration
      if (fs.existsSync(this.vaultPath)) {
        fs.unlinkSync(this.vaultPath);
      }

      return false;
    }
  }

  /**
   * Log migration success
   */
  _logMigration(result) {
    const log = {
      timestamp: new Date().toISOString(),
      success: true,
      stats: result.stats,
    };

    try {
      fs.writeFileSync(this.migrationLogPath, JSON.stringify(log, null, 2));
    } catch (error) {
      console.error('Failed to write migration log:', error);
    }
  }

  /**
   * Log error
   */
  _logError(message, error) {
    const log = {
      timestamp: new Date().toISOString(),
      success: false,
      message,
      error: error.message,
      stack: error.stack,
    };

    try {
      fs.writeFileSync(this.migrationLogPath, JSON.stringify(log, null, 2));
    } catch (err) {
      console.error('Failed to write error log:', err);
    }
  }

  /**
   * Get vault instance
   */
  getVault() {
    return this.vault;
  }

  /**
   * Check if migration was run
   */
  wasMigrated() {
    return this.migrated;
  }

  /**
   * Cleanup on app quit
   */
  cleanup() {
    if (this.vault) {
      this.vault.close();
    }

    if (this.ipcHandlers) {
      this.ipcHandlers.unregister();
    }
  }

  /**
   * Rollback migration (emergency only)
   */
  async rollback() {
    console.log('\n⏪ Rolling back migration...\n');

    try {
      const migration = new VaultMigration(this.appDataPath);
      const success = await migration.rollback();

      if (success) {
        console.log('✅ Rollback complete');

        // Delete vault
        if (fs.existsSync(this.vaultPath)) {
          fs.unlinkSync(this.vaultPath);
        }

        return true;
      } else {
        console.error('❌ Rollback failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Rollback error:', error);
      return false;
    }
  }
}

module.exports = VaultIntegration;
