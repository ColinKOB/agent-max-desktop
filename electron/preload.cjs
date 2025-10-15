const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', { width, height }),
  switchToFloatbar: () => ipcRenderer.invoke('switch-to-floatbar'),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  executeCommand: (command) => ipcRenderer.invoke('execute-command', { command }),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  getBounds: () => ipcRenderer.invoke('get-bounds'),
  setBounds: (bounds) => ipcRenderer.invoke('set-bounds', bounds),

  // Open URL in external browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Open Settings window
  openSettings: () => ipcRenderer.invoke('open-settings'),

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

    // Testing
    testPreferences: () => ipcRenderer.invoke('memory:test-preferences'),
  },
});

// Also expose as electronAPI for compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openSettings: () => ipcRenderer.invoke('open-settings'),
});
