/**
 * OAuth Security Utilities
 * Handles state generation, hashing, and validation for OAuth flows
 *
 * Uses the Web Crypto API (globalThis.crypto), which is available in both
 * the Electron renderer and browsers. Do NOT import Node's `crypto` module
 * here: Vite externalizes it for renderer builds, which silently breaks
 * getRandomValues/subtle and forces insecure fallbacks.
 */

const webCrypto = globalThis.crypto;

/**
 * Generate a cryptographically secure random state for OAuth
 * @returns {string} Base64-encoded random value
 */
export function generateOAuthState() {
  const randomBytes = webCrypto.getRandomValues(new Uint8Array(32));
  const hexString = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return btoa(hexString);
}

/**
 * Hash OAuth state for storage/comparison (SHA-256).
 * Prevents raw state value exposure in logs or storage.
 * @param {string} state - The state value to hash
 * @returns {Promise<string>} SHA-256 hash as hex string
 */
export async function hashOAuthState(state) {
  const data = new TextEncoder().encode(state);
  const digest = await webCrypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate OAuth state matches expected value
 * @param {string} receivedState - State received from OAuth callback
 * @param {string} expectedStateHash - Expected hash stored before redirect
 * @returns {Promise<boolean>} True if states match
 */
export async function validateOAuthState(receivedState, expectedStateHash) {
  try {
    const receivedHash = await hashOAuthState(receivedState);
    return receivedHash === expectedStateHash;
  } catch (err) {
    console.error('[OAuth] Failed to validate state:', err);
    return false;
  }
}

/**
 * Store OAuth state hash in sessionStorage (cleared on window close)
 * @param {string} stateHash - Hashed state to store
 */
export function storeOAuthStateHash(stateHash) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('oauth_state_hash', stateHash);
    }
  } catch (err) {
    console.error('[OAuth] Failed to store state hash:', err);
  }
}

/**
 * Retrieve and clear OAuth state hash from sessionStorage
 * @returns {string|null} Stored state hash or null if not found
 */
export function retrieveAndClearOAuthStateHash() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const hash = sessionStorage.getItem('oauth_state_hash');
      sessionStorage.removeItem('oauth_state_hash');
      return hash;
    }
  } catch (err) {
    console.error('[OAuth] Failed to retrieve state hash:', err);
  }
  return null;
}
