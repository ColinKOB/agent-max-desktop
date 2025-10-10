/**
 * Local Memory Manager for Agent Max Desktop
 * Stores user memories securely on the local machine
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

class LocalMemoryManager {
  constructor() {
    // Get app data directory (platform-specific)
    // macOS: ~/Library/Application Support/agent-max-desktop
    // Windows: %APPDATA%/agent-max-desktop
    // Linux: ~/.config/agent-max-desktop
    this.appDataPath = app.getPath('userData');
    this.memoryDir = path.join(this.appDataPath, 'memories');
    this.profileFile = path.join(this.memoryDir, 'profile.json');
    this.factsFile = path.join(this.memoryDir, 'facts.json');
    this.conversationsFile = path.join(this.memoryDir, 'conversations.json');
    this.preferencesFile = path.join(this.memoryDir, 'preferences.json');
    
    // Encryption key derived from machine ID (unique per machine)
    this.encryptionKey = this._generateEncryptionKey();
    
    // Initialize directories
    this._ensureDirectories();
  }

  /**
   * Generate encryption key based on machine ID
   */
  _generateEncryptionKey() {
    // Use machine ID + app name for unique key
    const machineId = require('node-machine-id').machineIdSync();
    return crypto.createHash('sha256')
      .update(machineId + 'agent-max-desktop')
      .digest();
  }

  /**
   * Ensure memory directories exist
   */
  _ensureDirectories() {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
      console.log('✓ Created memory directory:', this.memoryDir);
    }
  }

  /**
   * Encrypt data before storing
   */
  _encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  /**
   * Decrypt data after reading
   */
  _decrypt(encrypted) {
    try {
      const iv = Buffer.from(encrypted.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  /**
   * Save data to file with encryption
   */
  _saveFile(filePath, data) {
    try {
      const encrypted = this._encrypt(data);
      fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving file:', error);
      return false;
    }
  }

  /**
   * Load data from file with decryption
   */
  _loadFile(filePath, defaultValue = {}) {
    try {
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      const encrypted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const decrypted = this._decrypt(encrypted);
      return decrypted || defaultValue;
    } catch (error) {
      console.error('Error loading file:', error);
      return defaultValue;
    }
  }

  // ============================================
  // USER PROFILE
  // ============================================

  /**
   * Get user profile
   */
  getProfile() {
    return this._loadFile(this.profileFile, {
      name: null,
      created_at: new Date().toISOString(),
      interaction_count: 0,
      last_interaction: null,
      preferences: {}
    });
  }

  /**
   * Update user profile
   */
  updateProfile(updates) {
    const profile = this.getProfile();
    const updated = { ...profile, ...updates };
    this._saveFile(this.profileFile, updated);
    return updated;
  }

  /**
   * Set user name
   */
  setUserName(name) {
    return this.updateProfile({ name });
  }

  /**
   * Increment interaction count
   */
  incrementInteraction() {
    const profile = this.getProfile();
    profile.interaction_count += 1;
    profile.last_interaction = new Date().toISOString();
    this._saveFile(this.profileFile, profile);
    return profile;
  }

  // ============================================
  // FACTS
  // ============================================

  /**
   * Get all facts
   */
  getFacts() {
    return this._loadFile(this.factsFile, {});
  }

  /**
   * Add or update a fact
   */
  setFact(category, key, value) {
    const facts = this.getFacts();
    if (!facts[category]) {
      facts[category] = {};
    }
    facts[category][key] = {
      value,
      updated_at: new Date().toISOString()
    };
    this._saveFile(this.factsFile, facts);
    return facts;
  }

  /**
   * Get facts by category
   */
  getFactsByCategory(category) {
    const facts = this.getFacts();
    return facts[category] || {};
  }

  /**
   * Delete a fact
   */
  deleteFact(category, key) {
    const facts = this.getFacts();
    if (facts[category] && facts[category][key]) {
      delete facts[category][key];
      this._saveFile(this.factsFile, facts);
    }
    return facts;
  }

  // ============================================
  // CONVERSATIONS
  // ============================================

  /**
   * Get conversation history
   */
  getConversations() {
    return this._loadFile(this.conversationsFile, {
      sessions: {},
      current_session: null
    });
  }

  /**
   * Start new conversation session
   */
  startSession(sessionId = null) {
    const conversations = this.getConversations();
    const newSessionId = sessionId || `session_${Date.now()}`;
    
    conversations.sessions[newSessionId] = {
      started_at: new Date().toISOString(),
      messages: [],
      facts_extracted: []
    };
    conversations.current_session = newSessionId;
    
    this._saveFile(this.conversationsFile, conversations);
    return newSessionId;
  }

  /**
   * Add message to current session
   */
  addMessage(role, content, sessionId = null) {
    const conversations = this.getConversations();
    const sid = sessionId || conversations.current_session;
    
    if (!sid || !conversations.sessions[sid]) {
      // Start new session if none exists
      this.startSession(sid);
      return this.addMessage(role, content, sid);
    }

    conversations.sessions[sid].messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });

    this._saveFile(this.conversationsFile, conversations);
    return conversations.sessions[sid];
  }

  /**
   * Get recent messages from current session
   */
  getRecentMessages(count = 10, sessionId = null) {
    const conversations = this.getConversations();
    const sid = sessionId || conversations.current_session;
    
    if (!sid || !conversations.sessions[sid]) {
      return [];
    }

    const messages = conversations.sessions[sid].messages;
    return messages.slice(-count);
  }

  /**
   * Clear conversation session
   */
  clearSession(sessionId = null) {
    const conversations = this.getConversations();
    const sid = sessionId || conversations.current_session;
    
    if (sid && conversations.sessions[sid]) {
      delete conversations.sessions[sid];
    }
    
    if (conversations.current_session === sid) {
      conversations.current_session = null;
    }
    
    this._saveFile(this.conversationsFile, conversations);
  }

  // ============================================
  // PREFERENCES
  // ============================================

  /**
   * Get preferences
   */
  getPreferences() {
    try {
      let prefs = this._loadFile(this.preferencesFile, {
        explicit: {},
        implicit: {},
        work: {},
        system: {}
      });
      
      // Defensive: ensure prefs is an object
      if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
        console.warn('[Memory] Preferences not an object, creating new structure');
        prefs = {
          explicit: {},
          implicit: {},
          work: {},
          system: {}
        };
      }
      
      // Ensure all expected types exist
      if (!prefs.explicit || typeof prefs.explicit !== 'object') prefs.explicit = {};
      if (!prefs.implicit || typeof prefs.implicit !== 'object') prefs.implicit = {};
      if (!prefs.work || typeof prefs.work !== 'object') prefs.work = {};
      if (!prefs.system || typeof prefs.system !== 'object') prefs.system = {};
      
      return prefs;
    } catch (error) {
      console.error('[Memory] Error in getPreferences:', error);
      return {
        explicit: {},
        implicit: {},
        work: {},
        system: {}
      };
    }
  }

  /**
   * Set a preference
   */
  setPreference(key, value, type = 'explicit') {
    try {
      console.log(`[Memory] Setting preference: ${key} = ${value} (type: ${type})`);
      
      let preferences = this.getPreferences();
      
      // Defensive: ensure preferences is an object
      if (!preferences || typeof preferences !== 'object') {
        console.error('[Memory] Preferences is not an object, creating new');
        preferences = {
          explicit: {},
          implicit: {},
          work: {},
          system: {}
        };
      }
      
      // Defensive: ensure the type object exists
      if (!preferences[type] || typeof preferences[type] !== 'object') {
        console.log(`[Memory] Creating missing type: ${type}`);
        preferences[type] = {};
      }
      
      // Set the preference
      preferences[type][key] = {
        value,
        updated_at: new Date().toISOString()
      };
      
      console.log(`[Memory] Preference set successfully:`, preferences[type][key]);
      
      this._saveFile(this.preferencesFile, preferences);
      return preferences;
    } catch (error) {
      console.error('[Memory] Error in setPreference:', error);
      throw error;
    }
  }

  /**
   * Get preference by key
   */
  getPreference(key, type = 'explicit') {
    const preferences = this.getPreferences();
    return preferences.explicit[key]?.value || 
           preferences.implicit[key]?.value || 
           null;
  }

  // ============================================
  // CONTEXT BUILDING
  // ============================================

  /**
   * Build complete context for AI request
   * This is sent to the API with each chat message
   */
  buildContext() {
    const profile = this.getProfile();
    const facts = this.getFacts();
    const recentMessages = this.getRecentMessages(5);
    const preferences = this.getPreferences();

    return {
      profile: {
        name: profile.name,
        interaction_count: profile.interaction_count,
        last_interaction: profile.last_interaction
      },
      facts: this._summarizeFacts(facts),
      recent_messages: recentMessages,
      preferences: {
        explicit: Object.keys(preferences.explicit).reduce((acc, key) => {
          acc[key] = preferences.explicit[key].value;
          return acc;
        }, {}),
        implicit: Object.keys(preferences.implicit).reduce((acc, key) => {
          acc[key] = preferences.implicit[key].value;
          return acc;
        }, {})
      }
    };
  }

  /**
   * Summarize facts for context (limit size)
   */
  _summarizeFacts(facts) {
    const summary = {};
    let count = 0;
    const maxFacts = 20; // Limit to prevent huge payloads

    for (const category in facts) {
      if (count >= maxFacts) break;
      summary[category] = {};
      
      for (const key in facts[category]) {
        if (count >= maxFacts) break;
        summary[category][key] = facts[category][key].value;
        count++;
      }
    }

    return summary;
  }

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  /**
   * Export all memories (for backup)
   */
  exportMemories() {
    return {
      profile: this.getProfile(),
      facts: this.getFacts(),
      conversations: this.getConversations(),
      preferences: this.getPreferences(),
      exported_at: new Date().toISOString()
    };
  }

  /**
   * Import memories (from backup)
   */
  importMemories(data) {
    if (data.profile) this._saveFile(this.profileFile, data.profile);
    if (data.facts) this._saveFile(this.factsFile, data.facts);
    if (data.conversations) this._saveFile(this.conversationsFile, data.conversations);
    if (data.preferences) this._saveFile(this.preferencesFile, data.preferences);
    return true;
  }

  /**
   * Get memory file location (for user reference)
   */
  getMemoryLocation() {
    return this.memoryDir;
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const profile = this.getProfile();
    const facts = this.getFacts();
    const conversations = this.getConversations();
    const preferences = this.getPreferences();

    const factCount = Object.values(facts).reduce((sum, category) => 
      sum + Object.keys(category).length, 0
    );

    const messageCount = Object.values(conversations.sessions).reduce((sum, session) =>
      sum + session.messages.length, 0
    );

    return {
      user_name: profile.name,
      interactions: profile.interaction_count,
      facts_stored: factCount,
      conversations: Object.keys(conversations.sessions).length,
      messages: messageCount,
      preferences: Object.keys(preferences.explicit).length + Object.keys(preferences.implicit).length,
      storage_location: this.memoryDir
    };
  }
}

module.exports = LocalMemoryManager;
