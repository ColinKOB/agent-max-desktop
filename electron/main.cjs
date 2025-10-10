const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const LocalMemoryManager = require('./memory-manager.cjs');

let mainWindow;
let memoryManager;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  // Initial size: compact pill mode
  const windowWidth = 360;
  const windowHeight = 80;
  const margin = 16;
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - margin,
    y: margin,
    minWidth: windowWidth,
    minHeight: windowHeight,
    maxWidth: windowWidth,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    backgroundColor: '#00000000',
    show: false,
    title: 'Agent Max',
    hasShadow: true,
    vibrancy: 'hud', // macOS only
    visualEffectState: 'active', // macOS only
  });

  // Make window visible on all workspaces/desktops
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating', 1);

  // Make window draggable from top 20px
  mainWindow.setWindowButtonVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Optionally open DevTools, positioned to the side
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize memory manager
  memoryManager = new LocalMemoryManager();
  console.log('✓ Memory manager initialized');
  console.log('  Storage location:', memoryManager.getMemoryLocation());
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// Window resize for expand/collapse
ipcMain.handle('resize-window', (event, { width, height }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height);
  }
});

// Get screen dimensions
ipcMain.handle('get-screen-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

// Execute terminal command (with security confirmation)
ipcMain.handle('execute-command', async (event, { command }) => {
  const logDir = path.join(os.homedir(), 'Library', 'Logs', 'AgentMax');
  const logFile = path.join(logDir, 'commands.log');
  
  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Log the command
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${command}\n`);
  
  // Execute command based on platform
  try {
    if (process.platform === 'darwin') {
      // macOS: Use AppleScript to run in Terminal
      const { exec } = require('child_process');
      const script = `tell application "Terminal"
        activate
        do script "${command.replace(/"/g, '\\"')}"
      end tell`;
      
      await new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
      
      return { success: true, message: 'Command executed in Terminal' };
    } else if (process.platform === 'win32') {
      // Windows: Use PowerShell
      shell.openExternal(`powershell.exe -Command "${command}"`);
      return { success: true, message: 'Command executed in PowerShell' };
    } else {
      // Linux: Use default terminal
      shell.openExternal(`x-terminal-emulator -e "${command}"`);
      return { success: true, message: 'Command executed in terminal' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Copy to clipboard
ipcMain.handle('copy-to-clipboard', (event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return { success: true };
});

// ============================================
// MEMORY MANAGEMENT IPC HANDLERS
// ============================================

// Get user profile
ipcMain.handle('memory:get-profile', () => {
  return memoryManager.getProfile();
});

// Update user profile
ipcMain.handle('memory:update-profile', (event, updates) => {
  return memoryManager.updateProfile(updates);
});

// Set user name
ipcMain.handle('memory:set-name', (event, name) => {
  return memoryManager.setUserName(name);
});

// Increment interaction count
ipcMain.handle('memory:increment-interaction', () => {
  return memoryManager.incrementInteraction();
});

// Get all facts
ipcMain.handle('memory:get-facts', () => {
  return memoryManager.getFacts();
});

// Set a fact
ipcMain.handle('memory:set-fact', (event, { category, key, value }) => {
  return memoryManager.setFact(category, key, value);
});

// Delete a fact
ipcMain.handle('memory:delete-fact', (event, { category, key }) => {
  return memoryManager.deleteFact(category, key);
});

// Start new conversation session
ipcMain.handle('memory:start-session', (event, sessionId) => {
  return memoryManager.startSession(sessionId);
});

// Add message to conversation
ipcMain.handle('memory:add-message', (event, { role, content, sessionId }) => {
  return memoryManager.addMessage(role, content, sessionId);
});

// Get recent messages
ipcMain.handle('memory:get-recent-messages', (event, { count, sessionId }) => {
  return memoryManager.getRecentMessages(count, sessionId);
});

// Clear conversation session
ipcMain.handle('memory:clear-session', (event, sessionId) => {
  return memoryManager.clearSession(sessionId);
});

// Get preferences
ipcMain.handle('memory:get-preferences', () => {
  return memoryManager.getPreferences();
});

// Set preference
ipcMain.handle('memory:set-preference', (event, { key, value, type }) => {
  return memoryManager.setPreference(key, value, type);
});

// Get preference by key
ipcMain.handle('memory:get-preference', (event, key) => {
  return memoryManager.getPreference(key);
});

// Build complete context for AI request
ipcMain.handle('memory:build-context', () => {
  return memoryManager.buildContext();
});

// Export memories (for backup)
ipcMain.handle('memory:export', () => {
  return memoryManager.exportMemories();
});

// Import memories (from backup)
ipcMain.handle('memory:import', (event, data) => {
  return memoryManager.importMemories(data);
});

// Get memory statistics
ipcMain.handle('memory:get-stats', () => {
  return memoryManager.getStats();
});

// Get memory storage location
ipcMain.handle('memory:get-location', () => {
  return memoryManager.getMemoryLocation();
});
