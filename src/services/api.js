import axios from 'axios';

// API Base URL - connects to the existing FastAPI server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Debug logging
console.log('[API] Base URL:', API_BASE_URL);

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
    const apiKey = localStorage.getItem('api_key');
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
// CHAT API
// ============================================
export const chatAPI = {
  sendMessage: (message, userContext = null, image = null) => {
    const payload = {
      message,
      include_context: true,
      user_context: userContext,
    };
    
    // Add image if provided (base64 encoded)
    if (image) {
      payload.image = image;
    }
    
    return api.post('/api/chat/message', payload, {
      timeout: 90000, // 90 seconds for vision API
    });
  },
};

// ============================================
// HEALTH CHECK
// ============================================
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
