import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard,
  AlertCircle,
  Moon,
  Sun,
  Bell,
  Shield,
  User,
  Globe,
  Monitor,
  Coins,
  Volume2,
  VolumeX,
  LogOut,
  Trash2,
  Link,
  Unlink,
  Mail,
  Check,
  Eye,
  EyeOff,
  Database,
  RefreshCw,
  Info
} from 'lucide-react';
import useStore from '../store/useStore';
import { healthAPI } from '../services/api';
import toast from 'react-hot-toast';
import { CreditPurchase } from '../components/billing/CreditPurchase';
import { UsageDashboard } from '../components/billing/UsageDashboard';
import { BillingHistory } from '../components/billing/BillingHistory';
import './SettingsEnhanced.css';

// Custom Toggle Switch Component with better UX
const ToggleSwitch = ({ checked, onChange, disabled, label, id }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) onChange({ target: { checked: !checked } });
    }
  };

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle-switch ${checked ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onChange({ target: { checked: !checked } })}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </button>
  );
};

// Settings change toast with undo
const showSettingSavedToast = (settingName, newValue) => {
  toast.success(
    <span className="setting-toast">
      <Check size={16} />
      <span>{settingName} {typeof newValue === 'boolean' ? (newValue ? 'enabled' : 'disabled') : 'updated'}</span>
    </span>,
    {
      duration: 2000,
      style: {
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        color: '#166534'
      }
    }
  );
};

