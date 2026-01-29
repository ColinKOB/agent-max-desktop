/**
 * Centralized Error Handling Service
 * Provides consistent error handling across the application
 * with friendly user-facing messages and recovery flows
 */

import { toast } from 'react-hot-toast';

// Custom error class for application errors
export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Error codes
export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Storage errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Google Service errors
  GOOGLE_AUTH_ERROR: 'GOOGLE_AUTH_ERROR',
  GOOGLE_API_ERROR: 'GOOGLE_API_ERROR',

  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',
  RENDER_ERROR: 'RENDER_ERROR',
};

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low', // Log only, don't show to user
  MEDIUM: 'medium', // Show non-intrusive notification
  HIGH: 'high', // Show prominent error message
  CRITICAL: 'critical', // Show error dialog, may require restart
};

// Error types for recovery flow classification
export const ErrorType = {
  TRANSIENT: 'transient', // Auto-retry with subtle indicator
  RECOVERABLE: 'recoverable', // Show friendly message with action buttons
  BLOCKING: 'blocking', // Full-screen with clear next steps
};

/**
 * Friendly error messages and recovery information
 * Maps error codes to user-friendly content
 */
export const FriendlyErrorConfig = {
  [ErrorCodes.NETWORK_ERROR]: {
    type: ErrorType.RECOVERABLE,
    title: 'Connection lost',
    message: "Max can't reach the internet right now.",
    suggestion: 'Check your Wi-Fi or network connection and try again.',
    actions: ['checkInternet', 'retry'],
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 2000,
  },
  [ErrorCodes.API_ERROR]: {
    type: ErrorType.RECOVERABLE,
    title: 'Request failed',
    message: 'Something went wrong with that request.',
    suggestion: 'This is usually temporary. Try again in a moment.',
    actions: ['retry', 'copyDetails'],
    autoRetry: true,
    maxRetries: 2,
    retryDelay: 1500,
  },
  [ErrorCodes.TIMEOUT]: {
    type: ErrorType.TRANSIENT,
    title: 'Taking longer than expected',
    message: 'The request is taking a while to complete.',
    suggestion: 'Max is still working on it. Please wait a moment.',
    actions: ['retry', 'cancel'],
    autoRetry: true,
    maxRetries: 2,
    retryDelay: 3000,
  },
  [ErrorCodes.SERVER_UNAVAILABLE]: {
    type: ErrorType.BLOCKING,
    title: 'Server temporarily unavailable',
    message: "Max couldn't complete your request because the server is temporarily unavailable.",
    suggestion: 'Wait a few minutes and try again, or check status.agentmax.app for updates.',
    actions: ['retry', 'checkStatus', 'copyDetails'],
    autoRetry: false,
  },
  [ErrorCodes.UNAUTHORIZED]: {
    type: ErrorType.RECOVERABLE,
    title: 'Sign in required',
    message: 'You need to sign in to continue.',
    suggestion: 'Your session may have ended. Please sign in again.',
    actions: ['signIn'],
    autoRetry: false,
  },
  [ErrorCodes.SESSION_EXPIRED]: {
    type: ErrorType.RECOVERABLE,
    title: 'Session expired',
    message: 'Your session has timed out for security.',
    suggestion: 'Sign in again to pick up where you left off.',
    actions: ['signIn'],
    autoRetry: false,
  },
  [ErrorCodes.FORBIDDEN]: {
    type: ErrorType.RECOVERABLE,
    title: 'Access denied',
    message: "You don't have permission to do this.",
    suggestion: 'Contact support if you think this is a mistake.',
    actions: ['contactSupport'],
    autoRetry: false,
  },
  [ErrorCodes.GOOGLE_AUTH_ERROR]: {
    type: ErrorType.RECOVERABLE,
    title: 'Google connection issue',
    message: "Max couldn't connect to your Google account.",
    suggestion: 'Try reconnecting your Google account in Settings.',
    actions: ['reconnectGoogle', 'goToSettings'],
    autoRetry: false,
  },
  [ErrorCodes.GOOGLE_API_ERROR]: {
    type: ErrorType.TRANSIENT,
    title: 'Google service hiccup',
    message: 'There was a temporary issue with Google services.',
    suggestion: 'This usually resolves on its own. Retrying...',
    actions: ['retry'],
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 2000,
  },
  [ErrorCodes.VALIDATION_ERROR]: {
    type: ErrorType.RECOVERABLE,
    title: 'Invalid input',
    message: 'Something about that input was not quite right.',
    suggestion: 'Please check your input and try again.',
    actions: ['dismiss'],
    autoRetry: false,
  },
  [ErrorCodes.QUOTA_EXCEEDED]: {
    type: ErrorType.RECOVERABLE,
    title: 'Storage full',
    message: "You've run out of storage space.",
    suggestion: 'Free up some space by clearing old data or upgrade your plan.',
    actions: ['manageStorage', 'upgrade'],
    autoRetry: false,
  },
  [ErrorCodes.STORAGE_ERROR]: {
    type: ErrorType.RECOVERABLE,
    title: 'Storage issue',
    message: "Max couldn't save or load some data.",
    suggestion: 'Try refreshing the app. Your work should be safe.',
    actions: ['refresh', 'copyDetails'],
    autoRetry: true,
    maxRetries: 2,
    retryDelay: 1000,
  },
  [ErrorCodes.RENDER_ERROR]: {
    type: ErrorType.BLOCKING,
    title: 'Display error',
    message: 'Something went wrong displaying this content.',
    suggestion: 'Restarting the app usually fixes this.',
    actions: ['restart', 'copyDetails'],
    autoRetry: false,
  },
  [ErrorCodes.UNKNOWN_ERROR]: {
    type: ErrorType.RECOVERABLE,
    title: 'Something went wrong',
    message: 'An unexpected error occurred.',
    suggestion: 'Try again, or restart the app if the problem persists.',
    actions: ['retry', 'copyDetails'],
    autoRetry: true,
    maxRetries: 1,
    retryDelay: 1000,
  },
  [ErrorCodes.OPERATION_FAILED]: {
    type: ErrorType.RECOVERABLE,
    title: 'Action failed',
    message: "Max couldn't complete that action.",
    suggestion: 'Try again in a moment.',
    actions: ['retry', 'dismiss'],
    autoRetry: true,
    maxRetries: 2,
    retryDelay: 1500,
  },
};

