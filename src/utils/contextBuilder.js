/**
 * Context Builder Utility
 * Builds context from Memory Vault for AI requests
 * Uses hybrid search (local + Supabase) for fast, comprehensive results
 */

import { getProfile, getFacts, getRecentMessages, getPreferences } from '../services/supabaseMemory';
import { searchContext } from '../services/hybridSearch';

/**
 * Build complete context for chat request
 * @returns {Promise<Object>} Context object with profile, facts, messages, preferences
 */
export async function buildChatContext(sessionId = null, messageLimit = 10) {
  try {
    if (!localStorage.getItem('user_id')) {
      console.warn('[Context] User not initialized');
      return null;
    }

    // Gather context from Supabase-first memory
    const [profile, facts, recentMessages, preferences] = await Promise.all([
      getProfile().catch(() => null),
      getFacts().catch(() => ({})),
      sessionId
        ? getRecentMessages(messageLimit, sessionId).catch(() => [])
        : Promise.resolve([]),
      getPreferences().catch(() => ({})),
    ]);

    // Build context object
    const context = {
      profile: profile
        ? {
            name: profile.name || 'User',
            interaction_count: profile.interaction_count || 0,
          }
        : null,
      facts: formatFacts(facts),
      recent_messages: recentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content.substring(0, 500), // Limit message length
        timestamp: msg.timestamp,
      })),
      preferences: preferences,
    };

    console.log('[Context] Built context:', {
      hasProfile: !!context.profile,
      factCount: context.facts.length,
      messageCount: context.recent_messages.length,
      hasPreferences: Object.keys(context.preferences).length > 0,
    });

    return context;
  } catch (error) {
    console.error('[Context] Failed to build context:', error);
    return null;
  }
}

/**
 * Build enriched context using hybrid semantic search
 * @param {string} query - User's current query for relevant context retrieval
 * @param {string} sessionId - Optional session ID
 * @param {number} messageLimit - Max messages to include
 * @returns {Promise<Object>} Enriched context with semantically relevant items
 */
export async function buildEnrichedContext(query, sessionId = null, messageLimit = 10) {
  try {
    const userId = localStorage.getItem('user_id');
    
    if (!userId) {
      console.warn('[Context] User not initialized');
      return null;
    }

    // Get basic context
    const [profile, preferences] = await Promise.all([
      getProfile().catch(() => null),
      getPreferences().catch(() => ({})),
    ]);

    // Use hybrid search to find relevant messages and facts
    const searchResults = await searchContext(query, userId, {
      includeMessages: true,
      includeFacts: true,
      messageLimit,
      factLimit: 10
    });

    // Build enriched context
    const context = {
      profile: profile
        ? {
            name: profile.name || 'User',
            interaction_count: profile.interaction_count || 0,
          }
        : null,
      facts: searchResults.facts.map(f => ({
        category: f.category,
        key: f.key,
        value: f.value,
        relevance: f.score || 0
      })),
      relevant_messages: searchResults.messages.map(m => ({
        role: m.role,
        content: m.content?.substring(0, 500) || '',
        relevance: m.score || 0,
        source: m.source || 'unknown'
      })),
      preferences: preferences,
      search_stats: searchResults.stats
    };

    console.log('[Context] Built enriched context:', {
      hasProfile: !!context.profile,
      factCount: context.facts.length,
      relevantMessageCount: context.relevant_messages.length,
      searchDuration: searchResults.stats?.duration || 0
    });

    return context;
  } catch (error) {
    console.error('[Context] Failed to build enriched context:', error);
    return null;
  }
}

/**
 * Format facts for context
 * @param {Object} facts - Facts object from Memory Vault
 * @returns {Array} Formatted facts array
 */
function formatFacts(facts) {
  if (!facts || typeof facts !== 'object') {
    return [];
  }

  const formatted = [];

  // Convert nested object structure to flat array
  for (const [category, items] of Object.entries(facts)) {
    if (typeof items === 'object' && items !== null) {
      for (const [key, value] of Object.entries(items)) {
        formatted.push({
          category,
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        });
      }
    }
  }

  // Sort by importance (could be enhanced with confidence scores)
  return formatted.slice(0, 20); // Limit to top 20 facts
}

/**
 * Compute hash of context for change detection
 * @param {Object} context - Context object
 * @returns {string} Hash string
 */
export function hashContext(context) {
  if (!context) return '';

  const str = JSON.stringify({
    profile: context.profile,
    factCount: context.facts?.length || 0,
    prefCount: Object.keys(context.preferences || {}).length,
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(36);
}

/**
 * Reinforce facts that were used in the response
 * @param {Array<string>} usedFactIds - Array of fact IDs that were used
 */
export async function reinforceUsedFacts(usedFactIds) {
  if (!usedFactIds || usedFactIds.length === 0) {
    return;
  }

  // TODO: Implement fact reinforcement in supabaseMemory
  console.log('[Context] Fact reinforcement not yet implemented in Supabase-first memory');
}
