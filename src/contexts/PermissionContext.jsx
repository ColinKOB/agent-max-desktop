/**
 * Permission Context
 *
 * Global state management for user's permission level
 * Provides permission level and functions to update it
 *
 * Chatty mode was retired 2026-07-10: 'autonomous' is the only mode.
 * Legacy 'chatty' values from storage or the backend coerce to autonomous.
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { permissionAPI } from '../services/api';

const PermissionContext = createContext();

/**
 * Normalize permission level. Chatty is retired; everything is autonomous.
 */
function validateMode(mode) {
  if (mode && mode.toLowerCase() !== 'autonomous') {
    console.warn(`[Mode] Coercing retired/invalid mode '${mode}' to 'autonomous'`);
  }
  return 'autonomous';
}

export function PermissionProvider({ children }) {
  const [level, setLevel] = useState('autonomous');
  const [capabilities, setCapabilities] = useState({
    can_do: [],
    requires_approval: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load permission level on mount
  useEffect(() => {
    loadPermissionLevel();
  }, []);

  useEffect(() => {
    const handlePermissionStorage = (event) => {
      if (event.key !== 'permission_level' || !event.newValue) return;
      setLevel(validateMode(event.newValue));
    };

    window.addEventListener('storage', handlePermissionStorage);
    return () => window.removeEventListener('storage', handlePermissionStorage);
  }, []);

  const loadPermissionLevel = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await permissionAPI.getLevel();
      const data = response.data || response;

      // Normalize permission level using single source of truth
      const normalizedLevel = validateMode(data.permission_level);
      setLevel(normalizedLevel);
      setCapabilities({
        can_do: data.can_do || data.capabilities?.can_do || [],
        requires_approval: data.requires_approval || data.capabilities?.requires_approval || []
      });
    } catch (err) {
      console.error('Failed to load permission level:', err);
      setError(err.message || 'Failed to load permission level');
      try {
        const saved = localStorage.getItem('permission_level');
        if (saved) {
          const normalized = validateMode(saved);
          // Update localStorage if it had a deprecated value
          if (saved !== normalized) {
            localStorage.setItem('permission_level', normalized);
          }
          setLevel(normalized);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update permission level
   *
   * Only valid level: 'autonomous' (chatty retired 2026-07-10)
   */
  const updateLevel = async (newLevel) => {
    // Normalize the level before saving
    const normalized = validateMode(newLevel);
    try {
      try { localStorage.setItem('permission_level', normalized); } catch {}
      setLevel(normalized);
      await permissionAPI.updateLevel(normalized);
      await loadPermissionLevel(); // Reload to get new capabilities
    } catch (err) {
      console.error('Failed to update permission level:', err);
      try { localStorage.setItem('permission_level', normalized); } catch {}
      setLevel(normalized);
      throw err;
    }
  };

  const checkSafety = async (message, context = {}) => {
    try {
      const response = await permissionAPI.check(message, context);
      return response.data || response;
    } catch (err) {
      console.error('Safety check failed:', err);
      return {
        allowed: false,
        requires_approval: true,
        permission_level: level,
        markers: [],
        reason: 'Safety check failed',
        suggested_flow: null,
        draft_supported: false,
        is_high_risk: false
      };
    }
  };

  const value = {
    level,
    capabilities,
    loading,
    error,
    updateLevel,
    checkSafety,
    reload: loadPermissionLevel
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  const context = useContext(PermissionContext);

  if (!context) {
    // Graceful fallback if Provider is not mounted
    const fallbackLevel = (() => {
      try {
        const saved = localStorage.getItem('permission_level');
        return validateMode(saved);
      } catch { return 'autonomous'; }
    })();
    return {
      level: fallbackLevel,
      capabilities: { can_do: [], requires_approval: [] },
      loading: false,
      error: null,
      updateLevel: async (newLevel) => {
        const normalized = validateMode(newLevel);
        try {
          await permissionAPI.updateLevel(normalized);
          try { localStorage.setItem('permission_level', normalized); } catch {}
        } catch {}
      },
      checkSafety: async () => ({
        allowed: true,
        requires_approval: false,
        permission_level: fallbackLevel,
        markers: [],
        reason: 'fallback',
        suggested_flow: null,
        draft_supported: false,
        is_high_risk: false
      }),
      reload: async () => {}
    };
  }

  return context;
}

export default PermissionContext;
