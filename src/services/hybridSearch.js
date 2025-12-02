/**
 * Hybrid Search Service
 * 
 * Combines local search (fast, offline) with Supabase search (comprehensive, online)
 * Strategy:
 * 1. Try local search first (<10ms)
 * 2. If insufficient results or online, merge with Supabase
 * 3. Deduplicate and rank combined results
 * 4. Cache for future queries
 */

import {
  searchMessagesKeyword as localMessagesKeyword,
  searchMessagesSemantic as localMessagesSemantic,
  searchFactsKeyword as localFactsKeyword,
  searchFactsSemantic as localFactsSemantic
} from './localSearch.js';
import { generateEmbedding } from './embeddings.js';
import { supabase } from './supabase.js';
import { createLogger } from './logger.js';

const logger = createLogger('HybridSearch');

// Feature flag: Enable/disable Supabase semantic RPC calls
// 'auto' = auto-detect on first use, 'true' = always try, 'false' = never try
const SUPABASE_SEMANTICS_SETTING = import.meta.env.VITE_ENABLE_SUPABASE_SEMANTICS || 'auto';

// Auto-detection cache: null = not checked, true/false = result
let supabaseSemanticAvailable = null;
let supabaseSemanticCheckPromise = null;

/**
 * Check if Supabase semantic RPCs are available (with caching)
 */
async function checkSupabaseSemanticAvailable() {
  // If already checked, return cached result
  if (supabaseSemanticAvailable !== null) {
    return supabaseSemanticAvailable;
  }
  
  // If check in progress, wait for it
  if (supabaseSemanticCheckPromise) {
    return supabaseSemanticCheckPromise;
  }
  
  // Check based on setting
  if (SUPABASE_SEMANTICS_SETTING === 'false') {
    supabaseSemanticAvailable = false;
    return false;
  }
  
  if (SUPABASE_SEMANTICS_SETTING === 'true') {
    supabaseSemanticAvailable = true;
    return true;
  }
  
  // Auto-detect: try a lightweight probe
  supabaseSemanticCheckPromise = (async () => {
    try {
      // Test with a dummy embedding (all zeros won't match anything but tests RPC exists)
      const dummyEmbedding = new Array(384).fill(0);
      const { error } = await supabase.rpc('search_messages_semantic', {
        query_embedding: dummyEmbedding,
        target_user_id: '00000000-0000-0000-0000-000000000000', // Non-existent user
        similarity_threshold: 0.99,
        max_results: 1
      });
      
      if (error?.code === '42883' || error?.message?.includes('does not exist')) {
        // Function doesn't exist
        logger.info('[Supabase] Semantic search RPC not available (function missing)');
        supabaseSemanticAvailable = false;
      } else if (error?.code === 'PGRST202' || error?.code === '42501') {
        // Permission denied but function exists
        logger.info('[Supabase] Semantic search RPC exists but no permission');
        supabaseSemanticAvailable = false;
      } else {
        // Function exists (even if error due to dummy data)
        logger.info('[Supabase] Semantic search RPC available ✓');
        supabaseSemanticAvailable = true;
      }
    } catch (err) {
      logger.warn('[Supabase] Failed to detect semantic RPC availability:', err);
      supabaseSemanticAvailable = false;
    }
    
    supabaseSemanticCheckPromise = null;
    return supabaseSemanticAvailable;
  })();
  
  return supabaseSemanticCheckPromise;
}

// Search configuration
const CONFIG = {
  localMinResults: 5,          // Min results to consider local search sufficient
  combineThreshold: 0.5,       // Minimum score to include result
  maxResults: 20,              // Maximum results to return
  semanticThreshold: 0.6,      // Minimum similarity for semantic results
  enableSupabaseFallback: true, // Whether to use Supabase when local insufficient
  embeddingTimeout: 3000,      // Max time to wait for embedding generation
  searchTimeout: 5000          // Max time to wait for entire search
};

/**
 * Wrap a promise with a timeout
 */
function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => {
      logger.warn(`Operation timed out after ${ms}ms`);
      resolve(fallback);
    }, ms))
  ]);
}

/**
 * Hybrid message search combining keyword and semantic
 */
