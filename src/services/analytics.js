/**
 * PostHog Analytics Service - Renderer Process
 * Comprehensive product analytics for Agent Max Desktop
 *
 * Features:
 * - Maximum autocapture (clicks, inputs, page views)
 * - Error-only session recordings (cost-effective)
 * - 50+ typed event constants
 * - GDPR opt-out support
 * - Offline event queuing via main process
 */

import posthog from 'posthog-js';
import { createLogger } from './logger';

const logger = createLogger('Analytics');

// ============================================
// ANALYTICS EVENT CONSTANTS (50+ events)
// ============================================

export const AnalyticsEvents = {
  // App Lifecycle (5 events)
  APP_LAUNCHED: 'app_launched',
  APP_READY: 'app_ready',
  APP_ACTIVATED: 'app_activated',
  APP_CLOSED: 'app_closed',
  APP_UPDATED: 'app_updated',

  // Onboarding (9 events)
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_NAME_ENTERED: 'onboarding_name_entered',
  ONBOARDING_ACCOUNT_TYPE_SELECTED: 'onboarding_account_type_selected',
  ONBOARDING_SIGNIN_CLICKED: 'onboarding_signin_clicked',
  ONBOARDING_SIGNUP_CLICKED: 'onboarding_signup_clicked',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_ERROR: 'onboarding_error',

  // Authentication (8 events)
  SIGNIN_ATTEMPTED: 'signin_attempted',
  SIGNIN_SUCCEEDED: 'signin_succeeded',
  SIGNIN_FAILED: 'signin_failed',
  SIGNUP_ATTEMPTED: 'signup_attempted',
  SIGNUP_SUCCEEDED: 'signup_succeeded',
  SIGNUP_FAILED: 'signup_failed',
  LOGOUT: 'logout',
  SESSION_EXPIRED: 'session_expired',

  // Billing (12 events)
  BILLING_PAGE_VIEWED: 'billing_page_viewed',
  PLAN_VIEWED: 'plan_viewed',
  PLAN_SELECTED: 'plan_selected',
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_COMPLETED: 'checkout_completed',
  CHECKOUT_FAILED: 'checkout_failed',
  CHECKOUT_CANCELLED: 'checkout_cancelled',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription_downgraded',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  CREDITS_PURCHASED: 'credits_purchased',
  CREDITS_USED: 'credits_used',

  // Chat/Conversation (10 events)
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  CHAT_STARTED: 'chat_started',
  CHAT_ENDED: 'chat_ended',
  CHAT_STOPPED: 'chat_stopped',
  CHAT_REGENERATED: 'chat_regenerated',
  CHAT_ERROR: 'chat_error',
  CONTENT_COPIED: 'content_copied',
  ATTACHMENT_ADDED: 'attachment_added',
  SCREENSHOT_TAKEN: 'screenshot_taken',

  // Google Integration (6 events)
  GOOGLE_OAUTH_STARTED: 'google_oauth_started',
  GOOGLE_OAUTH_COMPLETED: 'google_oauth_completed',
  GOOGLE_OAUTH_FAILED: 'google_oauth_failed',
  GOOGLE_SYNC_STARTED: 'google_sync_started',
  GOOGLE_SYNC_COMPLETED: 'google_sync_completed',
  GOOGLE_SYNC_FAILED: 'google_sync_failed',

  // Autonomous Execution (12 events)
  PLAN_CREATED: 'plan_created',
  PLAN_APPROVED: 'plan_approved',
  PLAN_REJECTED: 'plan_rejected',
  PLAN_MODIFIED: 'plan_modified',
  EXECUTION_STARTED: 'execution_started',
  EXECUTION_STEP_COMPLETED: 'execution_step_completed',
  EXECUTION_COMPLETED: 'execution_completed',
  EXECUTION_FAILED: 'execution_failed',
  EXECUTION_CANCELLED: 'execution_cancelled',
  EXECUTION_PAUSED: 'execution_paused',
  TOOL_EXECUTION_FAILED: 'tool_execution_failed',
  TOOL_EXECUTION_RECOVERED: 'tool_execution_recovered',

  // Memory/Vault (8 events)
  MEMORY_ACCESSED: 'memory_accessed',
  MEMORY_ITEM_ADDED: 'memory_item_added',
  MEMORY_ITEM_UPDATED: 'memory_item_updated',
  MEMORY_ITEM_DELETED: 'memory_item_deleted',
  MEMORY_SEARCHED: 'memory_searched',
  MEMORY_SYNCED: 'memory_synced',
  MEMORY_EXPORTED: 'memory_exported',
  MEMORY_IMPORTED: 'memory_imported',

  // UI/UX (8 events)
  PAGE_VIEWED: 'page_viewed',
  BUTTON_CLICKED: 'button_clicked',
  MODAL_OPENED: 'modal_opened',
  MODAL_CLOSED: 'modal_closed',
  FEATURE_USED: 'feature_used',
  SETTINGS_CHANGED: 'settings_changed',
  THEME_CHANGED: 'theme_changed',
  WINDOW_RESIZED: 'window_resized',

  // Errors (6 events)
  ERROR_OCCURRED: 'error_occurred',
  UNHANDLED_ERROR: 'unhandled_error',
  API_ERROR: 'api_error',
  NETWORK_ERROR: 'network_error',
  VALIDATION_ERROR: 'validation_error',
  CRASH_DETECTED: 'crash_detected',

  // Updates (4 events)
  UPDATE_AVAILABLE: 'update_available',
  UPDATE_DOWNLOADED: 'update_downloaded',
  UPDATE_INSTALLED: 'update_installed',
  UPDATE_DEFERRED: 'update_deferred',
};

