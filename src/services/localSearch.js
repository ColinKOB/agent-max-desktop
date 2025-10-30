/**
 * Local Search Index Service
 * 
 * Provides ultra-fast (<10ms) local search for messages and facts
 * Features:
 * - Keyword search (inverted index)
 * - Semantic search (local embeddings)
 * - Persistence to disk
 * - Real-time updates from Supabase
 * - Offline-first with sync
 */

import { generateEmbedding, findMostSimilar } from './embeddings.js';
import { createLogger } from './logger.js';

const logger = createLogger('LocalSearch');

// In-memory search indexes
let messageIndex = {
  byId: new Map(),           // id -> message
  byKeyword: new Map(),      // word -> Set<id>
  byEmbedding: [],           // [{id, embedding, data}]
  bySession: new Map(),      // sessionId -> Set<id>
  byUser: new Map()          // userId -> Set<id>
};

let factIndex = {
  byId: new Map(),           // id -> fact
  byKeyword: new Map(),      // word -> Set<id>
  byEmbedding: [],           // [{id, embedding, data}]
  byCategory: new Map(),     // category -> Set<id>
  byUser: new Map()          // userId -> Set<id>
};

// Stopwords to exclude from keyword indexing
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might',
  'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how'
]);

// Persistence helpers
const STORAGE_KEY_MESSAGES = 'local_search_messages';
const STORAGE_KEY_FACTS = 'local_search_facts';
const SAVE_DEBOUNCE_MS = 5000;

let saveTimer = null;
let isDirty = false;

/**
 * Tokenize text for keyword search
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * Mark index as dirty and schedule save
 */