export async function searchMessages(query, options = {}) {
  const {
    userId = null,
    limit = CONFIG.maxResults,
    mode = 'hybrid',  // 'keyword', 'semantic', or 'hybrid'
    forceSupabase = false
  } = options;
  
  const startTime = Date.now();
  logger.info(`Searching messages: "${query.substring(0, 50)}..." (mode: ${mode})`);
  
  let localResults = [];
  let supabaseResults = [];
  
  // Step 1: Local search (always try first for speed)
  if (!forceSupabase) {
    try {
      if (mode === 'keyword' || mode === 'hybrid') {
        const kwResults = localMessagesKeyword(query, userId, limit);
        localResults.push(...kwResults.map(r => ({ ...r, source: 'local-keyword' })));
      }
      
      if (mode === 'semantic' || mode === 'hybrid') {
        const semResults = await localMessagesSemantic(query, userId, limit, CONFIG.semanticThreshold);
        localResults.push(...semResults.map(r => ({ 
          ...r.data, 
          score: r.similarity,
          source: 'local-semantic' 
        })));
      }
      
      logger.debug(`Local search found ${localResults.length} results`);
    } catch (error) {
      logger.warn('Local search failed:', error);
    }
  }
  
  // Step 2: Supabase search (if online and needed)
  const needsSupabase = forceSupabase || 
    (CONFIG.enableSupabaseFallback && 
     navigator.onLine && 
     supabase && 
     localResults.length < CONFIG.localMinResults);
  
  if (needsSupabase && userId) {
    try {
      // Check if Supabase semantic search is available (auto-detect on first use)
      const semanticAvailable = await checkSupabaseSemanticAvailable();
      
      if ((mode === 'semantic' || mode === 'hybrid') && semanticAvailable) {
        // Use timeout to prevent hanging on embedding generation
        const embedding = await withTimeout(
          generateEmbedding(query),
          CONFIG.embeddingTimeout,
          null
        );
        
        if (embedding) {
          const { data, error } = await supabase.rpc('search_messages_semantic', {
            query_embedding: embedding,
            target_user_id: userId,
            similarity_threshold: CONFIG.semanticThreshold,
            max_results: limit
          });
          
          if (error) {
            logger.warn('Supabase semantic search failed:', error);
            // If RPC doesn't exist, disable for future calls
            if (error.code === '42883' || error.message?.includes('does not exist')) {
              supabaseSemanticAvailable = false;
            }
          } else if (data) {
            supabaseResults.push(...data.map(r => ({ 
              ...r, 
              score: r.similarity,
              source: 'supabase-semantic' 
            })));
            logger.debug(`Supabase semantic search found ${data.length} results`);
          }
        } else {
          logger.warn('Embedding generation timed out, skipping semantic search');
        }
      } else if ((mode === 'semantic' || mode === 'hybrid') && !semanticAvailable) {
        logger.debug('Supabase semantic search skipped (not available)');
      }
      
      if (mode === 'keyword' || mode === 'hybrid') {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .textSearch('content', query, {
            type: 'websearch',
            config: 'english'
          })
          .limit(limit);
        
        if (error) {
          logger.warn('Supabase keyword search failed:', error);
        } else if (data) {
          supabaseResults.push(...data.map(r => ({ 
            ...r, 
            score: 0.8,  // Default score for keyword matches
            source: 'supabase-keyword' 
          })));
          logger.debug(`Supabase keyword search found ${data.length} results`);
        }
      }
    } catch (error) {
      logger.error('Supabase search error:', error);
    }
  }
  
  // Step 3: Merge and deduplicate results
  const merged = mergeResults(localResults, supabaseResults, limit);
  
  const duration = Date.now() - startTime;
  logger.info(`Hybrid search completed in ${duration}ms: ${merged.length} results (${localResults.length} local, ${supabaseResults.length} supabase)`);
  
  return {
    results: merged,
    stats: {
      duration,
      localCount: localResults.length,
      supabaseCount: supabaseResults.length,
      totalCount: merged.length,
      source: merged.length > 0 ? merged[0].source : 'none'
    }
  };
}

/**
 * Hybrid fact search
 */
