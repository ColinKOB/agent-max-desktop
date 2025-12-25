/**
 * Virtual Display Module for Agent Max Workspace
 *
 * Provides an isolated virtual display where the AI can operate
 * without hijacking the user's mouse and keyboard.
 *
 * Usage:
 *   const workspace = require('./native/macos');
 *
 *   // Create workspace
 *   const { displayId } = workspace.create(1920, 1080);
 *
 *   // Capture frame
 *   const base64png = workspace.captureFrame();
 *
 *   // Send input
 *   workspace.mouseClick(500, 300);
 *   workspace.typeText('Hello world');
 *
 *   // Destroy workspace
 *   workspace.destroy();
 */

const path = require('path');
const os = require('os');

// Check if we're on macOS
const isMacOS = os.platform() === 'darwin';

// Check macOS version (need 12.0+)
function getMacOSVersion() {
  if (!isMacOS) return null;
  const release = os.release().split('.');
  // macOS 12 (Monterey) = Darwin 21.x
  const darwinMajor = parseInt(release[0], 10);
  return darwinMajor >= 21 ? darwinMajor - 9 : null;  // Darwin 21 = macOS 12
}

const macOSVersion = getMacOSVersion();
const isSupported = isMacOS && macOSVersion && macOSVersion >= 12;

// Try to load native addon
let addon = null;
let loadError = null;

if (isSupported) {
  try {
    // Try loading from build directory
    const addonPath = path.join(__dirname, 'build', 'Release', 'virtual_display.node');
    addon = require(addonPath);
  } catch (err) {
    loadError = err;
    // Only warn in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[VirtualDisplay] Native addon not built yet. Virtual workspace will be unavailable.');
      console.warn('[VirtualDisplay] To build: cd native/macos && ./build.sh');
    }
  }
}

// Stub implementation for when addon is not available
const stub = {
  _active: false,
  _displayId: 0,
  isSupported: () => false,
  create: () => ({ success: false, displayId: 0 }),
  destroy: () => false,
  isActive: () => false,
  getDisplayId: () => 0,
  captureFrame: () => null,
  mouseMove: () => false,
  mouseClick: () => false,
  doubleClick: () => false,
  rightClick: () => false,
  mouseDown: () => false,
  mouseUp: () => false,
  scroll: () => false,
  keyPress: () => false,
  keyDown: () => false,
  keyUp: () => false,
  typeText: () => false,
  shortcut: () => false,
  moveWindow: () => false,
  launchApp: () => false
};

// Use addon if available, otherwise use stub
const impl = addon || stub;

