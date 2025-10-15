import { useState, useEffect } from 'react';
import { CreditCard, Check, Zap, Crown, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export function SubscriptionManager() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      // Get user email from localStorage or auth
      const userEmail = localStorage.getItem('user_email') || 'user@example.com';

      // Check subscription status from your backend
      const response = await fetch(
        `http://localhost:8000/api/v2/subscription/status?email=${userEmail}`
      );

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Failed to check subscription:', error);
    }
  };

  const handleSubscribe = async (plan) => {
    setLoading(true);
    try {
      const userEmail = localStorage.getItem('user_email') || 'user@example.com';

      // Create checkout session
      const response = await fetch('http://localhost:8000/api/v2/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          plan,
          success_url: `${window.location.origin}/settings?subscription=success`,
          cancel_url: `${window.location.origin}/settings?subscription=cancelled`,
        }),
      });

      const data = await response.json();

      if (data.checkout_url) {
        // Open Stripe checkout in browser
        if (window.electron?.openExternal) {
          await window.electron.openExternal(data.checkout_url);
        } else {
          window.open(data.checkout_url, '_blank');
        }

        toast.success('Opening checkout...');
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setBillingPortalLoading(true);
    try {
      const userEmail = localStorage.getItem('user_email') || 'user@example.com';

      const response = await fetch('http://localhost:8000/api/v2/subscription/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          return_url: `${window.location.origin}/settings`,
        }),
      });

      const data = await response.json();

      if (data.portal_url) {
        if (window.electron?.openExternal) {
          await window.electron.openExternal(data.portal_url);
        } else {
          window.open(data.portal_url, '_blank');
        }
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      toast.error('Failed to open billing portal.');
    } finally {
      setBillingPortalLoading(false);
    }
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      icon: Sparkles,
      features: [
        '100 AI requests per month',
        'Basic memory system',
        'Standard response time',
        'Community support',
      ],
      cta: 'Current Plan',
      disabled: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$19',
      period: 'per month',
      icon: Zap,
      popular: true,
      features: [
        'Unlimited AI requests',
        'Advanced memory & context',
        'Priority response time',
        'Screen control features',
        'Google services integration',
        'Email support',
      ],
      cta: 'Upgrade to Pro',
      stripePrice: 'price_pro_monthly', // Your Stripe price ID
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$49',
      period: 'per month',
      icon: Crown,
      features: [
        'Everything in Pro',
        'Custom AI models',
        'API access',
        'Team collaboration',
        'Priority support',
        'Custom integrations',
      ],
      cta: 'Upgrade to Enterprise',
      stripePrice: 'price_enterprise_monthly', // Your Stripe price ID
    },
  ];

  const currentPlan = subscription?.plan || 'free';

  return (
    <div className="subscription-manager">
      <div className="header mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Subscription & Billing
        </h2>
        <p className="text-gray-600 dark:text-gray-400">Choose the plan that works best for you</p>
      </div>

      {/* Current Subscription Status */}
      {subscription && subscription.plan !== 'free' && (
        <div className="current-subscription mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300">
                Current Plan:{' '}
                {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {subscription.status === 'active' ? 'Active' : subscription.status}
                {subscription.next_billing_date &&
                  ` • Renews ${new Date(subscription.next_billing_date).toLocaleDateString()}`}
              </p>
            </div>
            <button
              onClick={handleManageBilling}
              disabled={billingPortalLoading}
              className="btn-secondary flex items-center space-x-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>{billingPortalLoading ? 'Loading...' : 'Manage Billing'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Pricing Plans */}
      <div className="plans-grid grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`plan-card relative p-6 rounded-xl border-2 transition-all ${
                plan.popular
                  ? 'border-blue-500 shadow-lg scale-105'
                  : 'border-gray-200 dark:border-gray-700'
              } ${isCurrentPlan ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <Icon
                  className={`w-12 h-12 mx-auto mb-3 ${
                    plan.popular ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
                  }`}
                />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {plan.name}
                </h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                    {plan.price}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading || plan.disabled || isCurrentPlan}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                } ${plan.disabled || isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCurrentPlan ? 'Current Plan' : loading ? 'Loading...' : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">💳 Secure Payment</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          All payments are processed securely through Stripe. We never store your credit card
          information. Cancel anytime from the billing portal.
        </p>
      </div>
    </div>
  );
}
