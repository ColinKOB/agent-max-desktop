/**
 * PostHog Analytics - Main Process
 * Comprehensive product analytics for Agent Max Desktop
 */

const { app, ipcMain } = require('electron');
const { PostHog } = require('posthog-node');
const log = require('electron-log');

let client = null;
let distinctId = null;
let initialized = false;
let enabled = true;

// Event queue for offline support
const offlineQueue = [];
const MAX_QUEUE_SIZE = 1000;

/**
 * Get or generate a unique device ID for analytics
 */
async function getDistinctId() {
  if (distinctId) return distinctId;

  try {
    // Try to get machine ID for consistent identification
    const { machineId } = require('node-machine-id');
    distinctId = await machineId();
  } catch (e) {
    // Fallback to random UUID if machine-id fails
    const crypto = require('crypto');
    distinctId = `desktop_${crypto.randomUUID()}`;
  }

  return distinctId;
}

/**
 * Initialize PostHog analytics
 */
async function initialize() {
  if (initialized) return;

  // ALWAYS register IPC handlers (even when disabled) to prevent "No handler" errors
  registerIPCHandlers();

  const apiKey = process.env.VITE_POSTHOG_KEY || process.env.POSTHOG_KEY;
  const host = process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    log.info('[PostHog] No API key configured - analytics disabled');
    enabled = false;
    initialized = true; // Mark as initialized even when disabled
    return;
  }

  try {
    client = new PostHog(apiKey, {
      host,
      flushAt: 20,
      flushInterval: 10000, // 10 seconds
    });

    distinctId = await getDistinctId();
    initialized = true;

    // Identify this device
    client.identify({
      distinctId,
      properties: {
        platform: process.platform,
        arch: process.arch,
        app_version: app.getVersion(),
        electron_version: process.versions.electron,
        node_version: process.versions.node,
        os_version: process.getSystemVersion?.() || 'unknown',
      },
    });

    // Capture app launch
    capture('app_launched', {
      launch_type: 'cold_start',
      version: app.getVersion(),
    });

    log.info('[PostHog] Initialized successfully');

    // Flush any queued events
    flushOfflineQueue();

  } catch (error) {
    log.error('[PostHog] Initialization failed:', error);
    enabled = false;
  }
}

/**
 * Flush offline event queue
 */
function flushOfflineQueue() {
  if (!client || !enabled) return;

  while (offlineQueue.length > 0) {
    const event = offlineQueue.shift();
    try {
      client.capture(event);
    } catch (e) {
      log.error('[PostHog] Failed to flush queued event:', e);
    }
  }
}

/**
 * Capture an analytics event
 */
function capture(eventName, properties = {}) {
  if (!enabled) return;

  const event = {
    distinctId: distinctId || 'anonymous',
    event: eventName,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      platform: process.platform,
      app_version: app.getVersion(),
      timestamp: new Date().toISOString(),
    },
  };

  if (!initialized || !client) {
    // Queue for later if not initialized
    if (offlineQueue.length < MAX_QUEUE_SIZE) {
      offlineQueue.push(event);
    }
    return;
  }

  try {
    client.capture(event);
  } catch (error) {
    log.error('[PostHog] Failed to capture event:', error);
    // Queue for retry
    if (offlineQueue.length < MAX_QUEUE_SIZE) {
      offlineQueue.push(event);
    }
  }
}

/**
 * Capture an error with full context
 */
function captureError(error, context = {}) {
  if (!enabled) return;

  const errorData = {
    error_type: error.name || 'Error',
    error_message: error.message,
    error_stack: error.stack,
    ...context,
  };

  capture('error_occurred', errorData);

  // Also log locally
  log.error('[PostHog] Error captured:', error.message, context);
}

/**
 * Capture a tool execution failure with full debugging context
 * This is for internal debugging - user just sees "tool failed" in UI
 *
 * @param {Object} data - Tool failure data
 * @param {string} data.runId - The run ID
 * @param {string} data.toolName - Name of the tool that failed
 * @param {string} data.stepId - Step ID
 * @param {number} data.stepNumber - Step number in the run
 * @param {number} data.attemptNumber - Which retry attempt this was
 * @param {number} data.maxAttempts - Maximum retry attempts
 * @param {string} data.errorMessage - The error message
 * @param {string} data.stderr - stderr output if any
 * @param {number} data.exitCode - Exit code if applicable
 * @param {Object} data.args - Arguments passed to the tool
 * @param {string} data.userRequest - Original user request
 * @param {string} data.intent - Detected intent
 * @param {boolean} data.recovered - Whether this was eventually recovered
 */
