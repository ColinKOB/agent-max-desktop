/**
 * Supabase-First Memory Service
 * 
 * Provides unified memory API that:
 * 1. Uses Supabase as primary storage when online
 * 2. Falls back to Electron local memory when offline
 * 3. Syncs local changes when connection restored
 * 4. Respects user consent for data collection
 */

import { supabase, getUserFacts, setUserFact, getUserPreferences, setUserPreference, createSession, getUserSessions, storeMessage } from './supabase';
import { createLogger } from './logger.js';
import { indexMessage, indexFact } from './localSearch.js';
import { generateEmbedding } from './embeddings.js';

const logger = createLogger('SupabaseMemory');

// Sync queue for offline operations
let syncQueue = [];
let isOnline = navigator.onLine;
let syncInProgress = false;

// User consent scopes (default to conservative)
let consentScopes = {
  prompts: false,
  outputs: false,
  tools: false,
  screenshots: false,
};

// Listen for online/offline events
window.addEventListener('online', () => {
  isOnline = true;
  logger.info('Connection restored, syncing queued operations');
  processSyncQueue();
});

window.addEventListener('offline', () => {
  isOnline = false;
  logger.warn('Connection lost, using offline mode');
});

/**
 * Process queued operations when back online
 */
async function processSyncQueue() {
  if (syncInProgress || syncQueue.length === 0 || !isOnline) {
    return;
  }

  syncInProgress = true;
  logger.info(`Processing ${syncQueue.length} queued operations`);

  const operations = [...syncQueue];
  syncQueue = [];

  for (const operation of operations) {
    try {
      await executeOperation(operation);
      logger.debug('Synced operation:', operation.type);
    } catch (error) {
      logger.error('Failed to sync operation, re-queuing:', error);
      syncQueue.push(operation);
    }
  }

  syncInProgress = false;

  // If there are still failed operations, retry after delay
  if (syncQueue.length > 0) {
    setTimeout(processSyncQueue, 5000);
  }
}

/**
 * Execute an operation immediately or queue for later
 */
async function executeOrQueue(operation) {
  if (isOnline && supabase) {
    try {
      return await executeOperation(operation);
    } catch (error) {
      logger.warn('Operation failed, queuing for later:', error);
      syncQueue.push(operation);
      return null;
    }
  } else {
    // Queue for later and execute locally if possible
    syncQueue.push(operation);
    return await executeOperationLocally(operation);
  }
}

/**
 * Execute operation on Supabase
 */
async function executeOperation(operation) {
  const { type, data } = operation;
  const userId = localStorage.getItem('user_id');

  switch (type) {
    case 'setFact': {
      await setUserFact(userId, data.category, data.key, data.value, data.source);
      
      // Index fact locally with embedding
      try {
        const factForIndex = {
          id: `${userId}-${data.category}-${data.key}`,  // Generate consistent ID
          user_id: userId,
          category: data.category,
          key: data.key,
          value: data.value,
          confidence: 1.0,
          source: data.source
        };
        await indexFact(factForIndex, true);  // Generate embedding
      } catch (err) {
        logger.warn('Failed to index fact locally:', err);
      }
      return;
    }
    
    case 'setPreference':
      return await setUserPreference(userId, data.key, data.value, data.category);
    
    case 'storeMessage': {
      await storeMessage(data.sessionId, data.role, data.content, data.redactedContent, data.metadata);
      
      // Index message locally with embedding
      try {
        const messageForIndex = {
          id: data.metadata?.messageId || `${data.sessionId}-${Date.now()}`,
          session_id: data.sessionId,
          role: data.role,
          content: data.content,
          redacted_content: data.redactedContent,
          created_at: new Date().toISOString(),
          userId: userId
        };
        await indexMessage(messageForIndex, true);  // Generate embedding
      } catch (err) {
        logger.warn('Failed to index message locally:', err);
      }
      return;
    }
    
    default:
      throw new Error(`Unknown operation type: ${type}`);
  }
}

/**
 * Execute operation locally (Electron fallback)
 */
