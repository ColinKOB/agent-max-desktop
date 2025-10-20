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

  const steps = [
    { id: 'welcome', title: 'Welcome', component: WelcomeStep },
    { id: 'payment', title: 'Payment Setup', component: PaymentStep },
    { id: 'firstGoal', title: 'First Goal', component: FirstGoalStep },
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

  const handleComplete = () => {
    // Save onboarding completion
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('user_data', JSON.stringify(userData));
    onComplete(userData);
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="onboarding-flow fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Agent Max" className="w-10 h-10" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Agent Max Setup
            </h1>
          </div>
          
          {currentStep > 0 && currentStep < steps.length - 1 && (
            <button
              onClick={() => onSkip && onSkip()}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Skip for now
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                  ${index < currentStep 
                    ? 'bg-green-600 text-white' 
                    : index === currentStep 
                    ? 'bg-blue-600 text-white scale-110' 
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  }
                `}>
                  {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`
                    flex-1 h-1 mx-2 rounded transition-all
                    ${index < currentStep 
                      ? 'bg-green-600' 
                      : 'bg-gray-300 dark:bg-gray-600'
                    }
                  `} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            {steps.map((step) => (
              <span key={step.id} className="text-center flex-1">
                {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <CurrentStepComponent
                userData={userData}
                onNext={handleNext}
                onBack={handleBack}
                isFirst={currentStep === 0}
                isLast={currentStep === steps.length - 1}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 1: Welcome
 */
function WelcomeStep({ onNext, isFirst }) {
  const features = [
    { icon: Sparkles, title: 'Autonomous Actions', description: 'AI that works for you' },
    { icon: Shield, title: 'Secure & Private', description: 'Your data stays yours' },
    { icon: Zap, title: 'Lightning Fast', description: 'Real-time responses' },
    { icon: Users, title: 'Team Collaboration', description: 'Work together seamlessly' }
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="inline-block mb-6"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
        </motion.div>
        
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Welcome to Agent Max!
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Your AI assistant for automating computer tasks. Let's get you set up in just a few steps.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-center justify-center mx-auto mb-3">
                <Icon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </motion.div>
          );
        })}
      </div>

      <div className="text-center">
        <button
          onClick={() => onNext()}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg inline-flex items-center gap-2"
        >
          Get Started
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Step 2: Payment Setup
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