// ============================================
// ANALYTICS STATE
// ============================================

let initialized = false;
let enabled = true;
let sessionRecordingActive = false;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize PostHog analytics in renderer
 */
export function initializeAnalytics() {
  if (initialized) return;

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    logger.info('PostHog API key not configured - analytics disabled');
    enabled = false;
    return;
  }

  try {
    posthog.init(apiKey, {
      api_host: host,

      // Maximum autocapture for comprehensive tracking
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,

      // Automatic exception capture (Phase 2 - Error Tracking)
      capture_exceptions: {
        capture_unhandled_errors: true,      // Capture window.onerror
        capture_unhandled_rejections: true,  // Capture unhandled promise rejections
        capture_console_errors: true,        // Capture console.error calls
      },

      // Session recording - start paused, resume on errors
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-mask]',
      },

      // Performance settings
      persistence: 'localStorage',
      bootstrap: {
        distinctID: localStorage.getItem('device_id'),
      },

      // Privacy settings
      respect_dnt: true,

      // Loaded callback
      loaded: (ph) => {
        initialized = true;
        logger.info('PostHog initialized with exception capture enabled');

        // Start with recording paused (will resume on errors)
        ph.sessionRecording?.pause?.();
        sessionRecordingActive = false;

        // Set up additional error handlers for custom tracking
        setupErrorHandlers();
      },
    });

  } catch (error) {
    logger.error('PostHog initialization failed:', error);
    enabled = false;
  }
}

// ============================================
// CORE ANALYTICS FUNCTIONS
// ============================================

/**
 * Capture an analytics event
 */
export function capture(eventName, properties = {}) {
  if (!enabled) return;

  const enrichedProperties = {
    ...properties,
    timestamp: new Date().toISOString(),
    source: 'renderer',
  };

  // Try PostHog directly first
  if (initialized) {
    try {
      posthog.capture(eventName, enrichedProperties);
    } catch (error) {
      logger.error('PostHog capture failed:', error);
    }
  }

  // Also send via main process for reliability
  if (window.posthog?.capture) {
    window.posthog.capture(eventName, enrichedProperties);
  }
}

/**
 * Capture an error with full context and resume session recording
 */
export function captureError(error, context = {}) {
  if (!enabled) return;

  const errorData = {
    error_type: error.name || 'Error',
    error_message: error.message,
    error_stack: error.stack,
    url: window.location.href,
    ...context,
  };

  capture(AnalyticsEvents.ERROR_OCCURRED, errorData);

  // Resume session recording for 60 seconds on error
  resumeSessionRecording(60000);

  // Also send via main process
  if (window.posthog?.captureError) {
    window.posthog.captureError({ error: errorData, context });
  }
}

/**
 * Identify user (call after sign-in)
 */
export function identify(userId, properties = {}) {
  if (!enabled) return;

  try {
    if (initialized) {
      posthog.identify(userId, properties);
    }

    // Also identify via main process
    if (window.posthog?.identify) {
      window.posthog.identify(userId, properties);
    }

    logger.info('User identified:', userId);
  } catch (error) {
    logger.error('Identify failed:', error);
  }
}

/**
 * Reset analytics (call on logout)
 */
export function reset() {
  if (!enabled) return;

  try {
    if (initialized) {
      posthog.reset();
    }
    logger.info('Analytics reset');
  } catch (error) {
    logger.error('Reset failed:', error);
  }
}

