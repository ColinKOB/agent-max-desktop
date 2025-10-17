/**
 * Context Builder Utility
 * Builds context from Memory Vault for AI requests
 */

/**
 * Build complete context for chat request
 * @returns {Promise<Object>} Context object with profile, facts, messages, preferences
 */
export async function buildChatContext(sessionId = null, messageLimit = 10) {
  try {
    if (!window.electron?.memory) {
      console.warn('[Context] Memory API not available');
      return null;
    }

    // Gather context from Memory Vault
    const [profile, facts, recentMessages, preferences] = await Promise.all([
      window.electron.memory.getProfile().catch(() => null),
      window.electron.memory.getFacts().catch(() => ({})),
      sessionId
        ? window.electron.memory.getRecentMessages(messageLimit, sessionId).catch(() => [])
        : Promise.resolve([]),
      window.electron.memory.getPreferences().catch(() => ({})),
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

  if (!window.electron?.memory?.reinforceFact) {
    console.warn('[Context] reinforceFact API not available');
    return;
  }

  try {
    for (const factId of usedFactIds) {
      await window.electron.memory.reinforceFact(factId);
    }
    console.log('[Context] Reinforced', usedFactIds.length, 'facts');
  } catch (error) {
    console.error('[Context] Failed to reinforce facts:', error);
  }
}
