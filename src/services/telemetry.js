/**
 * Telemetry Service
 * Sends user interactions and errors to central server for debugging
 * Non-blocking, privacy-respecting, opt-in system
 */

import axios from 'axios';

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
    this.apiKey = import.meta.env.VITE_TELEMETRY_API_KEY || 'dev-key';

    // Start batch sender
    if (this.enabled) {
      this.startBatchSender();
    }
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

    if (enabled && !this.batchInterval) {
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
    if (this.batch.length === 0) return;

    const eventsToSend = [...this.batch];
    this.batch = [];

    try {
      // Fire and forget - don't wait for response
      axios
        .post(
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
    this.batchInterval = setInterval(() => {
      this.sendBatch();
    }, BATCH_INTERVAL);
  }

  /**
   * Force send all pending events
   */
  flush() {
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
