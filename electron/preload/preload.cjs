const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Desktop Features
  showNotification: (data) => ipcRenderer.invoke('show-notification', data),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', { width, height }),
  switchToFloatbar: () => ipcRenderer.invoke('switch-to-floatbar'),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  showCardWindow: () => ipcRenderer.invoke('window:show-card'),
  showPillWindow: () => ipcRenderer.invoke('window:show-pill'),
  executeCommand: (command) => ipcRenderer.invoke('execute-command', { command }),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  getBounds: () => ipcRenderer.invoke('get-bounds'),
  setBounds: (bounds) => ipcRenderer.invoke('set-bounds', bounds),
  // Subscribe to manual-resize notifications from main
  onUserResized: (callback) => {
    try {
      if (typeof callback === 'function') {
        ipcRenderer.on('window:user-resized', (_evt, payload) => {
          try { callback(payload); } catch {}
        });
      }
    } catch {}
  },

  // Open URL in external browser
  openExternal: (url) => ipcRenderer.invoke('open-external', { url }),

  // Open Settings window
  openSettings: (opts) => ipcRenderer.invoke('open-settings', opts || {}),
  
  // Open Test Window (for debugging)
  openTestWindow: () => ipcRenderer.invoke('open-test-window'),
  
  // Open native file dialog (opens as separate window, not attached to card)
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options || {}),

  // Memory management functions
  memory: {
    // Profile
    getProfile: () => ipcRenderer.invoke('memory:get-profile'),
    updateProfile: (updates) => ipcRenderer.invoke('memory:update-profile', updates),
    setName: (name) => ipcRenderer.invoke('memory:set-name', { name }),
    incrementInteraction: () => ipcRenderer.invoke('memory:increment-interaction'),

    // Facts
    getFacts: () => ipcRenderer.invoke('memory:get-facts'),
    setFact: (category, key, value) =>
      ipcRenderer.invoke('memory:set-fact', { category, key, value }),
    deleteFact: (category, key) => ipcRenderer.invoke('memory:delete-fact', { category, key }),

    // Conversations
    startSession: (sessionId) => ipcRenderer.invoke('memory:start-session', sessionId),
    addMessage: (role, content, sessionId) =>
      ipcRenderer.invoke('memory:add-message', { role, content, sessionId }),
    getRecentMessages: (count, sessionId) =>
      ipcRenderer.invoke('memory:get-recent-messages', { count, sessionId }),
    getAllSessions: () => ipcRenderer.invoke('memory:get-all-sessions'),
    getSessionById: (sessionId) => ipcRenderer.invoke('memory:get-session-by-id', sessionId),
    clearSession: (sessionId) => ipcRenderer.invoke('memory:clear-session', sessionId),

    // Preferences
    getPreferences: () => ipcRenderer.invoke('memory:get-preferences'),
    setPreference: (key, value, type) =>
      ipcRenderer.invoke('memory:set-preference', { key, value, type }),
    getPreference: (key) => ipcRenderer.invoke('memory:get-preference', key),

    // Context building
    buildContext: () => ipcRenderer.invoke('memory:build-context'),

    // Import/Export
    export: () => ipcRenderer.invoke('memory:export'),
    import: (data) => ipcRenderer.invoke('memory:import', data),

    // Stats
    getStats: () => ipcRenderer.invoke('memory:get-stats'),
    getLocation: () => ipcRenderer.invoke('memory:get-location'),

    // Telemetry (legacy support)
    telemetry: {
      record: (eventOrType, data) => {
        if (typeof eventOrType === 'string') {
          return ipcRenderer.invoke('telemetry:record', {
            eventType: eventOrType,
            data,
            source: 'renderer-memory',
          });
        }
        return ipcRenderer.invoke('telemetry:record', eventOrType);
      },
      flush: () => ipcRenderer.invoke('telemetry:flush'),
    },

    // Autonomous execution
    autonomous: {
      execute: (stepId, action, policy) => 
        ipcRenderer.invoke('autonomous:execute', { stepId, action, policy }),
      getStatus: (conversationId) => 
        ipcRenderer.invoke('autonomous:getStatus', { conversationId }),
    },
  },

  // Hands on Desktop bridges
  handsOnDesktop: {
    executeRequest: (request) => ipcRenderer.invoke('hands-on-desktop:execute-request', request),
    toggle: (enabled) => ipcRenderer.invoke('hands-on-desktop:toggle', enabled),
    status: () => ipcRenderer.invoke('hands-on-desktop:status'),
  },
});

