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
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export function BillingSettings({ tenantId = 'test-tenant-001' }) {
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
  }, [tenantId]);

  const fetchBillingSettings = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v2/billing/settings/${tenantId}`);
      
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error('[BillingSettings] Error:', err);
      toast.error('Failed to load billing settings');
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
      
      if (!response.ok) throw new Error('Failed to open portal');
      
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('[BillingSettings] Portal error:', err);
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="billing-settings p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-settings space-y-6">
      {/* Payment Method Section */}
      <div className="section bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Payment Method
          </h3>
        </div>

        {settings.paymentMethod ? (
          <div className="payment-card p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Card Icon */}
                <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                
                {/* Card Details */}
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {settings.paymentMethod.brand} •••• {settings.paymentMethod.last4}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
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
          <div className="no-payment p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                  No payment method on file
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                  Add a payment method to enable premium features and avoid service interruption.
                </p>
                <button
                  onClick={openStripePortal}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Add Payment Method
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Section */}
      <div className="section bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          Subscription
        </h3>

        {settings.subscription ? (
          <div className="subscription-info space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Plan</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                {settings.subscription.plan}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Status</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                settings.subscription.status === 'active' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
              }`}>
                <Check className="w-3 h-3" />
                {settings.subscription.status.charAt(0).toUpperCase() + settings.subscription.status.slice(1)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Next Billing Date</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {settings.subscription.nextBillingDate 
                  ? new Date(settings.subscription.nextBillingDate).toLocaleDateString()
                  : 'N/A'
                }
              </span>
            </div>
            
            <button
              onClick={openStripePortal}
              disabled={portalLoading}
              className="w-full mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Manage Subscription
            </button>
          </div>
        ) : (
          <div className="no-subscription text-center py-4">
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              No active subscription
            </p>
            <button
              onClick={() => window.location.href = '/pricing'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Plans
            </button>
          </div>
        )}
      </div>

      {/* Usage Alerts Section */}
      <div className="section bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
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
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Enable usage alerts
            </span>
          </label>

          {settings.usageAlerts.enabled && (
            <>
              {/* Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alert me when monthly cost exceeds:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">$</span>
                  <input
                    type="number"
                    value={settings.usageAlerts.threshold}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      usageAlerts: { ...prev.usageAlerts, threshold: parseInt(e.target.value) || 0 }
                    }))}
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <span className="text-gray-700 dark:text-gray-300">Email notifications</span>
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
                  <span className="text-gray-700 dark:text-gray-300">In-app notifications</span>
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Usage Limits Section */}
      <div className="section bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Usage Limits
        </h3>

        <div className="info-box p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Set hard limits to prevent overspending. When reached, new conversations will be blocked until the next billing period.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Monthly Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Monthly conversation limit
            </label>
            <input
              type="number"
              value={settings.usageLimits.monthlyConversationLimit}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                usageLimits: { ...prev.usageLimits, monthlyConversationLimit: parseInt(e.target.value) || 0 }
              }))}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              placeholder="0 for unlimited"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
              <span className="font-medium text-gray-900 dark:text-gray-100">
                Enable hard stop
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Block all new conversations when limit is reached
              </p>
            </div>
          </label>

          {/* Warning Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Warning threshold (%)
            </label>
            <input
              type="number"
              value={settings.usageLimits.warningThreshold}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                usageLimits: { ...prev.usageLimits, warningThreshold: parseInt(e.target.value) || 0 }
              }))}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              max="100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
    </div>
  );
}
