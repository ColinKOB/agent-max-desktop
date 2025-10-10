import { useState, useEffect } from 'react';
import { Moon, Sun, Zap, Info, Trash2, Globe } from 'lucide-react';
import useStore from '../store/useStore';
import { healthAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { theme, setTheme, apiConnected, setApiConnected } = useStore();
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('api_url') || 'http://localhost:8000');
  const [apiKey, setApiKey] = useState(localStorage.getItem('api_key') || '');
  const [testing, setTesting] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');

  useEffect(() => {
    // Get app version if running in Electron
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then(setAppVersion);
    }
  }, []);

  const handleSaveApiSettings = () => {
    localStorage.setItem('api_url', apiUrl);
    localStorage.setItem('api_key', apiKey);
    toast.success('API settings saved');
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
        Settings
      </h1>

      {/* Theme Settings */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          {theme === 'dark' ? (
            <Moon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Sun className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Appearance
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <Sun className="w-6 h-6 mx-auto mb-1" />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <Moon className="w-6 h-6 mx-auto mb-1" />
                <span className="text-sm font-medium">Dark</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API Settings */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            API Configuration
          </h2>
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
              className={`w-2 h-2 rounded-full ${
                apiConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-600 dark:text-gray-400">
              {apiConnected ? 'Connected to API' : 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Data Management
          </h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">
              Clear Local Cache
            </h3>
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
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Info className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            About
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">App Version</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {appVersion}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Product</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Agent Max Desktop
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">System</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Memory System V2
            </span>
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
