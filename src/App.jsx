import { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import AppleFloatBar from './components/FloatBar/AppleFloatBar';
import UITestDashboard from './pages/UITestDashboard';
import useStore from './store/useStore';
import { healthAPI, profileAPI } from './services/api';
import apiConfigManager from './config/apiConfig';
import { getOrCreateUser } from './services/supabase';
import { getProfile, getPreference, syncLocalIndex } from './services/supabaseMemory';
import { preloadModel } from './services/embeddings';
import { createLogger } from './services/logger';
import { PermissionProvider } from './contexts/PermissionContext';
import UpdateNotification from './components/UpdateNotification';
import { UserInputDialog } from './components/UserInputDialog';

const logger = createLogger('App');

function App({ windowMode = 'single' }) {
  const { setApiConnected, setProfile, setGreeting } = useStore();
  // Default to ready state so the floatbar pill renders immediately; async inits can adjust afterward.
  const [showWelcome, setShowWelcome] = useState(false); // true = show onboarding, false = hide
  const [isLoading, setIsLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(null);

  useEffect(() => {
    // Initialize user in Supabase
    initializeUser();
    
    // Initialize hybrid search (async, non-blocking)
    initializeHybridSearch();
    
    // Check API connection
    checkApiConnection();

    // Load initial profile
    loadProfile();

    // Set up update listeners
    setupUpdateListeners();

    // Adaptive health check with exponential backoff
    let checkInterval = 30000; // Start with 30 seconds
    let intervalId;

    const scheduleNextCheck = (wasSuccessful) => {
      if (wasSuccessful) {
        // Reset to normal interval on success
        checkInterval = 30000;
      } else {
        // Exponential backoff: 30s → 60s → 120s → max 300s (5min)
        checkInterval = Math.min(checkInterval * 2, 300000);
      }

      intervalId = setTimeout(async () => {
        const success = await checkApiConnection();
        scheduleNextCheck(success);
      }, checkInterval);
    };

    // Start the adaptive checking
    checkApiConnection().then(scheduleNextCheck);

    return () => {
      if (intervalId) clearTimeout(intervalId);
    };
  }, []);

  // Probe backend-provided desktop config (.well-known/desktop-config) once on boot
  useEffect(() => {
    try { apiConfigManager.probeWellKnownAndApply?.(); } catch {}
  }, []);

  // Global UI indicators for telemetry 401s and API endpoint fallbacks
  useEffect(() => {
    const onTelemetryUnauthorized = () => {
      try { toast.error('Telemetry unauthorized. Check API key/config.'); } catch {}
    };
    const onApiFallback = (evt) => {
      try {
        const { method, path, status } = evt?.detail || {};
        // Show fallback indicator in development to avoid noisy production UX
        if (import.meta.env.DEV) {
          toast((t) => (
            `Using fallback endpoint (${status}): ${method?.toUpperCase?.() || ''} ${path}`
          ), { id: 'api-fallback' });
        }
      } catch {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('telemetry:unauthorized', onTelemetryUnauthorized);
      window.addEventListener('api:fallback', onApiFallback);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('telemetry:unauthorized', onTelemetryUnauthorized);
        window.removeEventListener('api:fallback', onApiFallback);
      }
    };
  }, []);

  // Check if app was just updated and show a brief notification
  useEffect(() => {
    try {
      const justUpdated = localStorage.getItem('app_just_updated');
      if (justUpdated) {
        const { version, timestamp } = JSON.parse(justUpdated);
        // Only show if update was within the last 30 seconds
        if (Date.now() - timestamp < 30000) {
          setUpdateInfo({ justUpdated: true, version });
          // Auto-dismiss after 5 seconds
          setTimeout(() => {
            setUpdateInfo(null);
            localStorage.removeItem('app_just_updated');
          }, 5000);
        } else {
          localStorage.removeItem('app_just_updated');
        }
      }
    } catch {
      localStorage.removeItem('app_just_updated');
    }
  }, []);

  const initializeUser = async () => {
    try {
      // Generate or retrieve device_id
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        const gen = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
          ? globalThis.crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
        deviceId = gen();
        localStorage.setItem('device_id', deviceId);
        logger.info('Generated new device ID', { deviceId });
      }

      // Create or get user in Supabase
      const user = await getOrCreateUser(deviceId);
      if (user) {
        localStorage.setItem('user_id', user.id);
        logger.info('User initialized', { userId: user.id, credits: user.metadata?.credits || 0 });
        
        // Store user in global store for easy access
        useStore.getState().setCurrentUser(user);
      }
    } catch (error) {
      logger.error('Failed to initialize user', error);
      // Continue app operation even if user init fails
    }
  };

  const initializeHybridSearch = async () => {
    try {
      logger.info('Initializing hybrid search system...');
      
      // Preload the embedding model
      await preloadModel();
      logger.info('Hybrid search initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize hybrid search:', error);
    }
  };

  const setupUpdateListeners = () => {
    // Only set up listeners in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Listen for update available
      window.electronAPI.onUpdateAvailable?.((info) => {
        logger.info('Update available:', info);
        setUpdateInfo(info);
      });

      // Listen for download progress
      window.electronAPI.onUpdateDownloadProgress?.((progress) => {
        logger.info('Update download progress:', progress);
        setUpdateProgress(progress);
      });

      // Listen for update downloaded
      window.electronAPI.onUpdateDownloaded?.((info) => {
        logger.info('Update downloaded:', info);
        setUpdateInfo({ ...info, downloaded: true });
      });

      // Listen for update errors
      window.electronAPI.onUpdateError?.((error) => {
        logger.error('Update error:', error);
        setUpdateInfo({ error: error.message });
      });
    }
  };

  const checkApiConnection = async () => {
    try {
      const apiUrl = apiConfigManager.getBaseURL();
      logger.debug('GET /health');
      await healthAPI.check();
      setApiConnected(true);
      return true;
    } catch (error) {
      // Health check failed; rely on API interceptors for detailed error logs
      logger.warn('Health check failed');
      setApiConnected(false);
      return false;
    }
  };

  const loadProfile = async () => {
    try {
      // Load profile from Supabase (with Electron fallback)
      const profileData = await getProfile();

      // Check onboarding completion with local-first logic
      let localCompleted = false;
      try { localCompleted = localStorage.getItem('onboarding_completed') === 'true'; } catch {}
      const firstRun = (() => {
        try {
          return !localStorage.getItem('user_data') || !localStorage.getItem('device_id');
        } catch { return false; }
      })();

      // Show onboarding if it's first run OR locally not completed
      setShowWelcome(firstRun || !localCompleted);

      setProfile({
        name: profileData.name || 'User',
        interaction_count: profileData.interaction_count || 0,
        temporal_info: profileData.temporal_info || {},
        top_preferences: profileData.top_preferences || [],
      });

      // Generate greeting
      const greeting = profileData.name ? `Hi, ${profileData.name}!` : 'Hi there!';
      setGreeting(greeting);
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Set default profile if everything fails
      setProfile({
        name: 'User',
        interaction_count: 0,
        temporal_info: {},
        top_preferences: [],
      });
      setGreeting('Hi there!');
      setShowWelcome(true); // Show welcome if error (first time)
    } finally {
      setIsLoading(false);
    }
  };

  const handleWelcomeComplete = async (userData) => {
    setShowWelcome(false);
    setProfile({
      name: userData.name,
      interaction_count: 0,
      temporal_info: {},
      top_preferences: [],
    });
    setGreeting(`Hi, ${userData.name}!`);
    
    // Resize window back to normal size after onboarding
    try {
      await window.electron?.resizeWindow?.(360, 220);
      console.log('[App] Resized window after onboarding');
    } catch (err) {
      console.warn('[App] Failed to resize window after onboarding:', err);
    }
  };

  return (
    <PermissionProvider>
      { (isLoading || showWelcome === null) ? (
        <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ color:'#7a7a85' }}>Loading Agent Max...</div>
        </div>
      ) : (
        <AppleFloatBar
          showWelcome={showWelcome}
          onWelcomeComplete={handleWelcomeComplete}
          isLoading={isLoading}
          windowMode={windowMode}
        />
      ) }
      <UpdateNotification
        updateInfo={updateInfo}
        updateProgress={updateProgress}
        onDismiss={() => setUpdateInfo(null)}
      />
      <UserInputDialog />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(28, 28, 32, 0.95)',
            color: '#eaeaf0',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            backdropFilter: 'blur(12px)',
          },
        }}
      />
    </PermissionProvider>
  );
}

export default App;
