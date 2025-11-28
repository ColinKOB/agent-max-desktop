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
      {/* Status Badge - no duplicate header since parent has it */}
      <div className="flex items-center justify-end">
        {isActive ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
            ● Active
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-200 text-gray-700 border border-gray-300">
            Free Plan
          </span>
        )}
      </div>

      {/* Credit Balance Card - stronger gradient and better contrast */}
      <div className="p-5 bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 rounded-xl border border-blue-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Coins className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-800">Credits</span>
          </div>
          <span className="text-3xl font-bold text-blue-600">{userCredits.credits}</span>
        </div>
        
        {/* Progress bar */}
        {weeklyCredits > 0 && (
          <div className="mb-3">
            <div className="w-full h-2.5 bg-white/80 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all rounded-full ${creditPercent > 20 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}
                style={{ width: `${creditPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium mt-2">
              <span className="text-gray-700">{userCredits.credits} / {weeklyCredits} weekly</span>
              <span className="text-gray-600">Resets {resetDate}</span>
            </div>
          </div>
        )}
        
        <p className="text-sm text-gray-700 bg-white/70 rounded-lg px-3 py-2">
          💡 1 credit = 500 LLM tokens (~1 AI response)
        </p>
      </div>

      {/* Plan Details - improved spacing and visual hierarchy */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Current Plan</span>
          <span className="font-semibold text-gray-900 capitalize flex items-center gap-1.5">
            {tier === 'pro' && <Zap className="w-4 h-4 text-yellow-500" />}
            {tier === 'premium' && <Zap className="w-4 h-4 text-purple-500" />}
            {tier}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Weekly Allowance</span>
          <span className="font-semibold text-gray-900">
            {weeklyCredits > 0 ? `${weeklyCredits} credits` : 'None'}
          </span>
        </div>
        {isActive && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-600">Next Billing</span>
            <span className="font-medium text-gray-900">{nextDate}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {isActive ? (
          <>
            <button
              onClick={openPortal}
              disabled={portalLoading || !email}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50 font-medium"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Manage Billing
            </button>
            <button
              onClick={cancel}
              disabled={cancelLoading}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancel Plan
            </button>
          </>
        ) : (
          <div className="w-full p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
            <p className="text-sm text-gray-700 mb-2">
              🚀 <strong>Upgrade to get weekly credits</strong> and unlock the full potential of Agent Max.
            </p>
            <p className="text-xs text-gray-500">
              Click the <strong className="text-blue-600">Purchase Credits</strong> tab above to view plans.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
