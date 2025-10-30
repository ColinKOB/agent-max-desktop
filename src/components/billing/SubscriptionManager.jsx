import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Shield, XCircle } from 'lucide-react';
import { subscriptionAPI } from '../../services/api';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

export default function SubscriptionManager({ userId }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let userEmail = '';
        // Try to fetch email from Supabase users table
        if (userId) {
          const { data, error } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single();
          if (!error) userEmail = data?.email || '';
        }
        // Fallback to local storage
        if (!userEmail) userEmail = localStorage.getItem('user_email') || '';
        setEmail(userEmail);

        if (userEmail) {
          const res = await subscriptionAPI.getStatus(userEmail);
          setStatus(res?.data || null);
        } else {
          toast.error('No email found for subscription lookup');
        }
      } catch (e) {
        console.error('[SubscriptionManager] Failed to load status', e);
        toast.error('Failed to load subscription status');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const openPortal = async () => {
    if (!email) return;
    try {
      setPortalLoading(true);
      const returnUrl = `${window.location.origin}/#/settings?tab=overview`;
      const res = await subscriptionAPI.createPortal(email, returnUrl);
      const url = res?.data?.portal_url || res?.data?.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (e) {
      console.error('[SubscriptionManager] Open portal failed', e);
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const cancel = async () => {
    if (!email) return;
    try {
      setCancelLoading(true);
      await subscriptionAPI.cancel(email);
      toast.success('Subscription set to cancel at period end');
      // Refresh status
      const res = await subscriptionAPI.getStatus(email);
      setStatus(res?.data || null);
    } catch (e) {
      console.error('[SubscriptionManager] Cancel failed', e);
      toast.error('Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-gray-600 dark:text-gray-300">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading subscription...
      </div>
    );
  }

  const isActive = status?.status === 'active';
  const nextDate = status?.next_billing_date
    ? new Date((status.next_billing_date) * 1000).toLocaleDateString()
    : status?.current_period_end
    ? new Date((status.current_period_end) * 1000).toLocaleDateString()
    : 'N/A';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          <span className="font-medium text-gray-900 dark:text-gray-100">Subscription</span>
        </div>
        {isActive ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            Active
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
            None
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="text-gray-600 dark:text-gray-400">Plan</div>
        <div className="text-gray-900 dark:text-gray-100 capitalize">{status?.plan || 'free'}</div>
        <div className="text-gray-600 dark:text-gray-400">Next Billing Date</div>
        <div className="text-gray-900 dark:text-gray-100">{nextDate}</div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={openPortal}
          disabled={portalLoading || !email}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          Manage in Stripe Portal
        </button>
        {isActive && (
          <button
            onClick={cancel}
            disabled={cancelLoading}
            className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Cancel at Period End
          </button>
        )}
      </div>
    </div>
  );
}