async function executeOperationLocally(operation) {
  if (!window.electron?.memory) {
    logger.warn('No Electron memory available for offline operation');
    return null;
  }

  const { type, data } = operation;

  switch (type) {
    case 'setFact':
      return await window.electron.memory.setFact(data.category, data.key, data.value);
    case 'setPreference':
      return await window.electron.memory.setPreference(data.key, data.value, data.type);
    case 'storeMessage':
      return await window.electron.memory.addMessage(data.role, data.content, data.sessionId);
    default:
      return null;
  }
}

// ============================================================================
// PROFILE OPERATIONS
// ============================================================================

/**
 * Get user profile
 */
export async function getProfile() {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }

  try {
    // Try Supabase first
    if (isOnline && supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('metadata')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      // Extract profile from metadata
      return data?.metadata?.profile || {
        name: 'User',
        interaction_count: 0,
        temporal_info: {},
        top_preferences: []
      };
    }
  } catch (error) {
    logger.warn('Failed to get profile from Supabase, falling back to Electron:', error);
  }

  // Fallback to Electron
  if (window.electron?.memory) {
    return await window.electron.memory.getProfile();
  }

  throw new Error('No memory service available');
}

/**
 * Update user profile
 */
export async function updateProfile(updates) {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }

  const operation = {
    type: 'updateProfile',
    data: { userId, updates }
  };

  if (isOnline && supabase) {
    try {
      // Get current metadata
      const { data: current } = await supabase
        .from('users')
        .select('metadata')
        .eq('id', userId)
        .single();

      // Update profile in metadata
      const updatedMetadata = {
        ...current?.metadata,
        profile: {
          ...current?.metadata?.profile,
          ...updates
        }
      };

      const { error } = await supabase
        .from('users')
        .update({ metadata: updatedMetadata })
        .eq('id', userId);

      if (error) throw error;
      
      logger.info('Profile updated in Supabase');
      return;
    } catch (error) {
      logger.warn('Failed to update profile in Supabase, queuing:', error);
    }
  }

  // Queue for later and update locally
  syncQueue.push(operation);
  
  if (window.electron?.memory) {
    return await window.electron.memory.updateProfile(updates);
  }
}

/**
 * Set user name
 */
export async function setName(name) {
  return await updateProfile({ name });
}

/**
 * Increment interaction count
 */
export async function incrementInteraction() {
  try {
    const profile = await getProfile();
    const newCount = (profile.interaction_count || 0) + 1;
    await updateProfile({ interaction_count: newCount });
  } catch (error) {
    logger.error('Failed to increment interaction:', error);
  }
}

// ============================================================================
// FACTS OPERATIONS
// ============================================================================

/**
 * Get user facts
 */
export async function getFacts(category = null) {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    return {};
  }

  try {
    // Try Supabase first
    if (isOnline && supabase) {
      const facts = await getUserFacts(userId, category);
      
      // Convert to object format for compatibility
      const factsObj = {};
      facts.forEach(fact => {
        if (!factsObj[fact.category]) {
          factsObj[fact.category] = {};
        }
        factsObj[fact.category][fact.key] = fact.value;
      });
      
      return factsObj;
    }
  } catch (error) {
    logger.warn('Failed to get facts from Supabase, falling back to Electron:', error);
  }

  // Fallback to Electron
  if (window.electron?.memory) {
    return await window.electron.memory.getFacts();
  }

  return {};
}

/**
 * Set a fact
 */
export async function setFact(category, key, value, source = 'user') {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }

  // Check consent for storing facts
  if (!consentScopes.prompts && source === 'user') {
    logger.warn('User consent not granted for storing prompts');
    return;
  }

  const operation = {
    type: 'setFact',
    data: { category, key, value, source }
  };

  return await executeOrQueue(operation);
}

/**
 * Delete a fact
 */
export async function deleteFact(category, key) {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }

  if (isOnline && supabase) {
    try {
      const { error } = await supabase
        .from('facts')
        .delete()
        .eq('user_id', userId)
        .eq('category', category)
        .eq('key', key);

      if (error) throw error;
      logger.info('Fact deleted from Supabase');
      return;
    } catch (error) {
      logger.warn('Failed to delete fact from Supabase, falling back:', error);
    }
  }

  // Fallback to Electron
  if (window.electron?.memory) {
    return await window.electron.memory.deleteFact(category, key);
  }
}

// ============================================================================
// PREFERENCES OPERATIONS
// ============================================================================

/**
 * Get user preferences
 */
