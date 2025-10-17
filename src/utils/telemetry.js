/**
 * Telemetry — Glass UI Metrics
 * 
 * Lightweight event logging for glass UI performance monitoring.
 * Tracks blur layers, frame times, and platform transparency support.
 */

/**
 * Log glass UI render event
 * @param {string} component - Component name (e.g., 'Settings', 'ProfileCard')
 * @param {string} section - Section name (e.g., 'Appearance', 'API')
 * @param {Object} metrics - Performance metrics
 * @param {number} metrics.blurLayers - Number of blur layers in viewport
 * @param {number} [metrics.avgFrameMs] - Average frame time in ms
 */
export function logGlassRendered(component, section, metrics = {}) {
  const event = {
    event: 'ui.glass.rendered',
    timestamp: Date.now(),
    context: {
      component,
      section,
      os: getOS(),
      transparencyEnabled: checkTransparencySupport(),
      blurLayers: metrics.blurLayers || 0,
      avgFrameMs: metrics.avgFrameMs || 0,
      flagState: getFeatureFlagState(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Telemetry]', event);
  }

  // TODO: Wire to actual logging backend (Sentry, PostHog, etc.)
  // Example: Sentry.captureEvent(event);

  return event;
}

/**
 * Get OS platform
 * @returns {string}
 */
function getOS() {
  if (typeof window.electron !== 'undefined') {
    return window.electron.process?.platform || 'unknown';
  }
  
  // Fallback to user agent parsing
  const ua = navigator.userAgent;
  if (ua.includes('Mac')) return 'darwin';
  if (ua.includes('Win')) return 'win32';
  if (ua.includes('Linux')) return 'linux';
  return 'unknown';
}

/**
 * Check if transparency is supported/enabled
 * @returns {boolean}
 */
function checkTransparencySupport() {
  // Check for reduced transparency preference
  if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) {
    return false;
  }

  // Check for backdrop-filter support
  const testEl = document.createElement('div');
  testEl.style.backdropFilter = 'blur(1px)';
  const supported = testEl.style.backdropFilter === 'blur(1px)';

  return supported;
}

/**
 * Get current feature flag state
 * @returns {Object}
 */
function getFeatureFlagState() {
  try {
    // Dynamically import to avoid circular deps
    const flags = require('../config/featureFlags');
    return flags.getAllFlags?.() || {};
  } catch (err) {
    return {};
  }
}

/**
 * Measure frame time (simple approximation)
 * @param {Function} callback - Called with avg frame time in ms
 */
export function measureFrameTime(callback) {
  let frameCount = 0;
  let totalTime = 0;
  const startTime = performance.now();
  const duration = 1000; // Measure for 1 second

  function measureFrame(timestamp) {
    frameCount++;
    const elapsed = timestamp - startTime;

    if (elapsed < duration) {
      requestAnimationFrame(measureFrame);
    } else {
      const avgFrameTime = elapsed / frameCount;
      callback(avgFrameTime);
    }
  }

  requestAnimationFrame(measureFrame);
}

/**
 * Count blur layers in viewport
 * @returns {number}
 */
export function countBlurLayers() {
  const elements = document.querySelectorAll('*');
  let blurCount = 0;

  elements.forEach((el) => {
    const style = window.getComputedStyle(el);
    const backdropFilter = style.backdropFilter || style.webkitBackdropFilter;
    
    if (backdropFilter && backdropFilter !== 'none') {
      // Check if element is in viewport
      const rect = el.getBoundingClientRect();
      const inViewport =
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0;

      if (inViewport) {
        blurCount++;
      }
    }
  });

  return blurCount;
}
