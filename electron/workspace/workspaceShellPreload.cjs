/**
 * Preload script for the workspace shell HTML
 * Exposes IPC methods for tab management
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Tab operations (called from shell UI)
  createTab: (url) => ipcRenderer.invoke('workspace-shell-create-tab', url),
  closeTab: (tabId) => ipcRenderer.invoke('workspace-shell-close-tab', tabId),
  switchTab: (tabId) => ipcRenderer.invoke('workspace-shell-switch-tab', tabId),

  // Listen for tab updates from main process
  onTabsUpdate: (callback) => {
    ipcRenderer.on('tabs-update', (event, tabList, activeTabId) => {
      callback(tabList, activeTabId);
    });
  }
});