export async function getPreferences() {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    return {};
  }

  try {
    // Try Supabase first
    if (isOnline && supabase) {
      const prefs = await getUserPreferences(userId);
      
      // Convert to object format for compatibility
      const prefsObj = {};
      prefs.forEach(pref => {
        prefsObj[pref.key] = pref.value;
      });
      
      return prefsObj;
    }
  } catch (error) {
    logger.warn('Failed to get preferences from Supabase, falling back to Electron:', error);
  }

  // Fallback to Electron
  if (window.electron?.memory) {
    return await window.electron.memory.getPreferences();
  }

  return {};
}

/**
 * Get a specific preference
 */
export async function getPreference(key) {
  const prefs = await getPreferences();
  return prefs[key];
}

/**
 * Set a preference
 */
export async function setPreference(key, value, type = 'general') {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }

  const operation = {
    type: 'setPreference',
    data: { key, value, category: type }
  };

  return await executeOrQueue(operation);
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

/**
 * Start a new session
 */
export async function startSession(title = null, mode = 'private') {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }

  try {
    // Try Supabase first
    if (isOnline && supabase) {
      const session = await createSession(userId, title, mode);
      localStorage.setItem('session_id', session.id);
      return session.id;
    }
  } catch (error) {
    logger.warn('Failed to create session in Supabase, falling back to Electron:', error);
  }

  // Fallback to Electron
  if (window.electron?.memory) {
    const sessionId = await window.electron.memory.startSession();
    localStorage.setItem('session_id', sessionId);
    return sessionId;
  }

  // Last resort: generate local session ID
  const localSessionId = `local-session-${Date.now()}`;
  localStorage.setItem('session_id', localSessionId);
  return localSessionId;
}

/**
 * Add a message to the current session
 */
export async function addMessage(role, content, sessionId = null) {
  const userId = localStorage.getItem('user_id');
  const activeSessionId = sessionId || localStorage.getItem('session_id');
  
  if (!userId || !activeSessionId) {
    throw new Error('User or session not initialized');
  }

  // Check consent for storing messages
  if (!consentScopes.prompts && role === 'user') {
    logger.warn('User consent not granted for storing prompts');
    return;
  }
  if (!consentScopes.outputs && role === 'assistant') {
    logger.warn('User consent not granted for storing outputs');
    return;
  }

  const operation = {
    type: 'storeMessage',
    data: {
      sessionId: activeSessionId,
      role,
      content,
      redactedContent: content, // TODO: Add PII redaction
      metadata: { timestamp: new Date().toISOString() }
    }
  };

  return await executeOrQueue(operation);
}

/**
 * Get recent messages from session
 */
export async function getRecentMessages(count = 20, sessionId = null) {
  const userId = localStorage.getItem('user_id');
  const activeSessionId = sessionId || localStorage.getItem('session_id');
  
  if (!userId || !activeSessionId) {
    return [];
  }

  try {
    // Try Supabase first
    if (isOnline && supabase) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', activeSessionId)
        .order('created_at', { ascending: false })
        .limit(count);

      if (error) throw error;
      
      // Convert to expected format
      return data.reverse().map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime()
      }));
    }
  } catch (error) {
    logger.warn('Failed to get messages from Supabase, falling back to Electron:', error);
  }

  // Fallback to Electron
  if (window.electron?.memory?.getRecentMessages) {
    return await window.electron.memory.getRecentMessages(count, activeSessionId);
  }

  return [];
}

/**
 * Clear current session
 */
export async function clearSession(sessionId = null) {
  const userId = localStorage.getItem('user_id');
  const activeSessionId = sessionId || localStorage.getItem('session_id');
  
  if (!userId || !activeSessionId) {
    throw new Error('User or session not initialized');
  }

  try {
    // Try Supabase first
    if (isOnline && supabase) {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('session_id', activeSessionId);

      if (error) throw error;
      logger.info('Session cleared from Supabase');
      return;
    }
  } catch (error) {
    logger.warn('Failed to clear session in Supabase, falling back to Electron:', error);
  }

  // Fallback to Electron
  if (window.electron?.memory) {
    await window.electron.memory.clearSession(activeSessionId);
  }
}

/**
 * Get all sessions for the user
 */
