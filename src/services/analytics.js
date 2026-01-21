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

  // Window/UI State (10 events)
  WINDOW_EXPANDED: 'window_expanded',
  WINDOW_MINIMIZED: 'window_minimized',
  WINDOW_FOCUSED: 'window_focused',
  WINDOW_BLURRED: 'window_blurred',
  SETTINGS_OPENED: 'settings_opened',
  SETTINGS_CLOSED: 'settings_closed',
  CONVERSATION_CLEARED: 'conversation_cleared',
  CONVERSATION_STOPPED: 'conversation_stopped',
  CONTEXT_FULL_WARNING: 'context_full_warning',
  TUTORIAL_STARTED: 'tutorial_started',
  TUTORIAL_COMPLETED: 'tutorial_completed',
  TUTORIAL_SKIPPED: 'tutorial_skipped',

  // User Engagement (8 events)
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  DAILY_ACTIVE: 'daily_active',
  WEEKLY_ACTIVE: 'weekly_active',
  FIRST_MESSAGE_SENT: 'first_message_sent',
  POWER_USER_ACTION: 'power_user_action',
  IDLE_TIMEOUT: 'idle_timeout',
  RETURN_FROM_IDLE: 'return_from_idle',

  // Content Actions (6 events)
  CODE_BLOCK_COPIED: 'code_block_copied',
  RESPONSE_COPIED: 'response_copied',
  RESPONSE_REGENERATED: 'response_regenerated',
  FILE_ATTACHED: 'file_attached',
  IMAGE_ATTACHED: 'image_attached',
  LINK_CLICKED: 'link_clicked',

  // Billing Extended (4 events)
  CREDITS_LOW_WARNING: 'credits_low_warning',
  CREDITS_DEPLETED: 'credits_depleted',
  UPGRADE_PROMPT_SHOWN: 'upgrade_prompt_shown',
  UPGRADE_PROMPT_CLICKED: 'upgrade_prompt_clicked',

  // Performance (4 events)
  SLOW_RESPONSE: 'slow_response',
  API_LATENCY: 'api_latency',
  RENDER_PERFORMANCE: 'render_performance',
  MEMORY_WARNING: 'memory_warning',

  // Beta Analytics Events - Detailed tracking for all users during beta period
  BETA_MESSAGE_FULL: 'beta_message_full',           // Full user message content + context
  BETA_AI_RESPONSE_FULL: 'beta_ai_response_full',   // Full AI response content + metrics
  BETA_TOOL_EXECUTION: 'beta_tool_execution',       // Tool start with args
  BETA_TOOL_RESULT: 'beta_tool_result',             // Tool completion with stdout/stderr
  BETA_SESSION_CONTEXT: 'beta_session_context',     // Full context snapshot per request
  BETA_ERROR_FULL: 'beta_error_full',               // Detailed error with full stack
  BETA_ASK_USER: 'beta_ask_user',                   // User prompts and responses
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

// Window/UI State
export const trackWindowExpanded = (fromState = 'mini') =>
  capture(AnalyticsEvents.WINDOW_EXPANDED, { from_state: fromState });

export const trackWindowMinimized = (toState = 'mini') =>
  capture(AnalyticsEvents.WINDOW_MINIMIZED, { to_state: toState });

export const trackWindowFocused = () =>
  capture(AnalyticsEvents.WINDOW_FOCUSED);

export const trackWindowBlurred = () =>
  capture(AnalyticsEvents.WINDOW_BLURRED);

export const trackSettingsOpened = (source = 'toolbar') =>
  capture(AnalyticsEvents.SETTINGS_OPENED, { source });

export const trackSettingsClosed = (changesApplied = false) =>
  capture(AnalyticsEvents.SETTINGS_CLOSED, { changes_applied: changesApplied });

export const trackConversationCleared = (messageCount = 0) =>
  capture(AnalyticsEvents.CONVERSATION_CLEARED, { message_count: messageCount });

export const trackConversationStopped = (reason = 'user_action') =>
  capture(AnalyticsEvents.CONVERSATION_STOPPED, { reason });

