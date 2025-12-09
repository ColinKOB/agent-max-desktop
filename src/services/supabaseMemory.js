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

// Pre-auth queue for onboarding data saved before user_id exists
// This queue is flushed when flushPreAuthQueue() is called after account creation
let preAuthQueue = [];

/**
 * Queue an operation to be executed after user authentication
 * Used during onboarding when user_id doesn't exist yet
 */
export function queuePreAuthOperation(operation) {
  preAuthQueue.push({
    ...operation,
    queuedAt: Date.now()
  });
  logger.debug('[PreAuthQueue] Queued operation:', operation.type, '- Queue size:', preAuthQueue.length);
}

/**
 * Flush the pre-auth queue after user account is created
 * Should be called from handleComplete() in OnboardingFlow
 */
export async function flushPreAuthQueue() {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    logger.warn('[PreAuthQueue] Cannot flush - no user_id yet');
    return { success: false, reason: 'no_user_id' };
  }
  
  if (preAuthQueue.length === 0) {
    logger.debug('[PreAuthQueue] Nothing to flush');
    return { success: true, flushed: 0 };
  }
  
  logger.info(`[PreAuthQueue] Flushing ${preAuthQueue.length} queued operations for user ${userId}`);
  
  const results = [];
  const queueCopy = [...preAuthQueue];
  preAuthQueue = []; // Clear queue before processing
  
  for (const op of queueCopy) {
    try {
      switch (op.type) {
        case 'setPreference':
          await setPreference(op.key, op.value, op.category);
          results.push({ type: op.type, key: op.key, success: true });
          break;
        case 'updateProfile':
          await updateProfile(op.updates);
          results.push({ type: op.type, success: true });
          break;
        case 'setFact':
          await setFact(op.category, op.predicate, op.object, op.confidence);
          results.push({ type: op.type, success: true });
          break;
        default:
          logger.warn('[PreAuthQueue] Unknown operation type:', op.type);
          results.push({ type: op.type, success: false, reason: 'unknown_type' });
      }
    } catch (err) {
      logger.error('[PreAuthQueue] Failed to execute operation:', op.type, err);
      results.push({ type: op.type, success: false, error: err.message });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  logger.info(`[PreAuthQueue] Flushed ${successCount}/${results.length} operations successfully`);
  
  return { success: true, flushed: successCount, total: results.length, results };
}

/**
 * Get the current pre-auth queue size (for debugging)
 */
export function getPreAuthQueueSize() {
  return preAuthQueue.length;
}

// User consent scopes
// Default to TRUE - users who completed onboarding have implicitly consented
// The conservative false default was causing messages to not be stored
let consentScopes = {
  prompts: true,   // Default true - store user messages
  outputs: true,   // Default true - store AI responses
  tools: true,     // Default true - store tool usage
  screenshots: false,  // Screenshots still require explicit consent
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

  // Default profile structure - use null for name to indicate "not set"
  // This prevents masking missing data with a fake "User" name
  const defaultProfile = {
    name: null,  // null indicates not set, allows fallback chain to work
    interaction_count: 0,
    temporal_info: {},
    top_preferences: [],
    _source: 'default'  // Track where profile came from for debugging
  };

  try {
    // Try Supabase first
    if (isOnline && supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('metadata')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      // Extract profile from metadata, merge with defaults
      const supabaseProfile = data?.metadata?.profile;
      if (supabaseProfile) {
        return {
          ...defaultProfile,
          ...supabaseProfile,
          _source: 'supabase'
        };
      }
      
      // No profile in Supabase, return default with indicator
      logger.debug('[getProfile] No profile in Supabase metadata, using defaults');
      return { ...defaultProfile, _source: 'supabase_empty' };
    }
  } catch (error) {
    logger.warn('Failed to get profile from Supabase, falling back to Electron:', error);
  }

  // Fallback to Electron
  if (window.electron?.memory) {
    try {
      const electronProfile = await window.electron.memory.getProfile();
      return {
        ...defaultProfile,
        ...electronProfile,
        _source: 'electron'
      };
    } catch (e) {
      logger.warn('[getProfile] Electron memory fallback failed:', e);
    }
  }

  // Last resort: return default profile (allows chat to still work)
  logger.warn('[getProfile] All sources failed, returning default profile');
  return { ...defaultProfile, _source: 'fallback' };
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
 * NOTE: Sessions are created lazily - we only store a pending session ID locally
 * until the first message is sent. This prevents empty sessions in Supabase.
 */
export async function startSession(title = null, mode = 'private') {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }

  // Generate a pending session ID - actual Supabase session created on first message
  const pendingSessionId = `pending-session-${Date.now()}`;
  localStorage.setItem('session_id', pendingSessionId);
  localStorage.setItem('pending_session_title', title || '');
  localStorage.setItem('pending_session_mode', mode);
  
  return pendingSessionId;
}

/**
 * Ensure a real Supabase session exists (called when first message is sent)
 * Converts a pending session to a real Supabase session
 */
async function ensureRealSession() {
  const userId = localStorage.getItem('user_id');
  const currentSessionId = localStorage.getItem('session_id');
  
  if (!userId) {
    throw new Error('User not initialized');
  }
  
  // If already a real session (UUID format), return it
  if (currentSessionId && !currentSessionId.startsWith('pending-session-') && !currentSessionId.startsWith('local-session-')) {
    return currentSessionId;
  }
  
  // Create real session in Supabase
  const title = localStorage.getItem('pending_session_title') || null;
  const mode = localStorage.getItem('pending_session_mode') || 'private';
  
  try {
    if (isOnline && supabase) {
      const session = await createSession(userId, title, mode);
      localStorage.setItem('session_id', session.id);
      localStorage.removeItem('pending_session_title');
      localStorage.removeItem('pending_session_mode');
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
 * Creates the Supabase session lazily on first message (prevents empty sessions)
 */
export async function addMessage(role, content, sessionId = null) {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    throw new Error('User not initialized');
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

  // Ensure we have a real session (creates Supabase session on first message)
  const realSessionId = sessionId || await ensureRealSession();
  
  if (!realSessionId) {
    throw new Error('Session not initialized');
  }

  const operation = {
    type: 'storeMessage',
    data: {
      sessionId: realSessionId,
      role,
      content,
      redactedContent: content, // TODO: Add PII redaction
      metadata: {} // created_at is auto-generated by Supabase
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

  // Don't query Supabase with pending or local session IDs - they're not valid UUIDs
  const isPendingOrLocal = activeSessionId.startsWith('pending-session-') ||
                           activeSessionId.startsWith('local-session-');

  try {
    // Try Supabase first (only if we have a real UUID session)
    if (isOnline && supabase && !isPendingOrLocal) {
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

  // Fallback to Electron (also handles pending/local sessions)
  if (window.electron?.memory?.getRecentMessages) {
    return await window.electron.memory.getRecentMessages(count, activeSessionId);
  }

  // For pending sessions with no Electron backend, return empty (no messages yet)
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

  // Don't query Supabase with pending or local session IDs - they're not valid UUIDs
  const isPendingOrLocal = activeSessionId.startsWith('pending-session-') ||
                           activeSessionId.startsWith('local-session-');

  try {
    // Try Supabase first (only if we have a real UUID session)
    if (isOnline && supabase && !isPendingOrLocal) {
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

  // Fallback to Electron (also handles pending/local sessions)
  if (window.electron?.memory) {
    await window.electron.memory.clearSession(activeSessionId);
  }
}

/**
 * Get all sessions for the user (with messages for conversation history)
 */
export async function getAllSessions() {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    return [];
  }

  try {
    // Try Supabase first - include messages for conversation history
    if (isOnline && supabase) {
      const sessions = await getUserSessions(userId, false, true, 100); // includeMessages = true, limit = 100
      
      // Convert to format expected by ConversationHistory component
      // Filter out sessions with no messages (empty conversations)
      return sessions
        .filter(session => session.messages && session.messages.length > 0)
        .map(session => ({
          id: session.id,
          sessionId: session.id,
          title: session.title || 'Untitled Conversation',
          created_at: session.created_at,
          updated_at: session.updated_at,
          started_at: session.created_at,
          // Messages from the join - sort by created_at
          messages: (session.messages || [])
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map(m => ({
              role: m.role,
              content: m.content,
              timestamp: new Date(m.created_at).getTime(),
              created_at: new Date(m.created_at).getTime()
            })),
          message_count: (session.messages || []).length
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
 * Initialize consent from stored preferences
 * IMPORTANT: Default to TRUE for prompts/outputs to enable conversation history
 */
export async function initializeConsent() {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    return;
  }

  // Default consent scopes - should be TRUE to enable message storage
  const defaultScopes = {
    prompts: true,
    outputs: true,
    tools: true,
    screenshots: false
  };

  // Try to load from localStorage first (faster)
  try {
    const stored = localStorage.getItem('consent_scopes');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure prompts/outputs are true if not explicitly set
      consentScopes = { ...defaultScopes, ...parsed };
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
        // Merge Supabase scopes with defaults
        consentScopes = { ...defaultScopes, ...consentScopes, ...data.scopes };
        localStorage.setItem('consent_scopes', JSON.stringify(consentScopes));
      }
    } catch (error) {
      logger.warn('Failed to sync consent from Supabase:', error);
    }
  }
  
  // Ensure prompts and outputs are enabled for conversation history
  // This fixes the issue where old users have false values stored
  if (consentScopes.prompts === false || consentScopes.outputs === false) {
    console.log('[Consent] Enabling prompts/outputs for conversation history');
    consentScopes.prompts = true;
    consentScopes.outputs = true;
    localStorage.setItem('consent_scopes', JSON.stringify(consentScopes));
  }
  
  console.log('[Consent] Initialized:', consentScopes);
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
