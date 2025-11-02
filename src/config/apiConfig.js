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
