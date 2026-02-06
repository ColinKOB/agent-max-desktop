/**
 * Profile Cache Service - Phase 4: Local-First User Data
 *
 * This service provides a local-first approach to user profile and facts:
 * 1. Reads from local SQLite cache first (fast, works offline)
 * 2. Syncs with Supabase in the background
 * 3. Falls back to Supabase if local cache is empty
 *
 * Usage:
 *   import profileCacheService from './services/profileCacheService';
 *   const profile = await profileCacheService.getProfile(userId);
 *   const facts = await profileCacheService.getFacts(userId);
 */

import { supabase, SUPABASE_ENABLED, getUserFacts, setUserFact, getUserPreferences, setUserPreference } from './supabase';
import { createLogger } from './logger.js';
import apiConfigManager from '../config/apiConfig';

const logger = createLogger('ProfileCache');

// Check if we're in Electron with profile cache available
const hasElectronCache = () => {
  return typeof window !== 'undefined' && window.electronAPI?.profileCache;
};

/**
 * Get user profile - local cache first, then Supabase
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile
 */
export async function getProfile(userId) {
  if (!userId) return null;

  // Try local cache first (fast)
  if (hasElectronCache()) {
    try {
      const cached = await window.electronAPI.profileCache.getProfile(userId);
      if (cached) {
        logger.debug('Profile from local cache', { userId: userId.slice(-6) });

        // Sync from Supabase in background (don't await)
        syncProfileFromSupabase(userId).catch(err => {
          logger.warn('Background profile sync failed', err);
        });

        return cached;
      }
    } catch (err) {
      logger.warn('Local cache read failed', err);
    }
  }

  // Fall back to Supabase
  return fetchProfileFromSupabase(userId);
}

/**
 * Fetch profile from Supabase and cache locally
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile
 */
async function fetchProfileFromSupabase(userId) {
  if (!SUPABASE_ENABLED || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, credits, subscription_status, subscription_tier, credit_reset_date, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Supabase profile fetch failed', error);
      return null;
    }

    // Cache locally
    if (hasElectronCache() && data) {
      try {
        await window.electronAPI.profileCache.saveProfile(data);
        logger.debug('Profile cached locally', { userId: userId.slice(-6) });
      } catch (err) {
        logger.warn('Failed to cache profile locally', err);
      }
    }

    return data;
  } catch (err) {
    logger.error('Profile fetch error', err);
    return null;
  }
}

/**
 * Sync profile from Supabase to local cache (background operation)
 * @param {string} userId - User ID
 */
async function syncProfileFromSupabase(userId) {
  if (!SUPABASE_ENABLED || !supabase || !hasElectronCache()) return;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, credits, subscription_status, subscription_tier, credit_reset_date, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (!error && data) {
      await window.electronAPI.profileCache.saveProfile(data);
      logger.debug('Profile synced from Supabase', { userId: userId.slice(-6) });
    }
  } catch (err) {
    logger.warn('Profile sync failed', err);
  }
}

/**
 * Update credits locally and in Supabase
 * @param {string} userId - User ID
 * @param {number} credits - New credit balance
 */
export async function updateCredits(userId, credits) {
  // Update local cache immediately (fast)
  if (hasElectronCache()) {
    try {
      await window.electronAPI.profileCache.updateCredits(userId, credits);
      logger.debug('Credits updated locally', { credits });
    } catch (err) {
      logger.warn('Local credit update failed', err);
    }
  }
}

/**
 * Get user facts - local cache first, then Supabase
 * @param {string} userId - User ID
 * @param {string} category - Optional category filter
 * @returns {Promise<Array>} Array of facts
 */
export async function getFacts(userId, category = null) {
  if (!userId) return [];

  // Try local cache first
  if (hasElectronCache()) {
    try {
      const cached = await window.electronAPI.profileCache.getFacts(userId, category);
      if (cached && cached.length > 0) {
        logger.debug('Facts from local cache', { userId: userId.slice(-6), count: cached.length });

        // Sync from Supabase in background
        syncFactsFromSupabase(userId).catch(err => {
          logger.warn('Background facts sync failed', err);
        });

        return cached;
      }
    } catch (err) {
      logger.warn('Local facts read failed', err);
    }
  }

  // Fall back to Supabase
  return fetchFactsFromSupabase(userId, category);
}

/**
 * Fetch facts from Supabase and cache locally
 */
async function fetchFactsFromSupabase(userId, category = null) {
  if (!SUPABASE_ENABLED) return [];

  try {
    const facts = await getUserFacts(userId, category);

    // Cache locally
    if (hasElectronCache() && facts && facts.length > 0) {
      try {
        await window.electronAPI.profileCache.saveFacts(userId, facts);
        logger.debug('Facts cached locally', { count: facts.length });
      } catch (err) {
        logger.warn('Failed to cache facts locally', err);
      }
    }

    return facts || [];
  } catch (err) {
    logger.error('Facts fetch error', err);
    return [];
  }
}

