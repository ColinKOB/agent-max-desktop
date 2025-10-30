/**
 * Embedding Generation Service
 * 
 * Uses @xenova/transformers for client-side embedding generation
 * Model: all-MiniLM-L6-v2 (384 dimensions, fast, good quality)
 * 
 * Features:
 * - Client-side generation (no API calls)
 * - Caching for repeated text
 * - Batch processing support
 * - Works offline
 */

import { pipeline, env } from '@xenova/transformers';
import { createLogger } from './logger.js';

const logger = createLogger('Embeddings');

// Configure transformers.js for browser/Electron usage
env.allowLocalModels = false;  // Use CDN models
env.allowRemoteModels = true;

// Lazy-load the embedding pipeline
let embedder = null;
let initPromise = null;

// In-memory cache for embeddings (LRU with max 1000 entries)
const embeddingCache = new Map();
const MAX_CACHE_SIZE = 1000;

/**
 * Initialize the embedding model
 */
async function initializeEmbedder() {
  if (embedder) return embedder;
  
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      logger.info('Loading embedding model: all-MiniLM-L6-v2...');
      const startTime = Date.now();
      
      embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          quantized: true  // Use quantized model for faster inference
        }
      );
      
      const loadTime = Date.now() - startTime;
      logger.info(`Embedding model loaded in ${loadTime}ms`);
      
      return embedder;
    } catch (error) {
      logger.error('Failed to load embedding model:', error);
      embedder = null;
      initPromise = null;
      throw error;
    }
  })();
  
  return initPromise;
}

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<number[]>} - 384-dimensional embedding vector
 */
export async function generateEmbedding(text, useCache = true) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input for embedding');
  }
  
  // Normalize text (trim, lowercase for cache key)
  const normalizedText = text.trim();
  if (normalizedText.length === 0) {
    throw new Error('Empty text cannot be embedded');
  }
  
  const cacheKey = normalizedText.toLowerCase();
  
  // Check cache
  if (useCache && embeddingCache.has(cacheKey)) {
    logger.debug('Cache hit for embedding');
    return embeddingCache.get(cacheKey);
  }
  
  // Ensure model is loaded
  await initializeEmbedder();
  
  try {
    const startTime = Date.now();
    
    // Generate embedding
    const output = await embedder(normalizedText, {
      pooling: 'mean',
      normalize: true
    });
    
    // Extract the embedding array
    const embedding = Array.from(output.data);
    
    const inferenceTime = Date.now() - startTime;
    logger.debug(`Generated embedding in ${inferenceTime}ms (${embedding.length} dims)`);
    
    // Cache the result
    if (useCache) {
      // Implement simple LRU: if cache is full, remove oldest entry
      if (embeddingCache.size >= MAX_CACHE_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        embeddingCache.delete(firstKey);
      }
      embeddingCache.set(cacheKey, embedding);
    }
    
    return embedding;
  } catch (error) {
    logger.error('Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to embed
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts, useCache = true) {
  if (!Array.isArray(texts)) {
    throw new Error('texts must be an array');
  }
  
  // Filter out empty texts
  const validTexts = texts.filter(t => t && typeof t === 'string' && t.trim().length > 0);
  
  if (validTexts.length === 0) {
    return [];
  }
  
  logger.info(`Generating embeddings for ${validTexts.length} texts...`);
  const startTime = Date.now();
  
  // Process in parallel with limited concurrency
  const BATCH_SIZE = 5;
  const results = [];
  
  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text, useCache))
    );
    results.push(...batchResults);
  }
  
  const totalTime = Date.now() - startTime;
  logger.info(`Generated ${results.length} embeddings in ${totalTime}ms (${(totalTime / results.length).toFixed(1)}ms/embedding)`);
  
  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {number[]} embedding1 - First embedding vector
 * @param {number[]} embedding2 - Second embedding vector
 * @returns {number} - Cosine similarity score (0-1, higher is more similar)
 */
export function cosineSimilarity(embedding1, embedding2) {
  if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
    throw new Error('Embeddings must be arrays');
  }
  
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have same dimensions');
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  
  if (magnitude === 0) {
    return 0;
  }
  
  return dotProduct / magnitude;
}

/**
 * Find most similar embeddings from a list
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {Array<{embedding: number[], data: any}>} candidates - Candidate embeddings with associated data
 * @param {number} topK - Number of results to return
 * @param {number} threshold - Minimum similarity threshold (0-1)
 * @returns {Array<{similarity: number, data: any}>} - Top K most similar items
 */
export function findMostSimilar(queryEmbedding, candidates, topK = 10, threshold = 0.5) {
  if (!Array.isArray(queryEmbedding) || !Array.isArray(candidates)) {
    throw new Error('Invalid inputs');
  }
  
  // Calculate similarities
  const scoredCandidates = candidates
    .filter(c => c.embedding && Array.isArray(c.embedding))
    .map(candidate => ({
      similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
      data: candidate.data
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  
  return scoredCandidates;
}

/**
 * Clear the embedding cache
 */
export function clearCache() {
  embeddingCache.clear();
  logger.info('Embedding cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: embeddingCache.size,
    maxSize: MAX_CACHE_SIZE,
    utilizationPercent: (embeddingCache.size / MAX_CACHE_SIZE * 100).toFixed(1)
  };
}

/**
 * Preload the model (useful for reducing first-inference latency)
 */
export async function preloadModel() {
  try {
    logger.info('Preloading embedding model...');
    await initializeEmbedder();
    // Generate a dummy embedding to warm up the model
    await generateEmbedding('warmup', false);
    logger.info('Embedding model preloaded successfully');
  } catch (error) {
    logger.error('Failed to preload embedding model:', error);
  }
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  findMostSimilar,
  clearCache,
  getCacheStats,
  preloadModel
};
