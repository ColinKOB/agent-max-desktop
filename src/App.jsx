import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import FloatBar from './components/FloatBar';
import useStore from './store/useStore';
import { healthAPI, profileAPI } from './services/api';

function App() {
  const { setApiConnected, setProfile, setGreeting } = useStore();
  const [showWelcome, setShowWelcome] = useState(null); // null = checking, true = show, false = hide
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check API connection
    checkApiConnection();

    // Load initial profile
    loadProfile();

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

  const checkApiConnection = async () => {
    try {
      console.log('[Health] Checking API connection...');
      const response = await healthAPI.check();
      console.log('[Health] API is healthy:', response.data);
      setApiConnected(true);
      return true;
    } catch (error) {
      console.error('[Health] API health check failed:', error.message);
      console.error('[Health] Error details:', {
        code: error.code,
        status: error.response?.status,
        url: error.config?.url,
      });
      setApiConnected(false);
      return false;
    }
  };

  const loadProfile = async () => {
    try {
      // Load profile from local memory (Electron)
      if (window.electron?.memory) {
        const profileData = await window.electron.memory.getProfile();
        
        // Check if onboarding is completed
        const onboardingCompleted = await window.electron.memory.getPreference('onboarding_completed');
        setShowWelcome(!onboardingCompleted);
        
        setProfile({
          name: profileData.name || 'User',
          interaction_count: profileData.interaction_count || 0,
          temporal_info: {},
          top_preferences: []
        });
        
        // Generate greeting
        const greeting = profileData.name 
          ? `Hi, ${profileData.name}!` 
          : 'Hi there!';
        setGreeting(greeting);
      } else {
        // Fallback: try API (for non-Electron environments)
        const profileData = await profileAPI.get();
        setProfile(profileData);
        
        const greetingData = await profileAPI.getGreeting();
        setGreeting(greetingData.greeting);
        
        setShowWelcome(false); // No welcome for web version
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Set default profile if everything fails
      setProfile({
        name: 'User',
        interaction_count: 0,
        temporal_info: {},
        top_preferences: []
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
      top_preferences: []
    });
    setGreeting(`Hi, ${userData.name}!`);
  };

  return (
    <>
      <FloatBar showWelcome={showWelcome} onWelcomeComplete={handleWelcomeComplete} isLoading={isLoading} />
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
    </>
  );
}

export default App;