// Export wrapper with fallback behavior
module.exports = {
  /**
   * Check if virtual display is supported on this system
   */
  isSupported: () => isSupported && addon !== null,

  /**
   * Check if the system could support virtual display (even if not built)
   */
  isPotentiallySupported: () => isSupported,

  /**
   * Get load error if addon failed to load
   */
  getLoadError: () => loadError,

  /**
   * Create a virtual display
   * @param {number} width - Display width (default: 1920)
   * @param {number} height - Display height (default: 1080)
   * @returns {{ success: boolean, displayId: number }}
   */
  create: (width = 1920, height = 1080) => {
    if (!addon) {
      // Return a clear message about why it's not working
      return { success: false, displayId: 0, error: 'Native module not built' };
    }
    return addon.create(width, height);
  },

  /**
   * Destroy the virtual display
   * @returns {boolean}
   */
  destroy: () => {
    if (!addon) return false;
    return addon.destroy();
  },

  /**
   * Check if workspace is active
   * @returns {boolean}
   */
  isActive: () => {
    if (!addon) return false;
    return addon.isActive();
  },

  /**
   * Get the display ID
   * @returns {number}
   */
  getDisplayId: () => {
    if (!addon) return 0;
    return addon.getDisplayId();
  },

  /**
   * Capture current frame as base64 PNG
   * @returns {string|null}
   */
  captureFrame: () => {
    if (!addon) return null;
    return addon.captureFrame();
  },

  /**
   * Move mouse to position
   * @param {number} x
   * @param {number} y
   */
  mouseMove: (x, y) => {
    if (!addon) return false;
    return addon.mouseMove(x, y);
  },

  /**
   * Click at position
   * @param {number} x
   * @param {number} y
   * @param {'left'|'right'} button
   * @param {number} clickCount - 1 for single click, 2 for double click
   */
  mouseClick: (x, y, button = 'left', clickCount = 1) => {
    if (!addon) return false;
    return addon.mouseClick(x, y, button, clickCount);
  },

  /**
   * Double click at position
   * @param {number} x
   * @param {number} y
   */
  doubleClick: (x, y) => {
    if (!addon) return false;
    return addon.mouseClick(x, y, 'left', 2);
  },

  /**
   * Right click at position
   * @param {number} x
   * @param {number} y
   */
  rightClick: (x, y) => {
    if (!addon) return false;
    return addon.mouseClick(x, y, 'right', 1);
  },

  /**
   * Mouse down at position
   * @param {number} x
   * @param {number} y
   * @param {'left'|'right'} button
   */
  mouseDown: (x, y, button = 'left') => {
    if (!addon) return false;
    return addon.mouseDown(x, y, button);
  },

  /**
   * Mouse up at position
   * @param {number} x
   * @param {number} y
   * @param {'left'|'right'} button
   */
  mouseUp: (x, y, button = 'left') => {
    if (!addon) return false;
    return addon.mouseUp(x, y, button);
  },

  /**
   * Scroll
   * @param {number} deltaY - Vertical scroll amount (positive = down)
   * @param {number} deltaX - Horizontal scroll amount (positive = right)
   */
  scroll: (deltaY, deltaX = 0) => {
    if (!addon) return false;
    return addon.scroll(deltaY, deltaX);
  },

  /**
   * Press a key (down + up)
   * @param {number} keyCode - macOS key code
   */
  keyPress: (keyCode) => {
    if (!addon) return false;
    return addon.keyPress(keyCode);
  },

  /**
   * Key down
   * @param {number} keyCode
   */
  keyDown: (keyCode) => {
    if (!addon) return false;
    return addon.keyDown(keyCode);
  },

  /**
   * Key up
   * @param {number} keyCode
   */
  keyUp: (keyCode) => {
    if (!addon) return false;
    return addon.keyUp(keyCode);
  },

  /**
   * Type a string of text
   * @param {string} text
   */
  typeText: (text) => {
    if (!addon) return false;
    return addon.typeText(text);
  },

  /**
   * Send a keyboard shortcut
   * @param {string[]} modifiers - ['cmd'], ['cmd', 'shift'], etc.
   * @param {number} keyCode
   */
  shortcut: (modifiers, keyCode) => {
    if (!addon) return false;
    return addon.shortcut(modifiers, keyCode);
  },

  /**
   * Move an application window to the workspace
   * @param {string} bundleIdentifier - e.g., 'com.apple.Safari'
   * @returns {boolean}
   */
  moveWindow: (bundleIdentifier) => {
    if (!addon) return false;
    return addon.moveWindow(bundleIdentifier);
  },

  /**
   * Launch an application on the workspace
   * @param {string} bundleIdentifier
   * @returns {boolean}
   */
  launchApp: (bundleIdentifier) => {
    if (!addon) return false;
    return addon.launchApp(bundleIdentifier);
  },

  /**
   * Common key codes for convenience
   */
  KeyCodes: {
    RETURN: 0x24,
    TAB: 0x30,
    SPACE: 0x31,
    DELETE: 0x33,
    ESCAPE: 0x35,
    COMMAND: 0x37,
    SHIFT: 0x38,
    OPTION: 0x3A,
    CONTROL: 0x3B,
    LEFT_ARROW: 0x7B,
    RIGHT_ARROW: 0x7C,
    DOWN_ARROW: 0x7D,
    UP_ARROW: 0x7E,
    F1: 0x7A,
    F2: 0x78,
    F3: 0x63,
    F4: 0x76,
    F5: 0x60,
    // Letters
    A: 0x00, B: 0x0B, C: 0x08, D: 0x02, E: 0x0E, F: 0x03,
    G: 0x05, H: 0x04, I: 0x22, J: 0x26, K: 0x28, L: 0x25,
    M: 0x2E, N: 0x2D, O: 0x1F, P: 0x23, Q: 0x0C, R: 0x0F,
    S: 0x01, T: 0x11, U: 0x20, V: 0x09, W: 0x0D, X: 0x07,
    Y: 0x10, Z: 0x06
  }
};
