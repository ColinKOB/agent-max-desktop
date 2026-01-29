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
                        // Trigger Google OAuth flow - this would normally be handled by your auth system
                        window.location.href = '#/login?oauth=google';
                      }}
                    >
                      <Link size={16} />
                      <span>Connect</span>
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
