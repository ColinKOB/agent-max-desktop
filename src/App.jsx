import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import FloatBar from './components/FloatBar';
import useStore from './store/useStore';
import { healthAPI, profileAPI } from './services/api';

function App() {
  const { setApiConnected, setProfile, setGreeting } = useStore();

  useEffect(() => {
    // Check API connection
    checkApiConnection();

    // Load initial profile
    loadProfile();

    // Check API connection every 30 seconds
    const interval = setInterval(checkApiConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkApiConnection = async () => {
    try {
      await healthAPI.check();
      setApiConnected(true);
    } catch (error) {
      setApiConnected(false);
      console.error('API health check failed:', error);
    }
  };

  const loadProfile = async () => {
    try {
      const profileData = await profileAPI.get();
      setProfile(profileData);
      
      // Get greeting
      const greetingData = await profileAPI.getGreeting();
      setGreeting(greetingData.greeting);
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Set default profile if API fails
      setProfile({
        name: 'User',
        interaction_count: 0,
        temporal_info: {},
        top_preferences: []
      });
    }
  };

  return (
    <>
      <FloatBar />
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
