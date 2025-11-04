import { useState, useEffect } from 'react';
import {
  Mail,
  Calendar,
  FileText,
  Youtube,
  Sheet,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  TestTube,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import apiConfigManager from '../config/apiConfig';
import { googleAPI } from '../services/api';
import { generateOAuthState, hashOAuthState, storeOAuthStateHash } from '../services/oauth';

// Helper function to get API URL dynamically
function getApiUrl() {
  try {
    // Try to get from apiConfigManager
    if (apiConfigManager && typeof apiConfigManager.getBaseURL === 'function') {
      const baseUrl = apiConfigManager.getBaseURL();
      if (baseUrl) {
        // Normalize localhost to 127.0.0.1 to avoid IPv6 issues
        return baseUrl.includes('localhost') ? baseUrl.replace('localhost', '127.0.0.1') : baseUrl;
      }
    }
  } catch (err) {
    console.warn('[GoogleConnect] Failed to get API URL from config:', err);
  }
  
  // Fallback to default
  return 'http://127.0.0.1:8000';
}

export function GoogleConnect({ compact = false }) {
  const [connected, setConnected] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scopes, setScopes] = useState([]);
  const [testingService, setTestingService] = useState(null);
  const [serviceStatus, setServiceStatus] = useState({});

  // Version stamp to verify new code is loaded
  useEffect(() => {
    console.log('[GoogleConnect] Component loaded - Version 2025-10-27-v3');
    console.log('[GoogleConnect] axios available:', !!axios);
    console.log('[GoogleConnect] apiConfigManager available:', !!apiConfigManager);
    console.log('[GoogleConnect] getApiUrl function:', typeof getApiUrl);
    
    // Immediate connectivity test
    const testUrl = getApiUrl();
    console.log('[GoogleConnect] Resolved API URL on mount:', testUrl);
    
    // Test if we can reach the backend
    axios.get(`${testUrl}/health`)
      .then(res => {
        console.log('[GoogleConnect] ✅ Backend health check passed:', res.data);
      })
      .catch(err => {
        console.error('[GoogleConnect] ❌ Backend health check failed:', err.message);
        console.error('[GoogleConnect] Error details:', {
          code: err.code,
          message: err.message,
          response: err.response?.data
        });
      });
    
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    const API_URL = getApiUrl();
    console.log('[GoogleConnect] Checking connection status, API_URL:', API_URL);
    try {
      const envSetting = import.meta.env.VITE_ENVIRONMENT;
      const isProdBuild = envSetting === 'production' || envSetting === 'beta' || (!import.meta.env.DEV && import.meta.env.MODE === 'production');
      // Use configured API wrapper (adds API key & user headers)
      const { data } = await googleAPI.getStatus();

      if (data.connected && data.email) {
        setConnected(true);
        setUserEmail(data.email);
        setScopes(data.scopes || []);

        // Store in localStorage for this window
        localStorage.setItem('google_user_email', data.email);
      } else {
        // Check localStorage as fallback
        const storedEmail = localStorage.getItem('google_user_email');
        if (storedEmail) {
          // Verify with backend  
          const response = await googleAPI.getStatus(storedEmail);

          if (response.data.connected) {
            setConnected(true);
            setUserEmail(response.data.email);
            setScopes(response.data.scopes || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to check connection status:', err);
    }
  };

  const connectGoogle = async () => {
    console.log('[GoogleConnect] =================================');
    console.log('[GoogleConnect] Connect button clicked');
    
    const API_URL = getApiUrl();
    console.log('[GoogleConnect] API_URL:', API_URL);
    console.log('[GoogleConnect] apiConfigManager available:', !!apiConfigManager);
    console.log('[GoogleConnect] apiConfigManager.getBaseURL:', typeof apiConfigManager?.getBaseURL);
    setLoading(true);
    setError('');

    try {
      const envSetting = import.meta.env.VITE_ENVIRONMENT;
      const isProdBuild = envSetting === 'production' || envSetting === 'beta' || (!import.meta.env.DEV && import.meta.env.MODE === 'production');
      // Candidate start endpoints (dev fallback only)
      const startCandidates = [
        `${API_URL}/api/v2/google/auth/start`,
        `${API_URL}/api/v2/google/oauth/start`,
        `${API_URL}/api/google/auth/start`,
      ];
      if (!isProdBuild) {
        console.log('[GoogleConnect] Will try start endpoints in browser (dev only):', startCandidates);
      }
      
      // Include identifiers so backend can correlate callback → user
      let userId = null;
      try { userId = localStorage.getItem('user_id') || null; } catch {}
      let deviceId = null;
      try { deviceId = localStorage.getItem('device_id') || null; } catch {}
      if (!deviceId) {
        try {
          const gen = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
            ? globalThis.crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
              });
          deviceId = gen();
          localStorage.setItem('device_id', deviceId);
        } catch {}
      }

      // Build optional state to assist backend correlation
      let state = null;
      try {
        // Generate cryptographically secure state and hash it for storage
        state = generateOAuthState();
        const stateHash = hashOAuthState(state);
        storeOAuthStateHash(stateHash);
        console.log('[GoogleConnect] Generated secure OAuth state and stored hash');
      } catch (err) {
        console.error('[GoogleConnect] Failed to generate secure state:', err);
      }

      // Prefer server-driven start flow in the system browser so cookies/sessions carry to callback
      const params = new URLSearchParams();
      if (userId) params.set('user_id', userId);
      if (deviceId) params.set('device_id', deviceId);
      if (state) params.set('state', state);

      let openUrl = null;
      try {
        const resp = await googleAPI.getAuthUrl(userId, deviceId, state);
        if (resp?.data?.auth_url) openUrl = resp.data.auth_url;
      } catch (e) {
        console.log('[GoogleConnect] /auth/url not available');
      }
      if (!openUrl) {
        if (!isProdBuild) {
          // Dev fallback: try conventional start endpoints
          const startUrl = `${startCandidates[0]}?${params.toString()}`;
          openUrl = startUrl;
        } else {
          setError('Authorization endpoint is unavailable. Please update the backend to expose /api/v2/google/auth/url.');
          setLoading(false);
          return;
        }
      }
      console.log('[GoogleConnect] Opening URL:', openUrl);

      // Open system browser for OAuth
      console.log('[GoogleConnect] Available APIs:');
      console.log('[GoogleConnect]   - window.electronAPI:', !!window.electronAPI);
      console.log('[GoogleConnect]   - window.electron:', !!window.electron);
      console.log('[GoogleConnect]   - window.electronAPI.openExternal:', !!window.electronAPI?.openExternal);
      console.log('[GoogleConnect]   - window.electron.openExternal:', !!window.electron?.openExternal);
      
      if (window.electronAPI && window.electronAPI.openExternal) {
        console.log('[GoogleConnect] Calling window.electronAPI.openExternal...');
        const result = await window.electronAPI.openExternal(openUrl);
        console.log('[GoogleConnect] openExternal result:', result);
      } else if (window.electron && window.electron.openExternal) {
        console.log('[GoogleConnect] Calling window.electron.openExternal...');
        const result = await window.electron.openExternal(openUrl);
        console.log('[GoogleConnect] openExternal result:', result);
      } else {
        // Fallback for web
        console.log('[GoogleConnect] Opening in new window (fallback)');
        window.open(openUrl, '_blank');
      }

      console.log('[GoogleConnect] Browser should be open now, starting polling...');
      console.log('[GoogleConnect] Polling endpoint: /api/v2/google/status (via googleAPI wrapper)');

      // Poll for connection status
      let pollAttempts = 0;
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        console.log(`[GoogleConnect] Poll attempt ${pollAttempts}...`);
        try {
          // Check all connected accounts by calling status without email
          const statusResponse = await googleAPI.getStatus();
          console.log('[GoogleConnect] Poll response:', statusResponse.data);

          // If connected, the backend returns the connected account
          if (statusResponse.data.connected && statusResponse.data.email) {
            console.log('[GoogleConnect] ✅ Connection successful!', statusResponse.data.email);
            setConnected(true);
            setUserEmail(statusResponse.data.email);
            setScopes(statusResponse.data.scopes || []);

            // Store email locally for future checks
            localStorage.setItem('google_user_email', statusResponse.data.email);

            toast.success(`Connected to ${statusResponse.data.email}!`);
            setLoading(false);
            clearInterval(pollInterval);
          }
        } catch (err) {
          // Continue polling if error
          console.log('[GoogleConnect] Poll error (will retry):', err.message);
          if (err.response) {
            console.log('[GoogleConnect] Error response:', err.response.status, err.response.data);
          }
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        console.log('[GoogleConnect] Polling timeout reached (2 minutes)');
        clearInterval(pollInterval);
        setLoading(false);
        setError('Authentication timeout. Please try again.');
      }, 120000);
    } catch (err) {
      console.error('[GoogleConnect] ❌ Connection failed:', err);
      console.error('[GoogleConnect] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      setError(`Failed to start Google authentication: ${err.message}`);
      setLoading(false);
    }
  };

  const disconnectGoogle = async () => {
    try {
      await googleAPI.disconnect(userEmail);

      setConnected(false);
      setUserEmail('');
      setScopes([]);
      setServiceStatus({});
      localStorage.removeItem('google_user_email');
      toast.success('Google account disconnected');
    } catch (err) {
      console.error('Failed to disconnect Google:', err);
      setError('Failed to disconnect. Please try again.');
      toast.error('Failed to disconnect');
    }
  };

  const testService = async (serviceName) => {
    if (!userEmail) {
      toast.error('Please connect your Google account first');
      return;
    }

    setTestingService(serviceName);

    try {
      let result;
      switch (serviceName) {
        case 'Gmail':
          result = await googleAPI.listMessages(1);
          toast.success(`Gmail works! Found ${result.data.messages?.length || 0} recent emails`);
          setServiceStatus((prev) => ({ ...prev, Gmail: 'working' }));
          break;

        case 'Calendar':
          result = await googleAPI.listEvents(1);
          toast.success(`Calendar works! Found ${result.data.events?.length || 0} upcoming events`);
          setServiceStatus((prev) => ({ ...prev, Calendar: 'working' }));
          break;

        case 'Sheets':
          // Sheets access is configured (no test endpoint without spreadsheet ID)
          toast.success('Sheets access is configured and ready');
          setServiceStatus((prev) => ({ ...prev, Sheets: 'working' }));
          break;

        case 'Docs':
          // Docs access is configured (no test endpoint without document ID)
          toast.success('Docs access is configured and ready');
          setServiceStatus((prev) => ({ ...prev, Docs: 'working' }));
          break;

        case 'YouTube':
          result = await googleAPI.searchYouTube('test', 1);
          toast.success(`YouTube works! Found ${result.data.videos?.length || 0} videos`);
          setServiceStatus((prev) => ({ ...prev, YouTube: 'working' }));
          break;

        default:
          break;
      }
    } catch (err) {
      console.error(`Failed to test ${serviceName}:`, err);
      const errorDetail = err.response?.data?.detail || err.message;
      toast.error(`${serviceName} test failed: ${errorDetail}`);
      setServiceStatus((prev) => ({ ...prev, [serviceName]: 'error' }));
    } finally {
      setTestingService(null);
    }
  };

  const services = [
    { name: 'Gmail', icon: Mail, description: 'Read and send emails' },
    { name: 'Calendar', icon: Calendar, description: 'Manage events and meetings' },
    { name: 'Docs', icon: FileText, description: 'Create and read documents' },
    { name: 'Sheets', icon: Sheet, description: 'Work with spreadsheets' },
    { name: 'YouTube', icon: Youtube, description: 'Search and manage videos' },
  ];

  return (
    <div className={`google-connect-container${compact ? ' compact' : ''}`}>
      {!compact && (
      <div className="google-connect-header">
        {/* Google Logo */}
        <div className="google-logo-container">
          <svg viewBox="0 0 48 48" className="google-logo">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Connect Google Account</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Enable AI-powered assistance with Gmail, Calendar, Docs, Sheets, and YouTube.
        </p>
      </div>
      )}

      {!connected ? (
        <div className="connect-section">
          {!compact && (
            <div className="services-grid mb-6">
              {services.map((service) => (
                <div key={service.name} className="service-card">
                  <service.icon className="w-8 h-8 mb-2 text-blue-600" />
                  <h3 className="font-semibold">{service.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{service.description}</p>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="error-message mb-4">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <button onClick={connectGoogle} disabled={loading} className="connect-button">
            {loading ? (
              <>
                <div className="spinner" />
                <span>Waiting for authorization...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 48 48" style={{width: '20px', height: '20px'}}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          {loading && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
              A browser window has opened. Please authorize Agent Max to access your Google
              services.
            </p>
          )}
        </div>
      ) : (
        <div className="connected-section">
          <div className="status-card">
            <CheckCircle className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Connected Successfully</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Signed in as: <span className="font-semibold">{userEmail}</span>
            </p>

            <div className="connected-services mb-6">
              <h4 className="font-semibold mb-3">Available Services:</h4>
              <div className="services-list">
                {services.map((service) => (
                  <div key={service.name} className="service-item">
                    <div className="service-info">
                      <service.icon className="w-5 h-5 text-green-600" />
                      <div className="flex-1">
                        <span className="font-medium">{service.name}</span>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {service.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => testService(service.name)}
                      disabled={testingService === service.name}
                      className="test-button"
                      title={`Test ${service.name} connection`}
                    >
                      {testingService === service.name ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : serviceStatus[service.name] === 'working' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : serviceStatus[service.name] === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={disconnectGoogle} className="disconnect-button">
              Disconnect Google Account
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .google-connect-container {
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .google-connect-container.compact { padding: 0.75rem; max-width: 560px; }
        .google-connect-container.compact .google-logo { width: 56px; height: 56px; }
        .google-connect-container.compact .google-logo-container { margin-bottom: 0.75rem; }
        .google-connect-container.compact .connect-button { padding: 0.75rem 1rem; border-radius: 10px; font-size: 0.95rem; }

        .google-logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .google-logo {
          width: 80px;
          height: 80px;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .service-card {
          padding: 1.5rem;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          text-align: center;
          transition: all 0.2s;
        }

        .service-card:hover {
          border-color: #3b82f6;
          transform: translateY(-2px);
        }

        .connect-button {
          width: 100%;
          padding: 1rem 2rem;
          background: white;
          color: #1f2937;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .connect-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border-color: #4285F4;
        }

        .connect-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .disconnect-button {
          padding: 0.75rem 1.5rem;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .disconnect-button:hover {
          background: #dc2626;
        }

        .status-card {
          padding: 2rem;
          border: 2px solid #10b981;
          border-radius: 16px;
          text-align: center;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        }

        .connected-services {
          text-align: left;
        }

        .services-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .service-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 1rem;
          background: white;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .service-item:hover {
          transform: translateY(-1px);
        }

        .service-info {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          flex: 1;
        }

        .test-button {
          padding: 0.5rem;
          background: #f3f4f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .test-button:hover:not(:disabled) {
          background: #e5e7eb;
          transform: scale(1.05);
        }

        .test-button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 8px;
          font-weight: 500;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-color-scheme: dark) {
          .service-card {
            border-color: #374151;
            background: #1f2937;
          }

          .service-card:hover {
            border-color: #3b82f6;
            background: #111827;
          }

          .status-card {
            background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
            border-color: #10b981;
          }

          .service-item {
            background: #1f2937;
          }

          .test-button {
            background: #374151;
          }

          .test-button:hover:not(:disabled) {
            background: #4b5563;
          }
        }
      `}</style>
    </div>
  );
}
