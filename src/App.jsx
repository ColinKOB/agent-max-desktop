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
      // Load profile from local memory (Electron)
      if (window.electron?.memory) {
        const profileData = await window.electron.memory.getProfile();
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
