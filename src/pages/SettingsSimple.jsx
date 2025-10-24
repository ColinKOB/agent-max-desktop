import { useState, useEffect } from 'react';
import { GoogleConnect } from '../components/GoogleConnect';

export default function SettingsSimple() {
  // Preferences
  const [theme, setTheme] = useState('light'); // 'light' | 'dark' | 'system'
  const [analytics, setAnalytics] = useState(false);
  const [deepMemorySearch, setDeepMemorySearch] = useState(false);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('pref_theme');
      const storedAnalytics = localStorage.getItem('pref_analytics');
      const storedDeepMemory = localStorage.getItem('pref_deep_memory_search');
      if (storedTheme) setTheme(storedTheme);
      if (storedAnalytics) setAnalytics(storedAnalytics === '1');
      if (storedDeepMemory) setDeepMemorySearch(storedDeepMemory === '1');
    } catch {}
  }, []);

  const handleThemeChange = (value) => {
    setTheme(value);
    try { localStorage.setItem('pref_theme', value); } catch {}
  };

  const handleAnalyticsChange = (checked) => {
    setAnalytics(checked);
    try { localStorage.setItem('pref_analytics', checked ? '1' : '0'); } catch {}
  };

  const handleDeepMemoryChange = (checked) => {
    setDeepMemorySearch(checked);
    try { localStorage.setItem('pref_deep_memory_search', checked ? '1' : '0'); } catch {}
  };

  return (
    <div style={{ background: '#fff', color: '#111827', minHeight: '100%', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Settings</h1>

        {/* Preferences */}
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Preferences</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label htmlFor="pref-theme" style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 6 }}>Theme</label>
              <select
                id="pref-theme"
                value={theme}
                onChange={(e) => handleThemeChange(e.target.value)}
                aria-label="Theme selector"
                style={{ width: '100%', background: '#fff', color: '#111827', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label htmlFor="pref-analytics" style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>Usage analytics</label>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Help improve Agent Max by sending anonymous usage data.</p>
              </div>
              <input
                id="pref-analytics"
                type="checkbox"
                checked={analytics}
                onChange={(e) => handleAnalyticsChange(e.target.checked)}
                aria-label="Enable anonymous analytics"
                style={{ width: 18, height: 18 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label htmlFor="pref-deep-memory" style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>Deep memory search</label>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Use more extensive semantic search for better recall (may be slower).</p>
              </div>
              <input
                id="pref-deep-memory"
                type="checkbox"
                checked={deepMemorySearch}
                onChange={(e) => handleDeepMemoryChange(e.target.checked)}
                aria-label="Enable deep memory search"
                style={{ width: 18, height: 18 }}
              />
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

