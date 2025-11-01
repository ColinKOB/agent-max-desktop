/**
 * Telemetry Service
 * Sends user interactions and errors to central server for debugging
 * Non-blocking, privacy-respecting, opt-in system
 */

import axios from 'axios';

const globalWindow = typeof window !== 'undefined' ? window : undefined;

// Simple UUID generator (no external dependency)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const TELEMETRY_API = import.meta.env.VITE_TELEMETRY_API || 'http://localhost:8000';
const TELEMETRY_ENABLED =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('telemetry_enabled') !== 'false'
    : true; // Opt-in by default
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 5000; // 5 seconds

class TelemetryService {
  constructor() {
    this.enabled = TELEMETRY_ENABLED;
    this.userId = this.getUserId();
    this.sessionId = generateUUID();
    this.batch = [];
    this.apiKey =
      import.meta.env.VITE_TELEMETRY_API_KEY ||
      import.meta.env.VITE_API_KEY ||
      'dev-key';
    this.bridge = this.resolveBridge();
    this.bridgeAvailable = Boolean(this.bridge);
    this.bootstrapPromise = this.bootstrapFromElectron();

    if (this.enabled && !this.bridgeAvailable) {
      this.startBatchSender();
    }

    if (this.bootstrapPromise) {
      this.bootstrapPromise
        .then((bootstrap) => {
          if (!bootstrap) return;

          if (typeof bootstrap.enabled === 'boolean') {
            this.enabled = bootstrap.enabled;
          }
          if (bootstrap.userId) {
            this.userId = bootstrap.userId;
          }
          if (bootstrap.sessionId) {
            this.sessionId = bootstrap.sessionId;
          }

          this.bridge = this.resolveBridge();
          this.bridgeAvailable = Boolean(this.bridge);

          if (this.bridgeAvailable && this.batchInterval) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
          }

          if (this.enabled && !this.bridgeAvailable && !this.batchInterval) {
            this.startBatchSender();
          }

          this.logEvent('renderer.bootstrap', {
            sessionId: this.sessionId,
            bridge: this.bridgeAvailable ? 'electron-ipc' : 'direct-http',
            endpoint: bootstrap.endpoint,
            environment: bootstrap.environment,
            install: bootstrap.install,
          });
        })
        .catch(() => {
          // Ignore bootstrap errors; fall back to legacy behaviour
        });
    }
  }

  resolveBridge() {
    if (!globalWindow) return null;

    if (
      globalWindow.telemetry &&
      typeof globalWindow.telemetry.record === 'function'
    ) {
      return globalWindow.telemetry;
    }

    if (
      globalWindow.electron &&
      globalWindow.electron.telemetry &&
      typeof globalWindow.electron.telemetry.record === 'function'
    ) {
      return globalWindow.electron.telemetry;
    }

    return null;
  }

  async bootstrapFromElectron() {
    const bridge = this.resolveBridge();
    if (!bridge || typeof bridge.getBootstrap !== 'function') {
      return null;
    }

    try {
      const bootstrap = await bridge.getBootstrap();
      if (bootstrap) {
        this.bridge = bridge;
        this.bridgeAvailable = true;
        return bootstrap;
      }
    } catch (error) {
      // Ignore bootstrap errors; legacy mode will continue
    }
    return null;
  }

  /**
   * Get or create anonymized user ID
   */
  getUserId() {
    if (typeof localStorage === 'undefined') {
      return `user_${generateUUID()}`;
    }
    let userId = localStorage.getItem('telemetry_user_id');
    if (!userId) {
      userId = `user_${generateUUID()}`;
      localStorage.setItem('telemetry_user_id', userId);
    }
    return userId;
  }

  /**
   * Enable or disable telemetry
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('telemetry_enabled', enabled.toString());
    }

    if (this.bridgeAvailable && this.bridge && typeof this.bridge.setEnabled === 'function') {
      this.bridge
        .setEnabled(enabled)
        .catch(() => {
          // Ignore IPC failures - renderer state is authoritative fallback
        });
    }

    if (enabled && !this.batchInterval && !this.bridgeAvailable) {
      this.startBatchSender();
    } else if (!enabled && this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Log user interaction with AI
   * @param {Object} data - Interaction data
   * @param {string} data.userPrompt - What the user asked
   * @param {string} data.aiResponse - What the AI responded
   * @param {string} data.aiThoughts - AI's internal reasoning
   * @param {Array} data.toolsUsed - Tools that were called
   * @param {boolean} data.success - Whether it succeeded
   * @param {number} data.executionTime - Time in milliseconds
   * @param {string} data.model - AI model used
   */
  logInteraction(data) {
    if (!this.enabled) return;

    const event = {
      type: 'interaction',
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      appVersion: window.electron?.getAppVersion ? 'desktop' : 'web',
      platform: navigator.platform,
      ...data,
      metadata: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        ...data.metadata,
      },
    };

    this.addToBatch(event);
  }

  /**
   * Log error
   * @param {Object} error - Error object
   * @param {Object} context - Additional context
   */
  logError(error, context = {}) {
    if (!this.enabled) return;

    const event = {
      type: 'error',
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      errorType: error.name || 'Error',
      errorMessage: error.message,
      stackTrace: error.stack,
      severity: context.severity || 'error',
      context: {
        ...context,
        url: window.location?.href,
        userAgent: navigator.userAgent,
      },
    };

    this.addToBatch(event);

    // Send critical errors immediately
    if (context.severity === 'critical') {
      this.sendBatch();
    }
  }

  /**
   * Log performance metric
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   * @param {string} unit - Unit (ms, MB, etc.)
   */
  logPerformance(metric, value, unit = 'ms') {
    if (!this.enabled) return;

    const event = {
      type: 'performance',
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      metric,
      value,
      unit,
    };

    this.addToBatch(event);
  }

  /**
   * Log custom event
   * @param {string} eventName - Event name
   * @param {Object} properties - Event properties
   */
  logEvent(eventName, properties = {}) {
    if (!this.enabled) return;

    const event = {
      type: 'custom_event',
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      eventName,
      properties,
    };

    this.addToBatch(event);
  }

  /**
   * Add event to batch
   */
  addToBatch(event) {
    if (
      this.bridgeAvailable &&
      this.bridge &&
      typeof this.bridge.record === 'function'
    ) {
      // Route through main-process broker
      try {
        const result = this.bridge.record(event);
        if (result && typeof result.catch === 'function') {
          result.catch(() => {
            this.batch.push(event);
          });
        }
      } catch (error) {
        // Fall back to local queue if IPC fails
        this.batch.push(event);
      }
      return;
    }

    this.batch.push(event);

    // Send immediately if batch is full
    if (this.batch.length >= BATCH_SIZE) {
      this.sendBatch();
    }
  }

  /**
   * Send batch to server (async, non-blocking)
   */
  async sendBatch() {
    if (
      this.bridgeAvailable &&
      this.bridge &&
      typeof this.bridge.record === 'function'
    ) {
      if (this.batch.length === 0) return;

      const eventsToSend = [...this.batch];
      this.batch = [];

      try {
        await this.bridge.record(eventsToSend);
      } catch (error) {
        // If IPC fails, restore events to local queue for retry
        this.batch = [...eventsToSend, ...this.batch];
      }
      return;
    }

    if (this.batch.length === 0) return;

    const eventsToSend = [...this.batch];
    this.batch = [];

    try {
      // Fire and forget - don't wait for response
      axios
        .put(
          `${TELEMETRY_API}/api/telemetry/batch`,
          {
            events: eventsToSend,
          },
          {
            headers: {
              'X-API-Key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 5000, // 5 second timeout
            validateStatus: (status) => {
              // Accept any status code - we don't want to throw on 401/500
              return true;
            },
          }
        )
        .catch(() => {
          // Silently fail - don't interrupt user experience
          // Don't log to avoid console spam in development
        });
    } catch (error) {
      // Silently fail - telemetry is optional
    }
  }

  /**
   * Start batch sender interval
   */
  startBatchSender() {
    if (this.batchInterval) {
      return;
    }

    this.batchInterval = setInterval(() => {
      this.sendBatch();
    }, BATCH_INTERVAL);

    if (this.batchInterval && typeof this.batchInterval.unref === 'function') {
      this.batchInterval.unref();
    }
  }

  /**
   * Force send all pending events
   */
  flush() {
    if (
      this.bridgeAvailable &&
      this.bridge &&
      typeof this.bridge.record === 'function'
    ) {
      if (this.batch.length > 0) {
        const eventsToSend = [...this.batch];
        this.batch = [];
        try {
          const result = this.bridge.record(eventsToSend);
          if (result && typeof result.catch === 'function') {
            result.catch(() => {
              this.batch = [...eventsToSend, ...this.batch];
            });
          }
        } catch (error) {
          this.batch = [...eventsToSend, ...this.batch];
        }
      }

      if (typeof this.bridge.flush === 'function') {
        try {
          return this.bridge.flush();
        } catch (error) {
          // Ignore flush errors; renderer queue already handled
        }
      }
      return Promise.resolve();
    }

    return this.sendBatch();
  }

  /**
   * Clear all telemetry data
   */
  clearData() {
    this.batch = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('telemetry_user_id');
    }
    this.userId = this.getUserId();
  }
}

// Singleton instance
const telemetry = new TelemetryService();

// Auto-flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    telemetry.flush();
  });
}

export default telemetry;