/**
 * Action handlers for error recovery
 */
export const RecoveryActions = {
  retry: {
    label: 'Try Again',
    icon: 'refresh',
    variant: 'primary',
  },
  checkInternet: {
    label: 'Check Internet',
    icon: 'wifi',
    variant: 'secondary',
    handler: () => {
      if (window.electron?.shell) {
        window.electron.shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.network'
        );
      }
    },
  },
  checkStatus: {
    label: 'Check Status',
    icon: 'external',
    variant: 'secondary',
    handler: () => {
      if (window.electron?.shell) {
        window.electron.shell.openExternal('https://status.agentmax.app');
      } else {
        window.open('https://status.agentmax.app', '_blank');
      }
    },
  },
  signIn: {
    label: 'Sign In',
    icon: 'user',
    variant: 'primary',
  },
  reconnectGoogle: {
    label: 'Reconnect Google',
    icon: 'link',
    variant: 'primary',
  },
  goToSettings: {
    label: 'Open Settings',
    icon: 'settings',
    variant: 'secondary',
  },
  contactSupport: {
    label: 'Contact Support',
    icon: 'mail',
    variant: 'secondary',
    handler: () => {
      if (window.electron?.shell) {
        window.electron.shell.openExternal('mailto:support@agentmax.app');
      } else {
        window.open('mailto:support@agentmax.app', '_blank');
      }
    },
  },
  manageStorage: {
    label: 'Manage Storage',
    icon: 'database',
    variant: 'primary',
  },
  upgrade: {
    label: 'Upgrade Plan',
    icon: 'zap',
    variant: 'primary',
  },
  refresh: {
    label: 'Refresh App',
    icon: 'refresh',
    variant: 'primary',
    handler: () => window.location.reload(),
  },
  restart: {
    label: 'Restart App',
    icon: 'power',
    variant: 'primary',
    handler: () => window.location.reload(),
  },
  copyDetails: {
    label: 'Copy Error Details',
    icon: 'copy',
    variant: 'ghost',
  },
  dismiss: {
    label: 'Dismiss',
    icon: 'x',
    variant: 'ghost',
  },
  cancel: {
    label: 'Cancel',
    icon: 'x',
    variant: 'ghost',
  },
};

