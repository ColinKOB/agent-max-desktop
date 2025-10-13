/**
 * Response Cache Service
 * Caches AI responses for instant replay of similar questions
 * Dramatically speeds up repeated or similar questions
 */

class ResponseCache {
  constructor() {
    this.cache = this.loadCache();
    this.maxCacheSize = 100; // Keep last 100 interactions
  }

  /**
   * Load cache from localStorage
   */
  loadCache() {
    try {
      const cached = localStorage.getItem('agent_max_response_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Filter out old entries (older than 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        return parsed.filter(item => item.timestamp > sevenDaysAgo);
      }
    } catch (error) {
      console.warn('[ResponseCache] Failed to load cache:', error);
    }
    return [];
  }

  /**
   * Save cache to localStorage
   */
  saveCache() {
    try {
      // Keep only the most recent entries
      const toSave = this.cache.slice(-this.maxCacheSize);
      localStorage.setItem('agent_max_response_cache', JSON.stringify(toSave));
      this.cache = toSave;
    } catch (error) {
      console.warn('[ResponseCache] Failed to save cache:', error);
    }
  }

  /**
   * Normalize text for comparison
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[?!.,;]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Calculate similarity between two strings (0-1)
   * Uses simple word overlap for speed
   */
  calculateSimilarity(text1, text2) {
    const words1 = new Set(this.normalizeText(text1).split(' '));
    const words2 = new Set(this.normalizeText(text2).split(' '));
    
    // Jaccard similarity
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Check if question is an exact or very similar match
   * Returns cached response if found
   */
  getCachedResponse(userPrompt) {
    const normalized = this.normalizeText(userPrompt);
    
    // First, check for exact match (instant)
    for (const entry of this.cache) {
      if (this.normalizeText(entry.prompt) === normalized) {
        console.log('[ResponseCache] 🎯 Exact match found - instant response!');
        entry.hitCount = (entry.hitCount || 0) + 1;
        entry.lastHit = Date.now();
        this.saveCache();
        return {
          ...entry,
          cached: true,
          cacheType: 'exact'
        };
      }
    }

    // Then check for high similarity (>90%)
    for (const entry of this.cache) {
      const similarity = this.calculateSimilarity(userPrompt, entry.prompt);
      if (similarity >= 0.90) {
        console.log(`[ResponseCache] ⚡ High similarity (${(similarity * 100).toFixed(0)}%) - using cached response!`);
        entry.hitCount = (entry.hitCount || 0) + 1;
        entry.lastHit = Date.now();
        this.saveCache();
        return {
          ...entry,
          cached: true,
          cacheType: 'similar',
          similarity: similarity
        };
      }
    }

    // Check for medium similarity (70-90%) - show suggestion but don't auto-use
    for (const entry of this.cache) {
      const similarity = this.calculateSimilarity(userPrompt, entry.prompt);
      if (similarity >= 0.70) {
        console.log(`[ResponseCache] 💡 Similar question found (${(similarity * 100).toFixed(0)}%)`);
        return {
          suggestion: true,
          similarPrompt: entry.prompt,
          similarResponse: entry.response,
          similarity: similarity
        };
      }
    }

    return null;
  }

  /**
   * Add a new response to cache
   */
  cacheResponse(userPrompt, aiResponse, metadata = {}) {
    // Don't cache errors
    if (!aiResponse || metadata.success === false) {
      return;
    }

    // Check if this exact prompt already exists
    const existingIndex = this.cache.findIndex(
      entry => this.normalizeText(entry.prompt) === this.normalizeText(userPrompt)
    );

    if (existingIndex !== -1) {
      // Update existing entry
      this.cache[existingIndex] = {
        ...this.cache[existingIndex],
        response: aiResponse,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        ...metadata
      };
    } else {
      // Add new entry
      this.cache.push({
        prompt: userPrompt,
        response: aiResponse,
        timestamp: Date.now(),
        hitCount: 0,
        ...metadata
      });
    }

    this.saveCache();
    console.log(`[ResponseCache] Cached response for: "${userPrompt.substring(0, 50)}..."`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalEntries = this.cache.length;
    const totalHits = this.cache.reduce((sum, entry) => sum + (entry.hitCount || 0), 0);
    const mostUsed = this.cache
      .filter(e => e.hitCount > 0)
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 5);

    return {
      totalEntries,
      totalHits,
      mostUsed,
      cacheHitRate: totalEntries > 0 ? (totalHits / totalEntries * 100).toFixed(1) : 0
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = [];
    localStorage.removeItem('agent_max_response_cache');
    console.log('[ResponseCache] Cache cleared');
  }

  /**
   * Export cache for debugging
   */
  exportCache() {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      entries: this.cache,
      stats: this.getStats()
    };
  }
}

// Singleton instance
const responseCache = new ResponseCache();

export default responseCache;