function captureToolFailure(data) {
  if (!enabled) return;

  const eventData = {
    run_id: data.runId,
    tool_name: data.toolName,
    step_id: data.stepId,
    step_number: data.stepNumber,
    attempt_number: data.attemptNumber,
    max_attempts: data.maxAttempts,
    error_message: data.errorMessage,
    error_stderr: data.stderr ? data.stderr.substring(0, 2000) : null, // Limit stderr size
    exit_code: data.exitCode,
    args_used: data.args ? JSON.stringify(data.args).substring(0, 2000) : null, // Limit args size
    user_request: data.userRequest ? data.userRequest.substring(0, 500) : null,
    intent: data.intent,
    os: process.platform,
    app_version: app.getVersion(),
    recovered: data.recovered || false,
  };

  capture('tool_execution_failed', eventData);

  // Log locally for debugging
  log.warn('[PostHog] Tool failure captured:', {
    tool: data.toolName,
    error: data.errorMessage,
    attempt: data.attemptNumber,
    runId: data.runId,
  });
}

/**
 * Capture when a tool failure was recovered via retry
 */
function captureToolRecovery(data) {
  if (!enabled) return;

  capture('tool_execution_recovered', {
    run_id: data.runId,
    tool_name: data.toolName,
    step_id: data.stepId,
    attempts_before_success: data.attemptsBeforeSuccess,
    recovery_method: data.recoveryMethod || 'retry_with_new_args',
  });

  log.info('[PostHog] Tool recovery captured:', {
    tool: data.toolName,
    attempts: data.attemptsBeforeSuccess,
  });
}

// ============================================
// BETA ANALYTICS - Detailed tracking for all users during beta period
// ============================================

// Beta analytics always enabled during beta period
let betaAnalyticsEnabled = true;

/**
 * Set beta analytics enabled state (kept for IPC compatibility)
 */
function setBetaAnalyticsEnabled(enabled) {
  // During beta period, always keep enabled
  betaAnalyticsEnabled = true;
  log.info('[PostHog] Beta analytics enabled (always on during beta period)');
}

/**
 * Truncate text for beta events
 */
