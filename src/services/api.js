import axios from 'axios';

// API Base URL - connects to the existing FastAPI server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const apiKey = localStorage.getItem('api_key');
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
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
// HEALTH CHECK
// ============================================
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
