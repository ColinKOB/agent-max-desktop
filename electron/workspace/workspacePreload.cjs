/**
 * Workspace Preload Script
 *
 * Minimal preload for the AI workspace browser window.
 * Keeps the sandbox secure while allowing necessary functionality.
 */

const { contextBridge } = require('electron');

// Expose minimal API to the workspace page
contextBridge.exposeInMainWorld('agentMaxWorkspace', {
  // Identifier that this is the AI workspace
  isWorkspace: true,

  // Get viewport dimensions
  getViewportSize: () => ({
    width: window.innerWidth,
    height: window.innerHeight
  })
});

// Log that workspace is active
console.log('[AgentMax Workspace] Preload initialized');
