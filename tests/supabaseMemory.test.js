/**
 * Supabase Memory Service Tests
 * 
 * Tests online/offline scenarios, sync queue, and fallback behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getProfile,
  updateProfile,
  getFacts,
  setFact,
  deleteFact,
  getPreferences,
  getPreference,
  setPreference,
  startSession,
  addMessage,
  getRecentMessages,
  clearSession,
  getAllSessions,
  updateConsent,
  getConsent,
  buildContext,
  getSyncStatus,
  forceSync
} from '../src/services/supabaseMemory.js';

// Mock Supabase
vi.mock('../src/services/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn()
          }))
        }))
      })),
      insert: vi.fn(),
      update: vi.fn(() => ({
        eq: vi.fn()
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  },
  getUserFacts: vi.fn(),
  setUserFact: vi.fn(),
  getUserPreferences: vi.fn(),
  setUserPreference: vi.fn(),
  createSession: vi.fn(),
  getUserSessions: vi.fn(),
  storeMessage: vi.fn()
}));

// Mock Electron memory
const mockElectronMemory = {
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  getFacts: vi.fn(),
  setFact: vi.fn(),
  deleteFact: vi.fn(),
  getPreferences: vi.fn(),
  setPreference: vi.fn(),
  startSession: vi.fn(),
  addMessage: vi.fn(),
  getRecentMessages: vi.fn(),
  clearSession: vi.fn(),
  getAllSessions: vi.fn()
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: {
    memory: mockElectronMemory
  },
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true
});

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key'
  },
  writable: true
});

// Mock logger
vi.mock('../src/services/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('SupabaseMemory Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user_id') return 'test-user-123';
      if (key === 'session_id') return 'test-session-123';
      if (key === 'consent_scopes') return JSON.stringify({
        prompts: true,
        outputs: true,
        tools: false,
        screenshots: false
      });
      return null;
    });
  });

  describe('Profile Operations', () => {
    it('should get profile from Supabase when online', async () => {
      const mockProfile = {
        metadata: {
          profile: {
            name: 'Test User',
            interaction_count: 5
          }
        }
      };

      const { supabase } = require('../src/services/supabase.js');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
          })
        })
      });

      const profile = await getProfile();

      expect(profile).toEqual({
        name: 'Test User',
        interaction_count: 5,
        temporal_info: {},
        top_preferences: []
      });
    });

    it('should fallback to Electron when Supabase fails', async () => {
      mockElectronMemory.getProfile.mockResolvedValue({
        name: 'Electron User',
        interaction_count: 3
      });

      const { supabase } = require('../src/services/supabase.js');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Supabase error'))
          })
        })
      });

      const profile = await getProfile();

      expect(profile).toEqual({
        name: 'Electron User',
        interaction_count: 3
      });
      expect(mockElectronMemory.getProfile).toHaveBeenCalled();
    });

    it('should update profile in Supabase when online', async () => {
      const { supabase } = require('../src/services/supabase.js');
      
      // Mock get current metadata
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { metadata: { profile: { name: 'Old Name' } } },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
      });

      await updateProfile({ name: 'New Name' });

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user_id', 'test-user-123');
    });
  });

  describe('Facts Operations', () => {
    it('should get facts from Supabase when online', async () => {
      const mockFacts = [
        { category: 'personal', key: 'name', value: 'John' },
        { category: 'personal', key: 'city', value: 'NYC' }
      ];

      const { getUserFacts } = require('../src/services/supabase.js');
      getUserFacts.mockResolvedValue(mockFacts);

      const facts = await getFacts();

      expect(facts).toEqual({
        personal: {
          name: 'John',
          city: 'NYC'
        }
      });
    });

    it('should set fact in Supabase when online', async () => {
      const { setUserFact } = require('../src/services/supabase.js');
      setUserFact.mockResolvedValue({});

      await setFact('personal', 'email', 'john@example.com');

      expect(setUserFact).toHaveBeenCalledWith(
        'test-user-123',
        'personal',
        'email',
        'john@example.com',
        'user'
      );
    });

    it('should queue fact operation when offline', async () => {
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      const { setUserFact } = require('../src/services/supabase.js');
      setUserFact.mockRejectedValue(new Error('Network error'));

      mockElectronMemory.setFact.mockResolvedValue({});

      await setFact('personal', 'email', 'john@example.com');

      expect(mockElectronMemory.setFact).toHaveBeenCalledWith('personal', 'email', 'john@example.com');
    });
  });

  describe('Preferences Operations', () => {
    it('should get preferences from Supabase when online', async () => {
      const mockPrefs = [
        { key: 'theme', value: 'dark' },
        { key: 'language', value: 'en' }
      ];

      const { getUserPreferences } = require('../src/services/supabase.js');
      getUserPreferences.mockResolvedValue(mockPrefs);

      const prefs = await getPreferences();

      expect(prefs).toEqual({
        theme: 'dark',
        language: 'en'
      });
    });

    it('should get specific preference', async () => {
      const { getUserPreferences } = require('../src/services/supabase.js');
      getUserPreferences.mockResolvedValue([
        { key: 'theme', value: 'dark' },
        { key: 'language', value: 'en' }
      ]);

      const theme = await getPreference('theme');

      expect(theme).toBe('dark');
    });

    it('should set preference in Supabase when online', async () => {
      const { setUserPreference } = require('../src/services/supabase.js');
      setUserPreference.mockResolvedValue({});

      await setPreference('theme', 'light', 'ui');

      expect(setUserPreference).toHaveBeenCalledWith(
        'test-user-123',
        'theme',
        'light',
        'ui'
      );
    });
  });

  describe('Session Operations', () => {
    it('should start session in Supabase when online', async () => {
      const { createSession } = require('../src/services/supabase.js');
      createSession.mockResolvedValue({ id: 'new-session-123' });

      const sessionId = await startSession('Test Session');

      expect(sessionId).toBe('new-session-123');
      expect(createSession).toHaveBeenCalledWith('test-user-123', 'Test Session', 'private');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('session_id', 'new-session-123');
    });

    it('should fallback to Electron for session when offline', async () => {
      const { createSession } = require('../src/services/supabase.js');
      createSession.mockRejectedValue(new Error('Network error'));
      
      mockElectronMemory.startSession.mockResolvedValue('electron-session-456');

      const sessionId = await startSession();

      expect(sessionId).toBe('electron-session-456');
      expect(mockElectronMemory.startSession).toHaveBeenCalled();
    });

    it('should add message to session', async () => {
      const { storeMessage } = require('../src/services/supabase.js');
      storeMessage.mockResolvedValue({});

      await addMessage('user', 'Hello world');

      expect(storeMessage).toHaveBeenCalledWith(
        'test-session-123',
        'user',
        'Hello world',
        'Hello world',
        expect.objectContaining({ timestamp: expect.any(String) })
      );
    });

    it('should get recent messages from session', async () => {
      const mockMessages = [
        { role: 'user', content: 'Hello', created_at: '2025-01-01T10:00:00Z' },
        { role: 'assistant', content: 'Hi there!', created_at: '2025-01-01T10:00:05Z' }
      ];

      const { supabase } = require('../src/services/supabase.js');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: mockMessages, error: null })
            })
          })
        })
      });

      const messages = await getRecentMessages();

      expect(messages).toEqual([
        { role: 'user', content: 'Hello', timestamp: expect.any(Number) },
        { role: 'assistant', content: 'Hi there!', timestamp: expect.any(Number) }
      ]);
    });
  });

  describe('Consent Operations', () => {
    it('should update consent scopes', async () => {
      const { supabase } = require('../src/services/supabase.js');
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      await updateConsent({ prompts: false, tools: true });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'consent_scopes',
        JSON.stringify({
          prompts: true,
          outputs: true,
          tools: false,
          screenshots: false,
          prompts: false,
          tools: true
        })
      );
    });

    it('should get current consent', () => {
      const consent = getConsent();

      expect(consent).toEqual({
        prompts: true,
        outputs: true,
        tools: false,
        screenshots: false
      });
    });
  });

  describe('Sync Queue', () => {
    it('should report sync status', () => {
      const status = getSyncStatus();

      expect(status).toEqual({
        isOnline: true,
        queueLength: 0,
        syncInProgress: false
      });
    });

    it('should handle offline mode', async () => {
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

      const { setUserFact } = require('../src/services/supabase.js');
      mockElectronMemory.setFact.mockResolvedValue({});

      await setFact('test', 'key', 'value');

      const status = getSyncStatus();
      expect(status.isOnline).toBe(false);
      expect(status.queueLength).toBe(1);
    });
  });

  describe('Context Building', () => {
    it('should build context from all sources', async () => {
      // Mock all the dependencies
      const { getUserFacts, getUserPreferences } = require('../src/services/supabase.js');
      getUserFacts.mockResolvedValue([{ category: 'test', key: 'fact', value: 'value' }]);
      getUserPreferences.mockResolvedValue([{ key: 'pref', value: 'dark' }]);

      const { supabase } = require('../src/services/supabase.js');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { metadata: { profile: { name: 'Test' } } },
              error: null
            })
          })
        })
      });

      const context = await buildContext();

      expect(context).toEqual({
        profile: { name: 'Test', temporal_info: {}, top_preferences: [] },
        facts: { test: { fact: 'value' } },
        preferences: { pref: 'dark' },
        recentMessages: [],
        built_at: expect.any(String)
      });
    });

    it('should handle errors in context building', async () => {
      // Mock failure
      const { supabase } = require('../src/services/supabase.js');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Network error'))
          })
        })
      });

      mockElectronMemory.getProfile.mockRejectedValue(new Error('Electron error'));

      const context = await buildContext();

      expect(context.error).toBeDefined();
      expect(context.profile).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('should throw error when user not initialized', async () => {
      localStorageMock.getItem.mockImplementation(() => null);

      await expect(getProfile()).rejects.toThrow('User not initialized');
      await expect(setFact('test', 'key', 'value')).rejects.toThrow('User not initialized');
      await expect(startSession()).rejects.toThrow('User not initialized');
    });

    it('should handle missing Electron memory gracefully', async () => {
      // Remove Electron memory
      delete window.electron.memory;

      const { supabase } = require('../src/services/supabase.js');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Supabase error'))
          })
        })
      });

      await expect(getProfile()).rejects.toThrow('No memory service available');
    });
  });
});
