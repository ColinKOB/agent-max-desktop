import axios from 'axios';
import axiosRetry from 'axios-retry';
import apiConfigManager from '../config/apiConfig';
import { handleError, parseApiError, ErrorCodes } from './errorHandler';
import { createLogger } from './logger';
import { toast } from 'react-hot-toast';

const logger = createLogger('API');

// DEMO MODE - Set to true to use mock data and disable API calls
const DEMO_MODE = false; // Backend is now running with safety endpoints

if (DEMO_MODE) {
  logger.info('🎨 Running in DEMO MODE - Using mock data instead of real API');
} else {
  logger.info('🔌 Connecting to Agent Max backend API...');
}

// Get initial configuration
const initialConfig = apiConfigManager.getConfig();
logger.info('Initial configuration', {
  baseURL: initialConfig.baseURL,
  hasApiKey: !!initialConfig.apiKey,
  environment: import.meta.env.MODE,
});

// API Base URL - dynamically configured
// CRITICAL: Always have a fallback to prevent undefined baseURL
let API_BASE_URL = initialConfig.baseURL || 'http://localhost:8000';

if (!initialConfig.baseURL) {
  logger.warn('apiConfigManager returned undefined baseURL, using fallback: http://localhost:8000');
}

// Auto-detect local backend and switch if reachable (fast non-blocking)
// This prevents the UI from silently using production API when local server is up.
(async () => {
  try {
    // Skip if already using localhost
    const isLocal = (API_BASE_URL || '').includes('localhost:8000') || (API_BASE_URL || '').includes('127.0.0.1:8000');
    if (isLocal) return;

    // Quick reachability check with 700ms timeout
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 700);
    const res = await fetch('http://localhost:8000/health', { signal: controller.signal });
    clearTimeout(t);
    if (res.ok) {
      reconfigureAPI('http://localhost:8000');
      logger.info('🔁 Switched API to local backend at http://localhost:8000');
      try { toast.success('Connected to local Agent Max API (localhost:8000)'); } catch {}
    }
  } catch (e) {
    // Ignore; stay on existing baseURL
    logger.debug('Local API not detected; staying on configured base URL');
  }
})();

// Connection state management
const connectionState = {
  isConnected: true,
  lastCheck: Date.now(),
  listeners: new Set(),
};

export const addConnectionListener = (callback) => {
  connectionState.listeners.add(callback);
  return () => connectionState.listeners.delete(callback);
};

let _lastOfflineToastAt = 0;
const notifyConnectionChange = (isConnected) => {
  if (connectionState.isConnected !== isConnected) {
    connectionState.isConnected = isConnected;
    connectionState.lastCheck = Date.now();
    connectionState.listeners.forEach((callback) => callback(isConnected));
  }
};

// Create axios instance with extended timeout
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds for AI responses
});

