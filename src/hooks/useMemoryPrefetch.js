/**
 * Memory V3 Prefetch Hook
 * 
 * Provides debounced memory candidate prefetching for UI typing hints.
 * Uses Redis-cached backend endpoint for fast responses.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';
import { createLogger } from '../services/logger';

const logger = createLogger('useMemoryPrefetch');

// Get API base URL from environment
const API_BASE = import.meta.env.VITE_API_URL || 'https://agentmax-production.up.railway.app';

/**
 * Hook for memory prefetch functionality
 * 
 * @param {string} draftText - Current draft message text
 * @param {object} options - Configuration options
 * @returns {object} Prefetch state and controls
 */
export function useMemoryPrefetch(draftText, options = {}) {
  const {
    enabled = true,
    debounceMs = 350,
    minLength = 3,
    projectId = null,
    userId = null,
  } = options;

  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [draftHash, setDraftHash] = useState('');

  // Track if component is mounted
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch memory candidates from backend
   */
  const fetchCandidates = useCallback(async (text, force = false) => {
    if (!text || text.trim().length < minLength) {
      setCandidates([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // Add user ID if available
      if (userId) {
        headers['X-User-Id'] = userId;
      }

      // Add API key if available
      const apiKey = import.meta.env.VITE_API_KEY;
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const response = await fetch(`${API_BASE}/api/memory/prefetch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          draft_text: text,
          project_id: projectId,
          force_refresh: force,
        }),
      });

      if (!response.ok) {
        throw new Error(`Prefetch failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setCandidates(data.candidates || []);
        setCacheHit(data.cache_hit || false);
        setDraftHash(data.draft_hash || '');
        setError(null);

        logger.debug('Prefetch success', {
          candidatesCount: data.candidates?.length || 0,
          cacheHit: data.cache_hit,
          hash: data.draft_hash,
        });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message);
        setCandidates([]);
        logger.error('Prefetch failed', { error: err.message });
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [minLength, projectId, userId]);

  // Create debounced fetch function
  const debouncedFetch = useRef(
    debounce((text) => {
      fetchCandidates(text);
    }, debounceMs)
  ).current;

  // Trigger prefetch when draft text changes
  useEffect(() => {
    if (!enabled) {
      setCandidates([]);
      return;
    }

    if (!draftText || draftText.trim().length < minLength) {
      debouncedFetch.cancel();
      setCandidates([]);
      setError(null);
      return;
    }

    debouncedFetch(draftText);

    // Cleanup
    return () => {
      debouncedFetch.cancel();
    };
  }, [draftText, enabled, minLength, debouncedFetch]);

  /**
   * Force refresh (bypass cache)
   */
  const refresh = useCallback(() => {
    if (draftText && draftText.trim().length >= minLength) {
      debouncedFetch.cancel();
      fetchCandidates(draftText, true);
    }
  }, [draftText, minLength, fetchCandidates, debouncedFetch]);

  /**
   * Clear candidates
   */
  const clear = useCallback(() => {
    debouncedFetch.cancel();
    setCandidates([]);
    setError(null);
    setCacheHit(false);
    setDraftHash('');
  }, [debouncedFetch]);

  return {
    candidates,
    isLoading,
    error,
    cacheHit,
    draftHash,
    hasResults: candidates.length > 0,
    refresh,
    clear,
  };
}

/**
 * Get user ID from localStorage or generate a temporary one
 */
export function getUserIdForMemory() {
  try {
    // Try to get from Supabase session
    const session = JSON.parse(localStorage.getItem('supabase.auth.token') || '{}');
    if (session?.user?.id) {
      return session.user.id;
    }

    // Try to get from custom storage
    const userId = localStorage.getItem('agentmax_user_id');
    if (userId) {
      return userId;
    }

    // Generate temporary ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('agentmax_user_id', tempId);
    return tempId;
  } catch (error) {
    logger.error('Failed to get user ID', { error: error.message });
    return `temp-${Date.now()}`;
  }
}

export default useMemoryPrefetch;
