/**
 * Unified API Configuration Manager
 *
 * Provides a single source of truth for API configuration
 * and allows runtime reconfiguration from Settings.
 */

class ApiConfigManager {
  constructor() {
    this.listeners = new Set();
    this.config = this.loadConfig();
    this.lastProbe = null;
  }

  loadConfig() {
    const envMode = import.meta.env.MODE;
    const envSetting = import.meta.env.VITE_ENVIRONMENT;
    const isProdEnv = envSetting === 'production' || envSetting === 'beta' || (!import.meta.env.DEV && envMode === 'production');

    // Priority 1: localStorage (user settings) – only honor in non-production builds
    const savedUrl = localStorage.getItem('api_url');
    if (savedUrl && !isProdEnv) {
      console.log('[ApiConfig] Using saved URL from localStorage:', savedUrl);
      return {
        baseURL: savedUrl
      };
    } else if (savedUrl && isProdEnv) {
      // Clean up stale localhost overrides in production builds
      if (savedUrl.includes('localhost') || savedUrl.includes('127.0.0.1')) {
        console.log('[ApiConfig] Ignoring localhost override in production environment');
        localStorage.removeItem('api_url');
      } else {
        return { baseURL: savedUrl };
      }
    }

    // Priority 2: Environment variable
    if (import.meta.env.VITE_API_URL) {
      console.log('[ApiConfig] Using URL from environment:', import.meta.env.VITE_API_URL);
      return {
        baseURL: import.meta.env.VITE_API_URL,
        apiKey: import.meta.env.VITE_API_KEY || null
      };
    }

    // Priority 3: Development default
    // Check multiple ways to detect development mode
    const isDev = import.meta.env.DEV || 
                  envMode === 'development' || 
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      console.log('[ApiConfig] Development mode detected - using localhost:8000');
      console.log('[ApiConfig] Mode:', import.meta.env.MODE, 'DEV:', import.meta.env.DEV);
      return {
        baseURL: 'http://localhost:8000',
        apiKey: import.meta.env.VITE_API_KEY || 'dev'
      };
    }

    // Priority 4: Production default
    console.log('[ApiConfig] Production mode - using default API');
    return {
      baseURL: 'https://api.agentmax.com',
      apiKey: import.meta.env.VITE_API_KEY || null
    };
  }

  getBaseURL() {
    return this.config.baseURL;
  }

  getApiKey() {
    return this.config.apiKey;
  }

  getConfig() {
    return { ...this.config };
  }

  /**
   * Update API configuration and notify listeners
   * @param {string} baseURL - New API base URL
   */
  updateConfig(baseURL) {
    console.log('[ApiConfig] Updating configuration:', { baseURL });

    // Save to localStorage
    localStorage.setItem('api_url', baseURL);
    // Preserve existing apiKey in memory
    const prevKey = this.config.apiKey || null;
    this.config = { baseURL, apiKey: prevKey };

    // Notify all listeners
    this.notifyListeners();
  }

  updateApiKey(apiKey) {
    this.config = { ...this.config, apiKey };
    this.notifyListeners();
  }

  /**
   * Register a listener for config changes
   * @param {Function} callback - Called when config changes
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    this.listeners.forEach((callback) => {
      try {
        callback(this.config);
      } catch (error) {
        console.error('[ApiConfig] Listener error:', error);
      }
    });
  }

  /**
   * Probe backend-provided desktop config and apply overrides at runtime.
   * Endpoint: /.well-known/desktop-config
   */
  async probeWellKnownAndApply() {
    const base = (this.config?.baseURL || '').replace(/\/$/, '');
    if (!base) return;
    const url = `${base}/.well-known/desktop-config`;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        this.lastProbe = { attempted: true, applied: false, status: res.status, updatedAt: Date.now() };
        return;
      }
      const data = await res.json().catch(() => ({}));
      const next = { ...this.config };
      if (data.api_base && typeof data.api_base === 'string') next.baseURL = data.api_base;
      if (data.api_key && typeof data.api_key === 'string') next.apiKey = data.api_key;
      // Telemetry endpoint and key (optional)
      if (data.telemetry_api && typeof data.telemetry_api === 'string') next.telemetryApi = data.telemetry_api;
      if (data.telemetry_key && typeof data.telemetry_key === 'string') next.telemetryKey = data.telemetry_key;
      // Flags (e.g., disable_legacy_fallbacks)
      if (data.flags && typeof data.flags === 'object') {
        if (typeof data.flags.disable_legacy_fallbacks === 'boolean') {
          try {
            localStorage.setItem('disable_legacy_fallbacks', data.flags.disable_legacy_fallbacks ? 'true' : 'false');
          } catch {}
        }
      }
      // Apply only if something changed
      if (next.baseURL !== this.config.baseURL || next.apiKey !== this.config.apiKey || next.telemetryApi !== this.config.telemetryApi || next.telemetryKey !== this.config.telemetryKey) {
        this.config = next;
        this.notifyListeners();
        console.log('[ApiConfig] Applied overrides from .well-known/desktop-config');
        this.lastProbe = { attempted: true, applied: true, status: res.status, data, updatedAt: Date.now() };
      } else {
        this.lastProbe = { attempted: true, applied: false, status: res.status, data, updatedAt: Date.now() };
      }
    } catch (_) {
      // silent: optional feature
      this.lastProbe = { attempted: true, applied: false, status: 0, updatedAt: Date.now() };
    }
  }

  getLastProbe() {
    return this.lastProbe;
  }

  /**
   * Reset to default configuration
   */
  reset() {
    localStorage.removeItem('api_url');
    localStorage.removeItem('api_key'); // Clean up old API keys
    this.config = this.loadConfig();
    this.notifyListeners();
  }
}

// Create singleton instance
const apiConfigManager = new ApiConfigManager();

export default apiConfigManager;
