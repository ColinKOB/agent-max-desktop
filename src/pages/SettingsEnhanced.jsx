import { useState, useEffect } from 'react';
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
  Coins
} from 'lucide-react';
import useStore from '../store/useStore';
import { healthAPI } from '../services/api';
import toast from 'react-hot-toast';
import { CreditPurchase } from '../components/billing/CreditPurchase';
import { UsageDashboard } from '../components/billing/UsageDashboard';
import { BillingHistory } from '../components/billing/BillingHistory';
import './SettingsEnhanced.css';

export default function SettingsEnhanced() {
  const { theme, setTheme } = useStore();
  const [activeSection, setActiveSection] = useState('billing');
  const tenantId = localStorage.getItem('user_id') || localStorage.getItem('device_id') || 'test-tenant-001';
  
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
  
  // Billing state (alerts only)

  const [usageAlerts, setUsageAlerts] = useState({
    enabled: true,
    threshold: 80,
    email: true,
    inApp: true
  });

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
          <nav className="tabs-rail" role="tablist" aria-label="Settings sections">
            {sections.map(section => {
              const Icon = section.icon;
              const selected = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  role="tab"
                  aria-selected={selected}
                  className={`tab-chip ${selected ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
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
                <div className="alert-settings">
                  <div className="setting-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={usageAlerts.enabled}
                        onChange={(e) => setUsageAlerts({ ...usageAlerts, enabled: e.target.checked })}
                      />
                      <span>Enable usage alerts</span>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <span>Alert threshold</span>
                      <div className="threshold-input">
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={usageAlerts.threshold}
                          onChange={(e) => setUsageAlerts({ ...usageAlerts, threshold: e.target.value })}
                        />
                        <span>{usageAlerts.threshold}%</span>
                      </div>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={usageAlerts.email}
                        onChange={(e) => setUsageAlerts({ ...usageAlerts, email: e.target.checked })}
                      />
                      <span>Email notifications</span>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={usageAlerts.inApp}
                        onChange={(e) => setUsageAlerts({ ...usageAlerts, inApp: e.target.checked })}
                      />
                      <span>In-app notifications</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="appearance-section">
              <header className="section-header glass-panel">
                <h1>Appearance</h1>
                <p>Customize how Agent Max looks</p>
              </header>

              <div className="theme-selector glass-panel">
                <h3>Theme</h3>
                <div className="theme-options">
                  <button
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={24} />
                    <span>Light</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={24} />
                    <span>Dark</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'auto' ? 'active' : ''}`}
                    onClick={() => setTheme('auto')}
                  >
                    <Monitor size={24} />
                    <span>Auto</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add other sections as needed */}
        </main>
      </div>
    </div>
  );
}
