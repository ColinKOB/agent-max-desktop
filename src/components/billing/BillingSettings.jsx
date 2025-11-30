/**
 * Billing Settings Component
 * 
 * Professional billing interface with achievement stats and subscription tiers
 */
import { useState, useEffect } from 'react';
import { 
  Sparkles,
  Zap,
  Crown,
  Check,
  Loader2,
  MessageSquare,
  Clock,
  FileText,
  Code,
  TrendingUp,
  Calendar,
  Shield,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { creditsAPI } from '../../services/api';
import { supabase, isSupabaseAvailable } from '../../services/supabase';
import './BillingSettings.css';

// Subscription tier definitions
const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    monthlyPrice: 10,
    yearlyPrice: 100,
    creditsPerWeek: 150,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    features: [
      '150 credits per week',
      '~600 credits per month',
      'Standard response speed',
      'Email support',
      'Basic integrations'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    icon: Crown,
    monthlyPrice: 18,
    yearlyPrice: 180,
    creditsPerWeek: 250,
    popular: true,
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-gradient-to-br from-violet-50 to-purple-50',
    borderColor: 'border-violet-300',
    features: [
      '250 credits per week',
      '~1,000 credits per month',
      'Priority response speed',
      'Priority support',
      'Advanced integrations',
      'Memory & context'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Sparkles,
    monthlyPrice: 30,
    yearlyPrice: 300,
    creditsPerWeek: 600,
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50',
    borderColor: 'border-amber-200',
    features: [
      '600 credits per week',
      '~2,400 credits per month',
      'Fastest response speed',
      'Dedicated support',
      'All integrations',
      'Unlimited memory',
      'Custom workflows'
    ]
  }
];

// Stripe Payment Links - Direct checkout URLs
// These are used as primary checkout method and fallback if backend API fails
export const STRIPE_PAYMENT_LINKS = {
  starter_monthly: 'https://buy.stripe.com/eVqbIU2nN1uue2o2Q11Nu06',
  starter_annual: 'https://buy.stripe.com/00w5kwe6v8WW8I44Y91Nu05',
  premium_monthly: 'https://buy.stripe.com/fZueV66E32yy3nKgGR1Nu03',
  premium_annual: 'https://buy.stripe.com/00w00c0fF8WWbUg9ep1Nu04',
  pro_monthly: 'https://buy.stripe.com/bJe14g8Mb4GG1fCcqB1Nu02',
  pro_annual: 'https://buy.stripe.com/fZubIU8Mb8WW8I4fCN1Nu01',
};

export function BillingSettings({ tenantId = 'test-tenant-001', userId: propUserId }) {
  // Get userId from props, localStorage, or generate and persist a stable one
  const userId = (() => {
    if (propUserId) return propUserId;
    let stored = localStorage.getItem('user_id');
    if (!stored) {
      // Generate a stable user_id and persist it
      stored = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      try { localStorage.setItem('user_id', stored); } catch {}
      console.log('[BillingSettings] Generated new persistent user_id:', stored);
    }
    return stored;
  })();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedTier, setSelectedTier] = useState('premium');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [stats, setStats] = useState({
    totalConversations: 0,
    tasksCompleted: 0,
    hoursTimeSaved: 0,
    filesCreated: 0,
    codeGenerated: 0,
    currentCredits: 0,
    currentTier: null,
    subscriptionStatus: null
  });

  // Check for purchase success/cancel in URL and handle accordingly
  useEffect(() => {
    const checkPurchaseStatus = () => {
      const hash = window.location.hash;
      if (hash.includes('purchase=success')) {
        console.log('[BillingSettings] Purchase success detected, refreshing credits...');
        toast.success('🎉 Purchase successful! Your credits have been added.', { duration: 5000 });
        // Clean up URL
        window.location.hash = '#/settings';
        // Reload stats after a short delay to allow webhook to process
        setTimeout(() => loadUserStats(), 2000);
      } else if (hash.includes('purchase=cancel')) {
        toast('Purchase cancelled', { icon: '❌', duration: 3000 });
        window.location.hash = '#/settings';
      }
    };
    
    checkPurchaseStatus();
    window.addEventListener('hashchange', checkPurchaseStatus);
    return () => window.removeEventListener('hashchange', checkPurchaseStatus);
  }, []);

  useEffect(() => {
    loadUserStats();
  }, [userId]);

  const loadUserStats = async () => {
    try {
      setLoading(true);
      let credits = 0;
      let tier = null;
      let subscriptionStatus = null;
      
      console.log('[BillingSettings] Loading stats for userId:', userId);
      
      // 1. Try to get credits from Supabase (primary source)
      if (isSupabaseAvailable() && userId) {
        try {
          console.log('[BillingSettings] Querying Supabase for user:', userId);
          const { data: userData, error } = await supabase
            .from('users')
            .select('credits, subscription_tier, subscription_status')
            .eq('id', userId)
            .single();
          
          if (error) {
            console.warn('[BillingSettings] Supabase query error:', error.message, error.code);
          }
          
          if (!error && userData) {
            credits = userData.credits || 0;
            tier = userData.subscription_tier || null;
            subscriptionStatus = userData.subscription_status || null;
            console.log('[BillingSettings] Loaded from Supabase:', { credits, tier, subscriptionStatus });
          } else {
            console.log('[BillingSettings] No user data found in Supabase for:', userId);
          }
        } catch (err) {
          console.warn('[BillingSettings] Supabase query failed:', err);
        }
      } else {
        console.log('[BillingSettings] Supabase not available or no userId');
      }
      
      // 2. Fallback: try backend credits API
      if (credits === 0 && userId) {
        try {
          console.log('[BillingSettings] Trying backend API for credits...');
          const balanceRes = await creditsAPI.getBalance(userId);
          console.log('[BillingSettings] Backend API response:', balanceRes?.data);
          if (balanceRes?.data) {
            credits = balanceRes.data.credits || balanceRes.data.balance || 0;
            tier = balanceRes.data.subscription_tier || tier;
            console.log('[BillingSettings] Loaded from API:', { credits, tier });
          }
        } catch (err) {
          console.warn('[BillingSettings] Credits API failed:', err?.response?.status, err?.message);
        }
      }

      // 3. Load telemetry stats from Supabase (backend API doesn't have stats endpoint)
      let conversationCount = 0;
      let tasksCount = 0;
      if (isSupabaseAvailable() && userId) {
        try {
          // Count sessions for this user
          const { count: sessionCount } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          
          // Count telemetry events
          const { count: eventCount } = await supabase
            .from('telemetry_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          
          conversationCount = sessionCount || 0;
          tasksCount = eventCount || Math.floor(conversationCount * 0.6);
          console.log('[BillingSettings] Loaded stats from Supabase:', { conversationCount, tasksCount });
        } catch (err) {
          console.warn('[BillingSettings] Could not load telemetry from Supabase:', err?.message);
        }
      }

      // 4. Calculate estimated metrics
      const estimatedTimeSaved = Math.round(conversationCount * 0.25); // ~15min per conversation
      const estimatedFiles = Math.round(tasksCount * 2.5);
      const estimatedCode = Math.round(tasksCount * 85);

      setStats({
        totalConversations: conversationCount,
        tasksCompleted: tasksCount,
        hoursTimeSaved: estimatedTimeSaved,
        filesCreated: estimatedFiles,
        codeGenerated: estimatedCode,
        currentCredits: credits,
        currentTier: tier,
        subscriptionStatus
      });

    } catch (error) {
      console.error('[BillingSettings] Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId) => {
    const planId = `${tierId}_${billingCycle === 'yearly' ? 'annual' : 'monthly'}`;
    
    // Helper to open URL in external browser
    const openCheckout = async (url) => {
      if (window.electron?.openExternal) {
        await window.electron.openExternal(url);
        toast.success('Opening Stripe checkout in your browser...', { duration: 3000 });
      } else {
        window.open(url, '_blank');
      }
    };
    
    try {
      setPurchasing(true);
      setSelectedTier(tierId);
      
      const successUrl = `${window.location.origin}/#/settings?purchase=success`;
      const cancelUrl = `${window.location.origin}/#/settings?purchase=cancel`;

      // Try the API checkout endpoint first (allows tracking user_id)
      try {
        const response = await creditsAPI.createSubscription(planId, userId, successUrl, cancelUrl);
        
        if (response?.data?.url) {
          await openCheckout(response.data.url);
          return;
        }
      } catch (apiError) {
        console.warn('[BillingSettings] API checkout failed, using direct Payment Link:', apiError);
      }
      
      // Fallback to direct Stripe Payment Links with client_reference_id
      const paymentLink = STRIPE_PAYMENT_LINKS[planId];
      if (paymentLink) {
        console.log('[BillingSettings] Using direct Stripe Payment Link for:', planId);
        // Append client_reference_id so webhook can identify the user
        const linkWithUser = `${paymentLink}?client_reference_id=${encodeURIComponent(userId)}`;
        await openCheckout(linkWithUser);
        return;
      }
      
      // No payment link available
      throw new Error(`No payment link found for plan: ${planId}`);
    } catch (error) {
      console.error('[BillingSettings] Subscription failed:', error);
      toast.error(
        'Unable to open checkout. Please try again or contact support@agentmax.ai',
        { duration: 5000, icon: '📧' }
      );
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="billing-page">
        <div className="billing-loading">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-page">
      {/* Hero Stats Section */}
      <div className="billing-hero">
        <div className="hero-content">
          <h1 className="hero-title">Your Agent Max Journey</h1>
          <p className="hero-subtitle">
            Here's what you've accomplished with your AI assistant
          </p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-gradient-to-br from-violet-500 to-purple-600">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.totalConversations}</span>
              <span className="stat-label">Conversations</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-gradient-to-br from-emerald-500 to-teal-600">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.tasksCompleted}</span>
              <span className="stat-label">Tasks Completed</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-gradient-to-br from-blue-500 to-cyan-600">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.hoursTimeSaved}h</span>
              <span className="stat-label">Time Saved</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-gradient-to-br from-amber-500 to-orange-600">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.filesCreated}</span>
              <span className="stat-label">Files Created</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-gradient-to-br from-pink-500 to-rose-600">
              <Code className="w-5 h-5 text-white" />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.codeGenerated.toLocaleString()}</span>
              <span className="stat-label">Lines of Code</span>
            </div>
          </div>
        </div>

        {/* Current Credits Display */}
        <div className="credits-banner">
          <div className="credits-info">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            <span>Current Balance:</span>
            <strong>{stats.currentCredits} credits</strong>
          </div>
          {stats.currentTier && (
            <div className="current-plan">
              <Shield className="w-4 h-4" />
              <span>{stats.currentTier.charAt(0).toUpperCase() + stats.currentTier.slice(1)} Plan</span>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Section */}
      <div className="subscription-section">
        <div className="section-header">
          <h2>Choose Your Plan</h2>
          <p>Unlock more potential with Agent Max</p>
        </div>

        {/* Billing Toggle */}
        <div className="billing-toggle">
          <button
            className={`toggle-option ${billingCycle === 'monthly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            <Calendar className="w-4 h-4" />
            Monthly
          </button>
          <button
            className={`toggle-option ${billingCycle === 'yearly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('yearly')}
          >
            <Sparkles className="w-4 h-4" />
            Yearly
            <span className="save-badge">Save 17%</span>
          </button>
        </div>

        {/* Tier Cards */}
        <div className="tier-grid">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const price = billingCycle === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
            const isSelected = selectedTier === tier.id;
            const isCurrentPlan = stats.currentTier === tier.id;

            return (
              <div
                key={tier.id}
                className={`tier-card ${tier.popular ? 'popular' : ''} ${isSelected ? 'selected' : ''} ${isCurrentPlan ? 'current' : ''}`}
              >
                {tier.popular && (
                  <div className="popular-badge">Most Popular</div>
                )}
                {isCurrentPlan && (
                  <div className="current-badge">Current Plan</div>
                )}

                <div className={`tier-icon bg-gradient-to-br ${tier.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="tier-name">{tier.name}</h3>

                <div className="tier-price">
                  <span className="price-amount">${price}</span>
                  <span className="price-period">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>

                <div className="tier-credits">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>{tier.creditsPerWeek} credits/week</span>
                </div>

                <ul className="tier-features">
                  {tier.features.map((feature, idx) => (
                    <li key={idx}>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`tier-cta ${tier.popular ? 'primary' : 'secondary'}`}
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={purchasing || isCurrentPlan}
                >
                  {purchasing && selectedTier === tier.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : (
                    <>
                      Get {tier.name}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust Indicators */}
        <div className="trust-section">
          <div className="trust-item">
            <Shield className="w-5 h-5 text-emerald-600" />
            <span>Secure payments via Stripe</span>
          </div>
          <div className="trust-item">
            <Check className="w-5 h-5 text-emerald-600" />
            <span>Cancel anytime</span>
          </div>
          <div className="trust-item">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>Credits never expire</span>
          </div>
        </div>
      </div>
    </div>
  );
}