function markDirty() {
  isDirty = true;
  
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  
  saveTimer = setTimeout(() => {
    saveIndexes();
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Save indexes to localStorage
 */
export function saveIndexes() {
  if (!isDirty) return;
  
  try {
    const messageData = {
      byId: Array.from(messageIndex.byId.entries()),
      byKeyword: Array.from(messageIndex.byKeyword.entries()).map(([word, ids]) => [word, Array.from(ids)]),
      byEmbedding: messageIndex.byEmbedding,
      bySession: Array.from(messageIndex.bySession.entries()).map(([sid, ids]) => [sid, Array.from(ids)]),
      byUser: Array.from(messageIndex.byUser.entries()).map(([uid, ids]) => [uid, Array.from(ids)])
    };
    
    const factData = {
      byId: Array.from(factIndex.byId.entries()),
      byKeyword: Array.from(factIndex.byKeyword.entries()).map(([word, ids]) => [word, Array.from(ids)]),
      byEmbedding: factIndex.byEmbedding,
      byCategory: Array.from(factIndex.byCategory.entries()).map(([cat, ids]) => [cat, Array.from(ids)]),
      byUser: Array.from(factIndex.byUser.entries()).map(([uid, ids]) => [uid, Array.from(ids)])
    };
    
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messageData));
    localStorage.setItem(STORAGE_KEY_FACTS, JSON.stringify(factData));
    
    isDirty = false;
    logger.debug('Indexes saved to localStorage');
  } catch (error) {
    logger.error('Failed to save indexes:', error);
  }
}

/**
 * Load indexes from localStorage
 */
export function loadIndexes() {
  try {
    const messageData = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const factData = localStorage.getItem(STORAGE_KEY_FACTS);
    
    if (messageData) {
      const parsed = JSON.parse(messageData);
      messageIndex.byId = new Map(parsed.byId);
      messageIndex.byKeyword = new Map(parsed.byKeyword.map(([word, ids]) => [word, new Set(ids)]));
      messageIndex.byEmbedding = parsed.byEmbedding || [];
      messageIndex.bySession = new Map(parsed.bySession.map(([sid, ids]) => [sid, new Set(ids)]));
      messageIndex.byUser = new Map(parsed.byUser.map(([uid, ids]) => [uid, new Set(ids)]));
      logger.info(`Loaded ${messageIndex.byId.size} messages from local index`);
    }
    
    if (factData) {
      const parsed = JSON.parse(factData);
      factIndex.byId = new Map(parsed.byId);
      factIndex.byKeyword = new Map(parsed.byKeyword.map(([word, ids]) => [word, new Set(ids)]));
      factIndex.byEmbedding = parsed.byEmbedding || [];
      factIndex.byCategory = new Map(parsed.byCategory.map(([cat, ids]) => [cat, new Set(ids)]));
      factIndex.byUser = new Map(parsed.byUser.map(([uid, ids]) => [uid, new Set(ids)]));
      logger.info(`Loaded ${factIndex.byId.size} facts from local index`);
    }
  } catch (error) {
    logger.error('Failed to load indexes:', error);
  }
}

/**
 * Clear all indexes
 */
export function clearIndexes() {
  messageIndex = {
    byId: new Map(),
    byKeyword: new Map(),
    byEmbedding: [],
    bySession: new Map(),
    byUser: new Map()
  };
  
  factIndex = {
    byId: new Map(),
    byKeyword: new Map(),
    byEmbedding: [],
    byCategory: new Map(),
    byUser: new Map()
  };
  
  try {
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    localStorage.removeItem(STORAGE_KEY_FACTS);
  } catch (error) {
    logger.error('Failed to clear localStorage:', error);
  }
  
  logger.info('Indexes cleared');
}

// ============================================================================
// MESSAGE INDEXING
// ============================================================================

/**
 * Index a message for local search
 */
export async function indexMessage(message, generateEmbeddings = true) {
  if (!message || !message.id) {
    logger.warn('Invalid message for indexing');
    return;
  }
  
  const id = String(message.id);
  
  // Store full message data
  messageIndex.byId.set(id, message);
  
  // Index by session
  if (message.session_id) {
    if (!messageIndex.bySession.has(message.session_id)) {
      messageIndex.bySession.set(message.session_id, new Set());
    }
    messageIndex.bySession.get(message.session_id).add(id);
  }
  
  // Index by user (from session)
  if (message.userId || message.user_id) {
    const userId = message.userId || message.user_id;
    if (!messageIndex.byUser.has(userId)) {
      messageIndex.byUser.set(userId, new Set());
    }
    messageIndex.byUser.get(userId).add(id);
  }
  
  // Index keywords
  const content = message.content || message.redacted_content || '';
  const tokens = tokenize(content);
  
  for (const word of tokens) {
    if (!messageIndex.byKeyword.has(word)) {
      messageIndex.byKeyword.set(word, new Set());
    }
    messageIndex.byKeyword.get(word).add(id);
  }
  
  // Generate and index embedding
  if (generateEmbeddings && content.trim().length > 0) {
    try {
      const embedding = await generateEmbedding(content);
      
      // Remove old embedding for this message if exists
      messageIndex.byEmbedding = messageIndex.byEmbedding.filter(item => item.id !== id);
      
      // Add new embedding
      messageIndex.byEmbedding.push({
        id,
        embedding,
        data: {
          id: message.id,
          session_id: message.session_id,
          role: message.role,
          content: content.substring(0, 500),
          created_at: message.created_at
        }
      });
      
      logger.debug(`Indexed message ${id} with embedding`);
    } catch (error) {
      logger.warn(`Failed to generate embedding for message ${id}:`, error);
    }
  }
  
  markDirty();
}

/**
 * Index multiple messages in batch
 */
export async function indexMessagesBatch(messages, generateEmbeddings = true) {
  logger.info(`Batch indexing ${messages.length} messages...`);
  const startTime = Date.now();
  
  for (const message of messages) {
    await indexMessage(message, generateEmbeddings);
  }
  
  const duration = Date.now() - startTime;
  logger.info(`Batch indexed ${messages.length} messages in ${duration}ms`);
}

// ============================================================================
// FACT INDEXING
// ============================================================================

/**
 * Index a fact for local search
 */
export async function indexFact(fact, generateEmbeddings = true) {
  if (!fact || !fact.id) {
    logger.warn('Invalid fact for indexing');
    return;
  }
  
  const id = String(fact.id);
  
  // Store full fact data
  factIndex.byId.set(id, fact);
  
  // Index by category
  if (fact.category) {
    if (!factIndex.byCategory.has(fact.category)) {
      factIndex.byCategory.set(fact.category, new Set());
    }
    factIndex.byCategory.get(fact.category).add(id);
  }
  
  // Index by user
  if (fact.user_id) {
    if (!factIndex.byUser.has(fact.user_id)) {
      factIndex.byUser.set(fact.user_id, new Set());
    }
    factIndex.byUser.get(fact.user_id).add(id);
  }
  
  // Index keywords
  const searchText = `${fact.key} ${fact.value}`;
  const tokens = tokenize(searchText);
  
  for (const word of tokens) {
    if (!factIndex.byKeyword.has(word)) {
      factIndex.byKeyword.set(word, new Set());
    }
    factIndex.byKeyword.get(word).add(id);
  }
  
  // Generate and index embedding
  if (generateEmbeddings && searchText.trim().length > 0) {
    try {
      const embedding = await generateEmbedding(searchText);
      
      // Remove old embedding for this fact if exists
      factIndex.byEmbedding = factIndex.byEmbedding.filter(item => item.id !== id);
      
      // Add new embedding
      factIndex.byEmbedding.push({
        id,
        embedding,
        data: {
          id: fact.id,
          category: fact.category,
          key: fact.key,
          value: fact.value,
          confidence: fact.confidence
        }
      });
      
      logger.debug(`Indexed fact ${id} with embedding`);
    } catch (error) {
      logger.warn(`Failed to generate embedding for fact ${id}:`, error);
    }
  }
  
  markDirty();
}

/**
 * Index multiple facts in batch
 */
export async function indexFactsBatch(facts, generateEmbeddings = true) {
  logger.info(`Batch indexing ${facts.length} facts...`);
  const startTime = Date.now();
  
  for (const fact of facts) {
    await indexFact(fact, generateEmbeddings);
  }
  
  const duration = Date.now() - startTime;
  logger.info(`Batch indexed ${facts.length} facts in ${duration}ms`);
}

// ============================================================================
// SEARCH OPERATIONS
// ============================================================================

/**
 * Search messages by keywords (ultra-fast)
 */
export function searchMessagesKeyword(query, userId = null, limit = 20) {
  const startTime = Date.now();
  const tokens = tokenize(query);
  
  if (tokens.length === 0) {
    return [];
  }
  
  // Find messages that match any keyword
  const matchedIds = new Set();
  const scores = new Map();
  
  for (const token of tokens) {
    const ids = messageIndex.byKeyword.get(token) || new Set();
    for (const id of ids) {
      matchedIds.add(id);
      scores.set(id, (scores.get(id) || 0) + 1);
    }
  }
  
  // Filter by user if specified
  let results = Array.from(matchedIds)
    .filter(id => {
      const message = messageIndex.byId.get(id);
      if (!message) return false;
      if (userId && message.userId !== userId && message.user_id !== userId) return false;
      return true;
    })
    .map(id => ({
      ...messageIndex.byId.get(id),
      score: scores.get(id) / tokens.length  // Normalized score
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  const duration = Date.now() - startTime;
  logger.debug(`Keyword search returned ${results.length} results in ${duration}ms`);
  
  return results;
}

/**
 * Search messages by semantic similarity (fast)
 */
export async function searchMessagesSemantic(query, userId = null, limit = 20, threshold = 0.6) {
  const startTime = Date.now();
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // Filter candidates by user if specified
  let candidates = messageIndex.byEmbedding;
  if (userId) {
    const userMessageIds = messageIndex.byUser.get(userId);
    if (userMessageIds) {
      candidates = candidates.filter(item => userMessageIds.has(item.id));
    } else {
      return [];
    }
  }
  
  // Find similar messages
  const results = findMostSimilar(queryEmbedding, candidates, limit, threshold);
  
  const duration = Date.now() - startTime;
  logger.debug(`Semantic search returned ${results.length} results in ${duration}ms`);
  
  return results;
}

/**
 * Search facts by keywords (ultra-fast)
 */
export function searchFactsKeyword(query, userId = null, limit = 20) {
  const startTime = Date.now();
  const tokens = tokenize(query);
  
  if (tokens.length === 0) {
    return [];
  }
  
  // Find facts that match any keyword
  const matchedIds = new Set();
  const scores = new Map();
  
  for (const token of tokens) {
    const ids = factIndex.byKeyword.get(token) || new Set();
    for (const id of ids) {
      matchedIds.add(id);
      scores.set(id, (scores.get(id) || 0) + 1);
    }
  }
  
  // Filter by user if specified
  let results = Array.from(matchedIds)
    .filter(id => {
      const fact = factIndex.byId.get(id);
      if (!fact) return false;
      if (userId && fact.user_id !== userId) return false;
      return true;
    })
    .map(id => ({
      ...factIndex.byId.get(id),
      score: scores.get(id) / tokens.length
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  const duration = Date.now() - startTime;
  logger.debug(`Keyword search returned ${results.length} facts in ${duration}ms`);
  
  return results;
}

/**
 * Search facts by semantic similarity (fast)
 */
export async function searchFactsSemantic(query, userId = null, limit = 20, threshold = 0.6) {
  const startTime = Date.now();
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // Filter candidates by user if specified
  let candidates = factIndex.byEmbedding;
  if (userId) {
    const userFactIds = factIndex.byUser.get(userId);
    if (userFactIds) {
      candidates = candidates.filter(item => userFactIds.has(item.id));
    } else {
      return [];
    }
  }
  
  // Find similar facts
  const results = findMostSimilar(queryEmbedding, candidates, limit, threshold);
  
  const duration = Date.now() - startTime;
  logger.debug(`Semantic search returned ${results.length} facts in ${duration}ms`);
  
  return results;
}

/**
 * Get index statistics
 */
export function getIndexStats() {
  // Calculate approximate storage size
  const messageData = localStorage.getItem(STORAGE_KEY_MESSAGES);
  const factData = localStorage.getItem(STORAGE_KEY_FACTS);
  const storageSizeBytes = (messageData?.length || 0) + (factData?.length || 0);
  const storageSizeKB = (storageSizeBytes / 1024).toFixed(2);
  
  return {
    messages: {
      total: messageIndex.byId.size,
      withEmbeddings: messageIndex.byEmbedding.length,
      keywords: messageIndex.byKeyword.size,
      sessions: messageIndex.bySession.size,
      users: messageIndex.byUser.size
    },
    facts: {
      total: factIndex.byId.size,
      withEmbeddings: factIndex.byEmbedding.length,
      keywords: factIndex.byKeyword.size,
      categories: factIndex.byCategory.size,
      users: factIndex.byUser.size
    },
    storageSize: `${storageSizeKB} KB`
  };
}

// Initialize on import
loadIndexes();

export default {
  indexMessage,
  indexMessagesBatch,
  indexFact,
  indexFactsBatch,
  searchMessagesKeyword,
  searchMessagesSemantic,
  searchFactsKeyword,
  searchFactsSemantic,
  loadIndexes,
  clearIndexes,
  getIndexStats
};
