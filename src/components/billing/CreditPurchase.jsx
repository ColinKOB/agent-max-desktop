/**
 * Credit Purchase Component
 * Embedded Stripe Checkout for purchasing credits
 * 
 * Subscription Tiers (weekly credits):
 * - Starter: 150 credits/week ($10/mo, $100/yr)
 * - Premium: 250 credits/week ($18/mo, $180/yr)
 * - Pro: 600 credits/week ($30/mo, $300/yr)
 * 
 * 1 credit = 500 LLM tokens
 */
import { useState, useEffect } from 'react';
import { Coins, Check, Zap, AlertCircle, Loader2, X, Calendar, Sparkles } from 'lucide-react';
import { creditsAPI } from '../../services/api';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import './CreditPurchase.css';

export function CreditPurchase({ userId, onClose, onSuccess }) {
  const [packages, setPackages] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [tiers, setTiers] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [mode, setMode] = useState('subscription'); // 'one_time' | 'subscription'
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [currentCredits, setCurrentCredits] = useState(0);
  const [currentTier, setCurrentTier] = useState(null);

  useEffect(() => {
    loadPackages();
    loadCurrentCredits();
  }, [userId]);

  const loadPackages = async () => {
    try {
      const response = await creditsAPI.getPackages();
      const oneTime = response?.data?.one_time || [];
      const subs = response?.data?.subscriptions || [];
      const tierData = response?.data?.tiers || null;
      setPackages(oneTime);
      setSubscriptionPlans(subs);
      setTiers(tierData);
      // Default to premium monthly
      if (subs.length > 0) {
        setSelectedPackage('premium_monthly');
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
      toast.error('Failed to load credit packages');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentCredits = async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('credits, subscription_tier, subscription_status')
        .eq('id', userId)
        .single();
      
      setCurrentCredits(data?.credits || 0);
      setCurrentTier(data?.subscription_tier || null);
    } catch (error) {
      console.error('Failed to load credits:', error);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !userId) return;

    try {
      setPurchasing(true);
      const successUrl = `${window.location.origin}/#/settings?purchase=success`;
      const cancelUrl = `${window.location.origin}/#/settings?purchase=cancel`;

      // Route based on mode: one-time vs subscription
      const response =
        mode === 'subscription'
          ? await creditsAPI.createSubscription(selectedPackage, userId, successUrl, cancelUrl)
          : await creditsAPI.createCheckout(selectedPackage, userId, successUrl, cancelUrl);

      const checkoutUrl = response?.data?.url;
      
      if (checkoutUrl) {
        // Open Stripe Checkout in the same window
        // The Stripe page will redirect back to settings after completion
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      toast.error('Failed to start checkout. Please try again.');
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="credit-purchase-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading packages...</p>
      </div>
    );
  }

  // Filter subscriptions by billing cycle
  const filteredSubs = subscriptionPlans.filter(p => 
    billingCycle === 'annual' ? p.interval === 'year' : p.interval === 'month'
  );
  const list = mode === 'one_time' ? packages : filteredSubs;
  const selectedPkg = list.find(p => p.id === selectedPackage);
  
  // Get tier info for display
  const getTierFromPlan = (planId) => {
    if (!planId) return null;
    const tierName = planId.split('_')[0];
    return tiers?.[tierName] || null;
  };

  return (
    <div className="credit-purchase">
      {/* Header */}
      <div className="credit-purchase-header">
        <div className="flex items-center gap-3">
          <div className="icon-wrapper">
            <Coins className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {mode === 'subscription' ? 'Subscribe Monthly' : 'Purchase Credits'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Current balance: <span className="font-semibold text-blue-600">{currentCredits} credits</span>
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="close-btn"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Toggle One-Time vs Subscription */}
      <div className="flex items-center gap-2 mb-4">
        <button
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'one_time' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          onClick={() => {
            setMode('one_time');
            if (packages.length > 0) setSelectedPackage(packages[1]?.id || packages[0]?.id);
          }}
        >
          One-Time
        </button>
        <button
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'subscription' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          onClick={() => {
            setMode('subscription');
            if (subscriptionPlans.length > 0) setSelectedPackage(subscriptionPlans[1]?.id || subscriptionPlans[0]?.id);
          }}
        >
          Monthly Subscription
        </button>
      </div>

      {/* Billing Cycle Toggle (only for subscriptions) */}
      {mode === 'subscription' && (
        <div className="flex items-center justify-center gap-2 mb-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              billingCycle === 'monthly' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => {
              setBillingCycle('monthly');
              // Update selection to monthly equivalent
              const currentTierName = selectedPackage?.split('_')[0] || 'premium';
              setSelectedPackage(`${currentTierName}_monthly`);
            }}
          >
            <Calendar className="w-4 h-4" />
            Monthly
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              billingCycle === 'annual' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => {
              setBillingCycle('annual');
              // Update selection to annual equivalent
              const currentTierName = selectedPackage?.split('_')[0] || 'premium';
              setSelectedPackage(`${currentTierName}_annual`);
            }}
          >
            <Sparkles className="w-4 h-4" />
            Annual
            <span className="ml-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full">
              Save 17%
            </span>
          </button>
        </div>
      )}

      {/* Package Selection */}
      <div className="package-grid">
        {list.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelectedPackage(pkg.id)}
            className={`package-card ${selectedPackage === pkg.id ? 'selected' : ''}`}
            disabled={purchasing}
          >
            {/* Badge for best value */}
            {pkg.id === 'pro' && (
              <div className="best-value-badge">
                <Zap className="w-3 h-3" />
                Best Value
              </div>
            )}

            {/* Check mark for selected */}
            {selectedPackage === pkg.id && (
              <div className="selected-indicator">
                <Check className="w-4 h-4" />
              </div>
            )}

            {/* Package Info */}
            <div className="package-info">
              <h3 className="package-name">{pkg.name}</h3>
              <div className="package-credits">
                <Coins className="w-5 h-5" />
                <span>
                  {mode === 'subscription' 
                    ? `${pkg.credits_per_week?.toLocaleString() || pkg.credits?.toLocaleString()} credits/week`
                    : `${pkg.credits.toLocaleString()} credits`
                  }
                </span>
              </div>
              <div className="package-price">
                <span className="price-amount">
                  ${pkg.price_usd.toFixed(2)}
                  {mode === 'subscription' ? (pkg.interval === 'year' ? '/yr' : '/mo') : ''}
                </span>
                {mode === 'one_time' && pkg.price_per_credit && (
                  <span className="price-per">${pkg.price_per_credit.toFixed(3)}/credit</span>
                )}
              </div>
              {mode === 'subscription' && pkg.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{pkg.description}</p>
              )}
            </div>

            {/* Features */}
            <ul className="package-features">
              <li>
                <Check className="w-4 h-4" />
                <span>
                  {mode === 'subscription'
                    ? `${pkg.credits_per_week || pkg.credits} credits/week (~${(pkg.credits_per_week || pkg.credits) * 4} per month)`
                    : `${pkg.credits} AI credits`
                  }
                </span>
              </li>
              <li>
                <Check className="w-4 h-4" />
                <span>
                  {mode === 'subscription' 
                    ? `Renews ${pkg.interval === 'year' ? 'annually' : 'monthly'}`
                    : 'Never expires'
                  }
                </span>
              </li>
              <li>
                <Check className="w-4 h-4" />
                <span>
                  {pkg.tier === 'pro' ? 'Premium support' : pkg.tier === 'premium' ? 'Priority support' : 'Standard support'}
                </span>
              </li>
            </ul>
          </button>
        ))}
      </div>

      {/* Selected Package Summary */}
      {selectedPkg && (
        <div className="purchase-summary">
          <div className="summary-row">
            <span className="summary-label">Plan:</span>
            <span className="summary-value">{selectedPkg.name}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Credits:</span>
            <span className="summary-value">
              {mode === 'subscription'
                ? `${selectedPkg.credits_per_week || selectedPkg.credits} / week`
                : `${selectedPkg.credits.toLocaleString()}`
              }
            </span>
          </div>
          {mode === 'subscription' && (
            <div className="summary-row">
              <span className="summary-label">Billing:</span>
              <span className="summary-value capitalize">{selectedPkg.interval === 'year' ? 'Annual' : 'Monthly'}</span>
            </div>
          )}
          <div className="summary-row total">
            <span className="summary-label">Total:</span>
            <span className="summary-value">
              ${selectedPkg.price_usd.toFixed(2)}
              {mode === 'subscription' ? (selectedPkg.interval === 'year' ? '/year' : '/month') : ''}
            </span>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="security-notice">
        <AlertCircle className="w-4 h-4 text-blue-600" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Secure payment powered by Stripe. Your payment information is never stored on our servers.
        </p>
      </div>

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={!selectedPackage || purchasing}
        className="purchase-btn"
      >
        {purchasing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Redirecting to Stripe...
          </>
        ) : (
          <>
            <Coins className="w-5 h-5" />
            {mode === 'subscription' ? 'Subscribe' : 'Continue to Checkout'}
          </>
        )}
      </button>
    </div>
  );
}
