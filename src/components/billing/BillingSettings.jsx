/**
 * Billing Settings Component
 * 
 * Comprehensive billing management interface for the settings page
 */
import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Bell, 
  Shield, 
  AlertTriangle,
  Check,
  Info,
  ExternalLink,
  Loader2,
  Coins
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CreditPurchase } from './CreditPurchase';
import SubscriptionManager from './SubscriptionManager';

export function BillingSettings({ tenantId = 'test-tenant-001', userId, initialTab = 'overview' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [settings, setSettings] = useState({
    paymentMethod: null,
    subscription: null,
    usageAlerts: {
      enabled: true,
      threshold: 100,
      emailNotifications: true,
      inAppNotifications: true
    },
    usageLimits: {
      monthlyConversationLimit: 50,
      hardStop: false,
      warningThreshold: 80
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchBillingSettings();
    
    // Check URL for tab parameter
    const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tenantId]);

  const fetchBillingSettings = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v2/billing/settings/${tenantId}`);
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
      // If not ok, just use default settings
    } catch (err) {
      console.log('[BillingSettings] Using default settings (API not available)');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v2/billing/settings/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) throw new Error('Failed to save settings');
      
      toast.success('Settings saved successfully');
    } catch (err) {
      console.error('[BillingSettings] Save error:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const openStripePortal = async () => {
    try {
      setPortalLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v2/billing/portal/${tenantId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to open portal');
      }
      
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('[BillingSettings] Portal error:', err);
      toast.error(err.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="billing-settings p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-gray-200 rounded-xl"></div>
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="h-40 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'credits', label: 'Purchase Credits', icon: Coins },
  ];

  return (
    <div className="billing-settings space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Credits Tab */}
      {activeTab === 'credits' && (
        <CreditPurchase 
          userId={userId} 
          onSuccess={() => {
            toast.success('Credits added successfully!');
            setActiveTab('overview');
          }}
        />
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Payment Method Section */}
      <div className="section bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Payment Method
          </h3>
        </div>

        {settings.paymentMethod ? (
          <div className="payment-card p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Card Icon */}
                <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                
                {/* Card Details */}
                <div>
                  <p className="font-medium text-gray-900">
                    {settings.paymentMethod.brand} •••• {settings.paymentMethod.last4}
                  </p>
                  <p className="text-sm text-gray-600">
                    Expires {settings.paymentMethod.expMonth}/{settings.paymentMethod.expYear}
                  </p>
                </div>
              </div>
              
              <button
                onClick={openStripePortal}
                disabled={portalLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Update
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Warning message */}
            <div className="no-payment p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">
                    No payment method on file
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Add a payment method to enable premium features and avoid service interruption.
                  </p>
                </div>
              </div>
            </div>
            {/* CTA button - outside the warning for better contrast */}
            <button
              onClick={openStripePortal}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Add Payment Method
            </button>
          </div>
        )}
      </div>

      {/* Subscription Section */}
      <div className="section bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          Subscription
        </h3>
        <SubscriptionManager userId={userId} />
      </div>

      {/* Usage Alerts Section */}
      <div className="section bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-600" />
          Usage Alerts
        </h3>

        <div className="space-y-4">
          {/* Enable Alerts */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.usageAlerts.enabled}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                usageAlerts: { ...prev.usageAlerts, enabled: e.target.checked }
              }))}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-gray-900">
              Enable usage alerts
            </span>
          </label>

          {settings.usageAlerts.enabled && (
            <>
              {/* Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alert me when monthly cost exceeds:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">$</span>
                  <input
                    type="number"
                    value={settings.usageAlerts.threshold}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      usageAlerts: { ...prev.usageAlerts, threshold: parseInt(e.target.value) || 0 }
                    }))}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step="10"
                  />
                </div>
              </div>

              {/* Notification Types */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.usageAlerts.emailNotifications}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      usageAlerts: { ...prev.usageAlerts, emailNotifications: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Email notifications</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.usageAlerts.inAppNotifications}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      usageAlerts: { ...prev.usageAlerts, inAppNotifications: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">In-app notifications</span>
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Usage Limits Section */}
      <div className="section bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Usage Limits
        </h3>

        <div className="info-box p-3 bg-blue-50 rounded-lg mb-4">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              Set hard limits to prevent overspending. When reached, new conversations will be blocked until the next billing period.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Monthly Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly conversation limit
            </label>
            <input
              type="number"
              value={settings.usageLimits.monthlyConversationLimit}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                usageLimits: { ...prev.usageLimits, monthlyConversationLimit: parseInt(e.target.value) || 0 }
              }))}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              placeholder="0 for unlimited"
            />
            <p className="text-xs text-gray-500 mt-1">
              Set to 0 for unlimited conversations
            </p>
          </div>

          {/* Hard Stop */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.usageLimits.hardStop}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                usageLimits: { ...prev.usageLimits, hardStop: e.target.checked }
              }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">
                Enable hard stop
              </span>
              <p className="text-xs text-gray-500">
                Block all new conversations when limit is reached
              </p>
            </div>
          </label>

          {/* Warning Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warning threshold (%)
            </label>
            <input
              type="number"
              value={settings.usageLimits.warningThreshold}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                usageLimits: { ...prev.usageLimits, warningThreshold: parseInt(e.target.value) || 0 }
              }))}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              max="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Show warning when usage reaches this percentage
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
        </>
      )}
    </div>
  );
}
