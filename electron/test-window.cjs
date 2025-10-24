/**
 * Create a test window for memory features
 * Usage: Run the main app, then this will open the test page in an Electron window
 */

const { BrowserWindow } = require('electron');
const path = require('path');

function createTestWindow() {
  const testWindow = new BrowserWindow({
    width: 900,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the test HTML file
  testWindow.loadFile(path.join(__dirname, '..', 'test_memory_features.html'));

  testWindow.webContents.openDevTools();

  return testWindow;
}

module.exports = { createTestWindow };