// Also expose as electronAPI for compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.invoke('open-external', { url }),
  openSettings: (opts) => ipcRenderer.invoke('open-settings', opts || {}),
  
  // ===========================================
  // ENTERPRISE UPDATE MANAGEMENT
  // ===========================================
  
  // Event listeners for update notifications
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, data) => {
      try { callback(data); } catch (e) { console.error('[Update] Available callback error:', e); }
    });
  },
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_event, data) => {
      try { callback(data); } catch (e) { console.error('[Update] Progress callback error:', e); }
    });
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, data) => {
      try { callback(data); } catch (e) { console.error('[Update] Downloaded callback error:', e); }
    });
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_event, data) => {
      try { callback(data); } catch (e) { console.error('[Update] Error callback error:', e); }
    });
  },
  // Audit event stream for telemetry
  onUpdateAuditEvent: (callback) => {
    ipcRenderer.on('update-audit-event', (_event, data) => {
      try { callback(data); } catch (e) { console.error('[Update] Audit callback error:', e); }
    });
  },
  
  // User-initiated actions (Enterprise: requires user consent)
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  deferUpdate: () => ipcRenderer.invoke('update:defer'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // Update status and configuration
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  setUpdateChannel: (channel) => ipcRenderer.invoke('update:set-channel', channel),
  getUpdateChannels: () => ipcRenderer.invoke('update:get-channels'),
  
  // Legacy compatibility aliases
  restartForUpdate: () => ipcRenderer.invoke('update:install'),
});

contextBridge.exposeInMainWorld('telemetry', {
  getBootstrap: () => ipcRenderer.invoke('telemetry:get-bootstrap'),
  setEnabled: (enabled) => ipcRenderer.invoke('telemetry:set-enabled', enabled),
  flush: () => ipcRenderer.invoke('telemetry:flush'),
  record: (eventOrType, data) => {
    if (typeof eventOrType === 'string') {
      return ipcRenderer.invoke('telemetry:record', {
        eventType: eventOrType,
        data,
        source: 'renderer',
      });
    }
    return ipcRenderer.invoke('telemetry:record', eventOrType);
  },
});

// PostHog analytics bridge for renderer (forwards to main process)
contextBridge.exposeInMainWorld('posthog', {
  capture: (eventName, properties) => {
    try {
      ipcRenderer.invoke('posthog:capture', { eventName, properties });
    } catch (e) {
      console.error('[PostHog Bridge] Failed to capture event:', e);
    }
  },
  identify: (userId, properties) => {
    try {
      ipcRenderer.invoke('posthog:identify', { userId, properties });
    } catch (e) {
      console.error('[PostHog Bridge] Failed to identify user:', e);
    }
  },
  captureError: (error, context) => {
    try {
      const serialized = {
        message: error?.message || String(error),
        name: error?.name || 'Error',
        stack: error?.stack,
      };
      ipcRenderer.invoke('posthog:capture-error', { error: serialized, context });
    } catch (e) {
      console.error('[PostHog Bridge] Failed to capture error:', e);
    }
  },
  getFeatureFlag: async (flagName, defaultValue) => {
    try {
      return await ipcRenderer.invoke('posthog:get-feature-flag', { flagName, defaultValue });
    } catch (e) {
      console.error('[PostHog Bridge] Failed to get feature flag:', e);
      return { value: defaultValue };
    }
  },
  setEnabled: (enabled) => {
    try {
      ipcRenderer.invoke('posthog:set-enabled', { enabled });
    } catch (e) {
      console.error('[PostHog Bridge] Failed to set enabled:', e);
    }
  },
  flush: async () => {
    try {
      await ipcRenderer.invoke('posthog:flush');
    } catch (e) {
      console.error('[PostHog Bridge] Failed to flush:', e);
    }
  },
});