// Configure axios-retry for automatic retries
axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status >= 500) ||
      error.code === 'ECONNABORTED'
    );
  },
  onRetry: (retryCount, error, requestConfig) => {
    logger.warn(`Retry attempt ${retryCount}`, {
      url: requestConfig.url,
      method: requestConfig.method,
      error: error.message,
    });
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // No API key needed - backend uses server-side keys

    // Add request metadata
    config.metadata = {
      startTime: Date.now(),
      requestId: Math.random().toString(36).substr(2, 9),
    };

    // Log outgoing request
    logger.debug(`${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params,
      data: config.data,
    });

    return config;
  },
  (error) => {
    logger.error('Request interceptor error', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Success - mark as connected
    notifyConnectionChange(true);

    // Log response timing
    const duration = Date.now() - response.config.metadata?.startTime;
    const timer = logger.startTimer(
      `${response.config.method?.toUpperCase()} ${response.config.url}`
    );
    timer.end('completed');

    // Warn on slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        url: response.config.url,
        duration: `${duration}ms`,
      });
    }

    return response;
  },
  async (error) => {
    const { config } = error;

    // Parse error using centralized handler
    const appError = parseApiError(error);

    // Log error with context
    logger.error('API request failed', {
      url: config?.url,
      method: config?.method,
      status: error.response?.status,
      code: appError.code,
      message: appError.message,
      requestId: config?.metadata?.requestId,
    });

    // Update connection status
    if (!error.response) {
      logger.warn('Connection lost - no response from server');
      notifyConnectionChange(false);
    } else {
      notifyConnectionChange(true);
    }

    // Handle specific error cases
    if (error.response?.status === 401) {
      handleError(appError, 'API', {
        severity: 'high',
        showToast: true,
        fallbackMessage: 'Authentication failed. Please sign in again.',
      });
      // Trigger re-authentication if needed
      window.dispatchEvent(new CustomEvent('auth:expired'));
    } else if (error.response?.status === 403) {
      handleError(appError, 'API', {
        severity: 'medium',
        showToast: true,
        fallbackMessage: 'You do not have permission to perform this action.',
      });
    } else if (error.response?.status === 429) {
      // Rate limiting
      const retryAfter = error.response.headers['retry-after'];
      handleError(appError, 'API', {
        severity: 'medium',
        showToast: true,
        fallbackMessage: `Rate limit exceeded. Please try again in ${retryAfter || '60'} seconds.`,
      });
    } else if (!error.response) {
      // Network error -> no user toast; UI shows a dedicated reconnect pill.
      const now = Date.now();
      const shouldNote = connectionState.isConnected || (now - _lastOfflineToastAt > 10000);
      if (shouldNote) {
        _lastOfflineToastAt = now;
        handleError(appError, 'API', {
          severity: 'high',
          showToast: false, // use sleek reconnect pill instead of toast
          fallbackMessage: 'Disconnected from Agent Max. Reconnecting…',
        });
      } else {
        logger.debug('Suppressed offline note (throttled)');
      }
    }

    return Promise.reject(appError);
  }
);

// ============================================
// PROFILE API
// ============================================
export const profileAPI = {
  getProfile: () => api.get('/api/v2/profile'),
  getGreeting: () => api.get('/api/v2/profile/greeting'),
  setName: (name) => api.post('/api/v2/profile/name', { name }),
  getName: () => api.get('/api/v2/profile/name'),
  getContext: (goal = null) => api.get('/api/v2/profile/context', { params: { goal } }),
  getInsights: () => api.get('/api/v2/profile/insights'),
};

// ============================================
// FACTS API
// ============================================
export const factsAPI = {
  extractFacts: (message, goal = null) => api.post('/api/v2/facts/extract', { message, goal }),
  getFacts: (category = null, goal = null) =>
    api.get('/api/v2/facts', { params: { category, goal } }),
  setFact: (category, key, value) => api.put(`/api/v2/facts/${category}/${key}`, { value }),
  deleteFact: (category, key) => api.delete(`/api/v2/facts/${category}/${key}`),
  getSummary: () => api.get('/api/v2/facts/summary'),
};

// ============================================
// SEMANTIC API
// ============================================
export const semanticAPI = {
  findSimilar: (goal, threshold = 0.75, limit = 5) =>
    api.post('/api/v2/semantic/similar', { goal, threshold, limit }),
  getEmbedding: (text) => api.post('/api/v2/semantic/embedding', { text }),
  getPatterns: () => api.get('/api/v2/semantic/patterns'),
  getCacheStats: () => api.get('/api/v2/semantic/cache/stats'),
};

// ============================================
// CONVERSATION API
// ============================================
export const conversationAPI = {
  addMessage: (role, content, sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.post('/api/v2/conversation/message', { role, content }, { headers });
  },

  getContext: (lastN = 5, sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.get('/api/v2/conversation/context', {
      params: { last_n: lastN },
      headers,
    });
  },

  addTask: (task, sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.post('/api/v2/conversation/task', { action: 'add', task }, { headers });
  },

  completeTask: (task, sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.post('/api/v2/conversation/task', { action: 'complete', task }, { headers });
  },

  getTasks: (sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.get('/api/v2/conversation/tasks', { headers });
  },

  clearConversation: (sessionId = null) =>
    api.delete('/api/v2/conversation', {
      params: { session_id: sessionId },
    }),

  // NEW: Conversation History
  getHistory: (limit = 10, offset = 0) =>
    api.get('/api/v2/conversation/history', {
      params: { limit, offset },
    }),

  getConversationById: (conversationId) =>
    api.get(`/api/v2/conversation/history/${conversationId}`),
};

// ============================================
// PREFERENCES API
// ============================================
export const preferencesAPI = {
  getPreferences: () => api.get('/api/v2/preferences'),

  analyzePreferences: (steps, goal, success) =>
    api.post('/api/v2/preferences/analyze', { steps, goal, success }),

  setPreference: (key, value) => api.put(`/api/v2/preferences/${key}`, { value }),

  getPreference: (key, defaultValue = null) =>
    api.get(`/api/v2/preferences/${key}`, {
      params: { default: defaultValue },
    }),

  deletePreference: (key) => api.delete(`/api/v2/preferences/${key}`),
};

// ============================================
// CHAT API (Full Autonomous - Can Execute Commands)
// ============================================
export const chatAPI = {
  sendMessage: (message, userContext = null, image = null) => {
    const payload = {
      goal: message, // Autonomous API uses "goal" not "message"
      user_context: userContext,
      max_steps: 10,
      timeout: 300, // 5 minutes max execution time
    };

    // Add image if provided (base64 encoded)
    if (image) {
      payload.image = image;
    }

    // Use AUTONOMOUS endpoint - has full capabilities!
    return api.post('/api/v2/autonomous/execute', payload, {
      timeout: 310000, // 310 seconds (slightly more than backend timeout)
    });
  },

  sendMessageStream: async (message, userContext = null, image = null, onEvent) => {
    // Use NEW consolidated streaming endpoint with router optimizations
    // This handles both quick questions (deterministic tools, <100ms) and complex tasks
    const payload = {
      message: message,  // streaming chat uses "message" not "goal"
      context: userContext,  // renamed from user_context for consistency
      max_tokens: 1024,
      temperature: 0.7,
      stream: true,
      memory_mode: 'auto',  // auto-detect whether to use context
    };

    if (image) {
      payload.image = image;
    }

    // Get base URL
    const cfg = apiConfigManager.getConfig();
    const baseURL = cfg.baseURL || API_BASE_URL || 'http://localhost:8000';

    // Use NEW fast streaming endpoint with router (deterministic tools + progressive context)
    const response = await fetch(`${baseURL}/api/v2/chat/streaming/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dev',  // dev mode key
        'X-User-Id': localStorage.getItem('user_id') || 'anonymous'
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.error || errorMessage;
      } catch (e) {
        // Response might not be JSON
        try {
          errorMessage = (await response.text()) || errorMessage;
        } catch (e2) {
          // Use default message
        }
      }
      throw new Error(errorMessage);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const eventType = line.substring(6).trim();
          continue;
        }

        if (line.startsWith('data:')) {
          const data = line.substring(5).trim();
          // Ignore non-JSON markers like [DONE]
          if (!data || data === '[DONE]') continue;
          // Best-effort: only parse JSON objects/arrays
          const firstChar = data[0];
          if (firstChar !== '{' && firstChar !== '[') continue;
          try {
            const parsed = JSON.parse(data);
            onEvent(parsed);
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  },
};