/**
 * Sync facts from Supabase to local cache (background operation)
 */
async function syncFactsFromSupabase(userId) {
  if (!SUPABASE_ENABLED || !hasElectronCache()) return;

  try {
    const facts = await getUserFacts(userId, null);
    if (facts && facts.length > 0) {
      await window.electronAPI.profileCache.saveFacts(userId, facts);
      logger.debug('Facts synced from Supabase', { count: facts.length });
    }
  } catch (err) {
    logger.warn('Facts sync failed', err);
  }
}

/**
 * Set a fact - local first, then sync to Supabase
 * @param {string} userId - User ID
 * @param {string} category - Fact category
 * @param {string} key - Fact key
 * @param {string} value - Fact value
 * @param {string} source - Source of fact
 */
export async function setFact(userId, category, key, value, source = 'user') {
  // Save locally first (fast, works offline)
  if (hasElectronCache()) {
    try {
      await window.electronAPI.profileCache.setFact(userId, category, key, value, source);
      logger.debug('Fact set locally', { category, key });
    } catch (err) {
      logger.warn('Local fact set failed', err);
    }
  }

  // Sync to Supabase (background)
  if (SUPABASE_ENABLED) {
    setUserFact(userId, category, key, value, source)
      .then(() => {
        // Mark as synced in local cache
        if (hasElectronCache()) {
          window.electronAPI.profileCache.markFactsSynced([`${userId}-${category}-${key}`])
            .catch(() => {}); // Ignore errors
        }
      })
      .catch(err => {
        logger.warn('Supabase fact sync failed', err);
      });
  }
}

/**
 * Search facts locally
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching facts
 */
export async function searchFacts(userId, query) {
  if (!userId || !query) return [];

  if (hasElectronCache()) {
    try {
      return await window.electronAPI.profileCache.searchFacts(userId, query);
    } catch (err) {
      logger.warn('Local fact search failed', err);
    }
  }

  // Fall back to filtering fetched facts
  const allFacts = await getFacts(userId);
  const queryLower = query.toLowerCase();
  return allFacts.filter(f =>
    f.category?.toLowerCase().includes(queryLower) ||
    f.key?.toLowerCase().includes(queryLower) ||
    f.value?.toLowerCase().includes(queryLower)
  );
}

/**
 * Get user preferences - local cache first, then Supabase
 */
export async function getPreferences(userId) {
  if (!userId) return [];

  // Try local cache first
  if (hasElectronCache()) {
    try {
      const cached = await window.electronAPI.profileCache.getPreferences(userId);
      if (cached && cached.length > 0) {
        logger.debug('Preferences from local cache', { count: cached.length });

        // Sync in background
        syncPreferencesFromSupabase(userId).catch(() => {});

        return cached;
      }
    } catch (err) {
      logger.warn('Local preferences read failed', err);
    }
  }

  // Fall back to Supabase
  return fetchPreferencesFromSupabase(userId);
}

/**
 * Fetch preferences from Supabase and cache locally
 */
async function fetchPreferencesFromSupabase(userId) {
  if (!SUPABASE_ENABLED) return [];

  try {
    const prefs = await getUserPreferences(userId);

    // Cache locally
    if (hasElectronCache() && prefs && prefs.length > 0) {
      try {
        await window.electronAPI.profileCache.savePreferences(userId, prefs);
      } catch (err) {
        logger.warn('Failed to cache preferences locally', err);
      }
    }

    return prefs || [];
  } catch (err) {
    logger.error('Preferences fetch error', err);
    return [];
  }
}

/**
 * Sync preferences from Supabase
 */
async function syncPreferencesFromSupabase(userId) {
  if (!SUPABASE_ENABLED || !hasElectronCache()) return;

  try {
    const prefs = await getUserPreferences(userId);
    if (prefs && prefs.length > 0) {
      await window.electronAPI.profileCache.savePreferences(userId, prefs);
    }
  } catch (err) {
    logger.warn('Preferences sync failed', err);
  }
}

/**
 * Set a preference - local first, then sync
 */
export async function setPreference(userId, key, value, category = 'general') {
  // Save locally first
  if (hasElectronCache()) {
    try {
      await window.electronAPI.profileCache.setPreference(userId, key, value, category);
      logger.debug('Preference set locally', { key });
    } catch (err) {
      logger.warn('Local preference set failed', err);
    }
  }

  // Sync to Supabase
  if (SUPABASE_ENABLED) {
    setUserPreference(userId, key, value, category).catch(err => {
      logger.warn('Supabase preference sync failed', err);
    });
  }
}

/**
 * Check if user has cached profile
 */
export async function hasProfile(userId) {
  if (!userId) return false;

  if (hasElectronCache()) {
    try {
      return await window.electronAPI.profileCache.hasProfile(userId);
    } catch (err) {
      return false;
    }
  }

  return false;
}

