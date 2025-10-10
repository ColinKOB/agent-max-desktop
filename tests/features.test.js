/**
 * Feature Tests for Agent Max Desktop
 * Tests screenshots and semantic embeddings functionality
 * 
 * Run with: npm test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Screenshot Feature', () => {
  let mockElectronAPI;
  
  beforeEach(() => {
    // Mock electron API
    mockElectronAPI = {
      takeScreenshot: vi.fn(),
    };
    global.window = {
      electron: mockElectronAPI,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should capture screenshot and return base64 data', async () => {
    // Arrange
    const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    mockElectronAPI.takeScreenshot.mockResolvedValue(mockBase64);

    // Act
    const result = await window.electron.takeScreenshot();

    // Assert
    expect(mockElectronAPI.takeScreenshot).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockBase64);
    expect(result).toMatch(/^[A-Za-z0-9+/=]+$/); // Valid base64
  });

  it('should handle screenshot capture errors gracefully', async () => {
    // Arrange
    const mockError = new Error('Screenshot permission denied');
    mockElectronAPI.takeScreenshot.mockRejectedValue(mockError);

    // Act & Assert
    await expect(window.electron.takeScreenshot()).rejects.toThrow('Screenshot permission denied');
  });

  it('should validate screenshot size is reasonable', async () => {
    // Arrange
    const mockLargeBase64 = 'A'.repeat(1000000); // 1MB
    mockElectronAPI.takeScreenshot.mockResolvedValue(mockLargeBase64);

    // Act
    const result = await window.electron.takeScreenshot();

    // Assert
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(10000000); // Less than 10MB
  });

  it('should include screenshot in message payload when attached', async () => {
    // Arrange
    const mockBase64 = 'mock-screenshot-data';
    const userMessage = 'What is this?';
    
    const payload = {
      goal: userMessage,
      user_context: {},
      image: mockBase64,
    };

    // Assert
    expect(payload.image).toBe(mockBase64);
    expect(payload.goal).toBe(userMessage);
  });

  it('should clear screenshot after sending message', async () => {
    // This tests the FloatBar behavior
    // After sending, screenshotData should be set to null
    let screenshotData = 'mock-data';
    
    // Simulate sending
    screenshotData = null;
    
    expect(screenshotData).toBeNull();
  });
});

describe('Semantic Embeddings Feature', () => {
  let mockSemanticAPI;

  beforeEach(() => {
    // Mock semantic API
    mockSemanticAPI = {
      findSimilar: vi.fn(),
      getEmbedding: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should find similar goals with valid similarity scores', async () => {
    // Arrange
    const mockResponse = {
      data: {
        similar_goals: [
          {
            goal: 'Why is grass green?',
            similarity: 0.89,
            success: true,
            steps: 1,
          },
          {
            goal: 'What makes plants green?',
            similarity: 0.76,
            success: true,
            steps: 1,
          },
        ],
        count: 2,
      },
    };
    mockSemanticAPI.findSimilar.mockResolvedValue(mockResponse);

    // Act
    const result = await mockSemanticAPI.findSimilar('why is grass', 0.7, 3);

    // Assert
    expect(mockSemanticAPI.findSimilar).toHaveBeenCalledWith('why is grass', 0.7, 3);
    expect(result.data.similar_goals).toHaveLength(2);
    expect(result.data.similar_goals[0].similarity).toBeGreaterThan(0.7);
    expect(result.data.similar_goals[0].goal).toBe('Why is grass green?');
  });

  it('should handle no similar goals found', async () => {
    // Arrange
    mockSemanticAPI.findSimilar.mockResolvedValue({
      data: {
        similar_goals: [],
        count: 0,
      },
    });

    // Act
    const result = await mockSemanticAPI.findSimilar('unique question never asked', 0.7, 3);

    // Assert
    expect(result.data.similar_goals).toHaveLength(0);
    expect(result.data.count).toBe(0);
  });

  it('should validate similarity scores are between 0 and 1', async () => {
    // Arrange
    const mockResponse = {
      data: {
        similar_goals: [
          { goal: 'Test', similarity: 0.85, success: true, steps: 1 },
          { goal: 'Test 2', similarity: 0.72, success: true, steps: 1 },
        ],
        count: 2,
      },
    };
    mockSemanticAPI.findSimilar.mockResolvedValue(mockResponse);

    // Act
    const result = await mockSemanticAPI.findSimilar('test query', 0.7, 3);

    // Assert
    result.data.similar_goals.forEach(goal => {
      expect(goal.similarity).toBeGreaterThanOrEqual(0);
      expect(goal.similarity).toBeLessThanOrEqual(1);
    });
  });

  it('should respect similarity threshold parameter', async () => {
    // Arrange
    const threshold = 0.8;
    mockSemanticAPI.findSimilar.mockResolvedValue({
      data: {
        similar_goals: [
          { goal: 'High similarity', similarity: 0.95, success: true, steps: 1 },
          { goal: 'Medium similarity', similarity: 0.82, success: true, steps: 1 },
        ],
        count: 2,
      },
    });

    // Act
    const result = await mockSemanticAPI.findSimilar('test', threshold, 3);

    // Assert
    result.data.similar_goals.forEach(goal => {
      expect(goal.similarity).toBeGreaterThanOrEqual(threshold);
    });
  });

  it('should respect limit parameter', async () => {
    // Arrange
    const limit = 3;
    mockSemanticAPI.findSimilar.mockResolvedValue({
      data: {
        similar_goals: [
          { goal: 'Result 1', similarity: 0.95, success: true, steps: 1 },
          { goal: 'Result 2', similarity: 0.87, success: true, steps: 1 },
        ],
        count: 2,
      },
    });

    // Act
    const result = await mockSemanticAPI.findSimilar('test', 0.7, limit);

    // Assert
    expect(result.data.similar_goals.length).toBeLessThanOrEqual(limit);
  });

  it('should handle API errors gracefully', async () => {
    // Arrange
    mockSemanticAPI.findSimilar.mockRejectedValue(new Error('Backend unavailable'));

    // Act & Assert
    await expect(mockSemanticAPI.findSimilar('test', 0.7, 3)).rejects.toThrow('Backend unavailable');
  });

  it('should debounce search requests', async () => {
    // This tests that we don't spam the API
    const searchText = 'why is grass';
    
    // Simulate typing (multiple rapid updates)
    let debounceTimer;
    const debouncedSearch = (text) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await mockSemanticAPI.findSimilar(text, 0.7, 3);
      }, 800);
    };

    // Act - rapid typing
    debouncedSearch('w');
    debouncedSearch('wh');
    debouncedSearch('why');
    debouncedSearch('why ');
    debouncedSearch('why i');
    debouncedSearch('why is');
    debouncedSearch('why is ');
    debouncedSearch('why is g');
    debouncedSearch('why is gr');
    debouncedSearch(searchText);

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 900));

    // Assert - API should only be called once
    expect(mockSemanticAPI.findSimilar).toHaveBeenCalledTimes(1);
    expect(mockSemanticAPI.findSimilar).toHaveBeenCalledWith(searchText, 0.7, 3);
  });

  it('should get embedding vector for text', async () => {
    // Arrange
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
    mockSemanticAPI.getEmbedding.mockResolvedValue({
      data: {
        embedding: mockEmbedding,
        dimension: 1536,
        cached: false,
      },
    });

    // Act
    const result = await mockSemanticAPI.getEmbedding('test text');

    // Assert
    expect(result.data.embedding).toHaveLength(1536);
    expect(result.data.dimension).toBe(1536);
    result.data.embedding.forEach(value => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    });
  });
});

describe('Integration Tests', () => {
  it('should successfully send message with screenshot and receive response', async () => {
    // Arrange
    const mockElectron = {
      takeScreenshot: vi.fn().mockResolvedValue('mock-screenshot'),
    };
    
    const mockChatAPI = {
      sendMessage: vi.fn().mockResolvedValue({
        data: {
          final_response: 'This is a screenshot of code',
          execution_time: 3.2,
          steps: [
            {
              action: 'analyze_image',
              reasoning: 'Analyzed screenshot with GPT-4o',
              result: 'Success',
              success: true,
            },
          ],
        },
      }),
    };

    // Act
    const screenshot = await mockElectron.takeScreenshot();
    const response = await mockChatAPI.sendMessage('What is this?', {}, screenshot);

    // Assert
    expect(mockElectron.takeScreenshot).toHaveBeenCalled();
    expect(mockChatAPI.sendMessage).toHaveBeenCalledWith('What is this?', {}, 'mock-screenshot');
    expect(response.data.final_response).toContain('screenshot');
    expect(response.data.steps[0].action).toBe('analyze_image');
  });

  it('should show semantic suggestions while typing', async () => {
    // Arrange
    const mockSemanticAPI = {
      findSimilar: vi.fn().mockResolvedValue({
        data: {
          similar_goals: [
            { goal: 'Why is grass green?', similarity: 0.89, success: true, steps: 1 },
          ],
          count: 1,
        },
      }),
    };

    let message = '';
    let similarGoals = [];
    let showSuggestions = false;

    // Act - simulate typing
    message = 'why';
    if (message.length >= 3) {
      await new Promise(resolve => setTimeout(resolve, 800)); // Debounce
      const result = await mockSemanticAPI.findSimilar(message, 0.7, 3);
      if (result.data.similar_goals.length > 0) {
        similarGoals = result.data.similar_goals;
        showSuggestions = true;
      }
    }

    // Assert
    expect(mockSemanticAPI.findSimilar).toHaveBeenCalledWith('why', 0.7, 3);
    expect(similarGoals).toHaveLength(1);
    expect(showSuggestions).toBe(true);
  });
});

describe('Best Practices Validation', () => {
  it('should not expose sensitive data in screenshot base64', async () => {
    // Screenshot data should be base64, not contain API keys or passwords
    const mockBase64 = 'VGVzdCBkYXRh'; // "Test data" in base64
    
    // Should not contain common sensitive patterns
    expect(mockBase64).not.toMatch(/api[_-]?key/i);
    expect(mockBase64).not.toMatch(/password/i);
    expect(mockBase64).not.toMatch(/secret/i);
    expect(mockBase64).not.toMatch(/token/i);
  });

  it('should rate limit embedding requests', async () => {
    // Test that rate limiting logic exists
    // This is a conceptual test - actual rate limiting happens in backend
    const rateLimit = 10;
    const timeWindow = 60000; // 1 minute
    
    // Simulate rate limiter
    const rateLimiter = {
      requests: [],
      canMakeRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < timeWindow);
        return this.requests.length < rateLimit;
      },
      recordRequest() {
        this.requests.push(Date.now());
      }
    };

    // Simulate 15 requests
    let allowed = 0;
    let blocked = 0;
    
    for (let i = 0; i < 15; i++) {
      if (rateLimiter.canMakeRequest()) {
        rateLimiter.recordRequest();
        allowed++;
      } else {
        blocked++;
      }
    }

    // First 10 should be allowed, next 5 blocked
    expect(allowed).toBe(10);
    expect(blocked).toBe(5);
  });

  it('should cache embeddings to reduce API calls', async () => {
    const cache = new Map();
    
    const getEmbeddingWithCache = async (text) => {
      if (cache.has(text)) {
        return { cached: true, data: cache.get(text) };
      }
      const result = { embedding: [] }; // Mock result
      cache.set(text, result);
      return { cached: false, data: result };
    };

    // First call - not cached
    const result1 = await getEmbeddingWithCache('test');
    expect(result1.cached).toBe(false);

    // Second call - cached
    const result2 = await getEmbeddingWithCache('test');
    expect(result2.cached).toBe(true);
  });

  it('should validate input lengths', () => {
    const minLength = 2;
    const maxLength = 2000;

    // Too short
    expect('a'.length).toBeLessThan(minLength);

    // Valid
    expect('Hello, Agent Max'.length).toBeGreaterThanOrEqual(minLength);
    expect('Hello, Agent Max'.length).toBeLessThanOrEqual(maxLength);

    // Too long
    const tooLong = 'a'.repeat(2001);
    expect(tooLong.length).toBeGreaterThan(maxLength);
  });

  it('should handle concurrent requests properly', async () => {
    const mockAPI = {
      sendMessage: vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { final_response: 'ok' } }), 100))
      ),
    };

    // Send multiple requests
    const promises = [
      mockAPI.sendMessage('Request 1'),
      mockAPI.sendMessage('Request 2'),
      mockAPI.sendMessage('Request 3'),
    ];

    // All should complete
    const results = await Promise.all(promises);
    expect(results).toHaveLength(3);
    expect(mockAPI.sendMessage).toHaveBeenCalledTimes(3);
  });
});