// Legacy Sentry bridge for backwards compatibility (redirects to PostHog)
contextBridge.exposeInMainWorld('Sentry', {
  captureException: (error, context) => {
    try {
      const serialized = {
        message: error?.message || String(error),
        name: error?.name || 'Error',
        stack: error?.stack,
      };
      ipcRenderer.invoke('posthog:capture-error', { error: serialized, context });
    } catch (e) {
      console.error('[Sentry->PostHog Bridge] Failed to capture exception:', e);
    }
  },
  captureMessage: (message, level) => {
    try {
      ipcRenderer.invoke('posthog:capture', {
        eventName: 'sentry_message',
        properties: { message, level: level || 'info' }
      });
    } catch (e) {
      console.error('[Sentry->PostHog Bridge] Failed to capture message:', e);
    }
  },
  addBreadcrumb: () => {
    // No-op for backwards compatibility
  },
});

// Executor IPC bridge for pull-based execution (Phase 2)
contextBridge.exposeInMainWorld('executor', {
  createRun: (message, context, systemContext) =>
    ipcRenderer.invoke('autonomous:create-run', { message, context, systemContext }),
  abortRequest: () => ipcRenderer.invoke('autonomous:abort-request'), // Abort in-flight request
  startRun: (runId) => ipcRenderer.invoke('executor:start-run', runId),
  stopRun: (runId) => ipcRenderer.invoke('executor:stop-run', runId),
  stopAll: () => ipcRenderer.invoke('executor:stop-all'), // Emergency stop ALL runs
  getStatus: (runId) => ipcRenderer.invoke('executor:get-status', runId),
  getSystemContext: () => ipcRenderer.invoke('executor:get-system-context'),
  listActive: () => ipcRenderer.invoke('executor:list-active'),
  getStats: () => ipcRenderer.invoke('executor:get-stats'),
  setOnline: (isOnline) => ipcRenderer.invoke('executor:set-online', isOnline),
  cleanup: (olderThanDays) => ipcRenderer.invoke('executor:cleanup', olderThanDays),
  // Capture screen for auto-mode context (Feature: Productivity Screenshot)
  captureScreen: () => ipcRenderer.invoke('take-screenshot'),
  // Set user context (e.g., google_user_email for Gmail integration)
  setUserContext: (context) => ipcRenderer.invoke('pull-executor:set-context', context),
});

// macOS native tool execution bridge
contextBridge.exposeInMainWorld('macos', {
  // Execute a macOS AppleScript tool (notes.list, safari.navigate, etc.)
  executeTool: (tool, args) => ipcRenderer.invoke('execute-macos-tool', { tool, args }),
  // Check if a tool name is a macOS tool
  isMacOSTool: (tool) => ipcRenderer.invoke('is-macos-tool', tool),
  // Check if running on macOS
  isMacOS: () => ipcRenderer.invoke('is-macos'),
});

// AI ask_user tool - allows AI to ask user questions during execution
contextBridge.exposeInMainWorld('askUser', {
  // Listen for questions from the AI
  onQuestion: (callback) => {
    ipcRenderer.on('ask-user-question', (event, data) => callback(data));
  },
  // Send response back to the AI
  respond: (response) => ipcRenderer.invoke('ask-user-response', response),
  // Remove question listener
  removeListener: () => {
    ipcRenderer.removeAllListeners('ask-user-question');
  }
});

