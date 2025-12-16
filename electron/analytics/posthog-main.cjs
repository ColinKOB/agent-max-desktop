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

  const apiKey = process.env.VITE_POSTHOG_KEY || process.env.POSTHOG_KEY;
  const host = process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    log.info('[PostHog] No API key configured - analytics disabled');
    enabled = false;
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

    // Register IPC handlers
    registerIPCHandlers();

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
  identify,
  getFeatureFlag,
  setEnabled,
  flush,
  shutdown,
  setupLifecycleTracking,
  getDistinctId,
};
