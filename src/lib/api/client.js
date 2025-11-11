import axios from 'axios';
import axiosRetry from 'axios-retry';
import apiConfigManager from '../../config/apiConfig';

// Initialize base URL from config with safe fallback
let API_BASE_URL = (apiConfigManager.getConfig()?.baseURL) || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    (error.response && error.response.status >= 500) ||
    error.code === 'ECONNABORTED',
});

api.interceptors.request.use((config) => {
  try {
    const apiKey = apiConfigManager.getApiKey && apiConfigManager.getApiKey();
    if (apiKey) config.headers['X-API-Key'] = apiKey;
    const userId = (typeof localStorage !== 'undefined') ? localStorage.getItem('user_id') : null;
    if (userId) config.headers['X-User-Id'] = userId;
  } catch {}
  return config;
});

export function setBaseURL(newBaseURL) {
  API_BASE_URL = newBaseURL;
  api.defaults.baseURL = newBaseURL;
}

export function setApiKey(newApiKey) {
  if (newApiKey) {
    api.defaults.headers['X-API-Key'] = newApiKey;
  } else {
    delete api.defaults.headers['X-API-Key'];
  }
}

export function getBaseURL() {
  return API_BASE_URL;
}

export default api;
