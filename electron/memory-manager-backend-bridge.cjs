/**
 * Backend-Bridged Memory Manager for Agent Max Desktop
 * 
 * This version calls the backend REST API instead of storing locally,
 * ensuring messages are searchable via semantic search.
 * 
 * CRITICAL FIX: Previous version stored messages in local JSON files,
 * but backend semantic search queries the SQLite database. This caused
 * 0% recall - messages were never findable.
 */

const axios = require('axios');

class BackendBridgedMemoryManager {
  constructor(apiBaseUrl = 'http://localhost:8000') {
    this.apiBase = apiBaseUrl;
    this.currentSessionId = null;
    
    // Create axios instance with timeout
    this.client = axios.create({
      baseURL: this.apiBase,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('[MemoryManager] Initialized with backend bridge:', this.apiBase);
  }

  // ============================================
  // MESSAGES - Now calls backend API
  // ============================================

  /**
   * Start new conversation session
   */
  async startSession(sessionId = null) {
    this.currentSessionId = sessionId || `session_${Date.now()}`;
    console.log('[MemoryManager] Started session:', this.currentSessionId);
    return this.currentSessionId;
  }

  /**
   * Add message to backend database (CRITICAL FIX)
   * Previously saved to local JSON - now saves to backend SQLite
   */
  async addMessage(role, content, sessionId = null) {
    try {
      const sid = sessionId || this.currentSessionId;
      
      const response = await this.client.post('/api/memory/messages', {
        role,
        content,
        session_id: sid
      });
      
      console.log('[MemoryManager] Message saved to backend:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('[MemoryManager] Failed to save message to backend:', error.message);
      // Graceful degradation - don't throw, just log
      return null;
    }
  }

  /**
   * Get recent messages from backend
   */
  async getRecentMessages(count = 10, sessionId = null) {
    try {
      const params = { limit: count };
      if (sessionId) {
        params.session_id = sessionId;
      }
      
      const response = await this.client.get('/api/memory/messages', { params });
      console.log('[MemoryManager] Retrieved', response.data.length, 'messages from backend');
      
      // Convert to frontend format
      return response.data.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at
      }));
    } catch (error) {
      console.error('[MemoryManager] Failed to get messages from backend:', error.message);
      return [];
    }
  }

  /**
   * Get all conversation sessions
   * Note: Backend doesn't have session listing yet, return empty for now
   */
  async getAllSessions() {
    console.log('[MemoryManager] getAllSessions: Backend session listing not implemented yet');
    return [];
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId) {
    // Return messages for this session
    const messages = await this.getRecentMessages(null, sessionId);
    return {
      sessionId,
      messages,
      started_at: new Date().toISOString()
    };
  }

  /**
   * Clear conversation session
   */
  async clearSession(sessionId = null) {
    console.log('[MemoryManager] Session clearing not implemented in backend yet');
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  // ============================================
  // FACTS - Call backend API
  // ============================================

  /**
   * Get all facts from backend
   */
  async getFacts() {
    try {
      const response = await this.client.get('/api/memory/facts');
      
      // Convert array to nested object format for compatibility
      const factsObj = {};
      response.data.forEach(fact => {
        if (!factsObj[fact.category]) {
          factsObj[fact.category] = {};
        }
        factsObj[fact.category][fact.key] = {
          value: fact.value,
          updated_at: fact.updated_at
        };
      });
      
      return factsObj;
    } catch (error) {
      console.error('[MemoryManager] Failed to get facts:', error.message);
      return {};
    }
  }

  /**
   * Set a fact in backend
   */
  async setFact(category, key, value) {
    try {
      const response = await this.client.post('/api/memory/facts', {
        category,
        key,
        value,
        confidence: 0.9,
        pinned: false
      });
      
      console.log('[MemoryManager] Fact saved:', category, key);
      return response.data;
    } catch (error) {
      console.error('[MemoryManager] Failed to save fact:', error.message);
      return null;
    }
  }

  /**
   * Delete a fact from backend
   */
  async deleteFact(category, key) {
    try {
      // Need to find fact ID first
      const facts = await this.client.get('/api/memory/facts', {
        params: { category }
      });
      
      const fact = facts.data.find(f => f.key === key);
      if (fact) {
        await this.client.delete(`/api/memory/facts/${fact.id}`);
        console.log('[MemoryManager] Fact deleted:', category, key);
      }
    } catch (error) {
      console.error('[MemoryManager] Failed to delete fact:', error.message);
    }
  }

  // ============================================
  // PROFILE - Keep local for now (no backend endpoint yet)
  // ============================================

  async getProfile() {
    // Placeholder - implement backend profile endpoint later
    return {
      name: null,
      created_at: new Date().toISOString(),
      interaction_count: 0,
      last_interaction: null,
      preferences: {},
    };
  }

  async updateProfile(updates) {
    console.log('[MemoryManager] Profile updates:', updates);
    return this.getProfile();
  }

  async setUserName(name) {
    return this.updateProfile({ name });
  }

  async incrementInteraction() {
    return this.getProfile();
  }

  // ============================================
  // PREFERENCES - Keep local for now
  // ============================================

  async getPreferences() {
    return {
      explicit: {},
      implicit: {},
      work: {},
      system: {},
    };
  }

  async setPreference(key, value, type = 'explicit') {
    console.log('[MemoryManager] Preference set:', key, value, type);
    return this.getPreferences();
  }

  async getPreference(key, type = null) {
    return null;
  }

  // ============================================
  // CONTEXT BUILDING - Uses backend data
  // ============================================

  /**
   * Build context for AI - now pulls from backend
   */
  async buildContext() {
    const profile = await this.getProfile();
    const facts = await this.getFacts();
    const recentMessages = await this.getRecentMessages(5);
    const preferences = await this.getPreferences();

    // Convert facts to array format for backend
    const factsArray = [];
    for (const category in facts) {
      for (const key in facts[category]) {
        factsArray.push({
          category,
          key,
          value: facts[category][key].value
        });
      }
    }

    return {
      profile: {
        name: profile.name,
        interaction_count: profile.interaction_count,
        last_interaction: profile.last_interaction,
      },
      facts: factsArray,
      recent_messages: recentMessages,
      preferences: {
        explicit: Object.keys(preferences.explicit).reduce((acc, key) => {
          acc[key] = preferences.explicit[key].value;
          return acc;
        }, {}),
        implicit: Object.keys(preferences.implicit).reduce((acc, key) => {
          acc[key] = preferences.implicit[key].value;
          return acc;
        }, {}),
      },
    };
  }

  // ============================================
  // STATS
  // ============================================

  async getStats() {
    try {
      const response = await this.client.get('/api/memory/stats');
      return {
        user_name: null,
        interactions: 0,
        facts_stored: response.data.total_facts,
        conversations: 0,
        messages: response.data.total_messages,
        preferences: 0,
        storage_location: 'Backend API'
      };
    } catch (error) {
      console.error('[MemoryManager] Failed to get stats:', error.message);
      return {
        user_name: null,
        interactions: 0,
        facts_stored: 0,
        conversations: 0,
        messages: 0,
        preferences: 0,
        storage_location: 'Backend API (unavailable)'
      };
    }
  }

  async getMemoryLocation() {
    return 'Backend API: ' + this.apiBase;
  }

  // ============================================
  // EXPORT / IMPORT - Not implemented yet
  // ============================================

  async exportMemories() {
    console.warn('[MemoryManager] Export not implemented for backend bridge');
    return null;
  }

  async importMemories(data) {
    console.warn('[MemoryManager] Import not implemented for backend bridge');
    return false;
  }
}

module.exports = BackendBridgedMemoryManager;
