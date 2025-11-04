import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateOAuthState,
  hashOAuthState,
  validateOAuthState,
  storeOAuthStateHash,
  retrieveAndClearOAuthStateHash,
} from '../../src/services/oauth';

describe('OAuth Security Utilities', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });

  afterEach(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });

  describe('generateOAuthState', () => {
    it('should generate a non-empty state', () => {
      const state = generateOAuthState();
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });

    it('should generate different states on each call', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      expect(state1).not.toBe(state2);
    });

    it('should return base64-encoded string', () => {
      const state = generateOAuthState();
      // Base64 strings contain alphanumeric, +, /, and = characters
      expect(/^[A-Za-z0-9+/=]+$/.test(state)).toBe(true);
    });
  });

  describe('hashOAuthState', () => {
    it('should hash a state consistently', () => {
      const state = 'test-state-value';
      const hash1 = hashOAuthState(state);
      const hash2 = hashOAuthState(state);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different states', () => {
      const hash1 = hashOAuthState('state1');
      const hash2 = hashOAuthState('state2');
      expect(hash1).not.toBe(hash2);
    });

    it('should return a non-empty string', () => {
      const hash = hashOAuthState('test-state');
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('validateOAuthState', () => {
    it('should validate matching state and hash', () => {
      const state = 'test-state';
      const hash = hashOAuthState(state);
      const isValid = validateOAuthState(state, hash);
      expect(isValid).toBe(true);
    });

    it('should reject mismatched state and hash', () => {
      const state1 = 'test-state-1';
      const state2 = 'test-state-2';
      const hash = hashOAuthState(state1);
      const isValid = validateOAuthState(state2, hash);
      expect(isValid).toBe(false);
    });

    it('should handle empty states gracefully', () => {
      const hash = hashOAuthState('');
      const isValid = validateOAuthState('', hash);
      expect(isValid).toBe(true);
    });
  });

  describe('storeOAuthStateHash', () => {
    it('should store hash in sessionStorage', () => {
      const hash = 'test-hash-value';
      storeOAuthStateHash(hash);
      const stored = sessionStorage.getItem('oauth_state_hash');
      expect(stored).toBe(hash);
    });

    it('should overwrite previous hash', () => {
      storeOAuthStateHash('hash1');
      storeOAuthStateHash('hash2');
      const stored = sessionStorage.getItem('oauth_state_hash');
      expect(stored).toBe('hash2');
    });
  });

  describe('retrieveAndClearOAuthStateHash', () => {
    it('should retrieve stored hash', () => {
      const hash = 'test-hash-value';
      storeOAuthStateHash(hash);
      const retrieved = retrieveAndClearOAuthStateHash();
      expect(retrieved).toBe(hash);
    });

    it('should clear hash after retrieval', () => {
      const hash = 'test-hash-value';
      storeOAuthStateHash(hash);
      retrieveAndClearOAuthStateHash();
      const stored = sessionStorage.getItem('oauth_state_hash');
      expect(stored).toBeNull();
    });

    it('should return null if no hash stored', () => {
      const retrieved = retrieveAndClearOAuthStateHash();
      expect(retrieved).toBeNull();
    });
  });

  describe('Integration: Full OAuth state flow', () => {
    it('should handle complete state generation and validation flow', () => {
      // Generate secure state
      const state = generateOAuthState();
      expect(state).toBeTruthy();

      // Hash and store
      const hash = hashOAuthState(state);
      storeOAuthStateHash(hash);

      // Retrieve and validate
      const storedHash = retrieveAndClearOAuthStateHash();
      const isValid = validateOAuthState(state, storedHash);
      expect(isValid).toBe(true);

      // Verify hash is cleared
      const afterClear = sessionStorage.getItem('oauth_state_hash');
      expect(afterClear).toBeNull();
    });
  });
});