/**
 * Get feature flag value
 */
export async function getFeatureFlag(flagName, defaultValue = false) {
  if (!enabled) return defaultValue;

  try {
    if (initialized) {
      const value = posthog.getFeatureFlag(flagName);
      return value ?? defaultValue;
    }

    // Fallback to main process
    if (window.posthog?.getFeatureFlag) {
      const result = await window.posthog.getFeatureFlag(flagName, defaultValue);
      return result?.value ?? defaultValue;
    }

    return defaultValue;
  } catch (error) {
    logger.error('getFeatureFlag failed:', error);
    return defaultValue;
  }
}

/**
 * Set analytics enabled/disabled (GDPR opt-out)
 */
export function setEnabled(value) {
  enabled = value;

  if (initialized) {
    if (value) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  }

  // Also update main process
  if (window.posthog?.setEnabled) {
    window.posthog.setEnabled(value);
  }

  logger.info('Analytics enabled:', value);
}

/**
 * Check if analytics is enabled
 */
export function isEnabled() {
  return enabled;
}

/**
 * Flush pending events
 */
export async function flush() {
  if (!enabled) return;

  try {
    if (initialized) {
      posthog.flush();
    }

    if (window.posthog?.flush) {
      await window.posthog.flush();
    }
  } catch (error) {
    logger.error('Flush failed:', error);
  }
}

// ============================================
// SESSION RECORDING
// ============================================

/**
 * Resume session recording for a specified duration
 */
export function resumeSessionRecording(durationMs = 60000) {
  if (!enabled || !initialized) return;

  try {
    if (!sessionRecordingActive) {
      posthog.sessionRecording?.resume?.();
      sessionRecordingActive = true;
      logger.info('Session recording resumed for', durationMs / 1000, 'seconds');

      // Auto-pause after duration
      setTimeout(() => {
        pauseSessionRecording();
      }, durationMs);
    }
  } catch (error) {
    logger.error('Resume session recording failed:', error);
  }
}

/**
 * Pause session recording
 */
export function pauseSessionRecording() {
  if (!enabled || !initialized) return;

  try {
    posthog.sessionRecording?.pause?.();
    sessionRecordingActive = false;
    logger.info('Session recording paused');
  } catch (error) {
    logger.error('Pause session recording failed:', error);
  }
}

// ============================================
// ERROR HANDLERS
// ============================================

/**
 * Set up global error handlers
 */
function setupErrorHandlers() {
  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    captureError(event.error || new Error(event.message), {
      type: 'unhandled_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    captureError(error, {
      type: 'unhandled_rejection',
    });
  });

  logger.info('Global error handlers registered');
}

// ============================================
// CONVENIENCE METHODS FOR COMMON EVENTS
// ============================================

// Onboarding
export const trackOnboardingStarted = (step = 1) =>
  capture(AnalyticsEvents.ONBOARDING_STARTED, { step });

export const trackOnboardingStepCompleted = (step, data = {}) =>
  capture(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step, ...data });

export const trackOnboardingCompleted = (data = {}) =>
  capture(AnalyticsEvents.ONBOARDING_COMPLETED, data);

// Authentication
export const trackSignInAttempted = (method = 'email') =>
  capture(AnalyticsEvents.SIGNIN_ATTEMPTED, { method });

export const trackSignInSucceeded = (userId, method = 'email') => {
  capture(AnalyticsEvents.SIGNIN_SUCCEEDED, { method });
  identify(userId, { signin_method: method });
};

export const trackSignInFailed = (method, error) =>
  capture(AnalyticsEvents.SIGNIN_FAILED, { method, error: error?.message });

export const trackLogout = () => {
  capture(AnalyticsEvents.LOGOUT);
  reset();
};

// Billing
export const trackBillingPageViewed = () =>
  capture(AnalyticsEvents.BILLING_PAGE_VIEWED);

export const trackPlanSelected = (planId, planName, price) =>
  capture(AnalyticsEvents.PLAN_SELECTED, { plan_id: planId, plan_name: planName, price });

export const trackCheckoutStarted = (planId, amount) =>
  capture(AnalyticsEvents.CHECKOUT_STARTED, { plan_id: planId, amount });

export const trackCheckoutCompleted = (planId, amount, transactionId) =>
  capture(AnalyticsEvents.CHECKOUT_COMPLETED, { plan_id: planId, amount, transaction_id: transactionId });

export const trackCheckoutFailed = (planId, error) =>
  capture(AnalyticsEvents.CHECKOUT_FAILED, { plan_id: planId, error: error?.message });

