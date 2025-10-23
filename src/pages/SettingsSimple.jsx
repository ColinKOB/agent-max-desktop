import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { healthAPI, reconfigureAPI } from '../services/api';
import { GoogleConnect } from '../components/GoogleConnect';

export default function SettingsSimple() {
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    try {
      const storedUrl = localStorage.getItem('api_base_url');
      const storedKey = localStorage.getItem('api_key');
      if (storedUrl) setApiUrl(storedUrl);
      if (storedKey) setApiKey(storedKey);
    } catch {}
  }, []);

  const handleSave = () => {
    try {
      reconfigureAPI(apiUrl, apiKey || null);
      localStorage.setItem('api_base_url', apiUrl);
      if (apiKey) localStorage.setItem('api_key', apiKey); else localStorage.removeItem('api_key');
      toast.success('Settings saved');
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await healthAPI.check();
      toast.success('API reachable');
    } catch (e) {
      toast.error('API not reachable');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ background: '#fff', color: '#111827', minHeight: '100%', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Settings</h1>

        {/* API Configuration */}
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>API Configuration</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 6 }}>API URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8000"
                aria-label="API URL"
                style={{ width: '100%', background: '#fff', color: '#111827', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 6 }}>API Key (optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key if required"
                aria-label="API Key (optional)"
                style={{ width: '100%', background: '#fff', color: '#111827', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} style={btnPrimary}>Save</button>
              <button onClick={handleTest} disabled={testing} style={btnSecondary}>
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Integrations</h2>
          <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 16 }}>
            Connect your Google account to enable Gmail, Calendar, Docs, Sheets, and YouTube.
          </p>
          <GoogleConnect />
        </section>
      </div>
    </div>
  );
}

const btnPrimary = {
  padding: '10px 14px',
  background: '#111827',
  color: '#fff',
  borderRadius: 10,
  border: '1px solid #111827',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  cursor: 'pointer'
};

const btnSecondary = {
  padding: '10px 14px',
  background: '#f9fafb',
  color: '#111827',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  cursor: 'pointer'
};
