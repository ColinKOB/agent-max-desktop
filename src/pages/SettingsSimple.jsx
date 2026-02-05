import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GoogleConnect } from '../components/GoogleConnect';
import CredentialsSettings from '../components/settings/CredentialsSettings';
import telemetry from '../services/telemetry';
import apiConfigManager from '../config/apiConfig';
import packageJson from '../../package.json';
import logo from '../assets/AgentMaxLogo.png';
import { isGoogleComingSoon } from '../config/featureGates';

const FIGTREE = 'Figtree, system-ui, -apple-system, sans-serif';

// Custom toggle switch - squared-off design
function ToggleSwitch({ checked, onChange, id, ariaLabel }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, padding: 2,
        background: checked ? '#e8853b' : 'rgba(255,255,255,0.12)',
        border: `1px solid ${checked ? 'rgba(232,133,59,0.5)' : 'rgba(255,255,255,0.1)'}`,
        cursor: 'pointer',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        display: 'flex', alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        flexShrink: 0,
        WebkitAppearance: 'none',
        appearance: 'none',
        outline: 'none',
      }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

// Section animation
const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

export default function SettingsSimple() {
  // Preferences
  const [theme, setTheme] = useState('light'); // 'light' | 'dark' | 'system'
  const [analytics, setAnalytics] = useState(true);
  const [deepMemorySearch, setDeepMemorySearch] = useState(true);
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [disableLegacyFallbacks, setDisableLegacyFallbacks] = useState(false);
  const [probeStatus, setProbeStatus] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [browserPreference, setBrowserPreference] = useState('both'); // 'workspace_only' | 'safari_only' | 'both'

  useEffect(() => {
    try {
      // Load user email for feature gating
      const email = localStorage.getItem('user_email');
      if (email) setUserEmail(email);

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

      // Browser preference: default to 'both' (Max can use either workspace or Safari)
      const storedBrowserPref = localStorage.getItem('pref_browser_mode');
      if (storedBrowserPref) {
        setBrowserPreference(storedBrowserPref);
      } else {
        // First load - persist the default
        localStorage.setItem('pref_browser_mode', 'both');
      }

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

  const handleBrowserPreferenceChange = async (value) => {
    setBrowserPreference(value);
    try { localStorage.setItem('pref_browser_mode', value); } catch {}

    // Sync to executor for immediate effect on next run
    try {
      if (window.executor?.setUserContext) {
        window.executor.setUserContext({ browser_mode: value });
        console.log('[Settings] Synced browser_mode to executor:', value);
      }
    } catch (err) {
      console.error('[Settings] Failed to sync browser_mode to executor:', err);
    }

    // Sync to Supabase via preferences API
    try {
      const userId = localStorage.getItem('user_id');
      if (userId) {
        await window.electron?.memory?.setPreference?.('browser_mode', value, 'string');
      }
    } catch (err) {
      console.error('[Settings] Failed to sync browser preference:', err);
    }
  };

  const handleReprobe = async () => {
    try {
      await apiConfigManager.probeWellKnownAndApply?.();
      setProbeStatus(apiConfigManager.getLastProbe?.() || null);
    } catch {}
  };

  // Shared select style
  const selectStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    padding: '10px 12px',
    outline: 'none',
    fontSize: 13,
    transition: 'border-color 0.15s ease',
  };

  return (
    <div style={{ color: 'rgba(255,255,255,0.95)', minHeight: '100%', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'rgba(255,255,255,0.95)', fontFamily: FIGTREE }}>
          Settings
        </h1>

        {/* Preferences */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          style={{
            borderLeft: '2px solid rgba(168,152,130,0.4)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderLeftWidth: 2,
            borderLeftColor: 'rgba(168,152,130,0.4)',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 6,
            padding: 20,
            marginBottom: 24
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'rgba(255,255,255,0.95)', fontFamily: FIGTREE }}>Preferences</h2>
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <label htmlFor="pref-theme" style={{ display: 'block', fontSize: 14, color: 'rgba(168,152,130,0.9)', marginBottom: 6, fontWeight: 600 }}>Theme</label>
              <select
                id="pref-theme"
                value={theme}
                onChange={(e) => handleThemeChange(e.target.value)}
                aria-label="Theme selector"
                style={selectStyle}
              >
                <option value="light" style={{ background: '#1a1a1f', color: 'rgba(255,255,255,0.95)' }}>Light</option>
                <option value="dark" style={{ background: '#1a1a1f', color: 'rgba(255,255,255,0.95)' }}>Dark</option>
                <option value="system" style={{ background: '#1a1a1f', color: 'rgba(255,255,255,0.95)' }}>System</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <label htmlFor="pref-telemetry" style={{ display: 'block', fontSize: 14, color: 'rgba(168,152,130,0.9)', marginBottom: 4, fontWeight: 600 }}>Telemetry</label>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Send anonymized event data to improve reliability. In production builds this is off by default.</p>
              </div>
              <ToggleSwitch
                id="pref-telemetry"
                checked={telemetryEnabled}
                onChange={handleTelemetryChange}
                ariaLabel="Enable telemetry"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <label htmlFor="pref-analytics" style={{ display: 'block', fontSize: 14, color: 'rgba(168,152,130,0.9)', marginBottom: 4, fontWeight: 600 }}>Usage analytics</label>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Help improve Agent Max by sending anonymous usage data.</p>
              </div>
              <ToggleSwitch
                id="pref-analytics"
                checked={analytics}
                onChange={handleAnalyticsChange}
                ariaLabel="Enable anonymous analytics"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <label htmlFor="pref-deep-memory" style={{ display: 'block', fontSize: 14, color: 'rgba(168,152,130,0.9)', marginBottom: 4, fontWeight: 600 }}>Deep memory search</label>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Use more extensive semantic search for better recall (may be slower).</p>
              </div>
              <ToggleSwitch
                id="pref-deep-memory"
                checked={deepMemorySearch}
                onChange={handleDeepMemoryChange}
                ariaLabel="Enable deep memory search"
              />
            </div>
            <div>
              <label htmlFor="pref-browser" style={{ display: 'block', fontSize: 14, color: 'rgba(168,152,130,0.9)', marginBottom: 6, fontWeight: 600 }}>Browser mode</label>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                Choose how Max browses the web. "Max's Monitor" is an isolated browser window. "Your Safari" uses your personal browser.
              </p>
              <select
                id="pref-browser"
                value={browserPreference}
                onChange={(e) => handleBrowserPreferenceChange(e.target.value)}
                aria-label="Browser mode selector"
                style={selectStyle}
              >
                <option value="both" style={{ background: '#1a1a1f', color: 'rgba(255,255,255,0.95)' }}>Both (Max chooses)</option>
                <option value="workspace_only" style={{ background: '#1a1a1f', color: 'rgba(255,255,255,0.95)' }}>Max's Monitor only</option>
                <option value="safari_only" style={{ background: '#1a1a1f', color: 'rgba(255,255,255,0.95)' }}>Your Safari only</option>
              </select>
            </div>
          </div>
        </motion.section>

        {/* Integrations */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            borderLeftWidth: 2,
            borderLeftColor: 'rgba(168,152,130,0.4)',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 6,
            padding: 20,
            marginBottom: 24
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'rgba(255,255,255,0.95)', fontFamily: FIGTREE }}>Integrations</h2>

          {isGoogleComingSoon(userEmail) ? (
            /* Coming Soon UI for non-beta users */
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderLeft: '2px solid rgba(255,255,255,0.15)',
              padding: '16px 18px',
              borderRadius: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontFamily: FIGTREE }}>
                  Google Integration
                </span>
                <span style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  fontWeight: 500,
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}>
                  Coming soon
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Gmail, Calendar, Docs, Sheets, and YouTube access for research and task execution.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Gmail', 'Calendar', 'Docs', 'Sheets', 'YouTube'].map((service) => (
                  <span key={service} style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.4)',
                    padding: '3px 8px',
                    borderRadius: 2,
                    fontSize: 11,
                  }}>
                    {service}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            /* Full Google Connect for beta users */
            <>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
                Connect your Google account to enable Gmail, Calendar, Docs, Sheets, and YouTube.
              </p>
              <GoogleConnect />
            </>
          )}
        </motion.section>

        {/* AI Workspace Credentials */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
        >
          <CredentialsSettings />
        </motion.div>

        {/* About */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '20px 0 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src={logo}
              alt="Agent Max Logo"
              style={{ height: 28, width: 28 }}
            />
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'rgba(255,255,255,0.95)', fontFamily: FIGTREE }}>Agent Max</h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(168,152,130,0.7)' }}>Version</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                {packageJson.version}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(168,152,130,0.7)' }}>Build</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              &copy; 2026 Agent Max
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
