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
    <div className="subscription-manager amx-body">
      <div className="header mb-4">
        <h2 className="amx-heading text-xl mb-1">Subscription & Billing</h2>
        <p className="amx-subtle">Choose the plan that works best for you</p>
      </div>

      {/* Current Subscription Status */}
      {subscription && subscription.plan !== 'free' && (
        <div className="current-subscription mb-6 p-4 amx-liquid-nested rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="amx-body font-semibold">
                Current Plan{' '}
                {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
              </h3>
              <p className="text-sm amx-subtle">
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
              className={`plan-card relative p-5 rounded-xl transition-all amx-liquid-nested ${
                plan.popular ? 'ring-1 ring-white/30 scale-[1.02]' : ''
              } ${isCurrentPlan ? '' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/15 border border-white/25 text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-5">
                <Icon
                  className={`w-12 h-12 mx-auto mb-3 text-white/80`}
                />
                <h3 className="amx-heading text-lg mb-1">
                  {plan.name}
                </h3>
                <div className="mb-2">
                  <span className="text-3xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="amx-subtle ml-2">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm amx-body">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading || plan.disabled || isCurrentPlan}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all amx-liquid-nested border border-white/20 text-white hover:bg-white/15 ${
                  plan.disabled || isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isCurrentPlan ? 'Current Plan' : loading ? 'Loading...' : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="mt-8 p-4 amx-liquid-nested rounded-lg">
        <h4 className="amx-body font-semibold mb-2">Secure Payments</h4>
        <p className="text-sm amx-subtle">
          All payments are processed securely through Stripe. We never store your credit card
          information. You can cancel anytime from the billing portal.
        </p>
      </div>
    </div>
  );
}
