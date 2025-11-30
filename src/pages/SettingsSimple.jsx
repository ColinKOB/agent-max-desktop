import { useState, useEffect } from 'react';
import { GoogleConnect } from '../components/GoogleConnect';
import telemetry from '../services/telemetry';
import apiConfigManager from '../config/apiConfig';
import packageJson from '../../package.json';

export default function SettingsSimple() {
  // Preferences
  const [theme, setTheme] = useState('light'); // 'light' | 'dark' | 'system'
  const [analytics, setAnalytics] = useState(true);
  const [deepMemorySearch, setDeepMemorySearch] = useState(true);
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [disableLegacyFallbacks, setDisableLegacyFallbacks] = useState(false);
  const [probeStatus, setProbeStatus] = useState(null);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('pref_theme');
      const storedAnalytics = localStorage.getItem('pref_analytics');
      const storedDeepMemory = localStorage.getItem('pref_deep_memory_search');
      const storedTelemetry = localStorage.getItem('telemetry_enabled');
      const storedDisableFallbacks = localStorage.getItem('disable_legacy_fallbacks');
      
      // Load existing values or persist defaults for new users
      if (storedTheme) {
        setTheme(storedTheme);
      }
      
      // Analytics: default ON for beta testers
      if (storedAnalytics !== null) {
        setAnalytics(storedAnalytics === '1');
      } else {
        // First load - persist the default (ON)
        localStorage.setItem('pref_analytics', '1');
      }
      
      // Deep memory search: default ON for beta testers
      if (storedDeepMemory !== null) {
        setDeepMemorySearch(storedDeepMemory === '1');
      } else {
        // First load - persist the default (ON)
        localStorage.setItem('pref_deep_memory_search', '1');
      }
      
      // Telemetry: default ON for beta testers
      if (storedTelemetry !== null) {
        setTelemetryEnabled(storedTelemetry === 'true');
      } else {
        // First load - persist the default (ON)
        localStorage.setItem('telemetry_enabled', 'true');
        telemetry.setEnabled(true);
      }
      
      if (storedDisableFallbacks === '1' || storedDisableFallbacks === 'true') setDisableLegacyFallbacks(true);
      try { setProbeStatus(apiConfigManager.getLastProbe?.() || null); } catch {}
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

  const handleTelemetryChange = (checked) => {
    setTelemetryEnabled(checked);
    try {
      localStorage.setItem('telemetry_enabled', checked ? 'true' : 'false');
    } catch {}
    try { telemetry.setEnabled(checked); } catch {}
  };

  const handleDisableFallbacksChange = (checked) => {
    setDisableLegacyFallbacks(checked);
    try { localStorage.setItem('disable_legacy_fallbacks', checked ? '1' : '0'); } catch {}
  };

  const handleReprobe = async () => {
    try {
      await apiConfigManager.probeWellKnownAndApply?.();
      setProbeStatus(apiConfigManager.getLastProbe?.() || null);
    } catch {}
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
                <label htmlFor="pref-telemetry" style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>Telemetry</label>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Send anonymized event data to improve reliability. In production builds this is off by default.</p>
              </div>
              <input
                id="pref-telemetry"
                type="checkbox"
                checked={telemetryEnabled}
                onChange={(e) => handleTelemetryChange(e.target.checked)}
                aria-label="Enable telemetry"
                style={{ width: 18, height: 18 }}
              />
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
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Integrations</h2>
          <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 16 }}>
            Connect your Google account to enable Gmail, Calendar, Docs, Sheets, and YouTube.
          </p>
          <GoogleConnect />
        </section>

        {/* About */}
        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>About</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#374151' }}>Version</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', background: '#f3f4f6', padding: '4px 12px', borderRadius: 6 }}>
                {packageJson.version}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#374151' }}>Build</span>
              <span style={{ fontSize: 14, color: '#6b7280' }}>
                {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
              © 2025 Agent Max. Made with ❤️ by Colin O'Brien.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