/**
 * Get friendly error configuration for an error
 */
export const getFriendlyError = (error) => {
  const code = error?.code || ErrorCodes.UNKNOWN_ERROR;
  const config = FriendlyErrorConfig[code] || FriendlyErrorConfig[ErrorCodes.UNKNOWN_ERROR];

  return {
    ...config,
    code,
    originalMessage: error?.message,
    timestamp: error?.timestamp || new Date().toISOString(),
    stack: error?.stack,
    details: error?.details,
  };
};

/**
 * Format error details for copying to clipboard
 */
export const formatErrorForClipboard = (error) => {
  const friendlyError = getFriendlyError(error);
  return `
Agent Max Error Report
=====================
Time: ${friendlyError.timestamp}
Error Code: ${friendlyError.code}
Title: ${friendlyError.title}
Message: ${friendlyError.message}
Original Error: ${friendlyError.originalMessage || 'N/A'}

Technical Details:
${friendlyError.stack || 'No stack trace available'}

Additional Info:
${JSON.stringify(friendlyError.details, null, 2) || 'None'}
`.trim();
};

/**
 * Copy error details to clipboard
 */
export const copyErrorToClipboard = async (error) => {
  try {
    const text = formatErrorForClipboard(error);
    await navigator.clipboard.writeText(text);
    toast.success('Error details copied to clipboard', {
      duration: 2000,
      position: 'bottom-center',
    });
    return true;
  } catch (err) {
    console.error('Failed to copy error details:', err);
    return false;
  }
};

// Error logger
class ErrorLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
  }

  log(error, context = '', severity = ErrorSeverity.MEDIUM) {
    const friendlyConfig = getFriendlyError(error);
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      code: error.code || ErrorCodes.UNKNOWN_ERROR,
      stack: error.stack,
      context,
      severity,
      details: error.details,
      friendly: friendlyConfig,
    };

    // Add to memory
    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console output
    console.error(`[${context}] ${severity.toUpperCase()}:`, error.message, {
      code: error.code,
      details: error.details,
      stack: error.stack,
    });

    // Send to external service in production (e.g., Sentry)
    if (process.env.NODE_ENV === 'production' && window.Sentry) {
      window.Sentry.captureException(error, {
        level: severity,
        tags: { context, code: error.code },
      });
    }

    return logEntry;
  }

  getLogs(count = 10) {
    return this.logs.slice(0, count);
  }

  clearLogs() {
    this.logs = [];
  }

  getLastError() {
    return this.logs[0] || null;
  }
}

// Singleton logger instance
const errorLogger = new ErrorLogger();

// Track retry attempts for auto-retry logic
const retryTracker = new Map();

/**
 * Handle error with appropriate user feedback and recovery flows
 * @param {Error} error - The error to handle
 * @param {string} context - Where the error occurred
 * @param {Object} options - Additional options
 */