// ============================================
// GOOGLE SERVICES API
// ============================================
export const googleAPI = {
  // Connection status
  getStatus: (email = null) => api.get('/api/v2/google/status', { params: email ? { email } : {} }),

  // Gmail
  listMessages: (maxResults = 10, query = '') => {
    const email = localStorage.getItem('google_user_email');
    return api.get('/api/v2/google/messages', {
      params: { email, max_results: maxResults, q: query },
    });
  },

  getMessage: (messageId) => {
    const email = localStorage.getItem('google_user_email');
    return api.get(`/api/v2/google/message/${messageId}`, { params: { email } });
  },

  sendEmail: (to, subject, body) => {
    const email = localStorage.getItem('google_user_email');
    return api.post('/api/v2/google/send', { to, subject, body }, { params: { email } });
  },

  markAsRead: (messageId) => {
    const email = localStorage.getItem('google_user_email');
    return api.post(`/api/v2/google/mark-read/${messageId}`, null, { params: { email } });
  },

  archiveMessage: (messageId) => {
    const email = localStorage.getItem('google_user_email');
    return api.post(`/api/v2/google/archive/${messageId}`, null, { params: { email } });
  },

  // Calendar
  listEvents: (maxResults = 10) => {
    const email = localStorage.getItem('google_user_email');
    return api.get('/api/v2/google/calendar/events', {
      params: { email, max_results: maxResults },
    });
  },

  createEvent: (summary, startTime, endTime, description = '') => {
    const email = localStorage.getItem('google_user_email');
    return api.post(
      '/api/v2/google/calendar/events',
      { summary, start_time: startTime, end_time: endTime, description },
      { params: { email } }
    );
  },

  // YouTube
  searchYouTube: (query, maxResults = 10) =>
    api.get('/api/v2/google/youtube/search', {
      params: { q: query, max_results: maxResults },
    }),

  // Sheets
  readSheet: (spreadsheetId, range = 'A1:Z100') => {
    const email = localStorage.getItem('google_user_email');
    return api.get(`/api/v2/google/sheets/${spreadsheetId}/range`, {
      params: { email, range_name: range },
    });
  },

  // Docs
  getDocument: (documentId) => {
    const email = localStorage.getItem('google_user_email');
    return api.get(`/api/v2/google/docs/${documentId}`, { params: { email } });
  },
};