export async function searchFacts(query, options = {}) {
  const {
    userId = null,
    limit = CONFIG.maxResults,
    mode = 'hybrid',
    forceSupabase = false
  } = options;
  
  const startTime = Date.now();
  logger.info(`Searching facts: "${query.substring(0, 50)}..." (mode: ${mode})`);
  
  let localResults = [];
  let supabaseResults = [];
  
  // Step 1: Local search
  if (!forceSupabase) {
    try {
      if (mode === 'keyword' || mode === 'hybrid') {
        const kwResults = localFactsKeyword(query, userId, limit);
        localResults.push(...kwResults.map(r => ({ ...r, source: 'local-keyword' })));
      }
      
      if (mode === 'semantic' || mode === 'hybrid') {
        const semResults = await localFactsSemantic(query, userId, limit, CONFIG.semanticThreshold);
        localResults.push(...semResults.map(r => ({ 
          ...r.data, 
          score: r.similarity,
          source: 'local-semantic' 
        })));
      }
      
      logger.debug(`Local search found ${localResults.length} results`);
    } catch (error) {
      logger.warn('Local search failed:', error);
    }
  }
  
  // Step 2: Supabase search (if needed)
  const needsSupabase = forceSupabase || 
    (CONFIG.enableSupabaseFallback && 
     navigator.onLine && 
     supabase && 
     localResults.length < CONFIG.localMinResults);
  
  if (needsSupabase && userId) {
    try {
      // Check if Supabase semantic search is available (auto-detect on first use)
      const semanticAvailable = await checkSupabaseSemanticAvailable();
      
      if ((mode === 'semantic' || mode === 'hybrid') && semanticAvailable) {
        // Use timeout to prevent hanging on embedding generation
        const embedding = await withTimeout(
          generateEmbedding(query),
          CONFIG.embeddingTimeout,
          null
        );
        
        if (embedding) {
          const { data, error } = await supabase.rpc('search_facts_semantic', {
            query_embedding: embedding,
            target_user_id: userId,
            similarity_threshold: CONFIG.semanticThreshold,
            max_results: limit
          });
          
          if (error) {
            logger.warn('Supabase semantic search failed:', error);
            // If RPC doesn't exist, disable for future calls
            if (error.code === '42883' || error.message?.includes('does not exist')) {
              supabaseSemanticAvailable = false;
            }
          } else if (data) {
            supabaseResults.push(...data.map(r => ({ 
              ...r, 
              score: r.similarity,
              source: 'supabase-semantic' 
            })));
            logger.debug(`Supabase semantic search found ${data.length} results`);
          }
        } else {
          logger.warn('Embedding generation timed out, skipping semantic search');
        }
      } else if ((mode === 'semantic' || mode === 'hybrid') && !semanticAvailable) {
        logger.debug('Supabase semantic search skipped (not available)');
      }
      
      if (mode === 'keyword' || mode === 'hybrid') {
        const { data, error } = await supabase
          .from('facts')
          .select('*')
          .eq('user_id', userId)
          .textSearch('value', query, {
            type: 'websearch',
            config: 'english'
          })
          .limit(limit);
        
        if (error) {
          logger.warn('Supabase keyword search failed:', error);
        } else if (data) {
          supabaseResults.push(...data.map(r => ({ 
            ...r, 
            score: 0.8,
            source: 'supabase-keyword' 
          })));
          logger.debug(`Supabase keyword search found ${data.length} results`);
        }
      }
    } catch (error) {
      logger.error('Supabase search error:', error);
    }
  }
  
  // Step 3: Merge results
  const merged = mergeResults(localResults, supabaseResults, limit);
  
  const duration = Date.now() - startTime;
  logger.info(`Hybrid search completed in ${duration}ms: ${merged.length} results`);
  
  return {
    results: merged,
    stats: {
      duration,
      localCount: localResults.length,
      supabaseCount: supabaseResults.length,
      totalCount: merged.length,
      source: merged.length > 0 ? merged[0].source : 'none'
    }
  };
}

/**
 * Merge and deduplicate results from local and Supabase
 */
function mergeResults(localResults, supabaseResults, limit) {
  const seen = new Map();
  const merged = [];
  
  // Process all results
  const allResults = [...localResults, ...supabaseResults];
  
  for (const result of allResults) {
    const id = result.id || result.message_id || result.fact_id;
    if (!id) continue;
    
    // If we've seen this ID, keep the one with higher score
    if (seen.has(id)) {
      const existing = seen.get(id);
      if ((result.score || 0) > (existing.score || 0)) {
        seen.set(id, result);
      }
    } else {
      seen.set(id, result);
    }
  }
  
  // Convert to array and sort by score
  const results = Array.from(seen.values())
    .filter(r => (r.score || 0) >= CONFIG.combineThreshold)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
  
  return results;
}

/**
 * Search context builder - comprehensive context search
 */
export async function searchContext(query, userId, options = {}) {
  const {
    includeMessages = true,
    includeFacts = true,
    messageLimit = 10,
    factLimit = 10
  } = options;
  
  const startTime = Date.now();
  logger.info(`Building search context for: "${query.substring(0, 50)}..."`);
  
  const results = {
    messages: [],
    facts: [],
    stats: {}
  };
  
  // Search messages and facts in parallel
  const searches = [];
  
  if (includeMessages) {
    searches.push(
      searchMessages(query, { userId, limit: messageLimit, mode: 'hybrid' })
        .then(r => { results.messages = r.results; })
        .catch(err => logger.error('Message search failed:', err))
    );
  }
  
  if (includeFacts) {
    searches.push(
      searchFacts(query, { userId, limit: factLimit, mode: 'hybrid' })
        .then(r => { results.facts = r.results; })
        .catch(err => logger.error('Fact search failed:', err))
    );
  }
  
  await Promise.all(searches);
  
  const duration = Date.now() - startTime;
  results.stats = {
    duration,
    messageCount: results.messages.length,
    factCount: results.facts.length
  };
  
  logger.info(`Context search completed in ${duration}ms`);
  return results;
}

/**
 * Update search configuration
 */
export function updateConfig(updates) {
  Object.assign(CONFIG, updates);
  logger.info('Search config updated:', updates);
}

/**
 * Get current configuration
 */
export function getConfig() {
  return { ...CONFIG };
}

export default {
  searchMessages,
  searchFacts,
  searchContext,
  updateConfig,
  getConfig
};
