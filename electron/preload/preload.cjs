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
  
  // Update management
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  restartForUpdate: () => ipcRenderer.invoke('restart-for-update'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
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

// Executor IPC bridge for pull-based execution (Phase 2)
contextBridge.exposeInMainWorld('executor', {
  startRun: (runId) => ipcRenderer.invoke('executor:start-run', runId),
  stopRun: (runId) => ipcRenderer.invoke('executor:stop-run', runId),
  getStatus: (runId) => ipcRenderer.invoke('executor:get-status', runId),
  getSystemContext: () => ipcRenderer.invoke('executor:get-system-context'),
  listActive: () => ipcRenderer.invoke('executor:list-active'),
  getStats: () => ipcRenderer.invoke('executor:get-stats'),
  setOnline: (isOnline) => ipcRenderer.invoke('executor:set-online', isOnline),
  cleanup: (olderThanDays) => ipcRenderer.invoke('executor:cleanup', olderThanDays),
});