// ============================================
// TELEMETRY API
// ============================================
export const telemetryAPI = {
  sendBatch: (events) =>
    api.post('/api/v2/telemetry/batch', {
      events,
      userId: localStorage.getItem('user_id') || 'anonymous',
      sessionId: localStorage.getItem('session_id') || Date.now().toString(),
      timestamp: Date.now(),
    }),

  trackInteraction: (action, metadata = {}) =>
    api.post('/api/v2/telemetry/batch', {
      events: [
        {
          type: 'interaction',
          action,
          metadata,
          timestamp: Date.now(),
        },
      ],
      userId: localStorage.getItem('user_id') || 'anonymous',
      sessionId: localStorage.getItem('session_id') || Date.now().toString(),
    }),

  trackError: (error, context = {}) =>
    api.post('/api/v2/telemetry/batch', {
      events: [
        {
          type: 'error',
          error: error.message || error,
          stack: error.stack,
          context,
          timestamp: Date.now(),
        },
      ],
      userId: localStorage.getItem('user_id') || 'anonymous',
      sessionId: localStorage.getItem('session_id') || Date.now().toString(),
    }),

  getStats: () => api.get('/api/v2/telemetry/stats'),

  getInteractions: (limit = 100) =>
    api.get('/api/v2/telemetry/interactions', { params: { limit } }),
};

// ============================================
// SCREEN CONTROL API
// ============================================
export const screenAPI = {
  getCapabilities: () => api.get('/api/v2/screen/capabilities'),
  getInfo: () => api.get('/api/v2/screen/info'),
  getStatus: () => api.get('/api/v2/screen/status'),

  click: (x, y, button = 'left', clicks = 1) =>
    api.post('/api/v2/screen/click', { x, y, button, clicks }),

  clickText: (text, clicks = 1) => api.post('/api/v2/screen/click-text', { text, clicks }),

  clickElement: (description, clicks = 1) =>
    api.post('/api/v2/screen/click-element', { description, clicks }),

  typeText: (text, clear_first = false) => api.post('/api/v2/screen/type', { text, clear_first }),

  pressKey: (keys) => api.post('/api/v2/screen/press-key', { keys }),

  scroll: (direction = 'down', amount = 3) =>
    api.post('/api/v2/screen/scroll', { direction, amount }),

  takeScreenshot: (save_name = null) => api.post('/api/v2/screen/screenshot', { save_name }),
};

// ============================================
// AGENTS API
// ============================================
export const agentsAPI = {
  listProviders: () => api.get('/api/v2/agents/providers'),
  listRoles: () => api.get('/api/v2/agents/roles'),

  createAgent: (role, provider = null, apiKeys = null) =>
    api.post('/api/v2/agents/create', { role, provider, api_keys: apiKeys }),

  delegateTask: (agentId, task, context = null) =>
    api.post('/api/v2/agents/delegate', { agent_id: agentId, task, context }),

  listAgents: () => api.get('/api/v2/agents/list'),

  deleteAgent: (agentId) => api.delete(`/api/v2/agents/${agentId}`),
};

