import axios from 'axios';
import axiosRetry from 'axios-retry';
import apiConfigManager from '../config/apiConfig';
import { handleError, parseApiError, ErrorCodes } from './errorHandler';
import { createLogger } from './logger';
import { toast } from 'react-hot-toast';
import telemetry from './telemetry';
import { healthAPI as libHealthAPI } from '@lib/api/health';

const logger = createLogger('API');

/**
 * Get the client's operating system for backend context
 * Returns 'Darwin' for macOS to match backend expectations
 */
function getSystemOS() {
  if (typeof window !== 'undefined' && window.electron?.process?.platform) {
    // Electron environment - use actual platform
    const platform = window.electron.process.platform;
    return platform === 'darwin' ? 'Darwin' : platform === 'win32' ? 'Windows' : 'Linux';
  }
  // Fallback to user agent parsing
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (ua.includes('Mac')) return 'Darwin';
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

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

// In production builds, never auto-switch to localhost
const envSetting = import.meta.env.VITE_ENVIRONMENT;
const isProdBuild = envSetting === 'production' || envSetting === 'beta' || (!import.meta.env.DEV && import.meta.env.MODE === 'production');

if (!isProdBuild) {
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
}

// Connection state management
const connectionState = {
  isConnected: true,
  lastCheck: Date.now(),
  listeners: new Set(),
};


// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================
export const subscriptionAPI = {
  // Get subscription status - try v2 first, fallback to v1
  getStatus: (email) =>
    api.get(`/api/subscription/status`, { params: { email } })
      .catch(() => api.get(`/api/v2/subscription/status`, { params: { email } })),

  // Create billing portal session
  createPortal: (email, returnUrl) =>
    api.post(`/api/subscription/billing-portal`, { email, return_url: returnUrl })
      .catch(() => api.post(`/api/v2/subscription/billing-portal`, { email, return_url: returnUrl })),

  // Cancel subscription
  cancel: (email) =>
    api.post(`/api/subscription/cancel`, null, { params: { email } })
      .catch(() => api.post(`/api/v2/subscription/cancel`, null, { params: { email } })),
  
  // Create checkout session (for proper checkout flow)
  createCheckout: (email, plan, successUrl, cancelUrl) =>
    api.post(`/api/subscription/create-checkout`, { 
      email, 
      plan, 
      success_url: successUrl, 
      cancel_url: cancelUrl 
    }),
  
  // Change plan (upgrade or downgrade)
  changePlan: (email, newPlan) =>
    api.post(`/api/subscription/change-plan`, { email, new_plan: newPlan }),
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

// Backend feature flags (e.g., Hands on Desktop)
const FEATURE_FLAG_TTL_MS = 5 * 60 * 1000; // 5 minutes
let backendFeatureFlags = null;
let lastFeatureFlagFetch = 0;
let handsOnDesktopEnabled = true; // Assume enabled until backend says otherwise

async function refreshBackendFeatureFlags(force = false) {
  const now = Date.now();
  if (!force && backendFeatureFlags && (now - lastFeatureFlagFetch) < FEATURE_FLAG_TTL_MS) {
    return backendFeatureFlags;
  }
  try {
    const { data } = await api.get('/api/v2/feature-flags', { timeout: 5000 });
    const flagMap = (data && data.flags && typeof data.flags === 'object') ? data.flags : (data || {});
    backendFeatureFlags = flagMap;
    if (typeof flagMap.hands_on_desktop === 'boolean') {
      handsOnDesktopEnabled = flagMap.hands_on_desktop;
    }
    lastFeatureFlagFetch = now;
  } catch (err) {
    lastFeatureFlagFetch = now;
    logger.warn('Failed to refresh backend feature flags', { error: err?.message });
  }
  return backendFeatureFlags;
}

export const isHandsOnDesktopEnabled = () => handsOnDesktopEnabled;
export const __testHooks = {
  // Test-only helpers to control HandsOnDesktop state deterministically
  setHandsOnDesktopEnabled(value) {
    handsOnDesktopEnabled = !!value;
  },
  resetHandsOnDesktopState() {
    backendFeatureFlags = null;
    lastFeatureFlagFetch = 0;
    handsOnDesktopEnabled = true;
  },
};

async function getDesktopBridgeStatus() {
  try {
    if (typeof window === 'undefined') return null;
    if (!window?.electron?.handsOnDesktop?.status) return null;
    const status = await window.electron.handsOnDesktop.status();
    return status || null;
  } catch (err) {
    logger.warn('[API] Failed to fetch hands-on-desktop status', { error: err?.message });
    return null;
  }
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add API key if available
    const apiKey = apiConfigManager.getApiKey();
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }

    // Add user ID if available
    const userId = localStorage.getItem('user_id');
    if (userId) {
      config.headers['X-User-Id'] = userId;
    }

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
      try {
        telemetry.logEvent('api.slow_request', {
          url: response.config.url,
          method: response.config.method,
          duration_ms: duration,
          baseURL: api.defaults.baseURL,
        });
      } catch {}
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
    } else if (error.response?.status === 402) {
      // Payment Required / Insufficient Credits
      const detail = error.response?.data?.detail || {};
      const isInsufficientCredits = detail?.error === 'insufficient_credits' || 
                                     error.response?.data?.error === 'insufficient_credits';
      const creditsRemaining = detail?.credits_remaining ?? 0;
      const message = detail?.message || 'Insufficient credits. Please purchase more to continue.';
      
      logger.warn('Insufficient credits', { creditsRemaining, message });
      
      // Show prominent toast with action
      toast.error(
        (t) => (
          `💳 ${message}\n\nClick to purchase credits.`
        ),
        {
          duration: 8000,
          onClick: () => {
            // Open settings window (don't navigate current window)
            const openSettings = window.electron?.openSettings || window.electronAPI?.openSettings;
            if (openSettings) {
              openSettings({ route: '#/settings?section=credits' });
            } else {
              // Web fallback only
              window.location.hash = '#/settings?section=credits';
            }
          },
          style: {
            cursor: 'pointer',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }
        }
      );
      
      // Dispatch event for components to handle
      window.dispatchEvent(new CustomEvent('credits:insufficient', { 
        detail: { creditsRemaining, message } 
      }));
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
  getName: () => api.get('/api/v2/profile/name').then(res => ({
    name: res.data.user_name || res.data.name,
    is_set: res.data.is_set
  })),
  getContext: (goal = null) => api.get('/api/v2/profile/context', { params: { goal } }),
  getInsights: () => api.get('/api/v2/profile/insights'),
};

// ============================================
// FACTS API
// ============================================
export const factsAPI = {
  extractFacts: (message, goal = null) => 
    api.post('/api/v2/facts/extract', { message, goal }).then(res => ({
      facts: res.data.extracted_facts || res.data.facts || [],
      count: res.data.count || (res.data.facts || []).length
    })),
  getFacts: (category = null, goal = null) =>
    api.get('/api/v2/facts', { params: { category, goal } }).then(res => {
      // Handle both array and object responses
      if (res.data.facts) return res.data.facts;
      if (Array.isArray(res.data)) return res.data;
      return [];
    }),
  setFact: (category, key, value) => api.put(`/api/v2/facts/${category}/${key}`, { value }),
  deleteFact: (category, key) => api.delete(`/api/v2/facts/${category}/${key}`),
  getSummary: () => api.get('/api/v2/facts/summary'),
};

// ============================================
// SEMANTIC API
// ============================================
export const semanticAPI = {
  findSimilar: (goal, threshold = 0.75, limit = 5) =>
    api.post('/api/v2/semantic/similar', { goal, threshold, limit }).then(res => {
      // Handle both array and object responses
      if (res.data.similar_goals) {
        return {
          goals: res.data.similar_goals,
          count: res.data.count
        };
      }
      if (Array.isArray(res.data)) return { goals: res.data, count: res.data.length };
      return { goals: [], count: 0 };
    }),
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
    }).then(res => {
      // Handle paginated response format
      if (res.data.conversations) {
        return {
          conversations: res.data.conversations,
          total: res.data.total,
          hasMore: res.data.has_more
        };
      }
      return res.data;
    }),

  getConversationById: (conversationId) =>
    api.get(`/api/v2/conversation/history/${conversationId}`),
};