// Chat
export const trackMessageSent = (messageLength, hasAttachments = false) =>
  capture(AnalyticsEvents.MESSAGE_SENT, { message_length: messageLength, has_attachments: hasAttachments });

export const trackMessageReceived = (responseTimeMs, tokensUsed = 0) =>
  capture(AnalyticsEvents.MESSAGE_RECEIVED, { response_time_ms: responseTimeMs, tokens_used: tokensUsed });

export const trackChatError = (error) =>
  capture(AnalyticsEvents.CHAT_ERROR, { error: error?.message, error_type: error?.name });

// Autonomous Execution
export const trackPlanCreated = (planId, stepCount) =>
  capture(AnalyticsEvents.PLAN_CREATED, { plan_id: planId, step_count: stepCount });

export const trackExecutionStarted = (runId, mode = 'autonomous') =>
  capture(AnalyticsEvents.EXECUTION_STARTED, { run_id: runId, mode });

export const trackExecutionCompleted = (runId, durationMs, stepsCompleted) =>
  capture(AnalyticsEvents.EXECUTION_COMPLETED, {
    run_id: runId,
    duration_ms: durationMs,
    steps_completed: stepsCompleted
  });

export const trackExecutionFailed = (runId, error, stepFailed) =>
  capture(AnalyticsEvents.EXECUTION_FAILED, {
    run_id: runId,
    error: error?.message,
    step_failed: stepFailed
  });

/**
 * Track a tool execution failure with full debugging context
 * This is for internal debugging - user just sees "tool failed" UI
 */
export const trackToolExecutionFailed = (data) =>
  capture(AnalyticsEvents.TOOL_EXECUTION_FAILED, {
    run_id: data.runId,
    tool_name: data.toolName,
    step_id: data.stepId,
    step_number: data.stepNumber,
    attempt_number: data.attemptNumber,
    max_attempts: data.maxAttempts,
    error_message: data.errorMessage,
    error_stderr: data.stderr,
    exit_code: data.exitCode,
    args_used: JSON.stringify(data.args),
    user_request: data.userRequest,
    intent: data.intent,
    os: data.os,
    app_version: data.appVersion,
    recovered: data.recovered || false,
  });

/**
 * Track when a tool failure was recovered via retry
 */
export const trackToolExecutionRecovered = (data) =>
  capture(AnalyticsEvents.TOOL_EXECUTION_RECOVERED, {
    run_id: data.runId,
    tool_name: data.toolName,
    step_id: data.stepId,
    attempts_before_success: data.attemptsBeforeSuccess,
    recovery_method: data.recoveryMethod,
  });

// UI/UX
export const trackPageViewed = (pageName, properties = {}) =>
  capture(AnalyticsEvents.PAGE_VIEWED, { page_name: pageName, ...properties });

export const trackButtonClicked = (buttonName, location) =>
  capture(AnalyticsEvents.BUTTON_CLICKED, { button_name: buttonName, location });

export const trackFeatureUsed = (featureName, properties = {}) =>
  capture(AnalyticsEvents.FEATURE_USED, { feature_name: featureName, ...properties });

// Updates
export const trackUpdateAvailable = (version) =>
  capture(AnalyticsEvents.UPDATE_AVAILABLE, { version });

export const trackUpdateInstalled = (fromVersion, toVersion) =>
  capture(AnalyticsEvents.UPDATE_INSTALLED, { from_version: fromVersion, to_version: toVersion });

// Default export
export default {
  AnalyticsEvents,
  initializeAnalytics,
  capture,
  captureError,
  identify,
  reset,
  getFeatureFlag,
  setEnabled,
  isEnabled,
  flush,
  resumeSessionRecording,
  pauseSessionRecording,
  // Convenience methods
  trackOnboardingStarted,
  trackOnboardingStepCompleted,
  trackOnboardingCompleted,
  trackSignInAttempted,
  trackSignInSucceeded,
  trackSignInFailed,
  trackLogout,
  trackBillingPageViewed,
  trackPlanSelected,
  trackCheckoutStarted,
  trackCheckoutCompleted,
  trackCheckoutFailed,
  trackMessageSent,
  trackMessageReceived,
  trackChatError,
  trackPlanCreated,
  trackExecutionStarted,
  trackExecutionCompleted,
  trackExecutionFailed,
  trackToolExecutionFailed,
  trackToolExecutionRecovered,
  trackPageViewed,
  trackButtonClicked,
  trackFeatureUsed,
  trackUpdateAvailable,
  trackUpdateInstalled,
};