// ============================================
// CREDITS MANAGEMENT
// ============================================
export const creditsAPI = {
  // Get current credit balance
  getBalance: (userId) => api.get(`/api/v2/credits/balance/${userId}`),

  // Create Stripe checkout session for purchasing credits
  createCheckout: (packageType, userId, successUrl, cancelUrl) =>
    api.post('/api/v2/credits/checkout', {
      package: packageType,
      user_id: userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),

  // List available credit packages
  getPackages: () => api.get('/api/v2/credits/packages'),

  // Deduct credits (usually called by backend, but available)
  deductCredits: (userId, amount = 1) =>
    api.post(`/api/v2/credits/deduct/${userId}`, null, {
      params: { amount },
    }),
};

// ============================================
// PERMISSION LEVELS & SAFETY
// ============================================
export const permissionAPI = {
  // Internal: try multiple paths, falling back on 404
  _tryPaths: async (method, paths, payload = null, options = {}) => {
    let lastErr;
    for (const p of paths) {
      try {
        if (method === 'get') return await api.get(p, options);
        if (method === 'post') return await api.post(p, payload, options);
        if (method === 'put') return await api.put(p, payload, options);
        if (method === 'delete') return await api.delete(p, options);
        throw new Error(`Unsupported method ${method}`);
      } catch (err) {
        // Check status in both raw error and AppError wrapper
        const status = err?.response?.status || err?.status || err?.statusCode;
        if (status === 404) {
          lastErr = err;
          logger.debug(`Path ${p} returned 404, trying next fallback...`);
          continue; // try next path
        }
        throw err;
      }
    }
    throw lastErr || new Error('All endpoint paths failed');
  },
  /**
   * Get current user's permission level
   * @returns {Promise<{permission_level: string, name: string, description: string, capabilities: object}>}
   */
  getLevel: () => 
    DEMO_MODE
      ? Promise.resolve({
          permission_level: 'helpful',
          name: 'Helpful (Standard)',
          description: 'Balanced productivity mode',
          capabilities: {
            can_do: ['Write code', 'Run scripts'],
            requires_approval: ['Send emails', 'Delete files']
          }
        })
      : permissionAPI._tryPaths('get', ['/api/safety/permission-level', '/api/v2/safety/permission-level']),

  /**
   * Update user's permission level
   * @param {string} level - 'chatty', 'helpful', or 'powerful'
   * @returns {Promise<{success: boolean, permission_level: string, message: string}>}
   */
  updateLevel: (level) =>
    DEMO_MODE
      ? Promise.resolve({ success: true, permission_level: level, message: 'Updated' })
      : permissionAPI._tryPaths('post', ['/api/safety/permission-level', '/api/v2/safety/permission-level'], { permission_level: level }),

  /**
   * Check if action requires approval
   * @param {string} message - The action/message to check
   * @param {object} context - Optional context
   * @returns {Promise<object>} Safety check results
   */
  check: (message, context = {}) =>
    DEMO_MODE
      ? Promise.resolve({
          allowed: true,
          requires_approval: false,
          permission_level: 'helpful',
          markers: [],
          reason: 'Demo mode',
          suggested_flow: null,
          draft_supported: false,
          is_high_risk: false
        })
      : permissionAPI._tryPaths('post', ['/api/safety/check', '/api/v2/safety/check'], { message, context }),

  /**
   * Get activity log
   * @param {string} filter - 'all', 'approvals', 'high_risk', or 'communications'
   * @param {number} limit - Number of entries to return
   * @returns {Promise<{activities: array, total: number, page: number}>}
   */
  getActivityLog: (filter = 'all', limit = 50) =>
    DEMO_MODE
      ? Promise.resolve({ activities: [], total: 0, page: 1 })
      : permissionAPI._tryPaths('get', ['/api/safety/activity-log', '/api/v2/safety/activity-log'], null, { params: { filter, limit } }),

  /**
   * Log an activity (internal use)
   * @param {object} activity - Activity details
   * @returns {Promise<{success: boolean, activity_id: string}>}
   */
  logActivity: (activity) =>
    DEMO_MODE
      ? Promise.resolve({ success: true, activity_id: 'demo_123' })
      : permissionAPI._tryPaths('post', ['/api/safety/log-activity', '/api/v2/safety/log-activity'], activity),
};

// ============================================
// AMBIGUITY DETECTION API
// ============================================
export const ambiguityAPI = {
  /**
   * Check if a message is ambiguous and needs a screenshot
   * Uses GPT-4o-mini for intelligent classification
   * @param {string} message - The user's message
   * @param {number} wordThreshold - Only classify messages with more than this many words (default: 5)
   * @returns {Promise<{needs_screenshot: boolean, reason: string, latency_ms: number, word_count: number, confidence: number}>}
   */
  checkAmbiguity: (message, wordThreshold = 5) =>
    DEMO_MODE
      ? Promise.resolve({ 
          needs_screenshot: false, 
          reason: 'none',
          latency_ms: 0,
          word_count: message.split(' ').length,
          confidence: 1.0
        })
      : api.post('/api/ambiguity/check', { message, word_threshold: wordThreshold })
          .then(response => response.data),  // Extract data from axios response
};

// ============================================
// DRAFTS MANAGEMENT
// ============================================
export const draftsAPI = {
  /**
   * Create email draft
   * @param {object} draft - Email draft details
   * @returns {Promise<{draft_id: string, created_at: string, preview: object}>}
   */
  createEmail: (draft) =>
    DEMO_MODE
      ? Promise.resolve({
          draft_id: 'draft_demo123',
          created_at: new Date().toISOString(),
          preview: { to: draft.to, subject: draft.subject }
        })
      : api.post('/api/drafts/email', draft),

  /**
   * List all drafts
   * @returns {Promise<{drafts: array}>}
   */
  list: () =>
    DEMO_MODE
      ? Promise.resolve({ drafts: [] })
      : api.get('/api/drafts'),

  /**
   * Get draft details
   * @param {string} draftId - Draft ID
   * @returns {Promise<object>} Draft details
   */
  get: (draftId) =>
    DEMO_MODE
      ? Promise.resolve({ draft_id: draftId, type: 'email', status: 'pending' })
      : api.get(`/api/drafts/${draftId}`),

  /**
   * Send draft
   * @param {string} draftId - Draft ID
   * @returns {Promise<{success: boolean, sent_at: string, message: string}>}
   */
  send: (draftId) =>
    DEMO_MODE
      ? Promise.resolve({ success: true, sent_at: new Date().toISOString(), message: 'Sent' })
      : api.post(`/api/drafts/${draftId}/send`),

  /**
   * Delete draft
   * @param {string} draftId - Draft ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  delete: (draftId) =>
    DEMO_MODE
      ? Promise.resolve({ success: true, message: 'Deleted' })
      : api.delete(`/api/drafts/${draftId}`),
};

// ============================================
// HEALTH CHECK
// ============================================
export const healthAPI = {
  // Disable axios-retry for health pings to reduce duplicate logs while offline
  check: () => api.get('/health', { 'axios-retry': { retries: 0 } }),
};

// Export API URL for use in other modules
export { API_BASE_URL };

/**
 * Reconfigure the axios instance with new base URL
 * Called when user updates settings
 */
export const reconfigureAPI = (newBaseURL) => {
  logger.info('Reconfiguring with new base URL', { newBaseURL });

  // Update config manager
  apiConfigManager.updateConfig(newBaseURL);

  // Update axios instance
  api.defaults.baseURL = newBaseURL;
  API_BASE_URL = newBaseURL;

  logger.info('Reconfiguration complete');
  toast.success('API configuration updated');
};

// Listen for config changes from other sources
apiConfigManager.onChange((config) => {
  logger.info('Config changed externally, updating axios instance', config);
  api.defaults.baseURL = config.baseURL;
  API_BASE_URL = config.baseURL;
});

export default api;
