import axios from 'axios';
import apiConfigManager from '../config/apiConfig';

console.log('[API] Initializing with config manager...');

// Get initial configuration
const initialConfig = apiConfigManager.getConfig();
console.log('[API] Initial configuration:', {
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

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Start with 1 second

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetry = (error) => {
  // Retry on network errors or 5xx server errors
  return (
    !error.response || 
    error.code === 'ECONNABORTED' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ENETUNREACH' ||
    (error.response && error.response.status >= 500)
  );
};

// Request interceptor with retry logic
api.interceptors.request.use(
  (config) => {
    // Get API key from config manager
    const apiKey = apiConfigManager.getApiKey();
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
    
    // Add retry metadata
    config.metadata = { 
      retryCount: 0,
      startTime: Date.now() 
    };
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with retry and connection status
api.interceptors.response.use(
  (response) => {
    // Success - mark as connected
    notifyConnectionChange(true);
    
    // Log request timing for monitoring
    const duration = Date.now() - response.config.metadata.startTime;
    if (duration > 5000) {
      console.warn(`Slow request: ${response.config.url} took ${duration}ms`);
    }
    
    return response;
  },
  async (error) => {
    const config = error.config;
    
    // Enhanced error logging FIRST
    console.error('API Error Details:', {
      url: config?.url,
      method: config?.method,
      baseURL: config?.baseURL,
      status: error.response?.status,
      statusText: error.response?.statusText,
      code: error.code,
      message: error.message,
      data: error.response?.data,
      headers: error.response?.headers,
    });
    
    // Check if we should retry
    if (config && shouldRetry(error) && config.metadata.retryCount < MAX_RETRIES) {
      config.metadata.retryCount += 1;
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = RETRY_DELAY * Math.pow(2, config.metadata.retryCount - 1);
      
      console.log(`[Retry ${config.metadata.retryCount}/${MAX_RETRIES}] ${config.url} after ${delay}ms...`);
      
      await sleep(delay);
      
      // Reset start time for retry
      config.metadata.startTime = Date.now();
      
      return api(config);
    }
    
    // Mark as disconnected if network error
    if (!error.response) {
      console.warn('[Connection] Marking as disconnected - no response from server');
      notifyConnectionChange(false);
    } else {
      // If we got a response, connection is working
      notifyConnectionChange(true);
    }
    
    return Promise.reject(error);
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
  console.log('[API] Reconfiguring with new base URL:', newBaseURL);
  
  // Update config manager
  apiConfigManager.updateConfig(newBaseURL, newApiKey);
  
  // Update axios instance
  api.defaults.baseURL = newBaseURL;
  API_BASE_URL = newBaseURL;
  
  console.log('[API] ✅ Reconfiguration complete');
};

// Listen for config changes from other sources
apiConfigManager.onChange((config) => {
  console.log('[API] Config changed externally, updating axios instance');
  api.defaults.baseURL = config.baseURL;
  API_BASE_URL = config.baseURL;
});

export default api;
