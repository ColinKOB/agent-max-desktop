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
  const [level, setLevel] = useState('helpful'); // Default
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
      
      setLevel(data.permission_level || 'helpful');
      setCapabilities({
        can_do: data.can_do || [],
        requires_approval: data.requires_approval || []
      });
    } catch (err) {
      console.error('Failed to load permission level:', err);
      setError(err.message || 'Failed to load permission level');
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };
  
  const updateLevel = async (newLevel) => {
    try {
      await permissionAPI.updateLevel(newLevel);
      await loadPermissionLevel(); // Reload to get new capabilities
    } catch (err) {
      console.error('Failed to update permission level:', err);
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
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  
  return context;
}

export default PermissionContext;
