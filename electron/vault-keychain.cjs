/**
 * Vault Keychain Manager
 * Handles encryption key storage using OS-level keychain/credential manager
 */

const keytar = require('keytar');
const crypto = require('crypto');

const SERVICE_NAME = 'agent-max-desktop';
const ACCOUNT_NAME = 'vault-encryption-key';

class VaultKeychain {
  constructor() {
    this.serviceName = SERVICE_NAME;
    this.accountName = ACCOUNT_NAME;
  }

  /**
   * Generate a new 256-bit encryption key
   */
  generateKey() {
    return crypto.randomBytes(32).toString('hex'); // 256 bits as hex string
  }

  /**
   * Store encryption key in OS keychain
   * @param {string} key - 256-bit key as hex string
   */
  async storeKey(key) {
    try {
      await keytar.setPassword(this.serviceName, this.accountName, key);
      console.log('✓ Encryption key stored in OS keychain');
      return true;
    } catch (error) {
      console.error('Failed to store key in keychain:', error);
      throw new Error(`Keychain storage failed: ${error.message}`);
    }
  }

  /**
   * Retrieve encryption key from OS keychain
   * @returns {string|null} - 256-bit key as hex string, or null if not found
   */
  async retrieveKey() {
    try {
      const key = await keytar.getPassword(this.serviceName, this.accountName);
      if (key) {
        console.log('✓ Encryption key retrieved from OS keychain');
      }
      return key;
    } catch (error) {
      console.error('Failed to retrieve key from keychain:', error);
      return null;
    }
  }

  /**
   * Check if a key exists in the keychain
   */
  async hasKey() {
    const key = await this.retrieveKey();
    return key !== null;
  }

  /**
   * Delete encryption key from OS keychain
   */
  async deleteKey() {
    try {
      const deleted = await keytar.deletePassword(this.serviceName, this.accountName);
      if (deleted) {
        console.log('✓ Encryption key deleted from OS keychain');
      }
      return deleted;
    } catch (error) {
      console.error('Failed to delete key from keychain:', error);
      return false;
    }
  }

  /**
   * Initialize keychain - generate and store key if none exists
   * @returns {string} - The encryption key (either existing or newly generated)
   */
  async initialize() {
    let key = await this.retrieveKey();

    if (!key) {
      console.log('No encryption key found, generating new one...');
      key = this.generateKey();
      await this.storeKey(key);
    }

    return key;
  }

  /**
   * Rotate encryption key
   * WARNING: This requires re-encrypting the entire database
   * @returns {Object} - {oldKey, newKey}
   */
  async rotateKey() {
    const oldKey = await this.retrieveKey();
    if (!oldKey) {
      throw new Error('No existing key to rotate');
    }

    const newKey = this.generateKey();
    await this.storeKey(newKey);

    console.log('✓ Encryption key rotated (re-encryption required)');

    return { oldKey, newKey };
  }

  /**
   * Export key for backup (encrypted with user password)
   * @param {string} userPassword - User-provided password
   * @returns {string} - Encrypted key bundle as JSON string
   */
  async exportKeyBackup(userPassword) {
    const key = await this.retrieveKey();
    if (!key) {
      throw new Error('No key to export');
    }

    // Derive a key from the user password using PBKDF2
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(userPassword, salt, 100000, 32, 'sha256');

    // Encrypt the vault key with the derived key
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const backup = {
      version: 1,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      encrypted_key: encrypted,
      created_at: new Date().toISOString(),
    };

    return JSON.stringify(backup);
  }

  /**
   * Import key from backup (decrypt with user password)
   * @param {string} backupJson - Encrypted key bundle
   * @param {string} userPassword - User-provided password
   */
  async importKeyBackup(backupJson, userPassword) {
    const backup = JSON.parse(backupJson);

    // Derive the key from the user password
    const salt = Buffer.from(backup.salt, 'hex');
    const derivedKey = crypto.pbkdf2Sync(userPassword, salt, 100000, 32, 'sha256');

    // Decrypt the vault key
    const iv = Buffer.from(backup.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
    let decrypted = decipher.update(backup.encrypted_key, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Store the recovered key
    await this.storeKey(decrypted);

    console.log('✓ Encryption key restored from backup');
    return decrypted;
  }
}

module.exports = VaultKeychain;
