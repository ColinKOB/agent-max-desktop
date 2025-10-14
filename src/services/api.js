import axios from 'axios';
import axiosRetry from 'axios-retry';
import apiConfigManager from '../config/apiConfig';
import { handleError, parseApiError, ErrorCodes } from './errorHandler';
import { createLogger } from './logger';
import { toast } from 'react-hot-toast';

const logger = createLogger('API');
logger.info('Initializing with config manager...');

// Get initial configuration
const initialConfig = apiConfigManager.getConfig();
logger.info('Initial configuration', {
  baseURL: initialConfig.baseURL,
  hasApiKey: !!initialConfig.apiKey,
  environment: import.meta.env.MODE,
});

// API Base URL - dynamically configured
let API_BASE_URL = initialConfig.baseURL;

// Connection state management
let connectionState = {
  isConnected: true,
  lastCheck: Date.now(),
  listeners: new Set(),
};

export const addConnectionListener = (callback) => {
  connectionState.listeners.add(callback);
  return () => connectionState.listeners.delete(callback);
};

const notifyConnectionChange = (isConnected) => {
  if (connectionState.isConnected !== isConnected) {
    connectionState.isConnected = isConnected;
    connectionState.lastCheck = Date.now();
    connectionState.listeners.forEach(callback => callback(isConnected));
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
      error: error.message
    });
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Get API key from config manager
    const apiKey = apiConfigManager.getApiKey();
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
    
    // Add request metadata
    config.metadata = { 
      startTime: Date.now(),
      requestId: Math.random().toString(36).substr(2, 9)
    };
    
    // Log outgoing request
    logger.debug(`${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params,
      data: config.data
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
    const timer = logger.startTimer(`${response.config.method?.toUpperCase()} ${response.config.url}`);
    timer.end('completed');
    
    // Warn on slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        url: response.config.url,
        duration: `${duration}ms`
      });
    }
    
    return response;
  },
  async (error) => {
    const config = error.config;
    
    // Parse error using centralized handler
    const appError = parseApiError(error);
    
    // Log error with context
    logger.error('API request failed', {
      url: config?.url,
      method: config?.method,
      status: error.response?.status,
      code: appError.code,
      message: appError.message,
      requestId: config?.metadata?.requestId
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
        fallbackMessage: 'Authentication failed. Please sign in again.'
      });
      // Trigger re-authentication if needed
      window.dispatchEvent(new CustomEvent('auth:expired'));
    } else if (error.response?.status === 403) {
      handleError(appError, 'API', {
        severity: 'medium',
        showToast: true,
        fallbackMessage: 'You do not have permission to perform this action.'
      });
    } else if (error.response?.status === 429) {
      // Rate limiting
      const retryAfter = error.response.headers['retry-after'];
      handleError(appError, 'API', {
        severity: 'medium',
        showToast: true,
        fallbackMessage: `Rate limit exceeded. Please try again in ${retryAfter || '60'} seconds.`
      });
    } else if (!error.response) {
      // Network error
      handleError(appError, 'API', {
        severity: 'high',
        showToast: true,
        fallbackMessage: 'Cannot connect to server. Please check your internet connection.'
      });
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
  getContext: (goal = null) => 
    api.get('/api/v2/profile/context', { params: { goal } }),
  getInsights: () => api.get('/api/v2/profile/insights'),
};

// ============================================
// FACTS API
// ============================================
export const factsAPI = {
  extractFacts: (message, goal = null) =>
    api.post('/api/v2/facts/extract', { message, goal }),
  getFacts: (category = null, goal = null) =>
    api.get('/api/v2/facts', { params: { category, goal } }),
  setFact: (category, key, value) =>
    api.put(`/api/v2/facts/${category}/${key}`, { value }),
  deleteFact: (category, key) =>
    api.delete(`/api/v2/facts/${category}/${key}`),
  getSummary: () => api.get('/api/v2/facts/summary'),
};

// ============================================
// SEMANTIC API
// ============================================
export const semanticAPI = {
  findSimilar: (goal, threshold = 0.75, limit = 5) =>
    api.post('/api/v2/semantic/similar', { goal, threshold, limit }),
  getEmbedding: (text) =>
    api.post('/api/v2/semantic/embedding', { text }),
  getPatterns: () => api.get('/api/v2/semantic/patterns'),
  getCacheStats: () => api.get('/api/v2/semantic/cache/stats'),
};

// ============================================
// CONVERSATION API
// ============================================
export const conversationAPI = {
  addMessage: (role, content, sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.post('/api/v2/conversation/message', 
      { role, content }, 
      { headers }
    );
  },
  
  getContext: (lastN = 5, sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.get('/api/v2/conversation/context', { 
      params: { last_n: lastN },
      headers 
    });
  },
  
  addTask: (task, sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.post('/api/v2/conversation/task', 
      { action: 'add', task }, 
      { headers }
    );
  },
  
  completeTask: (task, sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.post('/api/v2/conversation/task',
      { action: 'complete', task },
      { headers }
    );
  },
  
  getTasks: (sessionId = null) => {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {};
    return api.get('/api/v2/conversation/tasks', { headers });
  },
  
  clearConversation: (sessionId = null) =>
    api.delete('/api/v2/conversation', { 
      params: { session_id: sessionId } 
    }),
  
  // NEW: Conversation History
  getHistory: (limit = 10, offset = 0) =>
    api.get('/api/v2/conversation/history', {
      params: { limit, offset }
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
  
  setPreference: (key, value) =>
    api.put(`/api/v2/preferences/${key}`, { value }),
  
  getPreference: (key, defaultValue = null) =>
    api.get(`/api/v2/preferences/${key}`, { 
      params: { default: defaultValue } 
    }),
  
  deletePreference: (key) =>
    api.delete(`/api/v2/preferences/${key}`),
};

// ============================================
// CHAT API (Full Autonomous - Can Execute Commands)
// ============================================
export const chatAPI = {
  sendMessage: (message, userContext = null, image = null) => {
    const payload = {
      goal: message,  // Autonomous API uses "goal" not "message"
      user_context: userContext,
      max_steps: 10,
      timeout: 300,  // 5 minutes max execution time
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
    const payload = {
      goal: message,
      user_context: userContext,
      max_steps: 10,
      timeout: 300,
    };
    
    if (image) {
      payload.image = image;
    }
    
    // Get API key
    const apiKey = apiConfigManager.getApiKey();
    const baseURL = apiConfigManager.getConfig().baseURL;
    
    // Use fetch for SSE streaming
    const response = await fetch(`${baseURL}/api/v2/autonomous/execute/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey || '',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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
          if (data) {
            try {
              const parsed = JSON.parse(data);
              onEvent(parsed);
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
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
  getStatus: (email = null) =>
    api.get('/api/v2/google/status', { params: email ? { email } : {} }),
  
  // Gmail
  listMessages: (maxResults = 10, query = '') => {
    const email = localStorage.getItem('google_user_email');
    return api.get('/api/v2/google/messages', { 
      params: { email, max_results: maxResults, q: query } 
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
      params: { email, max_results: maxResults } 
    });
  },
  
  createEvent: (summary, startTime, endTime, description = '') => {
    const email = localStorage.getItem('google_user_email');
    return api.post('/api/v2/google/calendar/events', 
      { summary, start_time: startTime, end_time: endTime, description },
      { params: { email } }
    );
  },
  
  // YouTube
  searchYouTube: (query, maxResults = 10) =>
    api.get('/api/v2/google/youtube/search', { 
      params: { q: query, max_results: maxResults } 
    }),
  
  // Sheets
  readSheet: (spreadsheetId, range = 'A1:Z100') => {
    const email = localStorage.getItem('google_user_email');
    return api.get(`/api/v2/google/sheets/${spreadsheetId}/range`, 
      { params: { email, range_name: range } }
    );
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
      timestamp: Date.now() 
    }),
  
  trackInteraction: (action, metadata = {}) =>
    api.post('/api/v2/telemetry/batch', {
      events: [{
        type: 'interaction',
        action,
        metadata,
        timestamp: Date.now()
      }],
      userId: localStorage.getItem('user_id') || 'anonymous',
      sessionId: localStorage.getItem('session_id') || Date.now().toString(),
    }),
  
  trackError: (error, context = {}) =>
    api.post('/api/v2/telemetry/batch', {
      events: [{
        type: 'error',
        error: error.message || error,
        stack: error.stack,
        context,
        timestamp: Date.now()
      }],
      userId: localStorage.getItem('user_id') || 'anonymous',
      sessionId: localStorage.getItem('session_id') || Date.now().toString(),
    }),
  
  getStats: () =>
    api.get('/api/v2/telemetry/stats'),
  
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
  
  clickText: (text, clicks = 1) =>
    api.post('/api/v2/screen/click-text', { text, clicks }),
  
  clickElement: (description, clicks = 1) =>
    api.post('/api/v2/screen/click-element', { description, clicks }),
  
  typeText: (text, clear_first = false) =>
    api.post('/api/v2/screen/type', { text, clear_first }),
  
  pressKey: (keys) =>
    api.post('/api/v2/screen/press-key', { keys }),
  
  scroll: (direction = 'down', amount = 3) =>
    api.post('/api/v2/screen/scroll', { direction, amount }),
  
  takeScreenshot: (save_name = null) =>
    api.post('/api/v2/screen/screenshot', { save_name }),
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
  
  deleteAgent: (agentId) =>
    api.delete(`/api/v2/agents/${agentId}`),
};

// ============================================
// HEALTH CHECK
// ============================================
export const healthAPI = {
  check: () => api.get('/health'),
};

// Export API URL for use in other modules
export { API_BASE_URL };

/**
 * Reconfigure the axios instance with new base URL
 * Called when user updates settings
 */
export const reconfigureAPI = (newBaseURL, newApiKey = null) => {
  logger.info('Reconfiguring with new base URL', { newBaseURL });
  
  // Update config manager
  apiConfigManager.updateConfig(newBaseURL, newApiKey);
  
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