// ============================================
// PREFERENCES API
// ============================================
export const preferencesAPI = {
  getPreferences: () => api.get('/api/v2/preferences').then(res => {
    // Handle both nested and flat responses
    if (res.data.preferences) return res.data.preferences;
    return res.data;
  }),

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
  sendMessageStream: async (message, userContext = null, image = null, onEvent) => {
    // Get base URL
    const cfg = apiConfigManager.getConfig();
    const baseURL = cfg.baseURL || API_BASE_URL || 'http://localhost:8000';

    // Derive mode from user context or localStorage
    // ONLY TWO MODES: chatty (read-only) and autonomous (full access)
    let requestedMode = 'chatty';
    try {
      const rawMode = (userContext && userContext.__mode) || localStorage.getItem('permission_level') || 'chatty';

      // Validate mode - must be chatty or autonomous
      if (rawMode === 'chatty' || rawMode === 'autonomous') {
        requestedMode = rawMode;
      } else {
        console.error(`[Mode] Invalid mode '${rawMode}' - must be 'chatty' or 'autonomous'. Defaulting to 'chatty'`);
        requestedMode = 'chatty';
      }
    } catch (_) {
      requestedMode = 'chatty';
    }

    // Runtime flag: allow disabling legacy fallbacks to surface drift
    const disableLegacyFallbacks = (() => {
      // Default behavior: in production builds, disable legacy fallbacks
      let defaultValue = isProdBuild ? true : false;
      try {
        const v = localStorage.getItem('disable_legacy_fallbacks');
        if (v === '1' || v === 'true') return true;
        if (v === '0' || v === 'false') return false;
      } catch {}
      try {
        const env = import.meta.env.VITE_DISABLE_LEGACY_FALLBACKS;
        if (env === 'true') return true;
        if (env === 'false') return false;
      } catch {}
      return defaultValue;
    })();

    // CRITICAL: Use chat streaming endpoint for all modes
    // The chat streaming endpoint handles mode internally via the 'mode' field in payload
    // The old /api/v2/agent/execute/stream and /api/v2/autonomous/execute/stream are deprecated
    // and return 404/410 respectively.
    const isAutonomous = requestedMode === 'autonomous';
    const endpoints = disableLegacyFallbacks
      ? [ `${baseURL}/api/v2/chat/streaming/stream` ]
      : [
          `${baseURL}/api/v2/chat/streaming/stream`,
          `${baseURL}/api/chat/streaming/stream`,
          `${baseURL}/api/v2/chat/stream`,
          `${baseURL}/api/chat/stream`,
          `${baseURL}/api/v2/chat/streaming`,
          `${baseURL}/api/chat/streaming`
        ];

    // Build payload based on endpoint
    // Temporary mitigation: pre-truncate very long chat messages to avoid backend 422 limit
    const MAX_MESSAGE_LEN = 4000;
    const shouldTruncate = !isAutonomous && typeof message === 'string' && message.length > MAX_MESSAGE_LEN;
    const truncatedMessage = shouldTruncate
      ? `${message.slice(0, MAX_MESSAGE_LEN)}\n\n[Note: Input truncated to ${MAX_MESSAGE_LEN} chars]`
      : message;

    let useHandsOnDesktop = handsOnDesktopEnabled;
    let desktopBridgeStatus = null;
    if (isAutonomous) {
      try {
        await refreshBackendFeatureFlags();
        useHandsOnDesktop = handsOnDesktopEnabled;
      } catch (err) {
        logger.warn('Falling back to hands-on-desktop default (true)', { error: err?.message });
      }
      desktopBridgeStatus = await getDesktopBridgeStatus();
      if (desktopBridgeStatus && desktopBridgeStatus.connected === false) {
        useHandsOnDesktop = false;
      }
    }

    const desktopFlagPayload = {
      server_fs: !useHandsOnDesktop,
    };
    if (desktopBridgeStatus && typeof desktopBridgeStatus.connected === 'boolean') {
      desktopFlagPayload.desktop_bridge_connected = desktopBridgeStatus.connected;
    }

    // Get Google user email from localStorage to pass to backend for Google services context
    const googleUserEmail = localStorage.getItem('google_user_email') || null;

    // Get system OS for macOS native tools support
    const systemOS = getSystemOS();

    // Get client timezone and local time for accurate time context
    const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    const now = new Date();
    const clientLocalTime = now.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const payload = isAutonomous ? {
      // Autonomous endpoint: include both keys for compatibility with guide/backend
      goal: message,
      message: message,
      mode: requestedMode,
      events_version: '2.1',
      user_context: {
        profile: userContext?.profile || {},
        facts: userContext?.facts || {},
        preferences: userContext?.preferences || {},
        recent_messages: userContext?.recent_messages || [],
        google_user_email: googleUserEmail,  // Backend reads from user_context.google_user_email
        system_os: systemOS,  // Enable macOS native tools (Notes, Calendar, Reminders, etc.)
        timezone: clientTimezone,  // Client's local timezone (e.g., "America/New_York")
        local_time: clientLocalTime  // Client's formatted local time
      },
      image: image || null,
      max_steps: 10,
      timeout: 300,
      flags: desktopFlagPayload
    } : {
      // Chat endpoint
      message: truncatedMessage,
      events_version: '2.1',
      user_context: {
        profile: userContext?.profile || {},
        facts: userContext?.facts || {},
        preferences: userContext?.preferences || {},
        recent_messages: userContext?.recent_messages || [],
        google_user_email: googleUserEmail,  // Backend reads from user_context.google_user_email
        system_os: systemOS,  // Enable macOS native tools (Notes, Calendar, Reminders, etc.)
        timezone: clientTimezone,  // Client's local timezone (e.g., "America/New_York")
        local_time: clientLocalTime  // Client's formatted local time
      },
      max_tokens: 1024,
      temperature: 0.7,
      stream: true,
      memory_mode: 'auto',
      mode: requestedMode,
      image: image || null
    };

    // Prepare headers with configured API key
    const configuredKey = apiConfigManager.getApiKey && apiConfigManager.getApiKey();

    // FIX: Ensure session_id exists before sending message
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('session_id', sessionId);
      logger.info('[API] Generated session_id for message', { sessionId });
    }

    // FIX: Ensure user_id exists before sending message to prevent 401 errors
    // If user_id is not set, generate one immediately
    // IMPORTANT: Generate a valid UUID format (not local-...) to avoid Supabase type errors
    let userId = localStorage.getItem('user_id');
    if (!userId || userId === 'anonymous') {
      const generateUserId = () => {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
          return globalThis.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };
      userId = generateUserId();
      localStorage.setItem('user_id', userId);
      logger.info('[API] Generated emergency user_id for message', { userId });

      // Also ensure device_id is set for user creation
      if (!localStorage.getItem('device_id')) {
        const deviceId = generateUserId();
        localStorage.setItem('device_id', deviceId);
        logger.info('[API] Generated device_id', { deviceId });
      }
    }

    const baseHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'X-Events-Version': '2.1',
      'X-User-Id': userId
    };
    if (configuredKey) baseHeaders['X-API-Key'] = configuredKey;
    if (sessionId) baseHeaders['X-Session-ID'] = sessionId; // FIX: Add session_id for conversation context
    let headers = { ...baseHeaders };

    // v2.1: Stream identity and resume support
    // Always generate a stream id for resilience; harmless if backend ignores it.
    const genStreamId = () => {
      try { return (globalThis.crypto && crypto.randomUUID && crypto.randomUUID()) || null; } catch (_) { return null; }
    };
    let streamId = null;
    try {
      streamId = (userContext && userContext.__resume && userContext.__resume.streamId) || genStreamId() || `stream_${Math.random().toString(36).slice(2)}`;
      baseHeaders['X-Stream-Id'] = streamId;
      headers['X-Stream-Id'] = streamId;
      const lastSeen = userContext && userContext.__resume && (userContext.__resume.lastSequenceSeen ?? null);
      if (lastSeen !== null && lastSeen !== undefined) {
        baseHeaders['Last-Sequence-Seen'] = String(lastSeen);
        headers['Last-Sequence-Seen'] = String(lastSeen);
      }
    } catch {}

    let response;
    let runStream = null;
    const closeRunStream = () => {
      if (runStream) {
        try { runStream.close(); } catch (_) {}
        runStream = null;
      }
    };
    const startRunStream = (planId) => {
      if (!planId || runStream) return;
      try {
        const url = `${baseURL}/api/v2/runs/${planId}/stream`;
        runStream = new EventSource(url);
        runStream.addEventListener('metadata', (ev) => {
          try {
            const data = JSON.parse(ev.data || '{}');
            const md = data.value ? data : (data.metadata || data);
            if (md && (md.key === 'run_status' || md.run_status)) {
              const payload = md.value || md.run_status || md;
              onEvent({ type: 'metadata', data: { run_status: payload, source: 'run_stream' } });
            }
          } catch (err) {
            logger.warn('[API] run_stream metadata parse error', err);
          }
        });
        runStream.addEventListener('exec_log', (ev) => {
          try {
            const data = JSON.parse(ev.data || '{}');
            onEvent({ type: 'exec_log', data: { ...data, source: 'run_stream' } });
          } catch (err) {
            logger.warn('[API] run_stream exec_log parse error', err);
          }
        });
        runStream.addEventListener('final', (ev) => {
          try {
            const data = JSON.parse(ev.data || '{}');
            onEvent({ type: 'final', data: { ...data, source: 'run_stream' } });
          } catch (err) {
            logger.warn('[API] run_stream final parse error', err);
          }
        });
        runStream.addEventListener('done', (ev) => {
          try {
            const data = JSON.parse(ev.data || '{}');
            onEvent({ type: 'done', data: { ...data, source: 'run_stream' } });
          } catch (err) {
            logger.warn('[API] run_stream done parse error', err);
          } finally {
            closeRunStream();
          }
        });
        runStream.addEventListener('error', (err) => {
          logger.warn('[API] run_stream error', err);
          closeRunStream();
        });
      } catch (err) {
        logger.warn('[API] Failed to start run stream', err);
      }
    };
    let lastStatus = 0;
    let lastBody = '';
    const MAX_NETWORK_RETRIES = 3;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitForReconnect = async (attempt = 1, reason = 'network') => {
      const clamped = Math.min(8000, 500 * attempt);
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('api:reconnecting', { detail: { area: 'chat_stream', attempt, reason } }));
        }
      } catch {}
      if (typeof window !== 'undefined' && window.addEventListener) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          await new Promise((resolve) => {
            let settled = false;
            const cleanup = () => {
              if (settled) return;
              settled = true;
              window.removeEventListener('online', handleOnline);
              clearTimeout(timer);
              resolve();
            };
            const handleOnline = () => cleanup();
            const timer = setTimeout(cleanup, Math.max(clamped, 1000));
            window.addEventListener('online', handleOnline, { once: true });
          });
          return;
        }
      }
      await wait(clamped);
    };
    const shouldRetryNetworkError = (err) => {
      if (!err) return false;
      const rawMessage = err?.message || String(err || '');
      if (!rawMessage) return err?.name === 'TypeError';
      const message = rawMessage.toLowerCase();
      const retryMarkers = [
        'err_network_changed',
        'failed to fetch',
        'network error',
        'networkerror',
        'network request failed',
        'connection was interrupted',
        'status: undefined'
      ];
      return retryMarkers.some((marker) => message.includes(marker));
    };

    const endpointQueue = [...endpoints];
    const MAX_STREAM_RESUME_RETRIES = 2;
    let streamResumeAttempts = 0;
    const MAX_TOTAL_NETWORK_RETRIES = isAutonomous ? 6 : 3;
    let totalNetworkRetries = 0;
    let streamCompleted = false;
    let lastSequenceSeen = (userContext && userContext.__resume && (userContext.__resume.lastSequenceSeen ?? null)) || null;
    let ackStreamId = null;

    endpointLoop:
    while (endpointQueue.length > 0) {
      const endpoint = endpointQueue.shift();
      response = null;
      logger.info(`[API] Trying ${isAutonomous ? 'AUTONOMOUS' : 'CHAT'} endpoint:`, endpoint);
      try {
        telemetry.logEvent('api.chat_stream.try_endpoint', {
          endpoint,
          mode: isAutonomous ? 'autonomous' : 'chat',
        });
      } catch {}
      let attempt = 0;
      while (attempt < MAX_NETWORK_RETRIES && !response) {
        attempt += 1;
        try {
          const requestHeaders = { ...headers };
          response = await fetch(endpoint, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(payload),
          });
          break;
        } catch (netErr) {
          lastStatus = 0;
          lastBody = String(netErr?.message || netErr);
          const retryable = shouldRetryNetworkError(netErr) && attempt < MAX_NETWORK_RETRIES;
          try {
            telemetry.logEvent('api.chat_stream.network_error', {
              endpoint,
              mode: isAutonomous ? 'autonomous' : 'chat',
              error: lastBody,
              attempt,
              retrying: retryable,
            });
          } catch {}
          if (retryable) {
            totalNetworkRetries += 1;
            if (totalNetworkRetries > MAX_TOTAL_NETWORK_RETRIES) {
              throw netErr;
            }
            try {
              telemetry.logEvent('api.chat_stream.network_error_retry', {
                endpoint,
                mode: isAutonomous ? 'autonomous' : 'chat',
                attempt,
              });
            } catch {}
            await waitForReconnect(totalNetworkRetries, 'fetch');
            continue;
          }
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('api:fallback', { detail: { area: 'chat_stream', endpoint, status: 0 } }));
            }
          } catch {}
          continue endpointLoop; // try next endpoint
        }
      }
      if (!response) continue;
      if (response.ok) {
        try {
          telemetry.logEvent('api.chat_stream.endpoint_selected', {
            endpoint,
            mode: isAutonomous ? 'autonomous' : 'chat',
            status: response.status,
          });
        } catch {}

        const consumeStream = async (resp) => {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let ackSeenLocal = false;
          let anyTokenSeenLocal = false;
          let terminalErrorReceived = false;

          while (true) {
            const { done, value } = await reader.read();

            if (done || terminalErrorReceived) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (terminalErrorReceived) break;
              if (line.startsWith('event:')) {
                continue;
              }

              if (line.startsWith('data:')) {
                const data = line.substring(5).trim();
                if (!data || data === '[DONE]') continue;
                const firstChar = data[0];
                if (firstChar !== '{' && firstChar !== '[') continue;
                try {
                  const parsed = JSON.parse(data);

                  if (isAutonomous) {
                    const eventType = parsed.type || parsed.event;
                    try {
                      const seq = parsed.seq ?? parsed.sequence ?? parsed.sequence_id ?? parsed.event_id ?? null;
                      if (seq !== null && seq !== undefined) {
                        lastSequenceSeen = seq;
                        try { localStorage.setItem(`amx_stream_seq_${streamId}`, String(seq)); } catch {}
                      }
                    } catch {}

                  const getPayloadData = (obj) => {
                    if (obj && typeof obj.data === 'object' && obj.data !== null) return obj.data;
                    if (obj && typeof obj === 'object') {
                      const { type, id, ...rest } = obj;
                      return rest;
                    }
                      return {};
                    };

                    if (eventType === 'ack') {
                      const ackData = getPayloadData(parsed);
                      ackSeenLocal = true;
                      const sid = ackData.stream_id || parsed.stream_id;
                    if (sid) {
                      ackStreamId = sid;
                      try { localStorage.setItem('amx_last_stream_id', sid); } catch {}
                    }
                    onEvent({ type: 'ack', data: ackData });
                    } else if (eventType === 'plan') {
                      const planData = getPayloadData(parsed);
                      if (planData && (planData.plan_id || planData.planId)) {
                        startRunStream(planData.plan_id || planData.planId);
                      }
                      onEvent({ type: 'plan', data: planData });
                    } else if (eventType === 'exec_log') {
                      const logData = getPayloadData(parsed);
                      onEvent({ type: 'exec_log', data: logData });
              } else if (eventType === 'tool_request') {
                if (!useHandsOnDesktop) {
                  logger.warn('[API] Received tool_request but hands-on desktop is disabled/unavailable; skipping');
                  continue;
                }
                      const req = getPayloadData(parsed);
                      try {
                        if (window.electron && window.electron.handsOnDesktop && typeof window.electron.handsOnDesktop.executeRequest === 'function') {
                          const requestPayload = {
                            run_id: req.run_id,
                            request_id: req.request_id,
                            step: req.step ?? 0,
                            tool: req.tool,
                            command: req.command || (req.args && req.args.command) || undefined,
                            args: req.args || {},
                            requires_elevation: !!req.requires_elevation,
                            timeout_sec: typeof req.timeout_sec === 'number' ? req.timeout_sec : 60,
                          };
                          try {
                            logger.info('[API] Dispatching hands-on-desktop tool_request', {
                              request_id: requestPayload.request_id,
                              tool: requestPayload.tool,
                              step: requestPayload.step,
                              run_id: requestPayload.run_id,
                            });
                          } catch {}
                          window.electron.handsOnDesktop.executeRequest(requestPayload).catch((e) => {
                            console.warn('[API] handsOnDesktop.executeRequest failed:', e);
                          });
                        } else {
                          console.warn('[API] handsOnDesktop bridge unavailable; cannot execute tool_request on desktop');
                        }
                      } catch (err) {
                        console.error('[API] tool_request dispatch error:', err);
                      }
                    } else if (eventType === 'thinking') {
                      const thinkingData = getPayloadData(parsed);
                      onEvent({ type: 'thinking', data: thinkingData });
                    } else if (eventType === 'final' || eventType === 'complete') {
                      const finalData = getPayloadData(parsed);
                      const finalResponse =
                        finalData.final_response || finalData.response || parsed.final_response || '';
                      const metrics = {
                        tokens_out: finalData.tokens_out ?? parsed.tokens_out,
                        total_ms: finalData.total_ms ?? parsed.total_ms,
                        tokens_in: finalData.tokens_in ?? parsed.tokens_in,
                        cost_usd: finalData.cost_usd ?? parsed.cost_usd,
                        checksum: finalData.checksum ?? parsed.checksum,
                      };
                      onEvent({ type: 'final', data: { final_response: finalResponse, ...metrics } });
                    } else if (eventType === 'token') {
                  const tokenData = getPayloadData(parsed);
                  onEvent({ type: 'token', data: tokenData });
                } else if (eventType === 'done') {
                  const doneData = getPayloadData(parsed);
                      const finalResponse =
                        doneData.final_response || doneData.response || parsed.final_response || '';
                      const metrics = {
                        tokens_out: doneData.tokens_out ?? parsed.tokens_out,
                        total_ms: doneData.total_ms ?? parsed.total_ms,
                        tokens_in: doneData.tokens_in ?? parsed.tokens_in,
                        cost_usd: doneData.cost_usd ?? parsed.cost_usd,
                        checksum: doneData.checksum ?? parsed.checksum,
                      };
                  onEvent({ type: 'done', data: { final_response: finalResponse, ...metrics } });
                  closeRunStream();
                } else if (eventType === 'error') {
                  const errData = getPayloadData(parsed);
                  const msg = errData.error || errData.message || 'Unknown error';
                  const isTerminal = !!errData.terminal;
                  onEvent({ type: 'error', data: { error: msg, code: errData.code, terminal: isTerminal, context: errData.context, details: errData.details } });
                  if (isTerminal) {
                    console.log('[API] Terminal error received, stopping SSE stream');
                    terminalErrorReceived = true;
                    closeRunStream();
                    break;
                  }
                } else if (eventType === 'metadata') {
                  const md = getPayloadData(parsed);
                  onEvent({ type: 'metadata', data: md });
                    } else {
                      onEvent(parsed);
                    }
                  } else {
                    try {
                      if (parsed && parsed.type === 'ack') {
                        ackSeenLocal = true;
                      }
                      const content = parsed?.content || parsed?.delta || parsed?.token || parsed?.text || '';
                      if (content && typeof content === 'string') {
                        anyTokenSeenLocal = true;
                      }
                      if ((parsed?.type === 'done' || parsed?.event === 'done') && !anyTokenSeenLocal) {
                        const jsonHeaders = {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json',
                          'X-User-Id': localStorage.getItem('user_id') || 'anonymous'
                        };
                        if (configuredKey) jsonHeaders['X-API-Key'] = configuredKey;
                        const fallbackPayload = {
                          message: truncatedMessage,
                          session_id: (userContext && userContext.session_id) || 'default',
                          include_context: true,
                          user_context: userContext ? {
                            profile: userContext.profile || {},
                            facts: userContext.facts || {},
                            preferences: userContext.preferences || {},
                            recent_messages: userContext.recent_messages || [],
                            google_user_email: googleUserEmail,
                            system_os: systemOS  // Enable macOS native tools
                          } : { system_os: systemOS, google_user_email: googleUserEmail },
                          image: image || null,
                          memory_mode: 'auto'
                        };
                        const jsonEp = `${baseURL}/api/v2/chat/message`;
                        try {
                          const jsonResp = await fetch(jsonEp, {
                            method: 'POST',
                            headers: jsonHeaders,
                            body: JSON.stringify(fallbackPayload)
                          });
                          if (jsonResp.ok) {
                            const data = await jsonResp.json();
                            // Include execution_steps for UI progress display
                            onEvent({
                              type: 'done',
                              data: {
                                final_response: data.response || '',
                                execution_steps: data.execution_steps || null
                              }
                            });
                            return { aborted: true };
                          }
                        } catch (_) { /* swallow and continue */ }
                      }
                    } catch (_) { /* ignore detection errors */ }
                    onEvent(parsed);
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }
          return { aborted: false };
        };

        try {
          const streamResult = await consumeStream(response);
          if (streamResult?.aborted) {
            streamCompleted = true;
            return;
          }
          streamCompleted = true;
          break;
        } catch (streamErr) {
          lastStatus = 0;
          lastBody = String(streamErr?.message || streamErr);
          const retryableStreamError = shouldRetryNetworkError(streamErr) && streamResumeAttempts < MAX_STREAM_RESUME_RETRIES;
          if (retryableStreamError) {
            streamResumeAttempts += 1;
            totalNetworkRetries += 1;
            if (totalNetworkRetries > MAX_TOTAL_NETWORK_RETRIES) {
              throw streamErr;
            }
            try {
              telemetry.logEvent('api.chat_stream.stream_error_retry', {
                endpoint,
                mode: isAutonomous ? 'autonomous' : 'chat',
                attempt: streamResumeAttempts,
                error: lastBody,
              });
            } catch {}
            await waitForReconnect(totalNetworkRetries, 'stream');
            const sidForResume = (typeof ackStreamId === 'string' && ackStreamId) || baseHeaders['X-Stream-Id'] || streamId;
            const resumeHeaders = { ...baseHeaders };
            if (sidForResume) resumeHeaders['X-Stream-Id'] = sidForResume;
            if (lastSequenceSeen !== null && lastSequenceSeen !== undefined) {
              resumeHeaders['Last-Sequence-Seen'] = String(lastSequenceSeen);
            }
            headers = resumeHeaders;
            endpointQueue.unshift(endpoint);
            continue endpointLoop;
          }
          throw streamErr;
        }
      }
      lastStatus = response.status;
      try { lastBody = await response.text(); } catch {}
      if (lastStatus === 404 || lastStatus === 405) {
        try {
          telemetry.logEvent('api.chat_stream.endpoint_fallback', {
            endpoint,
            mode: isAutonomous ? 'autonomous' : 'chat',
            status: lastStatus,
          });
        } catch {}
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('api:fallback', { detail: { area: 'chat_stream', endpoint, status: lastStatus } }));
          }
        } catch {}
        continue; // try next fallback path
      }
      // For 401, no point trying alternate path without auth
      if (lastStatus === 401) break;
    }

    if (!streamCompleted) {
      let errorMessage = `HTTP error! status: ${lastStatus || (response && response.status)}`;
      try {
        const parsed = lastBody && JSON.parse(lastBody);
        if (parsed && (parsed.detail || parsed.error)) {
          errorMessage = parsed.detail || parsed.error;
        } else if (lastBody) {
          errorMessage = lastBody;
        }
      } catch {}
      if ((lastStatus || response?.status) === 401 && !configuredKey) {
        errorMessage = 'Unauthorized (missing API key). Set your API key in Settings or .env (VITE_API_KEY).';
      }

      // Fallback to non-streaming chat endpoint when streaming is unavailable
      try {
        try {
          telemetry.logEvent('api.chat_stream.fallback_to_json', {
            mode: isAutonomous ? 'autonomous' : 'chat',
            last_status: lastStatus || (response && response.status),
          });
        } catch {}
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('api:fallback', { detail: { area: 'chat_stream', endpoint: 'json_fallback', status: lastStatus || (response && response.status) } }));
          }
        } catch {}
        const jsonHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-User-Id': localStorage.getItem('user_id') || 'anonymous'
        };
        if (configuredKey) jsonHeaders['X-API-Key'] = configuredKey;

        const fallbackPayload = {
          message: message,
          session_id: (userContext && userContext.session_id) || 'default',
          include_context: true,
          user_context: userContext ? {
            profile: userContext.profile || {},
            facts: userContext.facts || {},
            preferences: userContext.preferences || {},
            recent_messages: userContext.recent_messages || [],
            google_user_email: googleUserEmail,
            system_os: systemOS  // Enable macOS native tools
          } : { system_os: systemOS, google_user_email: googleUserEmail },
          image: image || null,
          memory_mode: 'auto'
        };

        const jsonEndpoints = disableLegacyFallbacks
          ? [ `${baseURL}/api/v2/chat/message` ]
          : [ `${baseURL}/api/v2/chat/message`, `${baseURL}/api/chat/message` ];

        for (const ep of jsonEndpoints) {
          const jsonResp = await fetch(ep, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(fallbackPayload)
          });
          if (jsonResp.ok) {
            const data = await jsonResp.json();
            if (onEvent) {
              onEvent({ type: 'done', data: { final_response: data.response || '' } });
            }
            return;
          }
        }
      } catch {}

      throw new Error(errorMessage);
    }

    
  },
};