export const handleError = (error, context = 'Application', options = {}) => {
  const {
    showToast = true,
    severity = ErrorSeverity.MEDIUM,
    fallbackMessage = 'An error occurred',
    retry = null,
    onRecoveryAction = null,
    skipAutoRetry = false,
  } = options;

  // Log the error
  const logEntry = errorLogger.log(error, context, severity);
  const friendlyError = getFriendlyError(error);

  // Handle auto-retry for transient errors
  if (
    !skipAutoRetry &&
    friendlyError.autoRetry &&
    retry &&
    friendlyError.type === ErrorType.TRANSIENT
  ) {
    const retryKey = `${context}-${error.code}`;
    const currentRetries = retryTracker.get(retryKey) || 0;

    if (currentRetries < (friendlyError.maxRetries || 3)) {
      retryTracker.set(retryKey, currentRetries + 1);

      // Show subtle retrying indicator
      const toastId = toast.loading(
        `${friendlyError.title}. Retrying... (${currentRetries + 1}/${friendlyError.maxRetries})`,
        {
          position: 'bottom-right',
          style: {
            background: 'rgba(30, 30, 35, 0.95)',
            color: '#fff',
            backdropFilter: 'blur(10px)',
          },
        }
      );

      setTimeout(() => {
        toast.dismiss(toastId);
        retry();
      }, friendlyError.retryDelay || 2000);

      return {
        handled: true,
        message: friendlyError.message,
        code: error.code || ErrorCodes.UNKNOWN_ERROR,
        autoRetrying: true,
        retryAttempt: currentRetries + 1,
      };
    } else {
      // Max retries reached, clear tracker and escalate
      retryTracker.delete(retryKey);
    }
  }

  // Show toast notification based on error type and severity
  if (showToast) {
    switch (friendlyError.type) {
      case ErrorType.TRANSIENT:
        // Show subtle notification for transient errors
        showTransientErrorToast(friendlyError, retry, onRecoveryAction);
        break;

      case ErrorType.RECOVERABLE:
        // Show recoverable error toast with action buttons
        showRecoverableErrorToast(friendlyError, retry, onRecoveryAction, error);
        break;

      case ErrorType.BLOCKING:
        // For blocking errors, we don't show toast - the ErrorBoundary handles it
        // But we can show a critical toast if not caught by boundary
        if (severity === ErrorSeverity.CRITICAL) {
          showBlockingErrorToast(friendlyError, retry, onRecoveryAction, error);
        } else {
          showRecoverableErrorToast(friendlyError, retry, onRecoveryAction, error);
        }
        break;

      default:
        // Fallback to original behavior for unmapped errors
        if (severity !== ErrorSeverity.LOW) {
          toast.error(friendlyError.message || fallbackMessage, {
            duration: 4000,
            position: 'bottom-right',
          });
        }
    }
  }

  return {
    handled: true,
    message: friendlyError.message,
    code: error.code || ErrorCodes.UNKNOWN_ERROR,
    friendly: friendlyError,
    logEntry,
  };
};

/**
 * Get button styles based on variant
 */
const getButtonVariantStyles = (variant) => {
  if (variant === 'primary') {
    return {
      background: 'linear-gradient(135deg, #7aa2ff, #a8ffcf)',
      color: '#1a1a1e',
    };
  }
  if (variant === 'ghost') {
    return {
      background: 'transparent',
      color: 'rgba(255,255,255,0.7)',
      border: '1px solid rgba(255,255,255,0.2)',
    };
  }
  return {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
  };
};

/**
 * Show transient error toast (subtle, auto-dismissing)
 */
const showTransientErrorToast = (friendlyError, _retry, _onRecoveryAction) => {
  toast(
    (_t) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: '2px solid rgba(255, 200, 50, 0.5)',
            borderTopColor: 'rgb(255, 200, 50)',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div>
          <div style={{ fontWeight: 500, fontSize: '14px' }}>{friendlyError.title}</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>{friendlyError.suggestion}</div>
        </div>
      </div>
    ),
    {
      duration: 4000,
      position: 'bottom-right',
      style: {
        background: 'rgba(30, 30, 35, 0.95)',
        color: '#fff',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 200, 50, 0.3)',
        borderRadius: '12px',
        padding: '12px 16px',
      },
    }
  );
};

/**
 * Show recoverable error toast with action buttons
 */