// ===========================================
// Workspace API - Isolated BrowserWindow for AI
// ===========================================
// Used for research/browsing tasks without hijacking user's mouse/keyboard
// The AI controls a separate Electron BrowserWindow, user sees it via PiP
contextBridge.exposeInMainWorld('workspace', {
  // Check if workspace is supported (always true - uses Electron BrowserWindow)
  isSupported: () => ipcRenderer.invoke('workspace:is-supported'),

  // Get current workspace status (active, url, title, windowId)
  getStatus: () => ipcRenderer.invoke('workspace:get-status'),

  // Create the AI workspace browser window
  // Returns { success: boolean, windowId?: number, error?: string }
  create: (width = 1280, height = 800) =>
    ipcRenderer.invoke('workspace:create', { width, height }),

  // Destroy the workspace browser window
  destroy: () => ipcRenderer.invoke('workspace:destroy'),

  // Check if workspace is currently active
  isActive: () => ipcRenderer.invoke('workspace:is-active'),

  // Get the window ID of the workspace
  getWindowId: () => ipcRenderer.invoke('workspace:get-window-id'),

  // Capture current frame as base64 PNG data URL
  captureFrame: () => ipcRenderer.invoke('workspace:capture-frame'),

  // Get last cached frame (faster, may be slightly stale)
  getFrame: () => ipcRenderer.invoke('workspace:get-frame'),

  // ===========================================
  // Navigation
  // ===========================================

  // Navigate to a URL
  navigate: (url) => ipcRenderer.invoke('workspace:navigate', { url }),

  // Go back in browser history
  back: () => ipcRenderer.invoke('workspace:back'),

  // Go forward in browser history
  forward: () => ipcRenderer.invoke('workspace:forward'),

  // Reload the current page
  reload: () => ipcRenderer.invoke('workspace:reload'),

  // Search Google (convenience method)
  search: (query) => ipcRenderer.invoke('workspace:search', { query }),

  // ===========================================
  // Input Actions
  // ===========================================

  // Click at coordinates
  click: (x, y, button = 'left', clickCount = 1) =>
    ipcRenderer.invoke('workspace:click', { x, y, button, clickCount }),

  // Double click at coordinates
  doubleClick: (x, y) =>
    ipcRenderer.invoke('workspace:double-click', { x, y }),

  // Right click at coordinates
  rightClick: (x, y) =>
    ipcRenderer.invoke('workspace:right-click', { x, y }),

  // Type text (types into currently focused element)
  type: (text) => ipcRenderer.invoke('workspace:type', { text }),

  // Press a key (with optional modifiers)
  pressKey: (key, modifiers = []) =>
    ipcRenderer.invoke('workspace:press-key', { key, modifiers }),

  // Scroll the page
  scroll: (deltaX = 0, deltaY = 0, x = null, y = null) =>
    ipcRenderer.invoke('workspace:scroll', { deltaX, deltaY, x, y }),

  // ===========================================
  // Element-based Actions (CSS selectors)
  // ===========================================

  // Click an element by CSS selector
  clickElement: (selector) =>
    ipcRenderer.invoke('workspace:click-element', { selector }),

  // Type into an element by CSS selector
  typeIntoElement: (selector, text) =>
    ipcRenderer.invoke('workspace:type-into-element', { selector, text }),

  // Find elements by CSS selector (returns array of element info)
  findElements: (selector) =>
    ipcRenderer.invoke('workspace:find-elements', { selector }),

  // ===========================================
  // Page Content Extraction
  // ===========================================

  // Get page text content
  getText: () => ipcRenderer.invoke('workspace:get-text'),

  // Get page HTML
  getHtml: () => ipcRenderer.invoke('workspace:get-html'),

  // Get all links on the page
  getLinks: () => ipcRenderer.invoke('workspace:get-links'),

  // Get all buttons on the page
  getButtons: () => ipcRenderer.invoke('workspace:get-buttons'),

  // Get all input fields on the page
  getInputs: () => ipcRenderer.invoke('workspace:get-inputs'),

  // Execute custom JavaScript in page context
  executeScript: (script) =>
    ipcRenderer.invoke('workspace:execute-script', { script }),

  // ===========================================
  // Window Management (Minimize/Restore)
  // ===========================================

  // Minimize the workspace (hides PiP but keeps browsing)
  minimize: () => ipcRenderer.invoke('workspace:minimize'),

  // Restore workspace from minimized state
  restore: () => ipcRenderer.invoke('workspace:restore'),

  // ===========================================
  // Activity Logging
  // ===========================================

  // Get activity log entries
  getActivityLog: (options = {}) =>
    ipcRenderer.invoke('workspace:get-activity-log', options),

  // Get list of sessions
  getSessions: () => ipcRenderer.invoke('workspace:get-sessions'),

  // Clear activity log
  clearActivityLog: () => ipcRenderer.invoke('workspace:clear-activity-log'),

  // ===========================================
  // Frame streaming for PiP viewer
  // ===========================================

  // Subscribe to frame updates (for real-time PiP)
  onFrame: (callback) => {
    ipcRenderer.on('workspace:frame', (_event, frame) => {
      try { callback(frame); } catch (e) { console.error('[Workspace] Frame callback error:', e); }
    });
  },

  // Unsubscribe from frame updates
  removeFrameListener: () => {
    ipcRenderer.removeAllListeners('workspace:frame');
  },

  // ===========================================
  // Common key codes (for pressKey)
  // ===========================================
  KeyCodes: {
    RETURN: 'Return',
    ENTER: 'Return',
    TAB: 'Tab',
    SPACE: 'Space',
    DELETE: 'Delete',
    BACKSPACE: 'Backspace',
    ESCAPE: 'Escape',
    LEFT: 'Left',
    RIGHT: 'Right',
    UP: 'Up',
    DOWN: 'Down',
  }
});

