/**
 * Error State Component
 * 
 * Provides contextual and actionable error states for various scenarios
 */
import React from 'react';
import { 
  AlertTriangle,
  XCircle,
  WifiOff,
  CreditCard,
  Database,
  Server,
  Shield,
  Clock,
  RefreshCw,
  Home,
  HelpCircle,
  Mail
} from 'lucide-react';

const iconMap = {
  warning: AlertTriangle,
  error: XCircle,
  network: WifiOff,
  payment: CreditCard,
  database: Database,
  server: Server,
  security: Shield,
  timeout: Clock,
  refresh: RefreshCw
};

export function ErrorState({
  icon = 'warning',
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  error,
  actions = [],
  showDetails = false,
  size = 'medium',
  variant = 'error',
  className = ''
}) {
  const Icon = typeof icon === 'string' ? iconMap[icon] || AlertTriangle : icon;
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          container: 'p-4',
          iconSize: 'w-10 h-10',
          titleSize: 'text-base',
          descSize: 'text-sm'
        };
      case 'large':
        return {
          container: 'p-8',
          iconSize: 'w-16 h-16',
          titleSize: 'text-2xl',
          descSize: 'text-base'
        };
      default:
        return {
          container: 'p-6',
          iconSize: 'w-12 h-12',
          titleSize: 'text-xl',
          descSize: 'text-sm'
        };
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'warning':
        return {
          container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-600 dark:text-yellow-400',
          title: 'text-yellow-900 dark:text-yellow-100',
          description: 'text-yellow-700 dark:text-yellow-300'
        };
      case 'info':
        return {
          container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          title: 'text-blue-900 dark:text-blue-100',
          description: 'text-blue-700 dark:text-blue-300'
        };
      default:
        return {
          container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
          icon: 'text-red-600 dark:text-red-400',
          title: 'text-red-900 dark:text-red-100',
          description: 'text-red-700 dark:text-red-300'
        };
    }
  };

  const sizes = getSizeClasses();
  const variants = getVariantClasses();

  return (
    <div className={`error-state ${sizes.container} ${variants.container} rounded-lg border-2 ${className}`}>
      <div className="text-center">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <Icon className={`${sizes.iconSize} ${variants.icon}`} />
        </div>

        {/* Title */}
        <h3 className={`${sizes.titleSize} font-semibold ${variants.title} mb-2`}>
          {title}
        </h3>

        {/* Description */}
        <p className={`${sizes.descSize} ${variants.description} mb-4 max-w-md mx-auto`}>
          {description}
        </p>

        {/* Error Details */}
        {error && showDetails && (
          <div className="mb-4">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="text-sm underline hover:no-underline"
            >
              {detailsOpen ? 'Hide' : 'Show'} error details
            </button>
            
            {detailsOpen && (
              <div className="mt-2 p-3 bg-white/50 dark:bg-black/20 rounded text-left">
                <code className="text-xs break-all">
                  {error.message || error}
                </code>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Preset Error States
 */

export function NetworkError({ onRetry }) {
  return (
    <ErrorState
      icon="network"
      title="Connection lost"
      description="Check your internet connection and try again"
      actions={[
        <button
          key="retry"
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>,
        <button
          key="offline"
          onClick={() => window.location.href = '/offline'}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          Work Offline
        </button>
      ]}
    />
  );
}

export function PaymentError({ onUpdatePayment, onContactSupport }) {
  return (
    <ErrorState
      icon="payment"
      title="Payment method declined"
      description="Please update your payment method to continue using Agent Max"
      actions={[
        <button
          key="update"
          onClick={onUpdatePayment}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          Update Payment
        </button>,
        <button
          key="support"
          onClick={onContactSupport}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium flex items-center gap-2"
        >
          <Mail className="w-4 h-4" />
          Contact Support
        </button>
      ]}
    />
  );
}

export function QuotaExceededError({ onUpgrade, onViewUsage }) {
  return (
    <ErrorState
      icon="warning"
      variant="warning"
      title="Monthly limit reached"
      description="You've used all your conversations this month. Upgrade to continue."
      actions={[
        <button
          key="upgrade"
          onClick={onUpgrade}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
        >
          Upgrade Plan
        </button>,
        <button
          key="usage"
          onClick={onViewUsage}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          View Usage
        </button>
      ]}
    />
  );
}

export function ServerError({ error, onRetry, onGoHome }) {
  return (
    <ErrorState
      icon="server"
      title="Server error"
      description="Our servers are having trouble. Please try again in a moment."
      error={error}
      showDetails={true}
      actions={[
        <button
          key="retry"
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>,
        <button
          key="home"
          onClick={onGoHome}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Go Home
        </button>
      ]}
    />
  );
}

export function TimeoutError({ onRetry }) {
  return (
    <ErrorState
      icon="timeout"
      variant="warning"
      title="Request timed out"
      description="The operation took too long. Please try again."
      actions={[
        <button
          key="retry"
          onClick={onRetry}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      ]}
    />
  );
}

export function PermissionError({ onRequestAccess }) {
  return (
    <ErrorState
      icon="security"
      variant="warning"
      title="Access denied"
      description="You don't have permission to access this feature."
      actions={[
        <button
          key="request"
          onClick={onRequestAccess}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Request Access
        </button>,
        <button
          key="help"
          onClick={() => window.open('https://agentmax.dev/help', '_blank')}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium flex items-center gap-2"
        >
          <HelpCircle className="w-4 h-4" />
          Get Help
        </button>
      ]}
    />
  );
}

export function NotFoundError({ onGoHome }) {
  return (
    <ErrorState
      icon="error"
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
      size="large"
      actions={[
        <button
          key="home"
          onClick={onGoHome || (() => window.location.href = '/')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <Home className="w-5 h-5" />
          Go to Dashboard
        </button>
      ]}
    />
  );
}

export function GenericError({ error, onRetry }) {
  return (
    <ErrorState
      title="Oops! Something went wrong"
      description="We encountered an unexpected error. Please try again."
      error={error}
      showDetails={true}
      actions={
        onRetry && [
          <button
            key="retry"
            onClick={onRetry}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Try Again
          </button>
        ]
      }
    />
  );
}
