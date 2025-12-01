/**
 * Deep Dive Service
 * 
 * Stores and retrieves long AI responses (>150 words) for detailed viewing
 * in the Deep Dive settings tab.
 * 
 * STORAGE STRATEGY:
 * - Primary: Supabase messages table (with is_deep_dive metadata flag)
 * - localStorage is used ONLY for caching/quick access, NOT as a fallback
 * - Deep Dives are linked to the conversation session for context
 * 
 * IMPORTANT: This is NOT an offline AI feature. The AI requires internet.
 * Deep Dives are stored responses from the cloud AI, not local processing.
 */

import { createLogger } from './logger.js';
import apiConfigManager from '../config/apiConfig';
import { supabase, SUPABASE_ENABLED } from './supabase';

const logger = createLogger('DeepDive');

const STORAGE_KEY = 'agent_max_deep_dives';
const MAX_DEEP_DIVES = 50; // Keep last 50 deep dives
const WORD_THRESHOLD = 150; // Minimum words to trigger deep dive

/**
 * Count words in a string
 */
function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Generate a quick summary of the text (first ~50 words) - fallback
 */
function generateQuickSummary(text, maxWords = 50) {
  if (!text || typeof text !== 'string') return '';
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Generate an AI summary using GPT-5-mini
 * Falls back to quick summary if API fails
 */
async function generateAISummary(fullText, userPrompt = '') {
  try {
    const apiUrl = apiConfigManager.getApiUrl?.() || 'https://agentmax-production.up.railway.app';
    const apiKey = apiConfigManager.getApiKey?.() || '';
    
    const response = await fetch(`${apiUrl}/api/v2/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-Key': apiKey })
      },
      body: JSON.stringify({
        text: fullText.substring(0, 4000), // Limit input size
        user_prompt: userPrompt,
        max_words: 30,
        model: 'gpt-5-mini'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.summary) {
        logger.info('[DeepDive] Generated AI summary');
        return data.summary;
      }
    }
  } catch (err) {
    logger.warn('[DeepDive] AI summary failed, using fallback:', err?.message);
  }
  
  // Fallback to quick summary
  return generateQuickSummary(fullText, 40);
}

/**
 * Generate a unique ID for a deep dive
 */
function generateId() {
  return `dd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all deep dives from storage
 */
export function getDeepDives() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    logger.error('Failed to get deep dives:', error);
    return [];
  }
}

/**
 * Get a specific deep dive by ID
 */
export function getDeepDive(id) {
  const deepDives = getDeepDives();
  return deepDives.find(dd => dd.id === id) || null;
}

/**
 * Save deep dives to storage
 */
function saveDeepDives(deepDives) {
  try {
    // Keep only the most recent MAX_DEEP_DIVES
    const trimmed = deepDives.slice(-MAX_DEEP_DIVES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch (error) {
    logger.error('Failed to save deep dives:', error);
    return false;
  }
}

/**
 * Check if a response qualifies as a deep dive (>150 words)
 */
export function qualifiesAsDeepDive(text) {
  return countWords(text) > WORD_THRESHOLD;
}

/**
 * Create a new deep dive entry
 * @param {string} userPrompt - The user's question
 * @param {string} fullResponse - The full AI response
 * @param {string} sessionId - Optional session ID to link the deep dive to the conversation
 * @returns {object} - The deep dive entry with id, summary, etc.
 */
export async function createDeepDive(userPrompt, fullResponse, sessionId = null) {
  const id = generateId();
  const wordCount = countWords(fullResponse);
  
  // Generate AI summary (async) - will fallback to quick summary if API fails
  let summary;
  try {
    summary = await generateAISummary(fullResponse, userPrompt);
  } catch {
    summary = generateQuickSummary(fullResponse, 40);
  }
  
  const deepDive = {
    id,
    userPrompt: userPrompt || '',
    fullResponse,
    summary,
    wordCount,
    createdAt: Date.now(),
    title: userPrompt ? generateQuickSummary(userPrompt, 10) : 'Deep Dive Response',
    sessionId: sessionId || localStorage.getItem('session_id') || null
  };
  
  // Save to localStorage (fallback/offline support)
  const deepDives = getDeepDives();
  deepDives.push(deepDive);
  saveDeepDives(deepDives);
  
  // Also save to Supabase for cross-device sync and conversation history
  await saveDeepDiveToSupabase(deepDive);
  
  logger.info(`Created deep dive: ${id} (${wordCount} words)`);
  
  return deepDive;
}

/**
 * Save deep dive to Supabase as a message with metadata
 * This links the deep dive to the conversation session
 */
async function saveDeepDiveToSupabase(deepDive) {
  try {
    const userId = localStorage.getItem('user_id');
    const sessionId = deepDive.sessionId;
    
    // Skip if no user or session, or if Supabase not available
    if (!userId || !sessionId || !SUPABASE_ENABLED || !supabase) {
      logger.debug('[DeepDive] Skipping Supabase save - no user/session or Supabase unavailable');
      return;
    }
    
    // Skip pending/local sessions
    if (sessionId.startsWith('pending-') || sessionId.startsWith('local-')) {
      logger.debug('[DeepDive] Skipping Supabase save - pending/local session');
      return;
    }
    
    // Store as a message with deep_dive metadata
    const { error } = await supabase.from('messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: deepDive.fullResponse,
      redacted_content: deepDive.summary, // Summary as redacted version
      metadata: {
        is_deep_dive: true,
        deep_dive_id: deepDive.id,
        word_count: deepDive.wordCount,
        user_prompt: deepDive.userPrompt,
        title: deepDive.title
      }
    });
    
    if (error) {
      logger.warn('[DeepDive] Failed to save to Supabase:', error.message);
    } else {
      logger.info('[DeepDive] Saved to Supabase session:', sessionId);
    }
  } catch (err) {
    logger.warn('[DeepDive] Supabase save error:', err?.message);
  }
}

/**
 * Get deep dives from Supabase (primary storage for cross-device sync)
 * Also includes any locally cached deep dives for quick access
 * 
 * NOTE: This fetches STORED AI responses, not local AI processing.
 * If Supabase is unavailable, only locally cached responses are shown.
 */
export async function getDeepDivesFromSupabase(limit = 50) {
  // Get locally cached deep dives first (for quick display)
  const localDeepDives = getDeepDives();
  
  // If Supabase not configured, just return local cache
  // This is NOT a "fallback AI" - these are previously stored cloud AI responses
  const userId = localStorage.getItem('user_id');
  if (!userId || !SUPABASE_ENABLED || !supabase) {
    logger.debug('[DeepDive] Supabase not available, showing cached responses only');
    return localDeepDives.map(dd => ({ ...dd, cached: true }));
  }
  
  try {
    // Query messages with is_deep_dive metadata from Supabase
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('role', 'assistant')
      .not('metadata->is_deep_dive', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      logger.warn('[DeepDive] Failed to fetch from Supabase:', error.message);
      // Return local cache with indicator that sync failed
      return localDeepDives.map(dd => ({ ...dd, cached: true, syncFailed: true }));
    }
    
    // Convert Supabase messages to deep dive format
    const supabaseDeepDives = (data || []).map(msg => ({
      id: msg.metadata?.deep_dive_id || `dd_${msg.id}`,
      userPrompt: msg.metadata?.user_prompt || '',
      fullResponse: msg.content,
      summary: msg.redacted_content || generateQuickSummary(msg.content, 40),
      wordCount: msg.metadata?.word_count || countWords(msg.content),
      createdAt: new Date(msg.created_at).getTime(),
      title: msg.metadata?.title || 'Deep Dive Response',
      sessionId: msg.session_id,
      synced: true // Indicates this is synced to cloud
    }));
    
    // Merge: Supabase is source of truth, local cache fills gaps
    const supabaseIds = new Set(supabaseDeepDives.map(d => d.id));
    const merged = [
      ...supabaseDeepDives,
      ...localDeepDives.filter(d => !supabaseIds.has(d.id)).map(dd => ({ ...dd, cached: true }))
    ];
    
    return merged.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  } catch (err) {
    logger.warn('[DeepDive] Supabase fetch error:', err?.message);
    return localDeepDives.map(dd => ({ ...dd, cached: true, syncFailed: true }));
  }
}

/**
 * Delete a deep dive by ID
 */
export function deleteDeepDive(id) {
  const deepDives = getDeepDives();
  const filtered = deepDives.filter(dd => dd.id !== id);
  saveDeepDives(filtered);
  logger.info(`Deleted deep dive: ${id}`);
}

/**
 * Clear all deep dives
 */
export function clearAllDeepDives() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    logger.info('Cleared all deep dives');
    return true;
  } catch (error) {
    logger.error('Failed to clear deep dives:', error);
    return false;
  }
}

/**
 * Get word count threshold
 */
export function getWordThreshold() {
  return WORD_THRESHOLD;
}

export default {
  getDeepDives,
  getDeepDive,
  getDeepDivesFromSupabase,
  createDeepDive,
  deleteDeepDive,
  clearAllDeepDives,
  qualifiesAsDeepDive,
  getWordThreshold,
};
