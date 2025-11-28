import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Shield, XCircle, Coins, Calendar, Zap } from 'lucide-react';
import { subscriptionAPI } from '../../services/api';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

// Weekly credits by tier
const TIER_CREDITS = {
  starter: 150,
  premium: 250,
  pro: 600,
  free: 0
};

export default function SubscriptionManager({ userId }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [userCredits, setUserCredits] = useState({ credits: 0, tier: 'free', resetAt: null });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let userEmail = '';
        
        // Try to fetch user data from Supabase users table
        if (userId) {
          const { data, error } = await supabase
            .from('users')
            .select('email, credits, subscription_tier, subscription_status, credits_reset_at')
            .eq('id', userId)
            .single();
          
          if (!error && data) {
            userEmail = data?.email || '';
            setUserCredits({
              credits: data?.credits || 0,
              tier: data?.subscription_tier || 'free',
              status: data?.subscription_status || 'none',
              resetAt: data?.credits_reset_at
            });
          }
        }
        
        // Fallback to local storage for email
        if (!userEmail) userEmail = localStorage.getItem('user_email') || '';
        setEmail(userEmail);

        if (userEmail) {
          try {
            const res = await subscriptionAPI.getStatus(userEmail);
            setStatus(res?.data || null);
          } catch (e) {
            // API may not have this user yet - that's okay
            console.log('[SubscriptionManager] Subscription API not available:', e.message);
          }
        }
      } catch (e) {
        console.error('[SubscriptionManager] Failed to load status', e);
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

  const isActive = userCredits.status === 'active' || status?.status === 'active';
  const tier = userCredits.tier || status?.plan || 'free';
  const weeklyCredits = TIER_CREDITS[tier] || 0;
  
  const nextDate = status?.next_billing_date
    ? new Date((status.next_billing_date) * 1000).toLocaleDateString()
    : status?.current_period_end
    ? new Date((status.current_period_end) * 1000).toLocaleDateString()
    : 'N/A';
  
  const resetDate = userCredits.resetAt 
    ? new Date(userCredits.resetAt).toLocaleDateString()
    : 'Monday';

  // Credit usage percentage
  const creditPercent = weeklyCredits > 0 
    ? Math.min(100, Math.round((userCredits.credits / weeklyCredits) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
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
            Free
          </span>
        )}
      </div>

      {/* Credit Balance Card */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900 dark:text-gray-100">Credits</span>
          </div>
          <span className="text-2xl font-bold text-blue-600">{userCredits.credits}</span>
        </div>
        
        {/* Progress bar */}
        {weeklyCredits > 0 && (
          <div className="mb-2">
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${creditPercent > 20 ? 'bg-blue-500' : 'bg-red-500'}`}
                style={{ width: `${creditPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{userCredits.credits} / {weeklyCredits} weekly</span>
              <span>Resets {resetDate}</span>
            </div>
          </div>
        )}
        
        <p className="text-xs text-gray-600 dark:text-gray-400">
          1 credit = 500 LLM tokens (~1 AI response)
        </p>
      </div>

      {/* Plan Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="text-gray-600 dark:text-gray-400">Plan</div>
        <div className="text-gray-900 dark:text-gray-100 capitalize flex items-center gap-1">
          {tier === 'pro' && <Zap className="w-4 h-4 text-yellow-500" />}
          {tier}
        </div>
        <div className="text-gray-600 dark:text-gray-400">Weekly Credits</div>
        <div className="text-gray-900 dark:text-gray-100">{weeklyCredits > 0 ? `${weeklyCredits}/week` : 'None'}</div>
        {isActive && (
          <>
            <div className="text-gray-600 dark:text-gray-400">Next Billing</div>
            <div className="text-gray-900 dark:text-gray-100">{nextDate}</div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {isActive ? (
          <>
            <button
              onClick={openPortal}
              disabled={portalLoading || !email}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Manage Billing
            </button>
            <button
              onClick={cancel}
              disabled={cancelLoading}
              className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancel
            </button>
          </>
        ) : (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Subscribe to get weekly credits. Go to the <strong>Purchase Credits</strong> tab above.
          </div>
        )}
      </div>
    </div>
  );
}