export const trackContextFullWarning = (usagePercent) =>
  capture(AnalyticsEvents.CONTEXT_FULL_WARNING, { usage_percent: usagePercent });

export const trackTutorialStarted = () =>
  capture(AnalyticsEvents.TUTORIAL_STARTED);

export const trackTutorialCompleted = (stepsCompleted) =>
  capture(AnalyticsEvents.TUTORIAL_COMPLETED, { steps_completed: stepsCompleted });

export const trackTutorialSkipped = (atStep) =>
  capture(AnalyticsEvents.TUTORIAL_SKIPPED, { at_step: atStep });

// User Engagement
export const trackSessionStarted = (isReturningUser = false) =>
  capture(AnalyticsEvents.SESSION_STARTED, {
    is_returning_user: isReturningUser,
    session_start_time: new Date().toISOString(),
  });

export const trackSessionEnded = (durationMs, messageCount = 0) =>
  capture(AnalyticsEvents.SESSION_ENDED, {
    duration_ms: durationMs,
    message_count: messageCount,
  });

export const trackDailyActive = (daysSinceInstall) =>
  capture(AnalyticsEvents.DAILY_ACTIVE, { days_since_install: daysSinceInstall });

export const trackFirstMessageSent = () =>
  capture(AnalyticsEvents.FIRST_MESSAGE_SENT, { milestone: 'first_message' });

export const trackPowerUserAction = (action, details = {}) =>
  capture(AnalyticsEvents.POWER_USER_ACTION, { action, ...details });

export const trackReturnFromIdle = (idleDurationMs) =>
  capture(AnalyticsEvents.RETURN_FROM_IDLE, { idle_duration_ms: idleDurationMs });

// Content Actions
export const trackCodeBlockCopied = (language = 'unknown', lineCount = 0) =>
  capture(AnalyticsEvents.CODE_BLOCK_COPIED, { language, line_count: lineCount });

export const trackResponseCopied = (responseLength = 0) =>
  capture(AnalyticsEvents.RESPONSE_COPIED, { response_length: responseLength });

export const trackResponseRegenerated = () =>
  capture(AnalyticsEvents.RESPONSE_REGENERATED);

export const trackFileAttached = (fileType, fileSizeKb) =>
  capture(AnalyticsEvents.FILE_ATTACHED, { file_type: fileType, file_size_kb: fileSizeKb });

export const trackImageAttached = (source = 'file', dimensions = {}) =>
  capture(AnalyticsEvents.IMAGE_ATTACHED, { source, ...dimensions });

export const trackLinkClicked = (linkType = 'external', domain = '') =>
  capture(AnalyticsEvents.LINK_CLICKED, { link_type: linkType, domain });

// Billing Extended
export const trackCreditsLowWarning = (creditsRemaining, threshold) =>
  capture(AnalyticsEvents.CREDITS_LOW_WARNING, {
    credits_remaining: creditsRemaining,
    threshold,
  });

export const trackCreditsDepleted = () =>
  capture(AnalyticsEvents.CREDITS_DEPLETED);

export const trackUpgradePromptShown = (trigger, currentPlan = 'free') =>
  capture(AnalyticsEvents.UPGRADE_PROMPT_SHOWN, { trigger, current_plan: currentPlan });

export const trackUpgradePromptClicked = (action, targetPlan = null) =>
  capture(AnalyticsEvents.UPGRADE_PROMPT_CLICKED, { action, target_plan: targetPlan });

// Performance
export const trackSlowResponse = (responseTimeMs, threshold = 10000) =>
  capture(AnalyticsEvents.SLOW_RESPONSE, {
    response_time_ms: responseTimeMs,
    threshold_ms: threshold,
  });

export const trackApiLatency = (endpoint, latencyMs, success = true) =>
  capture(AnalyticsEvents.API_LATENCY, {
    endpoint,
    latency_ms: latencyMs,
    success,
  });

