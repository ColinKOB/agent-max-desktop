/**
 * Permission Context
 * 
 * Global state management for user's permission level
 * Provides permission level and functions to update it
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { permissionAPI } from '../services/api';

const PermissionContext = createContext();

export function PermissionProvider({ children }) {
  const [level, setLevel] = useState('chatty'); // Default - chatty (read-only) or auto (full capabilities)
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
  
  const loadPermissionLevel = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await permissionAPI.getLevel();
      const data = response.data || response;
      
      // Normalize permission level to valid values
      let normalizedLevel = data.permission_level || 'chatty';
      // Migrate deprecated values: helpful/powerful/autonomous -> auto
      if (['helpful', 'powerful', 'autonomous'].includes(normalizedLevel)) {
        normalizedLevel = 'auto';
      }
      setLevel(normalizedLevel);
      setCapabilities({
        can_do: data.can_do || data.capabilities?.can_do || [],
        requires_approval: data.requires_approval || data.capabilities?.requires_approval || []
      });
    } catch (err) {
      console.error('Failed to load permission level:', err);
      setError(err.message || 'Failed to load permission level');
      try {
        let saved = localStorage.getItem('permission_level');
        if (saved) {
          // Migrate legacy values to valid ones: helpful/powerful/autonomous -> auto
          if (['helpful', 'powerful', 'autonomous'].includes(saved)) {
            saved = 'auto';
            localStorage.setItem('permission_level', 'auto');
          }
          setLevel(saved);
        }
      } catch {}
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Update permission level
   * 
   * Valid levels: 'chatty' (default) or 'autonomous' (full capabilities)
   * 
   * ⚠️ ARCHIVED/DEPRECATED - DO NOT USE:
   * // 'helpful' and 'powerful' are NO LONGER VALID
   * // They will be rejected by the backend with a 400 error
   */
  const updateLevel = async (newLevel) => {
    try {
      // Only 'chatty' and 'autonomous' are valid
      try { localStorage.setItem('permission_level', newLevel); } catch {}
      setLevel(newLevel);
      await permissionAPI.updateLevel(newLevel);
      await loadPermissionLevel(); // Reload to get new capabilities
    } catch (err) {
      console.error('Failed to update permission level:', err);
      try { localStorage.setItem('permission_level', newLevel); } catch {}
      setLevel(newLevel);
      throw err; // Let the component handle the error
    }
  };
  
  const checkSafety = async (message, context = {}) => {
    try {
      const response = await permissionAPI.check(message, context);
      return response.data || response;
    } catch (err) {
      console.error('Safety check failed:', err);
      // Return safe default on error
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
    // Graceful fallback if Provider is not mounted (e.g., alternate entry points or HMR)
    const fallbackLevel = (() => {
      try {
        let saved = localStorage.getItem('permission_level');
        // Migrate deprecated values
        if (saved && ['helpful', 'powerful', 'autonomous'].includes(saved)) {
          saved = 'auto';
          localStorage.setItem('permission_level', 'auto');
        }
        return saved || 'chatty';
      } catch { return 'chatty'; }
    })();
    return {
      level: fallbackLevel,
      capabilities: { can_do: [], requires_approval: [] },
      loading: false,
      error: null,
      updateLevel: async (newLevel) => {
        try {
          await permissionAPI.updateLevel(newLevel);
          try { localStorage.setItem('permission_level', newLevel); } catch {}
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
