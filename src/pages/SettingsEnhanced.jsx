import { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  Moon,
  Sun,
  Bell,
  Shield,
  User,
  Key,
  Globe,
  Monitor,
  Camera,
  MousePointer,
  ChevronRight,
  Activity,
  Calendar,
  BarChart3,
  Receipt,
  Coins
} from 'lucide-react';
import useStore from '../store/useStore';
import { healthAPI } from '../services/api';
import toast from 'react-hot-toast';
import { CreditPurchase } from '../components/billing/CreditPurchase';
import './SettingsEnhanced.css';

export default function SettingsEnhanced() {
  const { theme, setTheme } = useStore();
  const [activeSection, setActiveSection] = useState('billing');
  
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
  
  // Billing state
  const [billingData, setBillingData] = useState({
    currentPlan: 'Pro',
    monthlyLimit: 100.00,
    currentUsage: 32.47,
    billingCycle: 'Nov 1 - Nov 30',
    paymentMethod: '**** 4242',
    nextBillDate: 'November 1, 2025',
    costPerToken: 0.000002,
    tokensUsed: 16235000,
    averageDailyCost: 1.08
  });

  const [invoices, setInvoices] = useState([
    { id: 1, date: '2025-10-01', amount: 45.23, status: 'paid' },
    { id: 2, date: '2025-09-01', amount: 38.91, status: 'paid' },
    { id: 3, date: '2025-08-01', amount: 41.55, status: 'paid' }
  ]);

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

  const usagePercentage = (billingData.currentUsage / billingData.monthlyLimit) * 100;
  const daysInMonth = 30;
  const daysElapsed = 20; // Would calculate from actual date
  const projectedMonthlyUsage = (billingData.currentUsage / daysElapsed) * daysInMonth;

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

              {/* Usage Overview */}
              <div className="usage-overview glass-panel">
                <div className="usage-header">
                  <div className="usage-title">
                    <Activity size={20} />
                    <h3>Current Usage</h3>
                  </div>
                  <span className="billing-cycle">{billingData.billingCycle}</span>
                </div>

                <div className="usage-metrics">
                  <div className="metric-primary">
                    <span className="metric-value">${billingData.currentUsage.toFixed(2)}</span>
                    <span className="metric-label">of ${billingData.monthlyLimit.toFixed(2)} limit</span>
                  </div>
                  
                  <div className="usage-bar">
                    <div 
                      className={`usage-fill ${usagePercentage > 80 ? 'warning' : ''}`}
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>

                  <div className="usage-stats">
                    <div className="stat">
                      <TrendingUp size={16} />
                      <span>Projected: ${projectedMonthlyUsage.toFixed(2)}</span>
                    </div>
                    <div className="stat">
                      <BarChart3 size={16} />
                      <span>Daily avg: ${billingData.averageDailyCost.toFixed(2)}</span>
                    </div>
                    <div className="stat">
                      <Activity size={16} />
                      <span>{billingData.tokensUsed.toLocaleString()} tokens</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="cost-breakdown glass-panel">
                <h3>
                  <DollarSign size={20} />
                  Cost Breakdown
                </h3>
                <div className="breakdown-items">
                  <div className="breakdown-item">
                    <span className="item-label">Chat messages</span>
                    <span className="item-value">$18.32</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="item-label">Autonomous tasks</span>
                    <span className="item-value">$12.15</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="item-label">Image analysis</span>
                    <span className="item-value">$2.00</span>
                  </div>
                  <div className="breakdown-item total">
                    <span className="item-label">Total</span>
                    <span className="item-value">${billingData.currentUsage.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Plan Details */}
              <div className="plan-details glass-panel">
                <div className="plan-header">
                  <div>
                    <h3>Current Plan</h3>
                    <div className="plan-name">
                      <CheckCircle size={16} className="plan-icon" />
                      <span>{billingData.currentPlan}</span>
                    </div>
                  </div>
                  <button className="btn-secondary glass-button">
                    Change Plan
                  </button>
                </div>

                <div className="plan-features">
                  <div className="feature">
                    <CheckCircle size={16} className="check" />
                    <span>Unlimited chat messages</span>
                  </div>
                  <div className="feature">
                    <CheckCircle size={16} className="check" />
                    <span>1000 autonomous actions/month</span>
                  </div>
                  <div className="feature">
                    <CheckCircle size={16} className="check" />
                    <span>Priority support</span>
                  </div>
                  <div className="feature">
                    <CheckCircle size={16} className="check" />
                    <span>Advanced integrations</span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="payment-method glass-panel">
                <div className="payment-header">
                  <h3>
                    <CreditCard size={20} />
                    Payment Method
                  </h3>
                  <button className="btn-text">Update</button>
                </div>
                <div className="payment-details">
                  <div className="card-info">
                    <CreditCard size={32} className="card-icon" />
                    <div>
                      <p className="card-number">{billingData.paymentMethod}</p>
                      <p className="next-bill">Next bill: {billingData.nextBillDate}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing History */}
              <div className="billing-history glass-panel">
                <div className="history-header">
                  <h3>
                    <Receipt size={20} />
                    Billing History
                  </h3>
                  <button className="btn-text">View All</button>
                </div>
                <div className="invoices-list">
                  {invoices.map(invoice => (
                    <div key={invoice.id} className="invoice-item">
                      <div className="invoice-info">
                        <FileText size={16} />
                        <span className="invoice-date">{invoice.date}</span>
                        <span className="invoice-amount">${invoice.amount.toFixed(2)}</span>
                      </div>
                      <div className="invoice-actions">
                        <span className={`status ${invoice.status}`}>{invoice.status}</span>
                        <button className="btn-icon">
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Usage Alerts */}
              <div className="usage-alerts glass-panel">
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
                        onChange={(e) => setUsageAlerts({...usageAlerts, enabled: e.target.checked})}
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
                          onChange={(e) => setUsageAlerts({...usageAlerts, threshold: e.target.value})}
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
                        onChange={(e) => setUsageAlerts({...usageAlerts, email: e.target.checked})}
                      />
                      <span>Email notifications</span>
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={usageAlerts.inApp}
                        onChange={(e) => setUsageAlerts({...usageAlerts, inApp: e.target.checked})}
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