export const trackRenderPerformance = (component, renderTimeMs) =>
  capture(AnalyticsEvents.RENDER_PERFORMANCE, {
    component,
    render_time_ms: renderTimeMs,
  });

// ============================================
// USER PROPERTIES MANAGEMENT
// ============================================

/**
 * Set persistent user properties for segmentation
 */
export function setUserProperties(properties) {
  if (!enabled || !initialized) return;

  try {
    posthog.people.set(properties);
    logger.info('User properties set:', Object.keys(properties));
  } catch (error) {
    logger.error('Failed to set user properties:', error);
  }
}

/**
 * Increment a numeric user property
 */
export function incrementUserProperty(property, amount = 1) {
  if (!enabled || !initialized) return;

  try {
    posthog.people.increment(property, amount);
  } catch (error) {
    logger.error('Failed to increment user property:', error);
  }
}

/**
 * Set user properties once (won't overwrite if already set)
 */
export function setUserPropertiesOnce(properties) {
  if (!enabled || !initialized) return;

  try {
    posthog.people.set_once(properties);
  } catch (error) {
    logger.error('Failed to set user properties once:', error);
  }
}

// ============================================
// SESSION TRACKING HELPERS
// ============================================

let sessionStartTime = null;
let messageCountThisSession = 0;
let lastActivityTime = null;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Start tracking a new session
 */
export function startSession(isReturningUser = false) {
  sessionStartTime = Date.now();
  messageCountThisSession = 0;
  lastActivityTime = Date.now();

  trackSessionStarted(isReturningUser);

  // Set first seen date if not already set
  setUserPropertiesOnce({
    first_seen_date: new Date().toISOString(),
  });

  // Update last seen date
  setUserProperties({
    last_seen_date: new Date().toISOString(),
  });
}

/**
 * End the current session
 */
export function endSession() {
  if (sessionStartTime) {
    const durationMs = Date.now() - sessionStartTime;
    trackSessionEnded(durationMs, messageCountThisSession);

    // Update user properties
    incrementUserProperty('total_sessions', 1);
    incrementUserProperty('total_messages_sent', messageCountThisSession);
  }

  sessionStartTime = null;
  messageCountThisSession = 0;
}

/**
 * Record user activity (prevents idle timeout)
 */
export function recordActivity() {
  const now = Date.now();

  // Check if returning from idle
  if (lastActivityTime && (now - lastActivityTime) > IDLE_THRESHOLD_MS) {
    trackReturnFromIdle(now - lastActivityTime);
  }

  lastActivityTime = now;
}

/**
 * Increment message count for session
 */
export function recordMessageSent() {
  messageCountThisSession++;
  recordActivity();

  // Track first message milestone
  const totalMessages = parseInt(localStorage.getItem('total_messages_sent') || '0', 10);
  if (totalMessages === 0) {
    trackFirstMessageSent();
    setUserPropertiesOnce({ first_message_date: new Date().toISOString() });
  }

  localStorage.setItem('total_messages_sent', String(totalMessages + 1));
  incrementUserProperty('lifetime_messages', 1);
}

// ============================================
// BETA ANALYTICS - Detailed tracking for beta testers
// ============================================

// Session-level message counter for beta tracking
let betaSessionMessageIndex = 0;

/**
 * Check if beta analytics is enabled
 * During beta period, this is enabled for all users
 */
export function isBetaAnalyticsEnabled() {
  // Beta analytics enabled for all users during beta period
  return true;
}

/**
 * Truncate text to max bytes with marker
 * @param {string} text - Text to truncate
 * @param {number} maxBytes - Maximum bytes (default 10KB)
 * @returns {object} { text, truncated, fullLength }
 */
function truncateText(text, maxBytes = 10240) {
  if (!text || typeof text !== 'string') return { text: '', truncated: false, fullLength: 0 };

  const fullLength = text.length;
  if (text.length <= maxBytes) {
    return { text, truncated: false, fullLength };
  }

  return {
    text: text.substring(0, maxBytes) + '...[TRUNCATED]',
    truncated: true,
    fullLength
  };
}

