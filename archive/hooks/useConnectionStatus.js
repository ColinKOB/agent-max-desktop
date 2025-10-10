import { useState, useEffect } from 'react';
import { addConnectionListener } from '../services/api';

/**
 * Hook to monitor API connection status
 * @returns {Object} { isConnected, isChecking }
 */
export default function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Subscribe to connection changes
    const unsubscribe = addConnectionListener((connected) => {
      setIsConnected(connected);
      setIsChecking(false);
    });

    return unsubscribe;
  }, []);

  return { isConnected, isChecking };
}
