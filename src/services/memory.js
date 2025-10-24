/**
 * Local Memory Service for Agent Max Desktop
 * Manages all user memories stored locally on the client machine
 */

class MemoryService {
  constructor() {
    this.initialized = false;
    this.profile = null;
    this.sessionId = null;
  }

  /**
   * Initialize memory service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load user profile
      this.profile = await window.electron.memory.getProfile();

      // Start a new session
      this.sessionId = await window.electron.memory.startSession();

      // Increment interaction count
      await window.electron.memory.incrementInteraction();

      this.initialized = true;
      console.log('✓ Memory service initialized');
      console.log('  User:', this.profile.name || 'Not set');
      console.log('  Session:', this.sessionId);

      return this.profile;
    } catch (error) {
      console.error('Failed to initialize memory service:', error);
      throw error;
    }
  }

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  /**
   * Get user profile
   */
  async getProfile() {
    if (!this.initialized) await this.initialize();
    this.profile = await window.electron.memory.getProfile();
    return this.profile;
  }

  /**
   * Update user profile
   */
  async updateProfile(updates) {
    const updated = await window.electron.memory.updateProfile(updates);
    this.profile = updated;
    return updated;
  }

  /**
   * Set user name
   */
  async setUserName(name) {
    const updated = await window.electron.memory.setName(name);
    this.profile = updated;
    return updated;
  }

  /**
   * Get user name
   */
  getUserName() {
    return this.profile?.name || null;
  }

  // ============================================
  // FACTS MANAGEMENT
  // ============================================

  /**
   * Get all facts
   */
  async getFacts() {
    return await window.electron.memory.getFacts();
  }

  /**
   * Set a fact
   */
  async setFact(category, key, value) {
    return await window.electron.memory.setFact(category, key, value);
  }

  /**
   * Delete a fact
   */
  async deleteFact(category, key) {
    return await window.electron.memory.deleteFact(category, key);
  }

