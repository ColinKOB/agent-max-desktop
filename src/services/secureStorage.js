/**
 * Secure Storage Service
 * Provides OS keychain integration for sensitive data (API keys, tokens)
 * Falls back to localStorage for web builds
 */

const SERVICE_NAME = 'agent-max-desktop';
const API_KEY_ACCOUNT = 'api-key';
const TELEMETRY_KEY_ACCOUNT = 'telemetry-api-key';

/**
 * Check if we're in an Electron environment with keytar support
 * @returns {boolean}
 */
function isElectronWithKeytar() {
  try {
    return (
      typeof window !== 'undefined' &&
      window.electron &&
      typeof window.electron.keytar === 'object' &&
      typeof window.electron.keytar.getPassword === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Store API key securely
 * Uses OS keychain in Electron, falls back to localStorage
 * @param {string} apiKey - The API key to store
 * @returns {Promise<boolean>} Success status
 */
export async function storeApiKey(apiKey) {
  if (!apiKey) {
    console.warn('[SecureStorage] Attempted to store empty API key');
    return false;
  }

  try {
    if (isElectronWithKeytar()) {
      // Use OS keychain (Electron)
      await window.electron.keytar.setPassword(SERVICE_NAME, API_KEY_ACCOUNT, apiKey);
      console.log('[SecureStorage] API key stored in OS keychain');
      return true;
    } else {
      // Fallback to localStorage (web)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('api_key_secure', apiKey);
        console.log('[SecureStorage] API key stored in localStorage (fallback)');
        return true;
      }
    }
  } catch (err) {
    console.error('[SecureStorage] Failed to store API key:', err);
  }
  return false;
}

/**
 * Retrieve API key securely
 * @returns {Promise<string|null>} The stored API key or null
 */
export async function getApiKey() {
  try {
    if (isElectronWithKeytar()) {
      // Try OS keychain first
      const key = await window.electron.keytar.getPassword(SERVICE_NAME, API_KEY_ACCOUNT);
      if (key) {
        console.log('[SecureStorage] API key retrieved from OS keychain');
        return key;
      }
    }

    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      const key = localStorage.getItem('api_key_secure');
      if (key) {
        console.log('[SecureStorage] API key retrieved from localStorage (fallback)');
        return key;
      }
    }
  } catch (err) {
    console.error('[SecureStorage] Failed to retrieve API key:', err);
  }
  return null;
}

/**
 * Delete API key from secure storage
 * @returns {Promise<boolean>} Success status
 */
export async function deleteApiKey() {
  try {
    if (isElectronWithKeytar()) {
      // Delete from OS keychain
      const deleted = await window.electron.keytar.deletePassword(SERVICE_NAME, API_KEY_ACCOUNT);
      if (deleted) {
        console.log('[SecureStorage] API key deleted from OS keychain');
        return true;
      }
    }

    // Delete from localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('api_key_secure');
      console.log('[SecureStorage] API key deleted from localStorage');
      return true;
    }
  } catch (err) {
    console.error('[SecureStorage] Failed to delete API key:', err);
  }
  return false;
}

/**
 * Store telemetry API key securely
 * @param {string} telemetryKey - The telemetry API key to store
 * @returns {Promise<boolean>} Success status
 */
export async function storeTelemetryKey(telemetryKey) {
  if (!telemetryKey) {
    console.warn('[SecureStorage] Attempted to store empty telemetry key');
    return false;
  }

  try {
    if (isElectronWithKeytar()) {
      await window.electron.keytar.setPassword(SERVICE_NAME, TELEMETRY_KEY_ACCOUNT, telemetryKey);
      console.log('[SecureStorage] Telemetry key stored in OS keychain');
      return true;
    } else {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('telemetry_key_secure', telemetryKey);
        console.log('[SecureStorage] Telemetry key stored in localStorage (fallback)');
        return true;
      }
    }
  } catch (err) {
    console.error('[SecureStorage] Failed to store telemetry key:', err);
  }
  return false;
}

/**
 * Retrieve telemetry API key securely
 * @returns {Promise<string|null>} The stored telemetry key or null
 */
export async function getTelemetryKey() {
  try {
    if (isElectronWithKeytar()) {
      const key = await window.electron.keytar.getPassword(SERVICE_NAME, TELEMETRY_KEY_ACCOUNT);
      if (key) {
        console.log('[SecureStorage] Telemetry key retrieved from OS keychain');
        return key;
      }
    }

    if (typeof localStorage !== 'undefined') {
      const key = localStorage.getItem('telemetry_key_secure');
      if (key) {
        console.log('[SecureStorage] Telemetry key retrieved from localStorage (fallback)');
        return key;
      }
    }
  } catch (err) {
    console.error('[SecureStorage] Failed to retrieve telemetry key:', err);
  }
  return null;
}

/**
 * Check if secure storage is available (keytar in Electron)
 * @returns {boolean}
 */
export function isSecureStorageAvailable() {
  return Boolean(isElectronWithKeytar());
}

/**
 * Get storage backend name for debugging/UI purposes
 * @returns {string} 'keychain' or 'localStorage'
 */
export function getStorageBackend() {
  return isElectronWithKeytar() ? 'keychain' : 'localStorage';
}
