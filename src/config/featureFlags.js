/**
 * Feature Flags — Glass UI Rollout
 * 
 * Centralized feature flag management for controlled rollout of liquid glass UI.
 * Supports environment variables with runtime overrides for development.
 * 
 * @module featureFlags
 */

/**
 * Parse environment variable as boolean
 * @param {string} key - Environment variable name
 * @param {boolean} defaultValue - Default if not set
 * @returns {boolean}
 */
const getEnvValue = (key) => {
  // Prefer process.env when available (main process / preload)
  if (typeof process !== 'undefined' && process?.env && key in process.env) {
    return process.env[key];
  }

  // Fallback to Vite-style import.meta.env (renderer)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (key in import.meta.env) {
      return import.meta.env[key];
    }

    const viteKey = `VITE_${key}`;
    if (viteKey in import.meta.env) {
      return import.meta.env[viteKey];
    }
  }

  return undefined;
};

const getEnvFlag = (key, defaultValue = false) => {
  const value = getEnvValue(key);
  if (value === undefined) return defaultValue;

  if (typeof value === 'boolean') {
    return value;
  }

  return value === '1' || value === 'true';
};

const getEnvMode = () => {
  const fromProcess = typeof process !== 'undefined' ? process?.env?.NODE_ENV : undefined;
  if (fromProcess) return fromProcess;

  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE) {
    return import.meta.env.MODE;
  }

  return undefined;
};

const isDevelopmentMode = () => getEnvMode() === 'development';

/**
 * Feature Flags Configuration
 */
const flags = {
  /**
   * Master switch for all glass UI features
   * @type {boolean}
   */
  GLASS_UI_ENABLED: getEnvFlag('GLASS_UI_ENABLED', false),

  /**
   * Enable glass styling for Settings app sections
   * Rolled out incrementally per section
   * @type {boolean}
   */
  GLASS_SETTINGS: getEnvFlag('GLASS_SETTINGS', false),

  /**
   * Enable glass styling for ProfileCard component
   * @type {boolean}
   */
  GLASS_PROFILE_CARD: getEnvFlag('GLASS_PROFILE_CARD', false),

  /**
   * Enable glass styling for AgentDashboard
   * @type {boolean}
   */
  GLASS_AGENT_DASHBOARD: getEnvFlag('GLASS_AGENT_DASHBOARD', false),

  /**
   * Emergency escape hatch: Force opaque fallback for all components
   * Overrides all glass flags for production hotfixes
   * @type {boolean}
   */
  GLASS_FORCE_OPAQUE: getEnvFlag('GLASS_FORCE_OPAQUE', false),

  /**
   * Development: Show feature flag toggle UI in settings
   * @type {boolean}
   */
  GLASS_DEV_TOGGLE: getEnvFlag('GLASS_DEV_TOGGLE', isDevelopmentMode()),
};

/**
 * Runtime flag state (allows dev overrides)
 */
let runtimeFlags = { ...flags };

/**
 * Check if a glass feature is enabled
 * Respects GLASS_FORCE_OPAQUE override
 * 
 * @param {string} feature - Feature flag name (e.g., 'GLASS_SETTINGS')
 * @returns {boolean}
 */
export function isGlassEnabled(feature) {
  // Emergency override: force all glass off
  if (runtimeFlags.GLASS_FORCE_OPAQUE) {
    return false;
  }

  // Master switch: if glass UI disabled globally, return false
  if (!runtimeFlags.GLASS_UI_ENABLED && feature !== 'GLASS_UI_ENABLED') {
    return false;
  }

  return runtimeFlags[feature] ?? false;
}

/**
 * Set a feature flag at runtime (dev mode only)
 * @param {string} feature - Feature flag name
 * @param {boolean} value - New value
 */
export function setGlassFlag(feature, value) {
  if (!isDevelopmentMode()) {
    console.warn('[FeatureFlags] Runtime flag changes only allowed in development');
    return;
  }
  runtimeFlags[feature] = value;
  console.log(`[FeatureFlags] ${feature} = ${value}`);
}

/**
 * Get all current flag values
 * @returns {Object}
 */
export function getAllFlags() {
  return { ...runtimeFlags };
}

/**
 * Reset flags to environment defaults
 */
export function resetFlags() {
  runtimeFlags = { ...flags };
}

/**
 * Get CSS class name based on flag state
 * Returns glass class if enabled, fallback otherwise
 * 
 * @param {string} feature - Feature flag name
 * @param {string} glassClass - Class to use if enabled
 * @param {string} fallbackClass - Class to use if disabled
 * @returns {string}
 */
export function getGlassClass(feature, glassClass, fallbackClass = '') {
  return isGlassEnabled(feature) ? glassClass : fallbackClass;
}

// Export flags for direct access if needed
export { flags };

// Log flag state on load (dev only)
if (isDevelopmentMode()) {
  console.group('[FeatureFlags] Glass UI Configuration');
  console.table(runtimeFlags);
  console.groupEnd();
}
