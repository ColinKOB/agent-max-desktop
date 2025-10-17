import { useState, useEffect } from 'react';
import {
  Moon,
  Sun,
  Zap,
  Info,
  Trash2,
  Globe,
  Monitor,
  Camera,
  MousePointer,
  CreditCard,
} from 'lucide-react';
import useStore from '../store/useStore';
import { healthAPI, reconfigureAPI, screenAPI } from '../services/api';
import apiConfigManager from '../config/apiConfig';
import toast from 'react-hot-toast';
import { GoogleConnect } from '../components/GoogleConnect';
import { SubscriptionManager } from '../components/SubscriptionManager';
import { isGlassEnabled } from '../config/featureFlags';
import { logGlassRendered, countBlurLayers } from '../utils/telemetry';

export default function Settings() {
  const { theme, setTheme, apiConnected, setApiConnected } = useStore();
  const [apiUrl, setApiUrl] = useState(apiConfigManager.getBaseURL());
  const [apiKey, setApiKey] = useState(apiConfigManager.getApiKey() || '');
  const [testing, setTesting] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');

  // Screen Control state
  const [screenControlEnabled, setScreenControlEnabled] = useState(() => {
    return localStorage.getItem('screenControlEnabled') === 'true';
  });
  const [screenControlStatus, setScreenControlStatus] = useState(null);
  const [checkingScreen, setCheckingScreen] = useState(false);

  // Feature flag: Glass UI for Settings
  const useGlass = isGlassEnabled('GLASS_SETTINGS');

  useEffect(() => {
    // Get app version if running in Electron
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then(setAppVersion);
    }

    // Load current config
    const config = apiConfigManager.getConfig();
    setApiUrl(config.baseURL);
    setApiKey(config.apiKey || '');
  }, []);

  // Telemetry: Log glass render for Settings
  useEffect(() => {
    if (useGlass) {
      // Wait for DOM to render, then count blur layers
      setTimeout(() => {
        const blurLayers = countBlurLayers();
        logGlassRendered('Settings', 'Appearance', { blurLayers });
      }, 100);
    }
  }, [useGlass]);

  const handleSaveApiSettings = async () => {
    try {
      // Reconfigure the API with new settings
      reconfigureAPI(apiUrl, apiKey || null);
      toast.success('API settings saved');

      // Automatically test the new connection
      setTimeout(() => {
        handleTestConnection();
      }, 500);
    } catch (error) {
      console.error('[Settings] Failed to save API settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await healthAPI.check();
      setApiConnected(true);
      toast.success('Connected to API successfully!');
    } catch (error) {
      setApiConnected(false);
      toast.error('Failed to connect to API');
    } finally {
      setTesting(false);
    }
  };

  const handleClearCache = () => {
    if (!window.confirm('Clear all local cache? This will remove stored settings.')) {
      return;
    }

    localStorage.clear();
    toast.success('Cache cleared');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleCheckScreenControl = async () => {
    setCheckingScreen(true);
    try {
      const response = await screenAPI.getStatus();
      setScreenControlStatus(response.data);
      if (response.data.available) {
        toast.success('Screen control is available!');
      } else {
        toast.error('Screen control not available. Check API server.');
      }
    } catch (error) {
      console.error('[Settings] Screen control check failed:', error);
      toast.error('Failed to check screen control status');
      setScreenControlStatus({ available: false });
    } finally {
      setCheckingScreen(false);
    }
  };

  const handleTakeTestScreenshot = async () => {
    try {
      toast.loading('Taking screenshot...', { id: 'screenshot' });
      const response = await screenAPI.takeScreenshot();
      if (response.data.success) {
        toast.success(`Screenshot saved: ${response.data.path}`, { id: 'screenshot' });
      } else {
        toast.error('Screenshot failed', { id: 'screenshot' });
      }
    } catch (error) {
      console.error('[Settings] Screenshot failed:', error);
      toast.error('Failed to take screenshot', { id: 'screenshot' });
    }
  };

  const handleToggleScreenControl = (enabled) => {
    setScreenControlEnabled(enabled);
    localStorage.setItem('screenControlEnabled', enabled.toString());
    toast.success(enabled ? 'Screen control enabled' : 'Screen control disabled');
  };

  return (
    <div className={useGlass ? 'p-6 max-w-4xl mx-auto' : 'p-6 max-w-4xl mx-auto'}>
      <h1 className={useGlass ? 'amx-heading text-2xl mb-6' : 'text-2xl font-bold text-gray-100 mb-6'}>Settings</h1>

      {/* Theme Settings */}
      <div className={useGlass ? 'amx-liquid amx-noise amx-p-panel mb-6' : 'card mb-6'}>
        <div className="flex items-center space-x-2 mb-4">
          {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          <h2 className={useGlass ? 'amx-heading text-lg' : 'text-lg font-bold text-gray-100'}>Appearance</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className={useGlass ? 'amx-body block text-sm font-medium mb-2' : 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'}>
              Theme
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('light')}
                className={useGlass
                  ? `amx-liquid-nested flex-1 px-4 py-3 flex flex-col items-center ${
                      theme === 'light' ? 'ring-2 ring-white/40' : ''
                    }`
                  : `flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`
                }
              >
                <Sun className={useGlass ? 'w-6 h-6 mb-1 amx-body' : 'w-6 h-6 mb-1'} />
                <span className={useGlass ? 'text-sm font-medium amx-body' : 'text-sm font-medium'}>Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={useGlass
                  ? `amx-liquid-nested flex-1 px-4 py-3 flex flex-col items-center ${
                      theme === 'dark' ? 'ring-2 ring-white/40' : ''
                    }`
                  : `flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`
                }
              >
                <Moon className={useGlass ? 'w-6 h-6 mb-1 amx-body' : 'w-6 h-6 mb-1'} />
                <span className={useGlass ? 'text-sm font-medium amx-body' : 'text-sm font-medium'}>Dark</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API Settings */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Globe className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-bold text-gray-100">API Configuration</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="input w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The base URL of your Agent Max API server
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key (Optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key if required"
              className="input w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave blank if your API doesn't require authentication
            </p>
          </div>

          <div className="flex space-x-2">
            <button onClick={handleSaveApiSettings} className="btn-primary flex-1">
              Save Settings
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="btn-secondary px-6"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          <div className="flex items-center space-x-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-gray-600 dark:text-gray-400">
              {apiConnected ? 'Connected to API' : 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Screen Control */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Monitor className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-gray-100">Screen Control</h2>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Allow Agent Max to take screenshots and interact with your screen when needed.
        </p>

        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Enable Screen Control
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Let Agent Max take screenshots and click on screen elements
              </p>
            </div>
            <button
              onClick={() => handleToggleScreenControl(!screenControlEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                screenControlEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  screenControlEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Status Check */}
          {screenControlEnabled && (
            <div className="space-y-3">
              <button
                onClick={handleCheckScreenControl}
                disabled={checkingScreen}
                className="btn-secondary w-full flex items-center justify-center space-x-2"
              >
                <Monitor className="w-4 h-4" />
                <span>{checkingScreen ? 'Checking...' : 'Check Screen Control Status'}</span>
              </button>

              {screenControlStatus && (
                <div
                  className={`p-4 rounded-lg ${
                    screenControlStatus.available
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-1 ${
                        screenControlStatus.available ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div className="flex-1">
                      <h4
                        className={`font-semibold ${
                          screenControlStatus.available
                            ? 'text-green-900 dark:text-green-300'
                            : 'text-red-900 dark:text-red-300'
                        }`}
                      >
                        {screenControlStatus.available
                          ? '✅ Screen Control Available'
                          : '❌ Screen Control Unavailable'}
                      </h4>
                      <p
                        className={`text-sm mt-1 ${
                          screenControlStatus.available
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {screenControlStatus.message}
                      </p>
                      {!screenControlStatus.available && (
                        <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                          Note: macOS may require Screen Recording and Accessibility permissions in
                          System Settings → Privacy & Security
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Test Buttons */}
              {screenControlStatus?.available && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleTakeTestScreenshot}
                    className="btn-secondary flex items-center justify-center space-x-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Test Screenshot</span>
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const response = await screenAPI.getInfo();
                        toast.success(`Screen: ${response.data.screen.resolution}`, {
                          duration: 3000,
                        });
                      } catch (error) {
                        toast.error('Failed to get screen info');
                      }
                    }}
                    className="btn-secondary flex items-center justify-center space-x-2"
                  >
                    <Info className="w-4 h-4" />
                    <span>Screen Info</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Capabilities Info */}
          {screenControlEnabled && screenControlStatus?.available && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center space-x-2">
                <MousePointer className="w-4 h-4" />
                <span>Available Actions</span>
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                <li>• Take screenshots for visual context</li>
                <li>• Click on screen elements (with your permission)</li>
                <li>• Type text into applications</li>
                <li>• Press keyboard shortcuts</li>
                <li>• Read text from screen (OCR)</li>
              </ul>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-3">
                Agent Max will ask for permission before using screen control features.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Subscription & Billing */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <CreditCard className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-bold text-gray-100">Subscription & Billing</h2>
        </div>
        <SubscriptionManager />
      </div>

      {/* Google Services */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Globe className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-gray-100">Google Services</h2>
        </div>
        <GoogleConnect />
      </div>

      {/* Data Management */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Trash2 className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-bold text-gray-100">Data Management</h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">Clear Local Cache</h3>
            <p className="text-sm text-red-700 dark:text-red-400 mb-3">
              This will remove all locally stored settings and preferences. The app will reload.
            </p>
            <button
              onClick={handleClearCache}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Info className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-bold text-gray-100">About</h2>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">App Version</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{appVersion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Product</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Agent Max Desktop
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">System</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">Memory System V2</span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Built with Electron, React, and TailwindCSS
          </p>
        </div>
      </div>
    </div>
  );
}
