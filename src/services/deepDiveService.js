/**
 * Deep Dive Service
 * 
 * Stores and retrieves long AI responses (>150 words) for detailed viewing
 * in the Deep Dive settings tab.
 */

import { createLogger } from './logger.js';

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
 * Generate a summary of the text (first ~50 words)
 */
function generateSummary(text, maxWords = 50) {
  if (!text || typeof text !== 'string') return '';
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
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
 * @returns {object} - The deep dive entry with id, summary, etc.
 */
export function createDeepDive(userPrompt, fullResponse) {
  const id = generateId();
  const wordCount = countWords(fullResponse);
  const summary = generateSummary(fullResponse, 50);
  
  const deepDive = {
    id,
    userPrompt: userPrompt || '',
    fullResponse,
    summary,
    wordCount,
    createdAt: Date.now(),
    title: userPrompt ? generateSummary(userPrompt, 10) : 'Deep Dive Response'
  };
  
  // Save to storage
  const deepDives = getDeepDives();
  deepDives.push(deepDive);
  saveDeepDives(deepDives);
  
  logger.info(`Created deep dive: ${id} (${wordCount} words)`);
  
  return deepDive;
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
  createDeepDive,
  deleteDeepDive,
  clearAllDeepDives,
  qualifiesAsDeepDive,
  getWordThreshold,
};