/**
 * Get comprehensive beta user identity for all beta events
 * Includes user info, device info, subscription status, etc.
 */
export function getBetaUserIdentity() {
  try {
    const identity = {
      // User identification
      user_id: localStorage.getItem('user_id') || null,
      device_id: localStorage.getItem('device_id') || null,
      email: localStorage.getItem('user_email') || null,
      user_name: localStorage.getItem('user_name') || null,

      // Subscription info
      subscription_tier: localStorage.getItem('subscription_tier') || 'free',
      subscription_status: localStorage.getItem('subscription_status') || null,
      credits: parseInt(localStorage.getItem('credits') || '0', 10),

      // Session info
      session_id: localStorage.getItem('agent_max_session_id') || null,
      install_date: localStorage.getItem('install_date') || null,

      // Feature states
      google_connected: localStorage.getItem('google_user_email') ? true : false,
      browser_mode: localStorage.getItem('pref_browser_mode') || 'both',
      permission_mode: localStorage.getItem('pref_permission_mode') || 'suggest',

      // App info
      app_version: null,
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      screen_width: typeof window !== 'undefined' ? window.screen?.width : null,
      screen_height: typeof window !== 'undefined' ? window.screen?.height : null,
    };

    // Try to get app version from electron
    try {
      if (window.electron?.getAppVersion) {
        window.electron.getAppVersion().then(v => identity.app_version = v).catch(() => {});
      }
    } catch {}

    return identity;
  } catch (e) {
    return { error: 'Failed to get identity' };
  }
}

/**
 * Capture a beta event with full user identity
 * Only fires if beta analytics is enabled
 */
export function captureBetaEvent(eventName, properties = {}) {
  if (!isBetaAnalyticsEnabled()) return;
  if (!enabled) return;

  const enrichedProperties = {
    ...properties,
    ...getBetaUserIdentity(),
    beta_tracking: true,
    timestamp: new Date().toISOString(),
    source: 'renderer',
  };

  // Capture via normal PostHog path
  capture(eventName, enrichedProperties);
}

/**
 * Capture full message sent by user (beta testers only)
 * @param {object} data - Message data
 */
export function captureBetaMessageSent(data) {
  if (!isBetaAnalyticsEnabled()) return;

  betaSessionMessageIndex++;

  const { text: messageContent, truncated: messageTruncated, fullLength: messageFullLength } =
    truncateText(data.message_content);

  // Build recent messages preview (last 5)
  const recentMessagesPreview = (data.recent_messages || [])
    .slice(-5)
    .map(m => ({
      role: m.role,
      preview: m.content?.substring(0, 100) || '',
    }));

  captureBetaEvent(AnalyticsEvents.BETA_MESSAGE_FULL, {
    // Message content
    message_content: messageContent,
    message_truncated: messageTruncated,
    message_full_length: messageFullLength,

    // Screenshot info (not the actual image)
    has_screenshot: data.has_screenshot || false,
    screenshot_size_kb: data.screenshot_size_kb || null,

    // Conversation context
    conversation_length: data.conversation_length || 0,
    recent_messages_preview: recentMessagesPreview,
    session_message_index: betaSessionMessageIndex,

    // Active tools state
    has_active_spreadsheet: data.active_tools?.spreadsheet?.active || false,
    has_active_browser: data.active_tools?.workspace?.active || false,

    // Context keys (what data is available, not the data itself)
    has_profile: !!data.user_context?.profile,
    has_facts: !!data.user_context?.facts,
    has_preferences: !!data.user_context?.preferences,
    has_semantic_context: !!data.user_context?.semantic_context,
    context_keys: data.context_keys || [],
  });
}

/**
 * Capture full AI response (beta testers only)
 * @param {object} data - Response data
 */