/**
 * Force sync all user data from Supabase
 */
export async function forceSyncAll(userId) {
  if (!userId) return;

  logger.info('Force syncing all user data', { userId: userId.slice(-6) });

  await Promise.all([
    syncProfileFromSupabase(userId),
    syncFactsFromSupabase(userId),
    syncPreferencesFromSupabase(userId),
  ]);

  logger.info('Force sync complete');
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  if (hasElectronCache()) {
    try {
      return await window.electronAPI.profileCache.getStats();
    } catch (err) {
      logger.warn('Failed to get cache stats', err);
    }
  }
  return null;
}

/**
 * Clear user cache
 */
export async function clearCache(userId) {
  if (hasElectronCache()) {
    try {
      await window.electronAPI.profileCache.clear(userId);
      logger.info('Cache cleared for user', { userId: userId.slice(-6) });
    } catch (err) {
      logger.warn('Failed to clear cache', err);
    }
  }
}

// ==================== CONVERSATION SUMMARIES ====================

/**
 * Save a conversation summary when a conversation ends
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {string} summary - Brief summary of the conversation
 * @param {number} messageCount - Number of messages
 * @param {Array} topics - Main topics discussed
 */
export async function saveConversationSummary(userId, sessionId, summary, messageCount = 0, topics = []) {
  if (!userId || !sessionId || !summary) return;

  if (hasElectronCache()) {
    try {
      await window.electronAPI.profileCache.saveSummary(userId, sessionId, summary, messageCount, topics);
      logger.info('Conversation summary saved', { sessionId: sessionId.slice(-6) });
    } catch (err) {
      logger.warn('Failed to save conversation summary', err);
    }
  }
}

/**
 * Get recent conversation summaries
 * @param {string} userId - User ID
 * @param {number} limit - Max summaries to return (default 3)
 * @returns {Promise<Array>} Array of summaries
 */
export async function getRecentSummaries(userId, limit = 3) {
  if (!userId) return [];

  if (hasElectronCache()) {
    try {
      return await window.electronAPI.profileCache.getSummaries(userId, limit);
    } catch (err) {
      logger.warn('Failed to get conversation summaries', err);
    }
  }
  return [];
}

/**
 * Build a context string from recent conversation summaries
 * This is included in new conversations to give the AI context
 * @param {string} userId - User ID
 * @param {number} limit - Max summaries to include
 * @returns {Promise<string>} Formatted context string
 */
export async function buildSummaryContext(userId, limit = 3) {
  if (!userId) return '';

  if (hasElectronCache()) {
    try {
      return await window.electronAPI.profileCache.buildSummaryContext(userId, limit);
    } catch (err) {
      logger.warn('Failed to build summary context', err);
    }
  }
  return '';
}

/**
 * Generate a summary of the current conversation using GPT-5 mini via backend API
 * @param {Array} messages - Array of {role, content} messages
 * @returns {Promise<{summary: string, topics: Array}>} Summary and topics
 */
export async function generateConversationSummary(messages) {
  if (!messages || messages.length < 2) {
    return { summary: '', topics: [] };
  }

  // Filter to just user and assistant messages
  const relevantMessages = messages.filter(m =>
    m.role === 'user' || m.role === 'assistant'
  );

  if (relevantMessages.length < 2) {
    return { summary: '', topics: [] };
  }

  try {
    // Call backend API to generate summary using GPT-5 mini
    const baseURL = apiConfigManager.getBaseURL();
    const response = await fetch(`${baseURL}/api/v2/memory/summarize-conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': localStorage.getItem('user_id') || '',
      },
      body: JSON.stringify({
        messages: relevantMessages.map(m => ({
          role: m.role,
          content: m.content || ''
        }))
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const result = await response.json();
    logger.debug('Conversation summary generated', {
      summaryLength: result.summary?.length,
      topicCount: result.topics?.length
    });

    return {
      summary: result.summary || '',
      topics: result.topics || []
    };
  } catch (err) {
    logger.warn('Failed to generate conversation summary via API, using fallback', err);

    // Fallback: simple extractive summary
    const userMessages = relevantMessages.filter(m => m.role === 'user');
    const topics = userMessages
      .slice(0, 5)
      .map(m => {
        const content = m.content || '';
        const firstSentence = content.split(/[.!?]/)[0];
        return firstSentence.slice(0, 50).trim();
      })
      .filter(t => t.length > 3);

    const topicStr = topics.slice(0, 3).join(', ');
    const summary = `User discussed: ${topicStr}. ${relevantMessages.length} messages exchanged.`;

    return { summary, topics };
  }
}

export default {
  getProfile,
  updateCredits,
  getFacts,
  setFact,
  searchFacts,
  getPreferences,
  setPreference,
  hasProfile,
  forceSyncAll,
  getCacheStats,
  clearCache,
  // Conversation summaries
  saveConversationSummary,
  getRecentSummaries,
  buildSummaryContext,
  generateConversationSummary,
};
