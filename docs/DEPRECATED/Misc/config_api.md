# DEPRECATED: src/config/api.js

Do NOT use. Archived on 2025-11-06. Reason: Superseded by `src/config/apiConfig.js`; no imports remain.

## Original Source

```js
/* BEGIN ORIGINAL FILE: src/config/api.js */
/**
 * API Configuration
 *
 * This file manages the API URL for both development and production.
 *
 * For Development:
 * - Uses localhost:8000 (local backend)
 *
 * For Production:
 * - Set VITE_API_URL environment variable
 * - Or update DEFAULT_PRODUCTION_API below
 */

// Default production API URL (update this to your deployed backend)
const DEFAULT_PRODUCTION_API = 'https://api.agentmax.com'; // UPDATE THIS!

// Determine API URL (evaluated at module load time)
let API_URL_RESOLVED;

try {
  // Priority 1: Environment variable
  if (import.meta.env.VITE_API_URL) {
    console.log('[Config] Using API URL from environment:', import.meta.env.VITE_API_URL);
    API_URL_RESOLVED = import.meta.env.VITE_API_URL;
  }
  // Priority 2: Development mode
  else if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    console.log('[Config] Development mode detected - using localhost:8000');
    API_URL_RESOLVED = 'http://localhost:8000';
  }
  // Priority 3: Production default
  else {
    console.log('[Config] Production mode - using default API:', DEFAULT_PRODUCTION_API);
    API_URL_RESOLVED = DEFAULT_PRODUCTION_API;
  }
} catch (error) {
  console.error('[Config] Error determining API URL:', error);
  // Fallback to localhost if there's any error
  API_URL_RESOLVED = 'http://localhost:8000';
  console.warn('[Config] Falling back to localhost:8000');
}

// Export the API URL
export const API_URL = API_URL_RESOLVED;

// Helper function to get API URL (for debugging)
export const getApiUrl = () => API_URL;

// Export config object
export default {
  apiUrl: API_URL,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
/* END ORIGINAL FILE */
```
