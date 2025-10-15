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
    // Priority 1: localStorage (user settings)
    const savedUrl = localStorage.getItem('api_url');
    if (savedUrl) {
      console.log('[ApiConfig] Using saved URL from localStorage:', savedUrl);
      return {
        baseURL: savedUrl,
        apiKey: localStorage.getItem('api_key') || null,
      };
    }

    // Priority 2: Environment variable
    if (import.meta.env.VITE_API_URL) {
      console.log('[ApiConfig] Using URL from environment:', import.meta.env.VITE_API_URL);
      return {
        baseURL: import.meta.env.VITE_API_URL,
        apiKey: null,
      };
    }

    // Priority 3: Development default
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      console.log('[ApiConfig] Development mode - using localhost:8000');
      return {
        baseURL: 'http://localhost:8000',
        apiKey: null,
      };
    }

    // Priority 4: Production default
    console.log('[ApiConfig] Production mode - using default API');
    return {
      baseURL: 'https://api.agentmax.com',
      apiKey: null,
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
   * @param {string} apiKey - Optional API key
   */
  updateConfig(baseURL, apiKey = null) {
    console.log('[ApiConfig] Updating configuration:', { baseURL, apiKey: apiKey ? '***' : null });

    // Save to localStorage
    localStorage.setItem('api_url', baseURL);
    if (apiKey) {
      localStorage.setItem('api_key', apiKey);
    } else {
      localStorage.removeItem('api_key');
    }

    // Update internal config
    this.config = { baseURL, apiKey };

    // Notify all listeners
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
    localStorage.removeItem('api_key');
    this.config = this.loadConfig();
    this.notifyListeners();
  }
}

// Create singleton instance
const apiConfigManager = new ApiConfigManager();

export default apiConfigManager;
