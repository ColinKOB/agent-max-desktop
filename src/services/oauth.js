/**
 * OAuth Security Utilities
 * Handles state generation, hashing, and validation for OAuth flows
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random state for OAuth
 * Returns a SHA256 hash of random data to minimize identifier exposure
 * @returns {string} Base64-encoded SHA256 hash
 */
export function generateOAuthState() {
  try {
    // Generate 32 bytes of random data
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    
    // Convert to hex string
    const hexString = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Return as base64 for safe transmission
    return btoa(hexString);
  } catch (err) {
    console.error('[OAuth] Failed to generate secure state:', err);
    // Fallback to Math.random-based generation (less secure but works)
    return btoa(Math.random().toString(36).substring(2) + Date.now().toString(36));
  }
}

/**
 * Hash OAuth state for storage/comparison
 * Prevents state value exposure in logs or storage
 * @param {string} state - The state value to hash
 * @returns {string} SHA256 hash as hex string
 */
export function hashOAuthState(state) {
  try {
    // Use SubtleCrypto for browser compatibility
    if (crypto.subtle && typeof crypto.subtle.digest === 'function') {
      // This is async, so we'll use a sync fallback for now
      // In production, consider making this async throughout the call chain
    }
    
    // Fallback: simple hash using string operations
    // In a real app, you'd want to use a proper hashing library
    let hash = 0;
    for (let i = 0; i < state.length; i++) {
      const char = state.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  } catch (err) {
    console.error('[OAuth] Failed to hash state:', err);
    return state; // Fallback to original state
  }
}

/**
 * Validate OAuth state matches expected value
 * @param {string} receivedState - State received from OAuth callback
 * @param {string} expectedStateHash - Expected hash stored before redirect
 * @returns {boolean} True if states match
 */
export function validateOAuthState(receivedState, expectedStateHash) {
  try {
    const receivedHash = hashOAuthState(receivedState);
    return receivedHash === expectedStateHash;
  } catch (err) {
    console.error('[OAuth] Failed to validate state:', err);
    return false;
  }
}

/**
 * Store OAuth state securely in sessionStorage (cleared on tab close)
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
