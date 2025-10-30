/**
 * E2E Tests for Hybrid Search System
 * 
 * Tests the complete flow:
 * 1. Embedding generation
 * 2. Local index building
 * 3. Keyword and semantic search
 * 4. Hybrid search strategy
 * 5. Performance benchmarks
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { generateEmbedding, generateEmbeddingsBatch, cosineSimilarity, clearCache, getCacheStats } from '../src/services/embeddings.js';
import {
  indexMessage,
  indexFact,
  searchMessagesKeyword,
  searchMessagesSemantic,
  searchFactsKeyword,
  searchFactsSemantic,
  clearIndexes,
  getIndexStats
} from '../src/services/localSearch.js';
import { searchMessages, searchFacts, searchContext } from '../src/services/hybridSearch.js';

// Mock browser environment
global.window = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
global.navigator = { onLine: true };
global.localStorage = {
  data: {},
  getItem(key) { return this.data[key] || null; },
  setItem(key, value) { this.data[key] = value; },
  removeItem(key) { delete this.data[key]; },
  clear() { this.data = {}; }
};

// Test data
const testUserId = 'test-user-123';
const testSessionId = 'test-session-456';

const sampleMessages = [
  {
    id: '1',
    session_id: testSessionId,
    userId: testUserId,
    role: 'user',
    content: 'What are the best practices for React performance optimization?',
    created_at: '2025-01-01T10:00:00Z'
  },
  {
    id: '2',
    session_id: testSessionId,
    userId: testUserId,
    role: 'assistant',
    content: 'For React performance optimization, consider: 1) Use React.memo for expensive components, 2) Implement code splitting with React.lazy, 3) Use useMemo and useCallback hooks wisely.',
    created_at: '2025-01-01T10:01:00Z'
  },
  {
    id: '3',
    session_id: testSessionId,
    userId: testUserId,
    role: 'user',
    content: 'How do I implement authentication in a Next.js application?',
    created_at: '2025-01-01T11:00:00Z'
  },
  {
    id: '4',
    session_id: testSessionId,
    userId: testUserId,
    role: 'assistant',
    content: 'For Next.js authentication, you can use NextAuth.js. Install it with npm install next-auth, create an API route at pages/api/auth/[...nextauth].js, and configure your providers.',
    created_at: '2025-01-01T11:01:00Z'
  },
  {
    id: '5',
    session_id: testSessionId,
    userId: testUserId,
    role: 'user',
    content: 'What database should I use for a large-scale application?',
    created_at: '2025-01-01T12:00:00Z'
  }
];

const sampleFacts = [
  {
    id: 'fact-1',
    user_id: testUserId,
    category: 'technical',
    key: 'primary_language',
    value: 'JavaScript and TypeScript',
    confidence: 1.0
  },
  {
    id: 'fact-2',
    user_id: testUserId,
    category: 'technical',
    key: 'frameworks',
    value: 'React, Next.js, Node.js',
    confidence: 0.9
  },
  {
    id: 'fact-3',
    user_id: testUserId,
    category: 'preferences',
    key: 'coding_style',
    value: 'Functional programming with hooks',
    confidence: 0.8
  },
  {
    id: 'fact-4',
    user_id: testUserId,
    category: 'project',
    key: 'current_stack',
    value: 'Full-stack TypeScript with React and Supabase',
    confidence: 1.0
  }
];

describe('Hybrid Search E2E Tests', () => {
  beforeAll(async () => {
    // Set up user ID
    localStorage.setItem('user_id', testUserId);
    localStorage.setItem('session_id', testSessionId);
    
    // Clear any existing indexes
    clearIndexes();
    clearCache();
  });

  afterAll(() => {
    clearIndexes();
    clearCache();
    localStorage.clear();
  });

  describe('1. Embedding Generation', () => {
    it('should generate embeddings for text', async () => {
      const text = 'This is a test sentence for embedding generation';
      const embedding = await generateEmbedding(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(384);
      expect(typeof embedding[0]).toBe('number');
    }, 30000);

    it('should cache embeddings for repeated text', async () => {
      const text = 'cached test sentence';
      
      // First call
      const startTime1 = Date.now();
      await generateEmbedding(text);
      const duration1 = Date.now() - startTime1;
      
      // Second call (should be cached)
      const startTime2 = Date.now();
      await generateEmbedding(text);
      const duration2 = Date.now() - startTime2;
      
      // Cached call should be significantly faster
      expect(duration2).toBeLessThan(duration1 / 10);
      
      const stats = getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    }, 30000);

    it('should generate embeddings in batch', async () => {
      const texts = [
        'First test sentence',
        'Second test sentence',
        'Third test sentence'
      ];
      
      const embeddings = await generateEmbeddingsBatch(texts);
      
      expect(embeddings).toHaveLength(3);
      expect(embeddings[0].length).toBe(384);
    }, 30000);

    it('should calculate cosine similarity correctly', async () => {
      const text1 = 'React performance optimization';
      const text2 = 'Optimizing React applications for speed';
      const text3 = 'Python machine learning tutorial';
      
      const [emb1, emb2, emb3] = await generateEmbeddingsBatch([text1, text2, text3]);
      
      const sim12 = cosineSimilarity(emb1, emb2);
      const sim13 = cosineSimilarity(emb1, emb3);
      
      // Similar texts should have higher similarity
      expect(sim12).toBeGreaterThan(sim13);
      expect(sim12).toBeGreaterThan(0.5);
      expect(sim13).toBeLessThan(0.7);
    }, 30000);
  });

  describe('2. Local Index Building', () => {
    it('should index messages with embeddings', async () => {
      for (const message of sampleMessages) {
        await indexMessage(message, true);
      }
      
      const stats = getIndexStats();
      expect(stats.messages.total).toBe(5);
      expect(stats.messages.withEmbeddings).toBe(5);
      expect(stats.messages.keywords).toBeGreaterThan(0);
    }, 60000);

    it('should index facts with embeddings', async () => {
      for (const fact of sampleFacts) {
        await indexFact(fact, true);
      }
      
      const stats = getIndexStats();
      expect(stats.facts.total).toBe(4);
      expect(stats.facts.withEmbeddings).toBe(4);
    }, 60000);
  });

  describe('3. Keyword Search', () => {
    it('should find messages by keyword', () => {
      const results = searchMessagesKeyword('React performance', testUserId, 10);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('React');
      expect(results[0].score).toBeDefined();
    });

    it('should find facts by keyword', () => {
      const results = searchFactsKeyword('TypeScript', testUserId, 10);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].value).toContain('TypeScript');
    });

    it('should be fast (<10ms)', () => {
      const startTime = Date.now();
      searchMessagesKeyword('React', testUserId, 10);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(10);
    });
  });

  describe('4. Semantic Search', () => {
    it('should find semantically similar messages', async () => {
      const results = await searchMessagesSemantic('improving React app speed', testUserId, 5, 0.5);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].data.content).toBeDefined();
      expect(results[0].similarity).toBeGreaterThan(0.5);
    }, 10000);

    it('should find semantically similar facts', async () => {
      const results = await searchFactsSemantic('programming languages used', testUserId, 5, 0.5);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0.5);
    }, 10000);

    it('should rank by relevance', async () => {
      const results = await searchMessagesSemantic('React optimization', testUserId, 5, 0.3);
      
      // Results should be sorted by similarity
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
      }
    }, 10000);

    it('should be fast (<100ms)', async () => {
      const startTime = Date.now();
      await searchMessagesSemantic('React', testUserId, 5);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100);
    }, 10000);
  });

  describe('5. Hybrid Search Strategy', () => {
    it('should search messages using hybrid approach', async () => {
      // Mock offline Supabase
      global.navigator.onLine = true;
      
      const result = await searchMessages('Next.js authentication', {
        userId: testUserId,
        limit: 5,
        mode: 'hybrid'
      });
      
      expect(result.results).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.localCount).toBeGreaterThan(0);
      expect(result.stats.duration).toBeDefined();
    }, 15000);

    it('should search facts using hybrid approach', async () => {
      const result = await searchFacts('JavaScript frameworks', {
        userId: testUserId,
        limit: 5,
        mode: 'hybrid'
      });
      
      expect(result.results).toBeDefined();
      expect(result.stats).toBeDefined();
    }, 15000);

    it('should work in keyword-only mode', async () => {
      const result = await searchMessages('React', {
        userId: testUserId,
        limit: 5,
        mode: 'keyword'
      });
      
      expect(result.results).toBeDefined();
      expect(result.stats.duration).toBeLessThan(20);
    });

    it('should work in semantic-only mode', async () => {
      const result = await searchMessages('performance optimization', {
        userId: testUserId,
        limit: 5,
        mode: 'semantic'
      });
      
      expect(result.results).toBeDefined();
    }, 15000);

    it('should deduplicate results', async () => {
      const result = await searchMessages('React', {
        userId: testUserId,
        limit: 10,
        mode: 'hybrid'
      });
      
      // Check for unique IDs
      const ids = result.results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }, 15000);
  });

  describe('6. Context Search (Combined)', () => {
    it('should search both messages and facts', async () => {
      const context = await searchContext('React TypeScript project', testUserId, {
        includeMessages: true,
        includeFacts: true,
        messageLimit: 5,
        factLimit: 5
      });
      
      expect(context.messages).toBeDefined();
      expect(context.facts).toBeDefined();
      expect(context.stats).toBeDefined();
    }, 15000);

    it('should return relevant context quickly', async () => {
      const startTime = Date.now();
      await searchContext('authentication', testUserId, {
        messageLimit: 5,
        factLimit: 5
      });
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(500);
    }, 15000);
  });

  describe('7. Performance Benchmarks', () => {
    it('local keyword search performance', () => {
      const iterations = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        searchMessagesKeyword('React', testUserId, 10);
      }
      
      const avgDuration = (Date.now() - startTime) / iterations;
      console.log(`Average keyword search: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(10);
    });

    it('local semantic search performance', async () => {
      const iterations = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await searchMessagesSemantic('React performance', testUserId, 5);
      }
      
      const avgDuration = (Date.now() - startTime) / iterations;
      console.log(`Average semantic search: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(100);
    }, 30000);

    it('embedding generation performance', async () => {
      const texts = [
        'Short text',
        'This is a medium length text with more words',
        'This is a longer text that contains multiple sentences. It should still be processed efficiently. The embedding model handles variable length inputs.'
      ];
      
      const durations = [];
      
      for (const text of texts) {
        const start = Date.now();
        await generateEmbedding(text, false); // No cache
        durations.push(Date.now() - start);
      }
      
      console.log('Embedding generation times:', durations.map(d => `${d}ms`).join(', '));
      
      // All should complete reasonably fast
      durations.forEach(d => expect(d).toBeLessThan(500));
    }, 30000);
  });

  describe('8. Error Handling', () => {
    it('should handle empty queries gracefully', async () => {
      const result = await searchMessages('', { userId: testUserId });
      expect(result.results).toBeDefined();
    });

    it('should handle missing user ID', async () => {
      const result = await searchMessages('test', { userId: null });
      expect(result.results).toBeDefined();
    });

    it('should handle offline mode', async () => {
      global.navigator.onLine = false;
      
      const result = await searchMessages('React', {
        userId: testUserId,
        mode: 'hybrid'
      });
      
      expect(result.results).toBeDefined();
      expect(result.stats.localCount).toBeGreaterThan(0);
      expect(result.stats.supabaseCount).toBe(0);
      
      global.navigator.onLine = true;
    }, 15000);
  });
});
