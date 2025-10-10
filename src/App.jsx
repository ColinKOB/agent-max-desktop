import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import FloatBar from './components/FloatBar';
import WelcomeScreen from './components/WelcomeScreen';
import useStore from './store/useStore';
import { healthAPI, profileAPI } from './services/api';
import './styles/welcome.css';

function App() {
  const { setApiConnected, setProfile, setGreeting } = useStore();
  const [showWelcome, setShowWelcome] = useState(null); // null = checking, true = show, false = hide
  const [isLoading, setIsLoading] = useState(true);

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
    
    // Switch window to FloatBar mode
    if (window.electron?.switchToFloatbar) {
      setTimeout(() => {
        window.electron.switchToFloatbar();
      }, 300); // Small delay for smooth transition
    }
  };

  // Show loading state while checking
  if (isLoading || showWelcome === null) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e1e28 0%, #2d2d3a 100%)',
        color: '#ffffff',
        fontSize: '1.25rem'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      {showWelcome ? (
        <WelcomeScreen onComplete={handleWelcomeComplete} />
      ) : (
        <FloatBar />
      )}
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