const showRecoverableErrorToast = (friendlyError, retry, onRecoveryAction, error) => {
  toast(
    (t) => (
      <div style={{ minWidth: '280px' }}>
        <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
          {friendlyError.title}
        </div>
        <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '12px', lineHeight: 1.4 }}>
          {friendlyError.message}
        </div>
        {friendlyError.suggestion && (
          <div
            style={{
              fontSize: '12px',
              opacity: 0.65,
              marginBottom: '12px',
              padding: '8px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '6px',
            }}
          >
            {friendlyError.suggestion}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {friendlyError.actions.slice(0, 3).map((actionKey) => {
            const action = RecoveryActions[actionKey];
            if (!action) return null;

            return (
              <button
                key={actionKey}
                onClick={() => {
                  toast.dismiss(t.id);
                  if (actionKey === 'retry' && retry) {
                    retry();
                  } else if (actionKey === 'copyDetails') {
                    copyErrorToClipboard(error);
                  } else if (action.handler) {
                    action.handler();
                  } else if (onRecoveryAction) {
                    onRecoveryAction(actionKey, error);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  ...getButtonVariantStyles(action.variant),
                }}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    ),
    {
      duration: 8000,
      position: 'bottom-right',
      style: {
        background: 'rgba(30, 30, 35, 0.95)',
        color: '#fff',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 100, 100, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
    }
  );
};

/**
 * Show blocking error toast (more prominent)
 */
const showBlockingErrorToast = (friendlyError, retry, onRecoveryAction, error) => {
  toast(
    (t) => (
      <div style={{ minWidth: '320px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 100, 100, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            !
          </div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>{friendlyError.title}</div>
        </div>
        <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px', lineHeight: 1.5 }}>
          {friendlyError.message}
        </div>
        {friendlyError.suggestion && (
          <div
            style={{
              fontSize: '13px',
              opacity: 0.7,
              marginBottom: '16px',
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              lineHeight: 1.4,
            }}
          >
            <strong style={{ display: 'block', marginBottom: '4px' }}>What you can do:</strong>
            {friendlyError.suggestion}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {friendlyError.actions.slice(0, 3).map((actionKey) => {
            const action = RecoveryActions[actionKey];
            if (!action) return null;

            return (
              <button
                key={actionKey}
                onClick={() => {
                  toast.dismiss(t.id);
                  if (actionKey === 'retry' && retry) {
                    retry();
                  } else if (actionKey === 'copyDetails') {
                    copyErrorToClipboard(error);
                  } else if (action.handler) {
                    action.handler();
                  } else if (onRecoveryAction) {
                    onRecoveryAction(actionKey, error);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  ...getButtonVariantStyles(action.variant),
                }}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    ),
    {
      duration: 15000,
      position: 'top-center',
      style: {
        background: 'rgba(30, 30, 35, 0.98)',
        color: '#fff',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 100, 100, 0.4)',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
      },
    }
  );
};

/**
 * Clear retry tracker for a specific context
 */
export const clearRetryTracker = (context, code) => {
  if (context && code) {
    retryTracker.delete(`${context}-${code}`);
  } else {
    retryTracker.clear();
  }
};

/**
 * Create error handler for async operations
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @param {Object} options - Error handling options
 */
export const withErrorHandler = (fn, context = 'Operation', options = {}) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context, options);
      throw error; // Re-throw if caller needs to handle it
    }
  };
};

/**
 * Parse API error response
 * @param {Object} error - Axios error object
 * @returns {AppError} - Parsed application error
 */
export const parseApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const { status } = error.response;
    const { data } = error.response;

    let code = ErrorCodes.API_ERROR;
    let message = data.message || data.error || 'API request failed';

    switch (status) {
      case 401:
        code = ErrorCodes.UNAUTHORIZED;
        break;
      case 403:
        code = ErrorCodes.FORBIDDEN;
        break;
      case 404:
        message = 'Resource not found';
        break;
      case 500:
        message = 'Server error. Please try again later.';
        break;
    }

    return new AppError(message, code, { status, data });
  } else if (error.request) {
    // No response received
    return new AppError(
      'No response from server. Please check your connection.',
      ErrorCodes.NETWORK_ERROR,
      { request: error.request }
    );
  } else {
    // Request setup error
    return new AppError(error.message || 'Failed to make request', ErrorCodes.UNKNOWN_ERROR);
  }
};

// Export logger for direct access
export { errorLogger };

// Export default handler
export default {
  handleError,
  withErrorHandler,
  parseApiError,
  AppError,
  ErrorCodes,
  ErrorSeverity,
  ErrorType,
  errorLogger,
  getFriendlyError,
  copyErrorToClipboard,
  formatErrorForClipboard,
  FriendlyErrorConfig,
  RecoveryActions,
  clearRetryTracker,
};