export async function getAllSessions() {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    return [];
  }

  try {
    // Try Supabase first
    if (isOnline && supabase) {
      const sessions = await getUserSessions(userId, false);
      
      // Convert to expected format
      return sessions.map(session => ({
        id: session.id,
        title: session.title || 'Untitled Conversation',
        created_at: session.created_at,
        updated_at: session.updated_at,
        message_count: 0 // TODO: Add message count
      }));
    }
  } catch (error) {
    logger.warn('Failed to get sessions from Supabase, falling back to Electron:', error);
  }

  // Fallback to Electron
  if (window.electron?.memory?.getAllSessions) {
    return await window.electron.memory.getAllSessions();
  }

  return [];
}

// ============================================================================
// CONSENT OPERATIONS
// ============================================================================

/**
 * Update user consent scopes
 */
export async function updateConsent(scopes) {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }

  // Update local state immediately
  consentScopes = { ...consentScopes, ...scopes };
  
  // Persist to Supabase
  if (isOnline && supabase) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          scopes: consentScopes,
          consented_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      logger.info('Consent updated in Supabase');
    } catch (error) {
      logger.error('Failed to update consent in Supabase:', error);
    }
  }

  // Also save to localStorage as backup
  localStorage.setItem('consent_scopes', JSON.stringify(consentScopes));
}

/**
 * Get current consent scopes
 */
export function getConsent() {
  return { ...consentScopes };
}

/**
 * Initialize consent from storage or Supabase
 */
export async function initializeConsent() {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    return;
  }

  // Try to load from localStorage first (faster)
  try {
    const stored = localStorage.getItem('consent_scopes');
    if (stored) {
      consentScopes = JSON.parse(stored);
    }
  } catch {}

  // Then sync with Supabase if online
  if (isOnline && supabase) {
    try {
      const { data } = await supabase
        .from('users')
        .select('scopes')
        .eq('id', userId)
        .single();

      if (data?.scopes) {
        consentScopes = { ...consentScopes, ...data.scopes };
        localStorage.setItem('consent_scopes', JSON.stringify(consentScopes));
      }
    } catch (error) {
      logger.warn('Failed to sync consent from Supabase:', error);
    }
  }
}

// ============================================================================
// UTILITY OPERATIONS
// ============================================================================

/**
 * Build context from profile, facts, preferences, and recent messages
 */
export async function buildContext() {
  try {
    const [profile, facts, preferences, recentMessages] = await Promise.all([
      getProfile(),
      getFacts(),
      getPreferences(),
      getRecentMessages(10)
    ]);

    return {
      profile,
      facts,
      preferences,
      recentMessages,
      built_at: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to build context:', error);
    return {
      profile: {},
      facts: {},
      preferences: {},
      recentMessages: [],
      built_at: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Get sync queue status
 */
export function getSyncStatus() {
  return {
    isOnline,
    queueLength: syncQueue.length,
    syncInProgress
  };
}

/**
 * Force sync queued operations
 */
export async function forceSync() {
  if (isOnline) {
    await processSyncQueue();
  }
}

/**
 * Sync local search index with Supabase data
 * Call this on app startup to rebuild local index from cloud data
 */
export async function syncLocalIndex() {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    logger.warn('Cannot sync local index: user not initialized');
    return;
  }
  
  if (!isOnline || !supabase) {
    logger.warn('Cannot sync local index: offline or Supabase not available');
    return;
  }
  
  logger.info('Syncing local index with Supabase...');
  const startTime = Date.now();
  
  try {
    // Fetch all facts for this user
    const { indexFactsBatch } = await import('./localSearch.js');
    const facts = await getUserFacts(userId);
    if (facts && facts.length > 0) {
      await indexFactsBatch(facts, true);  // Generate embeddings
      logger.info(`Indexed ${facts.length} facts`);
    }
    
    // Fetch recent messages (last 100 from active sessions)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (messages && messages.length > 0) {
        const { indexMessagesBatch } = await import('./localSearch.js');
        // Add userId to each message for indexing
        const messagesWithUser = messages.map(m => ({ ...m, userId }));
        await indexMessagesBatch(messagesWithUser, true);  // Generate embeddings
        logger.info(`Indexed ${messages.length} messages`);
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Local index sync completed in ${duration}ms`);
  } catch (error) {
    logger.error('Failed to sync local index:', error);
  }
}

// Initialize consent on import
initializeConsent();
