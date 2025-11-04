import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  storeApiKey,
  getApiKey,
  deleteApiKey,
  storeTelemetryKey,
  getTelemetryKey,
  isSecureStorageAvailable,
  getStorageBackend,
} from '../../src/services/secureStorage';

describe('Secure Storage Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    // Mock window.electron if needed
    if (typeof window !== 'undefined' && !window.electron) {
      window.electron = undefined;
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('API Key Storage', () => {
    it('should store API key in localStorage (fallback)', async () => {
      const apiKey = 'test-api-key-12345';
      const result = await storeApiKey(apiKey);
      expect(result).toBe(true);
      
      const stored = localStorage.getItem('api_key_secure');
      expect(stored).toBe(apiKey);
    });

    it('should retrieve stored API key', async () => {
      const apiKey = 'test-api-key-12345';
      await storeApiKey(apiKey);
      
      const retrieved = await getApiKey();
      expect(retrieved).toBe(apiKey);
    });

    it('should return null if no API key stored', async () => {
      const retrieved = await getApiKey();
      expect(retrieved).toBeNull();
    });

    it('should delete API key', async () => {
      const apiKey = 'test-api-key-12345';
      await storeApiKey(apiKey);
      
      const deleted = await deleteApiKey();
      expect(deleted).toBe(true);
      
      const stored = localStorage.getItem('api_key_secure');
      expect(stored).toBeNull();
    });

    it('should reject empty API key', async () => {
      const result = await storeApiKey('');
      expect(result).toBe(false);
    });

    it('should reject null API key', async () => {
      const result = await storeApiKey(null);
      expect(result).toBe(false);
    });

    it('should overwrite existing API key', async () => {
      await storeApiKey('key1');
      await storeApiKey('key2');
      
      const retrieved = await getApiKey();
      expect(retrieved).toBe('key2');
    });
  });

  describe('Telemetry Key Storage', () => {
    it('should store telemetry key in localStorage (fallback)', async () => {
      const telemetryKey = 'test-telemetry-key-12345';
      const result = await storeTelemetryKey(telemetryKey);
      expect(result).toBe(true);
      
      const stored = localStorage.getItem('telemetry_key_secure');
      expect(stored).toBe(telemetryKey);
    });

    it('should retrieve stored telemetry key', async () => {
      const telemetryKey = 'test-telemetry-key-12345';
      await storeTelemetryKey(telemetryKey);
      
      const retrieved = await getTelemetryKey();
      expect(retrieved).toBe(telemetryKey);
    });

    it('should return null if no telemetry key stored', async () => {
      const retrieved = await getTelemetryKey();
      expect(retrieved).toBeNull();
    });

    it('should reject empty telemetry key', async () => {
      const result = await storeTelemetryKey('');
      expect(result).toBe(false);
    });
  });

  describe('Storage Backend Detection', () => {
    it('should report localStorage as backend when keytar unavailable', () => {
      const backend = getStorageBackend();
      expect(backend).toBe('localStorage');
    });

    it('should report secure storage unavailable without Electron keytar', () => {
      const available = isSecureStorageAvailable();
      expect(available).toBe(false);
    });
  });

  describe('Integration: Full API key lifecycle', () => {
    it('should handle complete API key lifecycle', async () => {
      const apiKey = 'lifecycle-test-key-12345';

      // Store
      const storeResult = await storeApiKey(apiKey);
      expect(storeResult).toBe(true);

      // Retrieve
      const retrieved = await getApiKey();
      expect(retrieved).toBe(apiKey);

      // Delete
      const deleteResult = await deleteApiKey();
      expect(deleteResult).toBe(true);

      // Verify deleted
      const afterDelete = await getApiKey();
      expect(afterDelete).toBeNull();
    });

    it('should handle separate API and telemetry key storage', async () => {
      const apiKey = 'api-key-value';
      const telemetryKey = 'telemetry-key-value';

      // Store both
      await storeApiKey(apiKey);
      await storeTelemetryKey(telemetryKey);

      // Retrieve both
      const retrievedApi = await getApiKey();
      const retrievedTelemetry = await getTelemetryKey();

      expect(retrievedApi).toBe(apiKey);
      expect(retrievedTelemetry).toBe(telemetryKey);

      // Verify they're stored separately
      expect(localStorage.getItem('api_key_secure')).toBe(apiKey);
      expect(localStorage.getItem('telemetry_key_secure')).toBe(telemetryKey);
    });
  });
});