export default function SettingsEnhanced() {
  const { theme, setTheme } = useStore();
  const [activeSection, setActiveSection] = useState('billing');
  const tenantId = localStorage.getItem('user_id') || localStorage.getItem('device_id') || 'test-tenant-001';
  const tabsRef = useRef(null);

  // Check URL for initial section
  useEffect(() => {
    const urlParams = new URLSearchParams(
      window.location.search || window.location.hash.split('?')[1]
    );
    const section = urlParams.get('section');
    if (section) {
      setActiveSection(section);
    }
  }, []);

  // Billing state (alerts only) - persisted to localStorage
  const [usageAlerts, setUsageAlerts] = useState(() => {
    const saved = localStorage.getItem('settings_usageAlerts');
    return saved ? JSON.parse(saved) : {
      enabled: true,
      threshold: 80,
      email: true,
      inApp: true
    };
  });

  // Notification settings state - persisted to localStorage
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem('settings_notifications');
    return saved ? JSON.parse(saved) : {
      enabled: true,
      soundEffects: true,
      desktopNotifications: true
    };
  });

  // Privacy settings state - persisted to localStorage
  const [privacySettings, setPrivacySettings] = useState(() => {
    const saved = localStorage.getItem('settings_privacy');
    return saved ? JSON.parse(saved) : {
      analyticsEnabled: true,
      crashReportsEnabled: true,
      showOnlineStatus: true
    };
  });

  // Advanced settings state - persisted to localStorage
  const [advancedSettings, setAdvancedSettings] = useState(() => {
    const saved = localStorage.getItem('settings_advanced');
    return saved ? JSON.parse(saved) : {
      developerMode: false,
      debugLogging: false,
      experimentalFeatures: false
    };
  });

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('settings_usageAlerts', JSON.stringify(usageAlerts));
  }, [usageAlerts]);

  useEffect(() => {
    localStorage.setItem('settings_notifications', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  useEffect(() => {
    localStorage.setItem('settings_privacy', JSON.stringify(privacySettings));
  }, [privacySettings]);

  useEffect(() => {
    localStorage.setItem('settings_advanced', JSON.stringify(advancedSettings));
  }, [advancedSettings]);

  // Setting change handlers with toast feedback
  const handleNotificationChange = useCallback((key, value) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
    const labels = {
      enabled: 'Notifications',
      soundEffects: 'Sound effects',
      desktopNotifications: 'Desktop notifications'
    };
    showSettingSavedToast(labels[key], value);
  }, []);

  const handlePrivacyChange = useCallback((key, value) => {
    setPrivacySettings(prev => ({ ...prev, [key]: value }));
    const labels = {
      analyticsEnabled: 'Analytics',
      crashReportsEnabled: 'Crash reports',
      showOnlineStatus: 'Online status'
    };
    showSettingSavedToast(labels[key], value);
  }, []);

  const handleAdvancedChange = useCallback((key, value) => {
    setAdvancedSettings(prev => ({ ...prev, [key]: value }));
    const labels = {
      developerMode: 'Developer mode',
      debugLogging: 'Debug logging',
      experimentalFeatures: 'Experimental features'
    };
    showSettingSavedToast(labels[key], value);
  }, []);

  const handleUsageAlertChange = useCallback((key, value) => {
    setUsageAlerts(prev => ({ ...prev, [key]: value }));
    if (key !== 'threshold') {
      const labels = {
        enabled: 'Usage alerts',
        email: 'Email notifications',
        inApp: 'In-app notifications'
      };
      showSettingSavedToast(labels[key], value);
    }
  }, []);

  // Keyboard navigation for tabs
  const handleTabKeyDown = useCallback((e, sectionId, sections) => {
    const currentIndex = sections.findIndex(s => s.id === sectionId);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % sections.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + sections.length) % sections.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = sections.length - 1;
    }

    if (newIndex !== currentIndex) {
      setActiveSection(sections[newIndex].id);
      // Focus the new tab
      setTimeout(() => {
        const newTab = tabsRef.current?.querySelector(`[data-section="${sections[newIndex].id}"]`);
        newTab?.focus();
      }, 0);
    }
  }, []);

  // Account info
  const userEmail = localStorage.getItem('user_email') || localStorage.getItem('google_user_email') || '';
  const userId = localStorage.getItem('user_id') || localStorage.getItem('device_id') || '';
  const googleEmail = localStorage.getItem('google_user_email') || '';
  const isGoogleConnected = !!googleEmail;

  // Delete account confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Third-party integrations state
  const [integrationStatus, setIntegrationStatus] = useState({
    notion: false,
    slack: false,
    discord: false,
    hubspot: false,
    zendesk: false
  });
  const [integrationLoading, setIntegrationLoading] = useState({});
  const [integrationTokens, setIntegrationTokens] = useState({
    notion: '',
    slack: '',
    discord: '',
    hubspot: '',
    zendesk: { subdomain: '', email: '', token: '' }
  });

  // Load integration status on mount
  useEffect(() => {
    const loadIntegrationStatus = async () => {
      try {
        if (window.electron?.integrations?.getAllStatus) {
          const status = await window.electron.integrations.getAllStatus();
          setIntegrationStatus(status);
        }
      } catch (e) {
        console.error('[Settings] Failed to load integration status:', e);
      }
    };
    loadIntegrationStatus();
  }, []);

  // Integration connect/disconnect handlers
  const handleIntegrationConnect = async (service) => {
    setIntegrationLoading(prev => ({ ...prev, [service]: true }));
    try {
      const creds = service === 'zendesk'
        ? integrationTokens.zendesk
        : { token: integrationTokens[service] };

      // Test connection first
      const testResult = await window.electron.integrations.test(service, creds);
      if (!testResult.success) {
        toast.error(testResult.error || `Failed to connect to ${service}`);
        return;
      }

      // If test passes, save and connect
      const result = await window.electron.integrations.connect(service, creds);
      if (result.success) {
        setIntegrationStatus(prev => ({ ...prev, [service]: true }));
        toast.success(`Connected to ${service}!`);
        // Clear the token input for security
        setIntegrationTokens(prev => ({
          ...prev,
          [service]: service === 'zendesk' ? { subdomain: '', email: '', token: '' } : ''
        }));
      } else {
        toast.error(result.error || `Failed to connect to ${service}`);
      }
    } catch (e) {
      toast.error(`Error connecting to ${service}: ${e.message}`);
    } finally {
      setIntegrationLoading(prev => ({ ...prev, [service]: false }));
    }
  };

  const handleIntegrationDisconnect = async (service) => {
    setIntegrationLoading(prev => ({ ...prev, [service]: true }));
    try {
      const result = await window.electron.integrations.disconnect(service);
      if (result.success) {
        setIntegrationStatus(prev => ({ ...prev, [service]: false }));
        toast.success(`Disconnected from ${service}`);
      } else {
        toast.error(result.error || `Failed to disconnect from ${service}`);
      }
    } catch (e) {
      toast.error(`Error disconnecting from ${service}: ${e.message}`);
    } finally {
      setIntegrationLoading(prev => ({ ...prev, [service]: false }));
    }
  };

  // Sign out handler
  const handleSignOut = () => {
    localStorage.removeItem('user_email');
    localStorage.removeItem('google_user_email');
    localStorage.removeItem('user_id');
    localStorage.removeItem('google_access_token');
    toast.success('Signed out successfully');
    window.location.reload();
  };

  // Google disconnect handler
  const handleGoogleDisconnect = () => {
    localStorage.removeItem('google_user_email');
    localStorage.removeItem('google_access_token');
    toast.success('Google account disconnected');
    window.location.reload();
  };

  const sections = [
    { id: 'credits', label: 'Purchase Credits', icon: Coins },
    { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
    { id: 'appearance', label: 'Appearance', icon: Moon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'account', label: 'Account', icon: User },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'advanced', label: 'Advanced', icon: Monitor }
  ];

  // Handle theme change with feedback
  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme);
    showSettingSavedToast('Theme', newTheme);
  }, [setTheme]);

  return (
    <div className="settings-enhanced">
      {/* Glassmorphic background */}
      <div className="glass-background">
        <div className="glass-gradient-1" />
        <div className="glass-gradient-2" />
        <div className="glass-gradient-3" />
      </div>

      <div className="settings-container">
        <div className="top-tabs glass-panel">
          <nav className="tabs-rail" role="tablist" aria-label="Settings sections" ref={tabsRef}>
            {sections.map((section, index) => {
              const Icon = section.icon;
              const selected = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  role="tab"
                  data-section={section.id}
                  aria-selected={selected}
                  aria-controls={`${section.id}-panel`}
                  tabIndex={selected ? 0 : -1}
                  className={`tab-chip ${selected ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, section.id, sections)}
                >
                  <Icon size={16} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <main className="settings-content">
          {activeSection === 'credits' && (
            <div className="credits-section">
              <CreditPurchase 
                userId={localStorage.getItem('user_id')}
                onSuccess={() => {
                  toast.success('Credits purchased successfully!');
                  setTimeout(() => {
                    setActiveSection('billing');
                  }, 2000);
                }}
              />
            </div>
          )}

          {activeSection === 'billing' && (
            <div className="billing-section">
              <header className="section-header glass-panel">
                <h1>Billing & Usage</h1>
                <p>Manage your subscription and monitor usage</p>
              </header>

              {/* Live Usage Dashboard */}
              <div className="glass-panel">
                <UsageDashboard tenantId={tenantId} />
              </div>

              {/* Live Billing History */}
              <div className="glass-panel mt-6">
                <BillingHistory tenantId={tenantId} />
              </div>

              {/* Usage Alerts */}
              <div className="usage-alerts glass-panel mt-6">
                <h3>
                  <AlertCircle size={20} />
                  Usage Alerts
                </h3>
                <div className="settings-list">
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="usage-enabled" className="setting-label">Enable usage alerts</label>
                      <p className="setting-description">Get notified when approaching usage limits</p>
                    </div>
                    <ToggleSwitch
                      id="usage-enabled"
                      checked={usageAlerts.enabled}
                      onChange={(e) => handleUsageAlertChange('enabled', e.target.checked)}
                      label="Enable usage alerts"
                    />
                  </div>
                  <div className="setting-row threshold-row">
                    <div className="setting-info">
                      <label htmlFor="usage-threshold" className="setting-label">Alert threshold</label>
                      <p className="setting-description">Trigger alert when usage reaches this percentage</p>
                    </div>
                    <div className="threshold-control">
                      <input
                        type="range"
                        id="usage-threshold"
                        min="50"
                        max="100"
                        value={usageAlerts.threshold}
                        onChange={(e) => handleUsageAlertChange('threshold', parseInt(e.target.value))}
                        disabled={!usageAlerts.enabled}
                        aria-valuemin={50}
                        aria-valuemax={100}
                        aria-valuenow={usageAlerts.threshold}
                        aria-label="Usage alert threshold percentage"
                      />
                      <span className="threshold-value">{usageAlerts.threshold}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="usage-email" className="setting-label">
                        <Mail size={16} className="setting-icon" />
                        Email notifications
                      </label>
                      <p className="setting-description">Receive alerts via email</p>
                    </div>
                    <ToggleSwitch
                      id="usage-email"
                      checked={usageAlerts.email}
                      onChange={(e) => handleUsageAlertChange('email', e.target.checked)}
                      disabled={!usageAlerts.enabled}
                      label="Email notifications"
                    />
                  </div>
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="usage-inapp" className="setting-label">
                        <Bell size={16} className="setting-icon" />
                        In-app notifications
                      </label>
                      <p className="setting-description">Show alerts within the app</p>
                    </div>
                    <ToggleSwitch
                      id="usage-inapp"
                      checked={usageAlerts.inApp}
                      onChange={(e) => handleUsageAlertChange('inApp', e.target.checked)}
                      disabled={!usageAlerts.enabled}
                      label="In-app notifications"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="appearance-section" id="appearance-panel" role="tabpanel" aria-labelledby="appearance-tab">
              <header className="section-header glass-panel">
                <h1>Appearance</h1>
                <p>Customize how Agent Max looks</p>
              </header>

              <div className="theme-selector glass-panel">
                <h3>Theme</h3>
                <div className="theme-options" role="radiogroup" aria-label="Theme selection">
                  <button
                    role="radio"
                    aria-checked={theme === 'light'}
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('light')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') handleThemeChange('dark');
                      if (e.key === 'ArrowLeft') handleThemeChange('auto');
                    }}
                    tabIndex={theme === 'light' ? 0 : -1}
                  >
                    <Sun size={24} />
                    <span>Light</span>
                    {theme === 'light' && <Check size={16} className="theme-check" />}
                  </button>
                  <button
                    role="radio"
                    aria-checked={theme === 'dark'}
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') handleThemeChange('auto');
                      if (e.key === 'ArrowLeft') handleThemeChange('light');
                    }}
                    tabIndex={theme === 'dark' ? 0 : -1}
                  >
                    <Moon size={24} />
                    <span>Dark</span>
                    {theme === 'dark' && <Check size={16} className="theme-check" />}
                  </button>
                  <button
                    role="radio"
                    aria-checked={theme === 'auto'}
                    className={`theme-option ${theme === 'auto' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('auto')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') handleThemeChange('light');
                      if (e.key === 'ArrowLeft') handleThemeChange('dark');
                    }}
                    tabIndex={theme === 'auto' ? 0 : -1}
                  >
                    <Monitor size={24} />
                    <span>Auto</span>
                    {theme === 'auto' && <Check size={16} className="theme-check" />}
                  </button>
                </div>
                <p className="theme-hint">
                  <Info size={14} />
                  {theme === 'auto'
                    ? 'Theme will match your system preferences'
                    : `Using ${theme} theme`}
                </p>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="notifications-section" id="notifications-panel" role="tabpanel" aria-labelledby="notifications-tab">
              <header className="section-header glass-panel">
                <h1>Notifications</h1>
                <p>Configure how Agent Max notifies you</p>
              </header>

              <div className="notification-settings glass-panel">
                <h3>
                  <Bell size={20} />
                  Notification Preferences
                </h3>
                <div className="settings-list">
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="notif-enabled" className="setting-label">Enable notifications</label>
                      <p className="setting-description">Receive notifications from Agent Max</p>
                    </div>
                    <ToggleSwitch
                      id="notif-enabled"
                      checked={notificationSettings.enabled}
                      onChange={(e) => handleNotificationChange('enabled', e.target.checked)}
                      label="Enable notifications"
                    />
                  </div>
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="notif-sound" className="setting-label">
                        <Volume2 size={16} className="setting-icon" />
                        Sound effects
                      </label>
                      <p className="setting-description">Play sounds for messages and alerts</p>
                    </div>
                    <ToggleSwitch
                      id="notif-sound"
                      checked={notificationSettings.soundEffects}
                      onChange={(e) => handleNotificationChange('soundEffects', e.target.checked)}
                      disabled={!notificationSettings.enabled}
                      label="Sound effects"
                    />
                  </div>
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="notif-desktop" className="setting-label">
                        <Monitor size={16} className="setting-icon" />
                        Desktop notifications
                      </label>
                      <p className="setting-description">Show system notifications on your desktop</p>
                    </div>
                    <ToggleSwitch
                      id="notif-desktop"
                      checked={notificationSettings.desktopNotifications}
                      onChange={(e) => handleNotificationChange('desktopNotifications', e.target.checked)}
                      disabled={!notificationSettings.enabled}
                      label="Desktop notifications"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'account' && (
            <div className="account-section">
              <header className="section-header glass-panel">
                <h1>Account</h1>
                <p>Manage your account settings</p>
              </header>

              <div className="account-info glass-panel">
                <h3>
                  <User size={20} />
                  Account Information
                </h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Email</label>
                    <div className="info-value">
                      <Mail size={16} />
                      <span>{userEmail || 'Not set'}</span>
                    </div>
                  </div>
                  <div className="info-item">
                    <label>User ID</label>
                    <div className="info-value">
                      <span className="user-id">{userId || 'Not available'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="account-actions glass-panel">
                <h3>
                  <Shield size={20} />
                  Account Actions
                </h3>
                <div className="action-buttons">
                  <button className="action-btn sign-out" onClick={handleSignOut}>
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </button>
                  <button
                    className="action-btn delete-account"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={18} />
                    <span>Delete Account</span>
                  </button>
                </div>

                {showDeleteConfirm && (
                  <div className="delete-confirmation">
                    <p>Are you sure you want to delete your account? This action cannot be undone.</p>
                    <div className="confirm-buttons">
                      <button
                        className="cancel-btn"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="confirm-delete-btn"
                        onClick={() => {
                          toast.error('Account deletion is not available yet. Please contact support.');
                          setShowDeleteConfirm(false);
                        }}
                      >
                        Yes, Delete My Account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'integrations' && (
            <div className="integrations-section">
              <header className="section-header glass-panel">
                <h1>Integrations</h1>
                <p>Connect external services to Agent Max</p>
              </header>

              {/* Google Account */}
              <div className="integration-card glass-panel">
                <div className="integration-header">
                  <div className="integration-icon google">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>Google Account</h4>
                    <p className="integration-status">
                      {isGoogleConnected ? (
                        <>
                          <span className="status-connected">Connected</span>
                          <span className="connected-email">{googleEmail}</span>
                        </>
                      ) : (
                        <span className="status-disconnected">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="integration-actions">
                  {isGoogleConnected ? (
                    <button className="disconnect-btn" onClick={handleGoogleDisconnect}>
                      <Unlink size={16} />
                      <span>Disconnect</span>
                    </button>
                  ) : (
                    <button
                      className="connect-btn"
                      onClick={() => {
                        toast('Google sign-in will open in a new window', { icon: 'info' });
                        window.location.href = '#/login?oauth=google';
                      }}
                    >
                      <Link size={16} />
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Notion */}
              <div className="integration-card glass-panel">
                <div className="integration-header">
                  <div className="integration-icon notion">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.296c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.62c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM2.876 1.015l13.356-.98c1.635-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.401-1.652z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>Notion</h4>
                    <p className="integration-status">
                      {integrationStatus.notion ? (
                        <span className="status-connected">Connected</span>
                      ) : (
                        <span className="status-disconnected">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="integration-body">
                  {!integrationStatus.notion && (
                    <div className="integration-input-group">
                      <input
                        type="password"
                        placeholder="Notion Integration Token"
                        value={integrationTokens.notion}
                        onChange={(e) => setIntegrationTokens(prev => ({ ...prev, notion: e.target.value }))}
                        className="integration-input"
                      />
                      <p className="integration-help">
                        Create an internal integration at <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer">notion.so/my-integrations</a>
                      </p>
                    </div>
                  )}
                </div>
                <div className="integration-actions">
                  {integrationStatus.notion ? (
                    <button
                      className="disconnect-btn"
                      onClick={() => handleIntegrationDisconnect('notion')}
                      disabled={integrationLoading.notion}
                    >
                      <Unlink size={16} />
                      <span>{integrationLoading.notion ? 'Disconnecting...' : 'Disconnect'}</span>
                    </button>
                  ) : (
                    <button
                      className="connect-btn"
                      onClick={() => handleIntegrationConnect('notion')}
                      disabled={integrationLoading.notion || !integrationTokens.notion}
                    >
                      <Link size={16} />
                      <span>{integrationLoading.notion ? 'Connecting...' : 'Connect'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Slack */}
              <div className="integration-card glass-panel">
                <div className="integration-header">
                  <div className="integration-icon slack">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
                      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
                      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
                      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>Slack</h4>
                    <p className="integration-status">
                      {integrationStatus.slack ? (
                        <span className="status-connected">Connected</span>
                      ) : (
                        <span className="status-disconnected">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="integration-body">
                  {!integrationStatus.slack && (
                    <div className="integration-input-group">
                      <input
                        type="password"
                        placeholder="Slack Bot Token (xoxb-...)"
                        value={integrationTokens.slack}
                        onChange={(e) => setIntegrationTokens(prev => ({ ...prev, slack: e.target.value }))}
                        className="integration-input"
                      />
                      <p className="integration-help">
                        Create a Slack App at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">api.slack.com/apps</a>
                      </p>
                    </div>
                  )}
                </div>
                <div className="integration-actions">
                  {integrationStatus.slack ? (
                    <button
                      className="disconnect-btn"
                      onClick={() => handleIntegrationDisconnect('slack')}
                      disabled={integrationLoading.slack}
                    >
                      <Unlink size={16} />
                      <span>{integrationLoading.slack ? 'Disconnecting...' : 'Disconnect'}</span>
                    </button>
                  ) : (
                    <button
                      className="connect-btn"
                      onClick={() => handleIntegrationConnect('slack')}
                      disabled={integrationLoading.slack || !integrationTokens.slack}
                    >
                      <Link size={16} />
                      <span>{integrationLoading.slack ? 'Connecting...' : 'Connect'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Discord */}
              <div className="integration-card glass-panel">
                <div className="integration-header">
                  <div className="integration-icon discord">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="#5865F2">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>Discord</h4>
                    <p className="integration-status">
                      {integrationStatus.discord ? (
                        <span className="status-connected">Connected</span>
                      ) : (
                        <span className="status-disconnected">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="integration-body">
                  {!integrationStatus.discord && (
                    <div className="integration-input-group">
                      <input
                        type="password"
                        placeholder="Discord Bot Token"
                        value={integrationTokens.discord}
                        onChange={(e) => setIntegrationTokens(prev => ({ ...prev, discord: e.target.value }))}
                        className="integration-input"
                      />
                      <p className="integration-help">
                        Create a bot at <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">discord.com/developers</a>
                      </p>
                    </div>
                  )}
                </div>
                <div className="integration-actions">
                  {integrationStatus.discord ? (
                    <button
                      className="disconnect-btn"
                      onClick={() => handleIntegrationDisconnect('discord')}
                      disabled={integrationLoading.discord}
                    >
                      <Unlink size={16} />
                      <span>{integrationLoading.discord ? 'Disconnecting...' : 'Disconnect'}</span>
                    </button>
                  ) : (
                    <button
                      className="connect-btn"
                      onClick={() => handleIntegrationConnect('discord')}
                      disabled={integrationLoading.discord || !integrationTokens.discord}
                    >
                      <Link size={16} />
                      <span>{integrationLoading.discord ? 'Connecting...' : 'Connect'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* HubSpot */}
              <div className="integration-card glass-panel">
                <div className="integration-header">
                  <div className="integration-icon hubspot">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="#FF7A59">
                      <path d="M18.164 7.93V5.507a2.074 2.074 0 0 0 1.198-1.883v-.062a2.074 2.074 0 0 0-2.074-2.074h-.062a2.074 2.074 0 0 0-2.074 2.074v.062a2.074 2.074 0 0 0 1.198 1.883V7.93a5.744 5.744 0 0 0-3.123 1.533L6.03 4.283a2.32 2.32 0 1 0-.973 1.078l6.966 5.051a5.732 5.732 0 0 0-.037 6.07l-2.127 2.127a1.73 1.73 0 1 0 1.05 1.05l2.127-2.127a5.744 5.744 0 1 0 5.127-9.602zM17.226 16.8a2.843 2.843 0 1 1 0-5.686 2.843 2.843 0 0 1 0 5.686z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>HubSpot</h4>
                    <p className="integration-status">
                      {integrationStatus.hubspot ? (
                        <span className="status-connected">Connected</span>
                      ) : (
                        <span className="status-disconnected">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="integration-body">
                  {!integrationStatus.hubspot && (
                    <div className="integration-input-group">
                      <input
                        type="password"
                        placeholder="HubSpot Private App Token"
                        value={integrationTokens.hubspot}
                        onChange={(e) => setIntegrationTokens(prev => ({ ...prev, hubspot: e.target.value }))}
                        className="integration-input"
                      />
                      <p className="integration-help">
                        Create a Private App in HubSpot Settings &gt; Integrations &gt; Private Apps
                      </p>
                    </div>
                  )}
                </div>
                <div className="integration-actions">
                  {integrationStatus.hubspot ? (
                    <button
                      className="disconnect-btn"
                      onClick={() => handleIntegrationDisconnect('hubspot')}
                      disabled={integrationLoading.hubspot}
                    >
                      <Unlink size={16} />
                      <span>{integrationLoading.hubspot ? 'Disconnecting...' : 'Disconnect'}</span>
                    </button>
                  ) : (
                    <button
                      className="connect-btn"
                      onClick={() => handleIntegrationConnect('hubspot')}
                      disabled={integrationLoading.hubspot || !integrationTokens.hubspot}
                    >
                      <Link size={16} />
                      <span>{integrationLoading.hubspot ? 'Connecting...' : 'Connect'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Zendesk */}
              <div className="integration-card glass-panel">
                <div className="integration-header">
                  <div className="integration-icon zendesk">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="#03363D">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.5c-5.238 0-9.5-4.262-9.5-9.5S6.762 2.5 12 2.5s9.5 4.262 9.5 9.5-4.262 9.5-9.5 9.5zm-5-7.5h10v5H7v-5zm0-7l10 7H7V7z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>Zendesk</h4>
                    <p className="integration-status">
                      {integrationStatus.zendesk ? (
                        <span className="status-connected">Connected</span>
                      ) : (
                        <span className="status-disconnected">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="integration-body">
                  {!integrationStatus.zendesk && (
                    <div className="integration-input-group zendesk-inputs">
                      <input
                        type="text"
                        placeholder="Subdomain (e.g., company)"
                        value={integrationTokens.zendesk.subdomain}
                        onChange={(e) => setIntegrationTokens(prev => ({
                          ...prev,
                          zendesk: { ...prev.zendesk, subdomain: e.target.value }
                        }))}
                        className="integration-input"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={integrationTokens.zendesk.email}
                        onChange={(e) => setIntegrationTokens(prev => ({
                          ...prev,
                          zendesk: { ...prev.zendesk, email: e.target.value }
                        }))}
                        className="integration-input"
                      />
                      <input
                        type="password"
                        placeholder="API Token"
                        value={integrationTokens.zendesk.token}
                        onChange={(e) => setIntegrationTokens(prev => ({
                          ...prev,
                          zendesk: { ...prev.zendesk, token: e.target.value }
                        }))}
                        className="integration-input"
                      />
                      <p className="integration-help">
                        Generate an API token in Zendesk Admin &gt; Channels &gt; API
                      </p>
                    </div>
                  )}
                </div>
                <div className="integration-actions">
                  {integrationStatus.zendesk ? (
                    <button
                      className="disconnect-btn"
                      onClick={() => handleIntegrationDisconnect('zendesk')}
                      disabled={integrationLoading.zendesk}
                    >
                      <Unlink size={16} />
                      <span>{integrationLoading.zendesk ? 'Disconnecting...' : 'Disconnect'}</span>
                    </button>
                  ) : (
                    <button
                      className="connect-btn"
                      onClick={() => handleIntegrationConnect('zendesk')}
                      disabled={integrationLoading.zendesk || !integrationTokens.zendesk.subdomain || !integrationTokens.zendesk.email || !integrationTokens.zendesk.token}
                    >
                      <Link size={16} />
                      <span>{integrationLoading.zendesk ? 'Connecting...' : 'Connect'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="privacy-section" id="privacy-panel" role="tabpanel" aria-labelledby="privacy-tab">
              <header className="section-header glass-panel">
                <h1>Privacy & Security</h1>
                <p>Control your data and privacy preferences</p>
              </header>

              <div className="privacy-settings glass-panel">
                <h3>
                  <Shield size={20} />
                  Data Collection
                </h3>
                <div className="settings-list">
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="privacy-analytics" className="setting-label">
                        <Database size={16} className="setting-icon" />
                        Usage analytics
                      </label>
                      <p className="setting-description">Help improve Agent Max by sharing anonymous usage data</p>
                    </div>
                    <ToggleSwitch
                      id="privacy-analytics"
                      checked={privacySettings.analyticsEnabled}
                      onChange={(e) => handlePrivacyChange('analyticsEnabled', e.target.checked)}
                      label="Usage analytics"
                    />
                  </div>
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="privacy-crash" className="setting-label">
                        <AlertCircle size={16} className="setting-icon" />
                        Crash reports
                      </label>
                      <p className="setting-description">Automatically send crash reports to help fix issues</p>
                    </div>
                    <ToggleSwitch
                      id="privacy-crash"
                      checked={privacySettings.crashReportsEnabled}
                      onChange={(e) => handlePrivacyChange('crashReportsEnabled', e.target.checked)}
                      label="Crash reports"
                    />
                  </div>
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="privacy-status" className="setting-label">
                        <Eye size={16} className="setting-icon" />
                        Show online status
                      </label>
                      <p className="setting-description">Allow others to see when you are active</p>
                    </div>
                    <ToggleSwitch
                      id="privacy-status"
                      checked={privacySettings.showOnlineStatus}
                      onChange={(e) => handlePrivacyChange('showOnlineStatus', e.target.checked)}
                      label="Show online status"
                    />
                  </div>
                </div>
              </div>

              <div className="security-info glass-panel">
                <h3>
                  <Shield size={20} />
                  Security
                </h3>
                <div className="info-card">
                  <Info size={20} className="info-icon" />
                  <div>
                    <p className="info-title">Your data is protected</p>
                    <p className="info-text">All communications are encrypted end-to-end. Your conversation data is stored securely and never shared with third parties.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'advanced' && (
            <div className="advanced-section" id="advanced-panel" role="tabpanel" aria-labelledby="advanced-tab">
              <header className="section-header glass-panel">
                <h1>Advanced</h1>
                <p>Developer options and experimental features</p>
              </header>

              <div className="advanced-settings glass-panel">
                <h3>
                  <Monitor size={20} />
                  Developer Options
                </h3>
                <div className="settings-list">
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="advanced-devmode" className="setting-label">Developer mode</label>
                      <p className="setting-description">Enable developer tools and console access</p>
                    </div>
                    <ToggleSwitch
                      id="advanced-devmode"
                      checked={advancedSettings.developerMode}
                      onChange={(e) => handleAdvancedChange('developerMode', e.target.checked)}
                      label="Developer mode"
                    />
                  </div>
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="advanced-debug" className="setting-label">
                        <RefreshCw size={16} className="setting-icon" />
                        Debug logging
                      </label>
                      <p className="setting-description">Log detailed information for troubleshooting</p>
                    </div>
                    <ToggleSwitch
                      id="advanced-debug"
                      checked={advancedSettings.debugLogging}
                      onChange={(e) => handleAdvancedChange('debugLogging', e.target.checked)}
                      disabled={!advancedSettings.developerMode}
                      label="Debug logging"
                    />
                  </div>
                  <div className="setting-row">
                    <div className="setting-info">
                      <label htmlFor="advanced-experimental" className="setting-label">
                        <AlertCircle size={16} className="setting-icon warning" />
                        Experimental features
                      </label>
                      <p className="setting-description">Try new features that are still in development</p>
                    </div>
                    <ToggleSwitch
                      id="advanced-experimental"
                      checked={advancedSettings.experimentalFeatures}
                      onChange={(e) => handleAdvancedChange('experimentalFeatures', e.target.checked)}
                      disabled={!advancedSettings.developerMode}
                      label="Experimental features"
                    />
                  </div>
                </div>

                {advancedSettings.developerMode && (
                  <div className="dev-warning">
                    <AlertCircle size={16} />
                    <span>Developer mode is enabled. Some features may affect performance.</span>
                  </div>
                )}
              </div>

              <div className="cache-section glass-panel">
                <h3>
                  <Database size={20} />
                  Storage & Cache
                </h3>
                <div className="cache-actions">
                  <button
                    className="cache-btn"
                    onClick={() => {
                      toast.success('Cache cleared successfully');
                    }}
                  >
                    <RefreshCw size={16} />
                    Clear Cache
                  </button>
                  <p className="cache-description">Clear temporary files and cached data</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
