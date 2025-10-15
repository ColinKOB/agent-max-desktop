/**
 * Centralized Error Handling Service
 * Provides consistent error handling across the application
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
};

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low', // Log only, don't show to user
  MEDIUM: 'medium', // Show non-intrusive notification
  HIGH: 'high', // Show prominent error message
  CRITICAL: 'critical', // Show error dialog, may require restart
};

// Error logger
class ErrorLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
  }

  log(error, context = '', severity = ErrorSeverity.MEDIUM) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      code: error.code || ErrorCodes.UNKNOWN_ERROR,
      stack: error.stack,
      context,
      severity,
      details: error.details,
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
}

// Singleton logger instance
const errorLogger = new ErrorLogger();

/**
 * Handle error with appropriate user feedback
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
  } = options;

  // Log the error
  errorLogger.log(error, context, severity);

  // Determine user message
  let userMessage = fallbackMessage;

  if (error.code) {
    switch (error.code) {
      case ErrorCodes.NETWORK_ERROR:
        userMessage = 'Network connection lost. Please check your internet connection.';
        break;
      case ErrorCodes.UNAUTHORIZED:
        userMessage = 'You need to sign in to continue.';
        break;
      case ErrorCodes.SESSION_EXPIRED:
        userMessage = 'Your session has expired. Please sign in again.';
        break;
      case ErrorCodes.GOOGLE_AUTH_ERROR:
        userMessage = 'Google authentication failed. Please reconnect your account.';
        break;
      case ErrorCodes.VALIDATION_ERROR:
        userMessage = error.message || 'Invalid input provided.';
        break;
      case ErrorCodes.QUOTA_EXCEEDED:
        userMessage = 'Storage quota exceeded. Please free up some space.';
        break;
      default:
        userMessage = error.message || fallbackMessage;
    }
  } else if (error.message) {
    userMessage = error.message;
  }

  // Show toast notification if enabled
  if (showToast) {
    switch (severity) {
      case ErrorSeverity.LOW:
        // Don't show toast for low severity
        break;
      case ErrorSeverity.MEDIUM:
        toast.error(userMessage, {
          duration: 4000,
          position: 'bottom-right',
        });
        break;
      case ErrorSeverity.HIGH:
        toast.error(userMessage, {
          duration: 6000,
          position: 'top-center',
          style: {
            background: '#ff4444',
            color: '#fff',
            fontWeight: 'bold',
          },
        });
        break;
      case ErrorSeverity.CRITICAL:
        // Show error dialog for critical errors
        if (window.electron?.dialog) {
          window.electron.dialog.showErrorBox('Critical Error', userMessage);
        } else {
          alert(`Critical Error: ${userMessage}`);
        }
        break;
    }
  }

  // Offer retry option if provided
  if (retry && severity !== ErrorSeverity.LOW) {
    setTimeout(() => {
      toast.error('Failed. Click to retry.', {
        duration: 5000,
        onClick: () => {
          retry();
        },
        style: {
          cursor: 'pointer',
        },
      });
    }, 1000);
  }

  return {
    handled: true,
    message: userMessage,
    code: error.code || ErrorCodes.UNKNOWN_ERROR,
  };
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
  errorLogger,
};
