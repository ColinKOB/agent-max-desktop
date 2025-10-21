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
        baseURL: savedUrl
      };
    }

    // Priority 2: Environment variable
    if (import.meta.env.VITE_API_URL) {
      console.log('[ApiConfig] Using URL from environment:', import.meta.env.VITE_API_URL);
      return {
        baseURL: import.meta.env.VITE_API_URL
      };
    }

    // Priority 3: Development default
    // Check multiple ways to detect development mode
    const isDev = import.meta.env.DEV || 
                  import.meta.env.MODE === 'development' || 
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      console.log('[ApiConfig] Development mode detected - using localhost:8000');
      console.log('[ApiConfig] Mode:', import.meta.env.MODE, 'DEV:', import.meta.env.DEV);
      return {
        baseURL: 'http://localhost:8000'
      };
    }

    // Priority 4: Production default
    console.log('[ApiConfig] Production mode - using default API');
    return {
      baseURL: 'https://api.agentmax.com'
    };
  }

  getBaseURL() {
    return this.config.baseURL;
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
    localStorage.removeItem('api_key'); // Clean up old API keys

    // Update internal config
    this.config = { baseURL };

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
    localStorage.removeItem('api_key'); // Clean up old API keys
    this.config = this.loadConfig();
    this.notifyListeners();
  }
}

// Create singleton instance
const apiConfigManager = new ApiConfigManager();

export default apiConfigManager;
