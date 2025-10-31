/**
 * Onboarding Flow Component
 * 
 * Progressive onboarding experience for new users
 */
import { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronLeft,
  Check,
  Sparkles,
  CreditCard,
  MessageSquare,
  Shield,
  Zap,
  Users,
  ArrowRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { healthAPI, googleAPI } from '../../services/api';
import apiConfigManager from '../../config/apiConfig';
import LogoPng from '../../assets/AgentMaxLogo.png';
import { setName as setProfileName, setPreference as setUserPreference, updateProfile as updateUserProfile } from '../../services/supabaseMemory';

const stripePublishableKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

if (!stripePublishableKey) {
  console.warn(
    '[Stripe] VITE_STRIPE_PUBLISHABLE_KEY is not set. Payment capture in onboarding will be disabled.'
  );
}

export function OnboardingFlow({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    hasPaymentMethod: false,
    firstGoal: ''
  });
  const [serverConnected, setServerConnected] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);

  useEffect(() => {
    let mounted = true;
    const attemptOnce = async () => {
      try {
        await healthAPI.check();
        if (mounted) setServerConnected(true);
      } catch (_) {
        if (mounted) setServerConnected(false);
      } finally {
        if (mounted) setCheckingServer(false);
      }
    };
    attemptOnce();
    const id = setInterval(attemptOnce, 4000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const steps = [
    { id: 'name', title: 'Your Name', component: NameStep },
    { id: 'usecase', title: 'How can I help?', component: HelpCategoryStep },
    { id: 'google', title: 'Connect Google', component: GoogleConnectStep },
    { id: 'complete', title: 'Ready to Go!', component: CompleteStep }
  ];

  const handleNext = (data = {}) => {
    setUserData(prev => ({ ...prev, ...data }));
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await setUserPreference('onboarding_completed', 'true');
    } catch {}
    try { localStorage.setItem('onboarding_completed', 'true'); } catch {}
    try { localStorage.setItem('user_data', JSON.stringify(userData)); } catch {}
    onComplete(userData);
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="absolute inset-0 z-50">
      <div className="h-full w-full flex flex-col px-4 py-4">
        <div className="flex-1 w-full mx-auto" style={{maxWidth: 720}}>
          <div
            className="w-full h-full rounded-2xl"
            style={{
              position: 'relative',
              background: 'linear-gradient(135deg, rgba(18,20,24,0.82), rgba(24,26,30,0.76))',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 12px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
              backdropFilter: 'saturate(120%) blur(18px)',
              WebkitBackdropFilter: 'saturate(120%) blur(18px)'
            }}
          >
            <div className="flex items-center justify-between px-6 pt-6">
              <div className="flex items-center gap-3">
                <img src={LogoPng} alt="Agent Max" className="h-6 w-auto object-contain" />
                <h1 className="text-[15px] font-semibold" style={{color: 'rgba(255,255,255,0.9)'}}>
                  Agent Max Setup
                </h1>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2" style={{color: 'rgba(255,255,255,0.9)'}}>
              <div className="flex-1 overflow-auto" style={{minHeight: 300}}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.22 }}
                  >
                    <CurrentStepComponent
                      userData={userData}
                      onNext={handleNext}
                      onBack={handleBack}
                      isFirst={currentStep === 0}
                      isLast={currentStep === steps.length - 1}
                      serverConnected={serverConnected}
                      checkingServer={checkingServer}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom progress, compact */}
              <div className="pt-6">
                <div className="flex items-center justify-between">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center flex-1">
                      <div
                        className={
                          `${index < currentStep ? 'bg-green-500' : index === currentStep ? 'bg-blue-500' : 'bg-white/16'} ` +
                          'rounded-full flex items-center justify-center'
                        }
                        style={{ width: 20, height: 20, color: '#fff', fontSize: 10, fontWeight: 600 }}
                      >
                        {index < currentStep ? '✓' : index + 1}
                      </div>
                      {index < steps.length - 1 && (
                        <div className="flex-1 mx-1 rounded" style={{ height: 2, background: index < currentStep ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.18)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 1: Your Name
 */
function NameStep({ userData, onNext }) {
  const [name, setName] = useState(userData.name || '');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    try {
      if (name.trim()) {
        try { await setProfileName(name.trim()); } catch {}
        try { await updateUserProfile({ name: name.trim() }); } catch {}
      }
      onNext({ name: name.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h2 style={{ color: 'rgba(255,255,255,0.94)', fontSize: 28, fontWeight: 800, letterSpacing: 0.2 }}>
        What is your name?
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, marginBottom: 20 }}>
        I’ll use this to personalize your experience.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'stretch',
          overflowX: 'hidden'
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          style={{
            width: '100%',
            height: 56,
            padding: '0 14px',
            color: 'rgba(255,255,255,0.92)',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.28))',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            outline: 'none'
          }}
        />
        <button
          onClick={handleContinue}
          disabled={!name.trim() || saving}
          style={{
            width: '100%',
            height: 28,
            padding: '0 16px',
            color: '#fff',
            background: 'linear-gradient(180deg, #3b82f6, #2563eb)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            fontWeight: 600,
            opacity: !name.trim() || saving ? 0.6 : 1,
            cursor: !name.trim() || saving ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-end'
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/**
 * Step 2: How can I help?
 */
function HelpCategoryStep({ userData, onNext, onBack }) {
  const [selected, setSelected] = useState(userData.helpCategory || '');

  const options = [
    'Help with school',
    'Help with coding',
    'Help with work',
    'Help with writing',
    'Help with day to day life',
  ];

  const handleContinue = async () => {
    try { await setUserPreference('help_category', selected); } catch {}
    onNext({ helpCategory: selected });
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10" style={{ paddingBottom: 16 }}>
      <h2 style={{ color: 'rgba(255,255,255,0.94)', fontSize: 26, fontWeight: 800, marginBottom: 6 }}>How can I help best?</h2>
      <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 18 }}>
        Choose one focus to get the most relevant tips and defaults. You can change this later.
      </p>

      <div className="grid grid-cols-1 gap-12" style={{ marginTop: 6 }}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => setSelected(opt)}
            style={{
              textAlign: 'left',
              padding: '16px 16px',
              borderRadius: 14,
              color: 'rgba(255,255,255,0.92)',
              background: selected === opt ? 'rgba(59,130,246,0.16)' : 'rgba(255,255,255,0.06)',
              border: selected === opt ? '1px solid rgba(59,130,246,0.45)' : '1px solid rgba(255,255,255,0.12)'
            }}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={onBack}
          style={{
            padding: '10px 16px',
            color: 'rgba(255,255,255,0.9)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            fontWeight: 600
          }}
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!selected}
          style={{
            padding: '10px 16px',
            color: '#fff',
            background: 'linear-gradient(180deg, #3b82f6, #2563eb)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            fontWeight: 600,
            opacity: !selected ? 0.6 : 1,
            cursor: !selected ? 'not-allowed' : 'pointer'
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/**
 * Step 3: Google OAuth
 */
function GoogleConnectStep({ userData, onNext, onBack, serverConnected, checkingServer }) {
  const [opening, setOpening] = useState(false);

  const connect = async () => {
    setOpening(true);
    try {
      const cfg = apiConfigManager.getConfig();
      const base = cfg.baseURL || 'http://localhost:8000';
      // Try a few conventional endpoints; backend isn’t up yet so this may open when available
      const candidates = [
        `${base}/api/v2/google/oauth/start`,
        `${base}/api/v2/google/oauth`,
        `${base}/api/v2/google/connect`,
      ];
      const url = candidates[0];
      if (window.electron?.openExternal) await window.electron.openExternal(url);
      else if (window.electronAPI?.openExternal) await window.electronAPI.openExternal(url);
    } catch (_) {
      // Non-blocking
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h2 style={{ color: 'rgba(255,255,255,0.94)', fontSize: 26, fontWeight: 800 }}>Connect Google</h2>
      <p style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
        We use Google to draft and send emails and manage your calendar on your behalf when you ask.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>
        You control permissions at all times and can disconnect in settings with one click.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
        <span style={{ width: 8, height: 8, borderRadius: 9999, background: serverConnected ? '#10b981' : '#f59e0b' }} />
        <span>
          {checkingServer ? 'Checking server…' : serverConnected ? 'Server connected' : 'Server offline — you can continue and connect later'}
        </span>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '10px 16px',
            color: 'rgba(255,255,255,0.9)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            fontWeight: 600
          }}
        >
          Back
        </button>

        <button
          type="button"
          onClick={connect}
          disabled={!serverConnected || opening}
          style={{
            padding: '10px 16px',
            color: '#fff',
            background: 'linear-gradient(180deg, #3b82f6, #2563eb)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            fontWeight: 600,
            opacity: !serverConnected || opening ? 0.6 : 1,
            cursor: !serverConnected || opening ? 'not-allowed' : 'pointer'
          }}
        >
          {opening ? 'Opening…' : 'Connect Google'}
        </button>
      </div>
    </div>
  );
}

/**
 * Legacy steps below (Payment, FirstGoal) are kept for reference but not used
 */
function PaymentStepContent({ userData, onNext, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    // In a real app, you'd create a setup intent on your backend
    // For now, we'll simulate the payment setup
    setTimeout(() => {
      setProcessing(false);
      onNext({ hasPaymentMethod: true });
    }, 2000);
  };

  const handleSkip = () => {
    onNext({ hasPaymentMethod: false });
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Add Payment Method
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          You're only charged $3 when conversations are marked as successful. No subscription fees!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Card Information
            </label>
            <div className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
              <CardElement 
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              How billing works:
            </h4>
            <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Pay only for successful conversations</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>$3 per completed conversation</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Cancel anytime, no hidden fees</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Back
          </button>
          
          <button
            type="submit"
            disabled={!stripe || processing}
            className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : 'Add Card'}
          </button>
          
          <button
            type="button"
            onClick={handleSkip}
            className="px-6 py-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentStep(props) {
  if (!stripePromise) {
    return <MissingStripeConfigStep {...props} />;
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentStepContent {...props} />
    </Elements>
  );
}

function MissingStripeConfigStep({ onNext, onBack }) {
  const handleSkip = () => {
    onNext({ hasPaymentMethod: false });
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-yellow-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Stripe Configuration Needed
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Add your Stripe publishable key to enable in-app payment collection. You can continue
          without adding a card and complete billing later.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Quick setup
          </h3>
          <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li>Create a publishable key in your Stripe dashboard.</li>
            <li>
              Add it to your environment file as{' '}
              <code className="font-mono bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">
                VITE_STRIPE_PUBLISHABLE_KEY=pk_test_yourKey
              </code>
            </li>
            <li>Restart the desktop app to apply the new configuration.</li>
          </ol>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
          <strong className="block font-medium mb-2">Need help?</strong>
          See <span className="font-mono text-xs">MONETIZATION_SETUP.md</span> for a full Stripe
          walkthrough.
        </div>
      </div>

      <div className="mt-8 flex gap-3 justify-end">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Continue Without Card
        </button>
      </div>
    </div>
  );
}

/**
 * Step 3: First Goal
 */
function FirstGoalStep({ userData, onNext, onBack }) {
  const [goal, setGoal] = useState('');
  
  const exampleGoals = [
    "Check my email for important messages",
    "Create a summary of today's news",
    "Organize my desktop files",
    "Research competitors for my business",
    "Draft a professional email"
  ];

  const handleSelectExample = (example) => {
    setGoal(example);
  };

  const handleSubmit = () => {
    if (goal.trim()) {
      onNext({ firstGoal: goal });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Try Your First Goal
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Tell Agent Max what you want to accomplish. You can start with something simple!
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What would you like Agent Max to help you with?
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe your goal..."
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={4}
          />
        </div>

        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Or try one of these examples:
          </p>
          <div className="space-y-2">
            {exampleGoals.map((example, index) => (
              <button
                key={index}
                onClick={() => handleSelectExample(example)}
                className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  "{example}"
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Back
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={!goal.trim()}
            className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Start Conversation
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 4: Complete
 */
function CompleteStep({ userData, onNext }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="inline-block mb-6"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
          <Check className="w-12 h-12 text-white" />
        </div>
      </motion.div>

      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        You're All Set!
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
        Agent Max is ready to help you automate your tasks and boost your productivity.
      </p>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Quick Tips:
        </h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Be specific about what you want to accomplish</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Review actions before confirming them</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>You can pause or stop at any time</span>
          </li>
        </ul>
      </div>

      <button
        onClick={() => onNext()}
        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium text-lg inline-flex items-center gap-2 shadow-lg"
      >
        Launch Agent Max
        <Sparkles className="w-5 h-5" />
      </button>
    </div>
  );
}
