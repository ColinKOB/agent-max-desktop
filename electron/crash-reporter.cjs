/**
 * Crash Reporter Configuration
 * Captures and reports crashes using Sentry
 */

const { app } = require('electron');
const Sentry = require('@sentry/electron/main');
const log = require('electron-log');

let initialized = false;

function setupCrashReporter() {
  // Only enable crash reporting in production
  if (process.env.NODE_ENV === 'development') {
    console.log('[CrashReporter] Disabled in development');
    return;
  }
  
  // Check if user has consented to crash reporting
  // This should be checked from user preferences
  const crashReportingEnabled = process.env.CRASH_REPORTING_ENABLED !== 'false';
  
  if (!crashReportingEnabled) {
    console.log('[CrashReporter] Disabled by user preference');
    return;
  }
  
  try {
    // Initialize Sentry
    // NOTE: Replace with your actual Sentry DSN
    const SENTRY_DSN = process.env.SENTRY_DSN || '';
    
    if (!SENTRY_DSN) {
      console.log('[CrashReporter] No Sentry DSN configured');
      return;
    }
    
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      release: `agent-max-desktop@${app.getVersion()}`,
      
      // Set sample rate (1.0 = 100% of errors reported)
      sampleRate: 1.0,
      
      // Performance monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      
      // Privacy settings
      beforeSend(event) {
        // Remove sensitive data
        if (event.user) {
          delete event.user.email;
          delete event.user.username;
        }
        
        // Remove PII from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            if (breadcrumb.data) {
              // Remove any keys that might contain sensitive data
              const sanitized = { ...breadcrumb.data };
              delete sanitized.apiKey;
              delete sanitized.token;
              delete sanitized.password;
              delete sanitized.message; // May contain user messages
              breadcrumb.data = sanitized;
            }
            return breadcrumb;
          });
        }
        
        return event;
      }
    });
    
    // Set user context (anonymous)
    Sentry.setUser({
      id: `anon-${Date.now()}`
    });
    
    // Set app context
    Sentry.setContext('app', {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    });
    
    initialized = true;
    console.log('[CrashReporter] Initialized with Sentry');
    log.info('[CrashReporter] Crash reporting enabled');
    
  } catch (error) {
    console.error('[CrashReporter] Failed to initialize:', error);
    log.error('[CrashReporter] Initialization error:', error);
  }
}

/**
 * Manually capture an error
 */
function captureError(error, context = {}) {
  if (!initialized) {
    return;
  }
  
  try {
    Sentry.captureException(error, {
      contexts: {
        custom: context
      }
    });
    log.error('[CrashReporter] Error captured:', error.message);
  } catch (err) {
    console.error('[CrashReporter] Failed to capture error:', err);
  }
}

/**
 * Manually capture a message
 */
function captureMessage(message, level = 'info') {
  if (!initialized) {
    return;
  }
  
  try {
    Sentry.captureMessage(message, level);
    log.info('[CrashReporter] Message captured:', message);
  } catch (err) {
    console.error('[CrashReporter] Failed to capture message:', err);
  }
}

/**
 * Add breadcrumb for debugging context
 */
function addBreadcrumb(breadcrumb) {
  if (!initialized) {
    return;
  }
  
  try {
    Sentry.addBreadcrumb(breadcrumb);
  } catch (err) {
    console.error('[CrashReporter] Failed to add breadcrumb:', err);
  }
}

/**
 * Set user context
 */
function setUserContext(userId) {
  if (!initialized) {
    return;
  }
  
  try {
    Sentry.setUser({
      id: userId
    });
  } catch (err) {
    console.error('[CrashReporter] Failed to set user context:', err);
  }
}

/**
 * Flush any pending error reports
 */
async function flush() {
  if (!initialized) {
    return;
  }
  
  try {
    await Sentry.flush(2000); // Wait up to 2 seconds
    log.info('[CrashReporter] Flushed pending reports');
  } catch (err) {
    console.error('[CrashReporter] Failed to flush:', err);
  }
}

module.exports = {
  setupCrashReporter,
  captureError,
  captureMessage,
  addBreadcrumb,
  setUserContext,
  flush
};