export function captureBetaAIResponse(data) {
  if (!isBetaAnalyticsEnabled()) return;

  const { text: responseContent, truncated: responseTruncated, fullLength: responseFullLength } =
    truncateText(data.response_content);

  captureBetaEvent(AnalyticsEvents.BETA_AI_RESPONSE_FULL, {
    // Response content
    response_content: responseContent,
    response_truncated: responseTruncated,
    response_full_length: responseFullLength,

    // Response metadata
    response_type: data.response_type || 'unknown', // 'direct', 'task_complete', 'error'
    response_time_ms: data.response_time_ms || null,
    tokens_used: data.tokens_used || null,

    // Run info
    run_id: data.run_id || null,
    is_direct_response: data.is_direct_response || false,

    // Correlation
    original_message_preview: data.original_message?.substring(0, 100) || null,
  });
}

/**
 * Capture tool execution start (beta testers only)
 * Called from main process via IPC
 */
export function captureBetaToolExecution(data) {
  if (!isBetaAnalyticsEnabled()) return;

  const { text: argsJson, truncated: argsTruncated, fullLength: argsFullLength } =
    truncateText(JSON.stringify(data.tool_args || {}));

  captureBetaEvent(AnalyticsEvents.BETA_TOOL_EXECUTION, {
    run_id: data.run_id,
    step_index: data.step_index,
    step_id: data.step_id,
    tool_name: data.tool_name,
    tool_args_json: argsJson,
    tool_args_truncated: argsTruncated,
    tool_args_full_length: argsFullLength,
    tool_description: data.tool_description || null,
    attempt_number: data.attempt_number || 1,
    max_attempts: data.max_attempts || 3,
    user_request: data.user_request?.substring(0, 200) || null,
    intent: data.intent?.substring(0, 200) || null,
  });
}

/**
 * Capture tool execution result (beta testers only)
 * Called from main process via IPC
 */
export function captureBetaToolResult(data) {
  if (!isBetaAnalyticsEnabled()) return;

  const { text: stdout, truncated: stdoutTruncated } = truncateText(data.stdout || '');
  const { text: stderr, truncated: stderrTruncated } = truncateText(data.stderr || '');

  captureBetaEvent(AnalyticsEvents.BETA_TOOL_RESULT, {
    run_id: data.run_id,
    step_id: data.step_id,
    tool_name: data.tool_name,

    // Result
    success: data.success,
    exit_code: data.exit_code,
    stdout: stdout,
    stdout_truncated: stdoutTruncated,
    stderr: stderr,
    stderr_truncated: stderrTruncated,
    error_message: data.error_message || null,

    // Timing
    execution_time_ms: data.execution_time_ms || null,
    attempt_number: data.attempt_number || 1,

    // Recovery info
    recovered: data.recovered || false,
    recovery_method: data.recovery_method || null,

    // Screenshot info
    has_screenshot: data.has_screenshot || false,
    screenshot_size_kb: data.screenshot_size_kb || null,
  });
}

/**
 * Capture session context snapshot (beta testers only)
 * Called when a new run is created
 */
export function captureBetaSessionContext(data) {
  if (!isBetaAnalyticsEnabled()) return;

  const { text: messageContent, truncated: messageTruncated } =
    truncateText(data.message || '');

  captureBetaEvent(AnalyticsEvents.BETA_SESSION_CONTEXT, {
    run_id: data.run_id,

    // Message
    message_content: messageContent,
    message_truncated: messageTruncated,

    // Screenshot metadata (not the image)
    has_screenshot: !!data.screenshot_b64,
    screenshot_size_kb: data.screenshot_b64 ? Math.round(data.screenshot_b64.length / 1024) : null,

    // Integration status
    google_connected: !!data.google_user_email,
    browser_mode: data.browser_mode || 'both',

    // Active tools
    has_active_spreadsheet: data.active_tools?.spreadsheet?.active || false,
    has_active_browser: data.active_tools?.workspace?.active || false,

    // Context keys present
    has_profile: !!data.context?.profile,
    has_facts: !!data.context?.facts,
    has_preferences: !!data.context?.preferences,
    has_semantic_context: !!data.context?.semantic_context,
  });
}