// ============================================
// GOOGLE SERVICES API
// ============================================
export const googleAPI = {
  // Connection status
  getStatus: (email = null) => {
    let device_id = null;
    try { device_id = localStorage.getItem('device_id') || null; } catch {}
    const params = email ? { email } : {};
    if (device_id) params.device_id = device_id;
    return api.get('/api/v2/google/status', { params });
  },

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
  
  // OAuth support: prefer server-provided auth URL
  getAuthUrl: (userId = null, deviceId = null, state = null) =>
    api.get('/api/v2/google/auth/url', {
      params: { user_id: userId, device_id: deviceId, state },
    }),

  // Disconnect account
  disconnect: (email) =>
    api.post('/api/v2/google/disconnect', null, { params: { email } }),
};

// ============================================
// TELEMETRY API
// ============================================
export const telemetryAPI = {
  // Note: telemetry endpoints are at /api/telemetry (not /api/v2/telemetry)
  sendBatch: (events) =>
    api.post('/api/telemetry/batch', {
      events,
      userId: localStorage.getItem('user_id') || 'anonymous',
      sessionId: localStorage.getItem('session_id') || Date.now().toString(),
      timestamp: Date.now(),
    }),

  trackInteraction: (action, metadata = {}) =>
    api.post('/api/telemetry/batch', {
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
    api.post('/api/telemetry/batch', {
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

  // Note: telemetry endpoints are at /api/telemetry (not /api/v2/telemetry)
  getStats: () => api.get('/api/telemetry/stats'),

  getInteractions: (limit = 100) =>
    api.get('/api/telemetry/interactions', { params: { limit } }),
};

// ============================================
// SCREEN CONTROL API
// ============================================
export const screenAPI = {
  getCapabilities: () => permissionAPI._tryPaths('get', [
    '/api/v2/screen/capabilities',
    '/api/screen/capabilities',
    '/screen/capabilities'
  ]),
  getInfo: () => permissionAPI._tryPaths('get', [
    '/api/v2/screen/info',
    '/api/screen/info',
    '/screen/info'
  ]),
  getStatus: () => permissionAPI._tryPaths('get', [
    '/api/v2/screen/status',
    '/api/screen/status',
    '/screen/status'
  ]),

  click: (x, y, button = 'left', clicks = 1) =>
    permissionAPI._tryPaths('post', [
      '/api/v2/screen/click',
      '/api/screen/click',
      '/screen/click'
    ], { x, y, button, clicks }),

  clickText: (text, clicks = 1) => permissionAPI._tryPaths('post', [
    '/api/v2/screen/click-text',
    '/api/screen/click-text',
    '/screen/click-text'
  ], { text, clicks }),

  clickElement: (description, clicks = 1) =>
    permissionAPI._tryPaths('post', [
      '/api/v2/screen/click-element',
      '/api/screen/click-element',
      '/screen/click-element'
    ], { description, clicks }),

  typeText: (text, clear_first = false) => permissionAPI._tryPaths('post', [
    '/api/v2/screen/type',
    '/api/screen/type',
    '/screen/type'
  ], { text, clear_first }),

  pressKey: (keys) => permissionAPI._tryPaths('post', [
    '/api/v2/screen/press-key',
    '/api/screen/press-key',
    '/screen/press-key'
  ], { keys }),

  scroll: (direction = 'down', amount = 3) =>
    permissionAPI._tryPaths('post', [
      '/api/v2/screen/scroll',
      '/api/screen/scroll',
      '/screen/scroll'
    ], { direction, amount }),

  takeScreenshot: (save_name = null) => permissionAPI._tryPaths('post', [
    '/api/v2/screen/screenshot',
    '/api/screen/screenshot',
    '/screen/screenshot'
  ], { save_name }),
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

  // Create emergency top-up ($5 for 50 credits)
  emergencyTopup: (userId, successUrl, cancelUrl) =>
    api.post('/api/v2/credits/emergency-topup', {
      package: 'emergency',
      user_id: userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),

  // Create subscription checkout session (monthly plans)
  createSubscription: (plan, userId, successUrl, cancelUrl) =>
    api.post('/api/v2/credits/checkout-subscription', {
      plan,
      user_id: userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),

  // Add credits to user account (for free trials, bonuses, etc.)
  addCredits: (userId, amount, source = 'free_trial') =>
    api.post(`/api/v2/credits/add/${userId}`, null, {
      params: { amount, source },
    }),

  // Get detailed subscription status
  getSubscriptionStatus: (userId) =>
    api.get(`/api/v2/credits/subscription-status/${userId}`),

  // Cancel subscription at end of billing period
  cancelSubscription: (userId) =>
    api.post('/api/v2/credits/cancel-subscription', {
      user_id: userId,
    }),
};

// ============================================
// PERMISSION LEVELS & SAFETY
// ============================================
export const permissionAPI = {
  // Internal: try multiple paths, falling back on 404
  _tryPaths: async (method, paths, payload = null, options = {}) => {
    // In production or when explicitly enabled, prefer v2-only to surface drift
    const legacyDisabled = (() => {
      let d = isProdBuild ? true : false;
      try {
        const v = localStorage.getItem('disable_legacy_fallbacks');
        if (v === '1' || v === 'true') return true;
        if (v === '0' || v === 'false') return false;
      } catch {}
      try {
        const env = import.meta.env.VITE_DISABLE_LEGACY_FALLBACKS;
        if (env === 'true') return true;
        if (env === 'false') return false;
      } catch {}
      return d;
    })();

    const effectivePaths = legacyDisabled ? paths.filter(p => typeof p === 'string' && p.includes('/api/v2/')) : paths;
    let lastErr;
    for (const p of effectivePaths) {
      try {
        if (method === 'get') return await api.get(p, options);
        if (method === 'post') return await api.post(p, payload, options);
        if (method === 'put') return await api.put(p, payload, options);
        if (method === 'delete') return await api.delete(p, options);
        throw new Error(`Unsupported method ${method}`);
      } catch (err) {
        // Check status in both raw error and AppError wrapper
        const status = err?.response?.status || err?.status || err?.statusCode;
        // For some deployments, older paths/methods return 404/405/400; try the next path
        if (status === 404 || status === 405 || status === 400) {
          lastErr = err;
          logger.debug(`Path ${p} returned ${status}, trying next fallback...`);
          try {
            telemetry.logEvent('api.fallback_path', {
              method,
              path: p,
              status,
              baseURL: api.defaults.baseURL,
              component: 'permissionAPI',
            });
          } catch {}
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('api:fallback', { detail: { method, path: p, status, area: 'permissionAPI' } }));
            }
          } catch {}
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
          permission_level: 'chatty',
          name: 'Chatty (Default)',
          description: 'Read-only assistant mode',
          capabilities: {
            can_do: ['Read files', 'Search web'],
            requires_approval: []
          }
        })
      : (async () => {
          try {
            return await permissionAPI._tryPaths('get', ['/api/v2/safety/permission-level', '/api/safety/permission-level']);
          } catch (_) {
            try {
              return await permissionAPI._tryPaths('post', ['/api/v2/safety/permission-level', '/api/safety/permission-level'], {});
            } catch (err2) {
              const status = err2?.response?.status || err2?.status || err2?.statusCode;
              if (status === 404 || status === 405 || status === 400 || status === 501) {
                logger.warn('[Safety] permission-level unavailable, defaulting to chatty');
                return {
                  data: {
                    permission_level: 'chatty',
                    name: 'Chatty (Default)',
                    description: 'Safety service unavailable',
                    capabilities: {
                      can_do: ['Read files', 'Search web'],
                      requires_approval: []
                    }
                  }
                };
              }
              throw err2;
            }
          }
        })(),

  /**
   * Update user's permission level
   * @param {string} level - 'chatty' or 'autonomous'
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
  check: async (message, context = {}) => {
    if (DEMO_MODE) {
      return {
        allowed: true,
        requires_approval: false,
        permission_level: 'chatty',
        markers: [],
        reason: 'Demo mode',
        suggested_flow: null,
        draft_supported: false,
        is_high_risk: false
      };
    }
    try {
      return await permissionAPI._tryPaths('post', ['/api/v2/safety/check', '/api/safety/check'], { message, context });
    } catch (err) {
      const status = err?.response?.status || err?.status || err?.statusCode;
      if (status === 404 || status === 405 || status === 400 || status === 501) {
        // Backend doesn't implement safety yet – permit by default
        logger.warn('[Safety] check unavailable, allowing by default:', status);
        return {
          allowed: true,
          requires_approval: false,
          permission_level: 'chatty',
          markers: [],
          reason: 'Safety service unavailable',
          suggested_flow: null,
          draft_supported: false,
          is_high_risk: false
        };
      }
      throw err;
    }
  },

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
      : permissionAPI._tryPaths('post', ['/api/ambiguity/check', '/api/v2/ambiguity/check'], { message, word_threshold: wordThreshold })
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
// RUN CONTROL (viewer stream)
// ============================================
export const runAPI = {
  cancel: (runId) =>
    api.post(`/api/v2/runs/${runId}/cancel`).catch(() => api.post(`/api/runs/${runId}/cancel`)),
  pause: (runId) =>
    api.post(`/api/v2/runs/${runId}/pause`).catch(() => api.post(`/api/runs/${runId}/pause`)),
  resume: (runId) =>
    api.post(`/api/v2/runs/${runId}/resume`).catch(() => api.post(`/api/runs/${runId}/resume`)),
  get: (runId) =>
    api.get(`/api/v2/runs/${runId}`).catch(() => api.get(`/api/runs/${runId}`)),
};

// ============================================
// HEALTH CHECK
// ============================================
export const healthAPI = libHealthAPI;

// Export API URL for use in other modules
export { API_BASE_URL };

/**
 * Reconfigure the axios instance with new base URL
 * Called when user updates settings
 */
export const reconfigureAPI = (newBaseURL, newApiKey = undefined) => {
  logger.info('Reconfiguring with new base URL', { newBaseURL, hasApiKey: newApiKey !== undefined });

  // Update config manager
  apiConfigManager.updateConfig(newBaseURL);
  try {
    // Persist API key change if provided (undefined = no change, null = clear)
    if (typeof newApiKey !== 'undefined') {
      apiConfigManager.updateApiKey(newApiKey);
    }
  } catch {}

  // Update axios instance
  api.defaults.baseURL = newBaseURL;
  API_BASE_URL = newBaseURL;
  // Sync default auth header immediately for consumers using api.defaults
  try {
    if (typeof newApiKey !== 'undefined') {
      if (newApiKey) {
        api.defaults.headers['X-API-Key'] = newApiKey;
      } else {
        delete api.defaults.headers['X-API-Key'];
      }
    }
  } catch {}

  logger.info('Reconfiguration complete');
  toast.success('API configuration updated');
};

// Listen for config changes from other sources
apiConfigManager.onChange((config) => {
  logger.info('Config changed externally, updating axios instance', config);
  api.defaults.baseURL = config.baseURL;
  API_BASE_URL = config.baseURL;
  try {
    if (config.apiKey) {
      api.defaults.headers['X-API-Key'] = config.apiKey;
    } else {
      delete api.defaults.headers['X-API-Key'];
    }
  } catch {}
});

export default api;
