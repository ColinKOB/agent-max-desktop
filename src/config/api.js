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

// Get API URL from environment or use defaults
export const getApiUrl = () => {
  // Priority 1: Environment variable (set in .env or build time)
  if (import.meta.env.VITE_API_URL) {
    console.log('[Config] Using API URL from environment:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  // Priority 2: Check if we're in development
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  
  if (isDev) {
    console.log('[Config] Development mode - using localhost:8000');
    return 'http://localhost:8000';
  }
  
  // Priority 3: Production default
  console.log('[Config] Production mode - using default API:', DEFAULT_PRODUCTION_API);
  return DEFAULT_PRODUCTION_API;
};

// Export the API URL
export const API_URL = getApiUrl();

// Export config object
export default {
  apiUrl: API_URL,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