/**
 * Capture detailed error (beta testers only)
 */
export function captureBetaError(error, context = {}) {
  if (!isBetaAnalyticsEnabled()) return;

  captureBetaEvent(AnalyticsEvents.BETA_ERROR_FULL, {
    error_type: error?.name || 'Error',
    error_message: error?.message || String(error),
    error_stack: error?.stack || null,
    ...context,
  });
}

/**
 * Capture ask_user interaction (beta testers only)
 */
export function captureBetaAskUser(data) {
  if (!isBetaAnalyticsEnabled()) return;

  captureBetaEvent(AnalyticsEvents.BETA_ASK_USER, {
    run_id: data.run_id,
    question: data.question?.substring(0, 500) || null,
    options: data.options || null,
    user_response: data.user_response?.substring(0, 500) || null,
    response_time_ms: data.response_time_ms || null,
  });
}

/**
 * Initialize beta session recording (if consent given)
 * Call this after normal analytics init
 */
export function initializeBetaRecording() {
  if (!isBetaAnalyticsEnabled()) return;
  if (!initialized) return;

  try {
    // Resume continuous session recording for beta users
    posthog.sessionRecording?.resume?.();
    sessionRecordingActive = true;
    logger.info('Beta session recording enabled');
  } catch (e) {
    logger.error('Failed to enable beta session recording:', e);
  }
}

/**
 * Reset beta session message counter (call on conversation clear)
 */
export function resetBetaSessionCounter() {
  betaSessionMessageIndex = 0;
}

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
  // User properties
  setUserProperties,
  setUserPropertiesOnce,
  incrementUserProperty,
  // Session tracking
  startSession,
  endSession,
  recordActivity,
  recordMessageSent,
  // Onboarding
  trackOnboardingStarted,
  trackOnboardingStepCompleted,
  trackOnboardingCompleted,
  // Auth
  trackSignInAttempted,
  trackSignInSucceeded,
  trackSignInFailed,
  trackLogout,
  // Billing
  trackBillingPageViewed,
  trackPlanSelected,
  trackCheckoutStarted,
  trackCheckoutCompleted,
  trackCheckoutFailed,
  trackCreditsLowWarning,
  trackCreditsDepleted,
  trackUpgradePromptShown,
  trackUpgradePromptClicked,
  // Chat
  trackMessageSent,
  trackMessageReceived,
  trackChatError,
  // Execution
  trackPlanCreated,
  trackExecutionStarted,
  trackExecutionCompleted,
  trackExecutionFailed,
  trackToolExecutionFailed,
  trackToolExecutionRecovered,
  // UI/UX
  trackPageViewed,
  trackButtonClicked,
  trackFeatureUsed,
  trackWindowExpanded,
  trackWindowMinimized,
  trackWindowFocused,
  trackWindowBlurred,
  trackSettingsOpened,
  trackSettingsClosed,
  trackConversationCleared,
  trackConversationStopped,
  trackContextFullWarning,
  trackTutorialStarted,
  trackTutorialCompleted,
  trackTutorialSkipped,
  // Content Actions
  trackCodeBlockCopied,
  trackResponseCopied,
  trackResponseRegenerated,
  trackFileAttached,
  trackImageAttached,
  trackLinkClicked,
  // Engagement
  trackSessionStarted,
  trackSessionEnded,
  trackDailyActive,
  trackFirstMessageSent,
  trackPowerUserAction,
  trackReturnFromIdle,
  // Updates
  trackUpdateAvailable,
  trackUpdateInstalled,
  // Performance
  trackSlowResponse,
  trackApiLatency,
  trackRenderPerformance,
  // Beta Analytics
  isBetaAnalyticsEnabled,
  getBetaUserIdentity,
  captureBetaEvent,
  captureBetaMessageSent,
  captureBetaAIResponse,
  captureBetaToolExecution,
  captureBetaToolResult,
  captureBetaSessionContext,
  captureBetaError,
  captureBetaAskUser,
  initializeBetaRecording,
  resetBetaSessionCounter,
};