// ===========================================
// Spreadsheet API
// ===========================================
// Excel-like spreadsheet for data manipulation and analysis
// The AI controls a separate Electron BrowserWindow, user sees it via PiP
contextBridge.exposeInMainWorld('spreadsheet', {
  // Check if spreadsheet is active
  isActive: () => ipcRenderer.invoke('spreadsheet:is-active'),

  // Get current spreadsheet status
  getStatus: () => ipcRenderer.invoke('spreadsheet:get-status'),

  // Get detailed status with data summary (for AI context)
  getDetailedStatus: () => ipcRenderer.invoke('spreadsheet:get-detailed-status'),

  // Create the spreadsheet window
  create: (width = 1280, height = 800) =>
    ipcRenderer.invoke('spreadsheet:create', { width, height }),

  // Destroy the spreadsheet window
  destroy: () => ipcRenderer.invoke('spreadsheet:destroy'),

  // Minimize the spreadsheet
  minimize: () => ipcRenderer.invoke('spreadsheet:minimize'),

  // Restore the spreadsheet
  restore: () => ipcRenderer.invoke('spreadsheet:restore'),

  // Capture current frame as base64 PNG
  captureFrame: () => ipcRenderer.invoke('spreadsheet:capture-frame'),

  // ===========================================
  // Cell Operations
  // ===========================================

  readCell: (sheet, cell) =>
    ipcRenderer.invoke('spreadsheet:read-cell', { sheet, cell }),

  writeCell: (sheet, cell, value) =>
    ipcRenderer.invoke('spreadsheet:write-cell', { sheet, cell, value }),

  readRange: (sheet, range) =>
    ipcRenderer.invoke('spreadsheet:read-range', { sheet, range }),

  writeRange: (sheet, startCell, data) =>
    ipcRenderer.invoke('spreadsheet:write-range', { sheet, startCell, data }),

  // ===========================================
  // Formula Operations
  // ===========================================

  setFormula: (sheet, cell, formula) =>
    ipcRenderer.invoke('spreadsheet:set-formula', { sheet, cell, formula }),

  getFormula: (sheet, cell) =>
    ipcRenderer.invoke('spreadsheet:get-formula', { sheet, cell }),

  // ===========================================
  // Sheet Management
  // ===========================================

  getSheets: () => ipcRenderer.invoke('spreadsheet:get-sheets'),

  addSheet: (name) => ipcRenderer.invoke('spreadsheet:add-sheet', { name }),

  deleteSheet: (name) => ipcRenderer.invoke('spreadsheet:delete-sheet', { name }),

  // ===========================================
  // File Operations
  // ===========================================

  openFile: (path) => ipcRenderer.invoke('spreadsheet:open-file', { path }),

  saveFile: (path) => ipcRenderer.invoke('spreadsheet:save-file', { path }),

  exportFile: (format, path) =>
    ipcRenderer.invoke('spreadsheet:export', { format, path }),

  // ===========================================
  // Frame streaming for PiP viewer
  // ===========================================

  onFrame: (callback) => {
    ipcRenderer.on('spreadsheet:frame', (_event, frame) => {
      try { callback(frame); } catch (e) { console.error('[Spreadsheet] Frame callback error:', e); }
    });
  },

  removeFrameListener: () => {
    ipcRenderer.removeAllListeners('spreadsheet:frame');
  }
});