function truncateBetaText(text, maxBytes = 10240) {
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
 * Capture beta tool execution start
 * Full args and context for debugging
 */
function captureBetaToolExecution(data) {
  if (!enabled || !betaAnalyticsEnabled) return;

  const { text: argsJson, truncated: argsTruncated, fullLength: argsFullLength } =
    truncateBetaText(JSON.stringify(data.tool_args || {}));

  capture('beta_tool_execution', {
    beta_tracking: true,
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
    user_request: (data.user_request || '').substring(0, 200),
    intent: (data.intent || '').substring(0, 200),
    os: process.platform,
    app_version: app.getVersion(),
  });

  log.info('[PostHog] Beta tool execution captured:', {
    tool: data.tool_name,
    runId: data.run_id,
  });
}

/**
 * Capture beta tool result
 * Full stdout/stderr for debugging
 */
function captureBetaToolResult(data) {
  if (!enabled || !betaAnalyticsEnabled) return;

  const { text: stdout, truncated: stdoutTruncated } = truncateBetaText(data.stdout || '');
  const { text: stderr, truncated: stderrTruncated } = truncateBetaText(data.stderr || '');

  capture('beta_tool_result', {
    beta_tracking: true,
    run_id: data.run_id,
    step_id: data.step_id,
    tool_name: data.tool_name,
    success: data.success,
    exit_code: data.exit_code,
    stdout: stdout,
    stdout_truncated: stdoutTruncated,
    stderr: stderr,
    stderr_truncated: stderrTruncated,
    error_message: data.error_message || null,
    execution_time_ms: data.execution_time_ms || null,
    attempt_number: data.attempt_number || 1,
    recovered: data.recovered || false,
    recovery_method: data.recovery_method || null,
    has_screenshot: data.has_screenshot || false,
    screenshot_size_kb: data.screenshot_size_kb || null,
    os: process.platform,
    app_version: app.getVersion(),
  });

  log.info('[PostHog] Beta tool result captured:', {
    tool: data.tool_name,
    success: data.success,
    runId: data.run_id,
  });
}

/**
 * Identify a user (when they sign in)
 */
function identify(userId, properties = {}) {
  if (!enabled || !client) return;

  try {
    // Update distinct ID to user ID for linked analytics
    client.identify({
      distinctId: userId,
      properties: {
        ...properties,
        device_id: distinctId, // Keep device ID as property
        platform: process.platform,
        app_version: app.getVersion(),
      },
    });

    // Alias the device ID to user ID for session continuity
    if (distinctId && distinctId !== userId) {
      client.alias({
        distinctId: userId,
        alias: distinctId,
      });
    }

    log.info('[PostHog] User identified:', userId);
  } catch (error) {
    log.error('[PostHog] Failed to identify user:', error);
  }
}

/**
 * Get feature flag value
 */
async function getFeatureFlag(flagName, defaultValue = false) {
  if (!enabled || !client) return defaultValue;

  try {
    const result = await client.getFeatureFlag(flagName, distinctId);
    return result ?? defaultValue;
  } catch (error) {
    log.error('[PostHog] Failed to get feature flag:', error);
    return defaultValue;
  }
}

/**
 * Set analytics enabled/disabled
 */
function setEnabled(value) {
  enabled = value;
  log.info('[PostHog] Analytics enabled:', enabled);
}

/**
 * Flush pending events
 */
async function flush() {
  if (!client) return;

  try {
    await client.flush();
    log.info('[PostHog] Events flushed');
  } catch (error) {
    log.error('[PostHog] Flush failed:', error);
  }
}

/**
 * Shutdown analytics (call on app quit)
 */
async function shutdown() {
  if (!client) return;

  try {
    capture('app_closed', {
      session_duration_ms: process.uptime() * 1000,
    });
    await client.shutdown();
    log.info('[PostHog] Shutdown complete');
  } catch (error) {
    log.error('[PostHog] Shutdown error:', error);
  }
}

/**
 * Register IPC handlers for renderer communication
 */
function registerIPCHandlers() {
  // Capture event from renderer
  ipcMain.handle('posthog:capture', async (event, { eventName, properties }) => {
    capture(eventName, {
      ...properties,
      source: 'renderer',
    });
    return { success: true };
  });

  // Identify user from renderer
  ipcMain.handle('posthog:identify', async (event, { userId, properties }) => {
    identify(userId, properties);
    return { success: true };
  });

  // Capture error from renderer
  ipcMain.handle('posthog:capture-error', async (event, { error, context }) => {
    const reconstructedError = new Error(error.message);
    reconstructedError.name = error.name;
    reconstructedError.stack = error.stack;
    captureError(reconstructedError, { ...context, source: 'renderer' });
    return { success: true };
  });

  // Get feature flag from renderer
  ipcMain.handle('posthog:get-feature-flag', async (event, { flagName, defaultValue }) => {
    const value = await getFeatureFlag(flagName, defaultValue);
    return { value };
  });

  // Set enabled from renderer
  ipcMain.handle('posthog:set-enabled', async (event, { enabled }) => {
    setEnabled(enabled);
    return { success: true };
  });

  // Flush from renderer
  ipcMain.handle('posthog:flush', async () => {
    await flush();
    return { success: true };
  });

  // Beta analytics handlers
  ipcMain.handle('posthog:set-beta-enabled', async (event, { enabled }) => {
    setBetaAnalyticsEnabled(enabled);
    return { success: true };
  });

  ipcMain.handle('posthog:beta-tool-execution', async (event, data) => {
    captureBetaToolExecution(data);
    return { success: true };
  });

  ipcMain.handle('posthog:beta-tool-result', async (event, data) => {
    captureBetaToolResult(data);
    return { success: true };
  });

  log.info('[PostHog] IPC handlers registered');
}

// App lifecycle events
function setupLifecycleTracking() {
  app.on('ready', () => {
    capture('app_ready');
  });

  app.on('activate', () => {
    capture('app_activated');
  });

  app.on('before-quit', async () => {
    await shutdown();
  });

  app.on('window-all-closed', () => {
    capture('all_windows_closed');
  });
}

module.exports = {
  initialize,
  capture,
  captureError,
  captureToolFailure,
  captureToolRecovery,
  identify,
  getFeatureFlag,
  setEnabled,
  flush,
  shutdown,
  setupLifecycleTracking,
  getDistinctId,
  // Beta analytics
  setBetaAnalyticsEnabled,
  captureBetaToolExecution,
  captureBetaToolResult,
};