  /**
   * Extract facts from conversation (client-side parsing)
   */
  async extractFactsFromMessage(message, response) {
    // Enhanced fact extraction with more patterns
    const facts = {};
    const messageLower = message.toLowerCase();

    // Look for "my name is X" pattern
    const nameMatch = message.match(/my name is (\w+)/i);
    if (nameMatch) {
      await this.setFact('personal', 'name', nameMatch[1]);
      await this.setUserName(nameMatch[1]);
      facts.name = nameMatch[1];
    }

    // Look for location patterns
    const locationPatterns = [
      /I live in ([A-Za-z\s]+?)(?:\.|,|$)/i,
      /I'm in ([A-Za-z\s]+?)(?:\.|,|$)/i,
      /I am in ([A-Za-z\s]+?)(?:\.|,|$)/i,
      /I'm from ([A-Za-z\s]+?)(?:\.|,|$)/i,
      /I am from ([A-Za-z\s]+?)(?:\.|,|$)/i,
      /my location is ([A-Za-z\s]+?)(?:\.|,|$)/i,
    ];

    for (const pattern of locationPatterns) {
      const locationMatch = message.match(pattern);
      if (locationMatch) {
        const location = locationMatch[1].trim();
        await this.setFact('location', 'city', location);
        facts.location = location;
        console.log(`[Memory] Extracted location: ${location}`);
        break;
      }
    }

    // Look for favorite food patterns
    const favFoodPatterns = [
      /(my\s+favorite\s+food\s+is|my\s+favourite\s+food\s+is)\s+([A-Za-z0-9 .,'\-]+)/i,
      /favorite\s+food:\s*([A-Za-z0-9 .,'\-]+)/i,
      /favourite\s+food:\s*([A-Za-z0-9 .,'\-]+)/i,
    ];
    for (const pattern of favFoodPatterns) {
      const m = message.match(pattern);
      if (m) {
        const food = (m[2] || m[1] || m[0]).replace(/^(my\s+favorite\s+food\s+is|my\s+favourite\s+food\s+is)\s+/i, '').trim();
        if (food) {
          await this.setFact('preferences', 'favorite_food', food);
          facts.favorite_food = food;
        }
        break;
      }
    }

    // Look for "I like X" / "I love X" patterns (general preferences)
    const likeMatch = message.match(/I\s+(like|love|prefer)\s+([\w\s]+)/i);
    if (likeMatch) {
      const likeVal = likeMatch[2].trim();
      await this.setFact('preferences', 'likes', likeVal);
      facts.likes = likeVal;
    }

    // Look for "I am X" or "I'm a X" pattern
    const descriptionPatterns = [
      /I am (?:a |an )?([\w\s]+?)(?:\.|,|$)/i,
      /I'm (?:a |an )?([\w\s]+?)(?:\.|,|$)/i,
    ];

    for (const pattern of descriptionPatterns) {
      const descMatch = message.match(pattern);
      if (descMatch) {
        const desc = descMatch[1].trim();
        // Don't save common words as descriptions
        if (!['in', 'from', 'here', 'there'].includes(desc.toLowerCase())) {
          await this.setFact('personal', 'description', desc);
          facts.description = desc;
          break;
        }
      }
    }

    // Education (school/university)
    const educationPatterns = [
      /(?:I go to|I attend|I study at|my school is|I am at)\s+([A-Za-z0-9 .,&'\-]+?)(?:\.|,|$)/i
    ];

    for (const pattern of educationPatterns) {
      const eduMatch = message.match(pattern);
      if (eduMatch) {
        const school = eduMatch[1].trim();
        if (school) {
          await this.setFact('education', 'school', school);
          facts.school = school;
        }
        break;
      }
    }

    return facts;
  }

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  /**
   * Add message to conversation history
   */
  async addMessage(role, content) {
    await window.electron.memory.addMessage(role, content, this.sessionId);

    // Extract facts if it's a user message
    if (role === 'user') {
      await this.extractFactsFromMessage(content, null);
    }
  }

  /**
   * Get recent messages
   */
  async getRecentMessages(count = 10) {
    return await window.electron.memory.getRecentMessages(count, this.sessionId);
  }

  /**
   * Clear current conversation
   */
  async clearConversation() {
    await window.electron.memory.clearSession(this.sessionId);
    // Start new session
    this.sessionId = await window.electron.memory.startSession();
  }

  // ============================================
  // PREFERENCES MANAGEMENT
  // ============================================

  /**
   * Get all preferences
   */
  async getPreferences() {
    return await window.electron.memory.getPreferences();
  }

  /**
   * Set a preference
   */
  async setPreference(key, value, type = 'explicit') {
    return await window.electron.memory.setPreference(key, value, type);
  }

  /**
   * Get specific preference
   */
  async getPreference(key) {
    return await window.electron.memory.getPreference(key);
  }

  // ============================================
  // CONTEXT BUILDING FOR API
  // ============================================

  /**
   * Build complete context to send with API requests
   * This is the key function that sends local memory to the API
   */
  async buildContextForAPI() {
    return await window.electron.memory.buildContext();
  }

  /**
   * Send message to AI with local context using FULL AUTONOMOUS SYSTEM
   * This uses the smart Agent Max that decides whether to chat or execute commands
   */
  async sendMessageWithContext(message, api) {
    try {
      // Add user message to local memory first
      await this.addMessage('user', message);

      // Build context from local memory
      const context = await this.buildContextForAPI();

      // Send to AUTONOMOUS endpoint (the smart one!)
      const response = await api.post('/api/v2/autonomous/quick', {
        goal: message,
        user_context: context,
        max_steps: 10,
        timeout: 300,
      });

      // Extract response (now properly structured!)
      const aiResponse = response.data.response || 'No response';

      // Add AI response to local memory
      await this.addMessage('assistant', aiResponse);

      return {
        response: aiResponse,
        status: response.data.status,
        execution_time: response.data.execution_time,
        exit_code: response.data.exit_code,
      };
    } catch (error) {
      console.error('Error sending message with context:', error);
      throw error;
    }
  }

  /**
   * Send simple chat message (no command execution)
   * Use this for simple questions where you DON'T want commands executed
   */
  async sendChatMessage(message, api) {
    try {
      // Add user message to local memory first
      await this.addMessage('user', message);

      // Build context from local memory
      const context = await this.buildContextForAPI();

      // Send to CHAT endpoint (safe, no commands)
      const response = await api.post('/api/v2/chat/message', {
        message,
        user_context: context,
        include_context: true,
      });

      // Add AI response to local memory
      if (response.data.response) {
        await this.addMessage('assistant', response.data.response);
      }

      return response.data;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  // ============================================
  // BACKUP & RESTORE
  // ============================================

  /**
   * Export all memories for backup
   */
  async exportMemories() {
    const data = await window.electron.memory.export();

    // Create download blob
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-max-memories-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return data;
  }

  /**
   * Import memories from backup file
   */
  async importMemories(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          await window.electron.memory.import(data);

          // Reload profile
          this.profile = await window.electron.memory.getProfile();

          resolve(data);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // ============================================
  // STATISTICS & INFO
  // ============================================

  /**
   * Get memory statistics
   */
  async getStats() {
    return await window.electron.memory.getStats();
  }

  /**
   * Get memory storage location
   */
  async getStorageLocation() {
    return await window.electron.memory.getLocation();
  }

  /**
   * Get user greeting based on profile and time
   */
  async getPersonalizedGreeting() {
    const profile = await this.getProfile();
    const hour = new Date().getHours();

    let timeOfDay = 'day';
    if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';

    const name = profile.name || 'there';
    const isFirstTime = profile.interaction_count === 1;

    if (isFirstTime) {
      return `Good ${timeOfDay}! I'm Agent Max. Nice to meet you, ${name}!`;
    } else {
      return `Good ${timeOfDay}, ${name}! Welcome back.`;
    }
  }
}

// Create singleton instance
const memoryService = new MemoryService();

export default memoryService;
