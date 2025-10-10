const { app, BrowserWindow, ipcMain, screen, shell, desktopCapturer } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const LocalMemoryManager = require('./memory-manager.cjs');

let mainWindow;
let ffmpegProcess;
let memoryManager;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  // Initial size: mini square mode (68x68)
  const windowWidth = 68;
  const windowHeight = 68;
  const margin = 16;
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - margin,
    y: margin,
    minWidth: 68,  // Mini square
    minHeight: 68,
    maxWidth: 360,  // Full card width
    maxHeight: 520, // Full card height
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,  // Must allow resizing for setSize to work
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Disable web security for API requests (both local dev and remote prod)
      webSecurity: false,
      // Allow cross-origin requests (needed for remote API)
      allowRunningInsecureContent: false,
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
    console.log(`[Electron] Resizing window to ${width}x${height}`);
    const beforeBounds = mainWindow.getBounds();
    console.log('[Electron] Before resize:', beforeBounds);
    
    mainWindow.setSize(width, height);
    
    // Check actual size after resize
    setTimeout(() => {
      const afterBounds = mainWindow.getBounds();
      console.log('[Electron] After resize:', afterBounds);
      if (afterBounds.width !== width || afterBounds.height !== height) {
        console.error(`[Electron] RESIZE FAILED! Expected ${width}x${height}, got ${afterBounds.width}x${afterBounds.height}`);
      }
    }, 100);
  }
});

// Get window bounds (for boundary checking)
ipcMain.handle('get-bounds', () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return { x: 0, y: 0, width: 0, height: 0 };
});

// Set window bounds (for boundary correction)
ipcMain.handle('set-bounds', (event, bounds) => {
  if (mainWindow) {
    mainWindow.setBounds(bounds);
  }
});

// Switch to FloatBar mode (after welcome screen)
ipcMain.handle('switch-to-floatbar', () => {
  if (mainWindow) {
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 360;
    const windowHeight = 80;
    const margin = 16;
    
    mainWindow.setSize(windowWidth, windowHeight);
    mainWindow.setPosition(screenWidth - windowWidth - margin, margin);
    mainWindow.setAlwaysOnTop(true, 'floating', 1);
    mainWindow.setMaximumSize(windowWidth, 9999); // Allow vertical expansion
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

// Helper to ensure memory manager is initialized
function ensureMemoryManager() {
  if (!memoryManager) {
    throw new Error('Memory manager not initialized. Please wait for app to be ready.');
  }
  return memoryManager;
}

// Get user profile
ipcMain.handle('memory:get-profile', () => {
  return ensureMemoryManager().getProfile();
});

// Update user profile
ipcMain.handle('memory:update-profile', (event, updates) => {
  return ensureMemoryManager().updateProfile(updates);
});

// Set user name
ipcMain.handle('memory:set-name', (event, name) => {
  return ensureMemoryManager().setUserName(name);
});

// Increment interaction count
ipcMain.handle('memory:increment-interaction', () => {
  return ensureMemoryManager().incrementInteraction();
});

// Get all facts
ipcMain.handle('memory:get-facts', () => {
  return ensureMemoryManager().getFacts();
});

// Set a fact
ipcMain.handle('memory:set-fact', (event, { category, key, value }) => {
  return ensureMemoryManager().setFact(category, key, value);
});

// Delete a fact
ipcMain.handle('memory:delete-fact', (event, { category, key }) => {
  return ensureMemoryManager().deleteFact(category, key);
});

// Start new conversation session
ipcMain.handle('memory:start-session', (event, sessionId) => {
  return ensureMemoryManager().startSession(sessionId);
});

// Add message to conversation
ipcMain.handle('memory:add-message', (event, { role, content, sessionId }) => {
  return ensureMemoryManager().addMessage(role, content, sessionId);
});

// Get recent messages
ipcMain.handle('memory:get-recent-messages', (event, { count, sessionId }) => {
  return ensureMemoryManager().getRecentMessages(count, sessionId);
});

// Clear conversation session
ipcMain.handle('memory:clear-session', (event, sessionId) => {
  return ensureMemoryManager().clearSession(sessionId);
});

// Get preferences
ipcMain.handle('memory:get-preferences', () => {
  return ensureMemoryManager().getPreferences();
});

// Set preference
ipcMain.handle('memory:set-preference', (event, { key, value, type }) => {
  return ensureMemoryManager().setPreference(key, value, type);
});

// Get preference by key
ipcMain.handle('memory:get-preference', (event, key) => {
  return ensureMemoryManager().getPreference(key);
});

// Build complete context for AI request
ipcMain.handle('memory:build-context', () => {
  return ensureMemoryManager().buildContext();
});

// Export memories (for backup)
ipcMain.handle('memory:export', () => {
  return ensureMemoryManager().exportMemories();
});

// Import memories (from backup)
ipcMain.handle('memory:import', (event, data) => {
  return ensureMemoryManager().importMemories(data);
});

// Get memory statistics
ipcMain.handle('memory:get-stats', () => {
  return ensureMemoryManager().getStats();
});

// Get memory storage location
ipcMain.handle('memory:get-location', () => {
  return ensureMemoryManager().getMemoryLocation();
});

// Test preferences (for debugging)
ipcMain.handle('memory:test-preferences', async () => {
  try {
    const mm = ensureMemoryManager();
    console.log('[Test] Testing preferences system...');
    
    // Test 1: Get current preferences
    const before = mm.getPreferences();
    console.log('[Test] Current preferences:', JSON.stringify(before, null, 2));
    
    // Test 2: Set a test preference
    await mm.setPreference('test_key', 'test_value', 'work');
    console.log('[Test] Set test preference');
    
    // Test 3: Verify it was saved
    const after = mm.getPreferences();
    console.log('[Test] Preferences after set:', JSON.stringify(after, null, 2));
    
    // Test 4: Get the specific preference
    const retrieved = mm.getPreference('test_key');
    console.log('[Test] Retrieved value:', retrieved);
    
    return {
      success: true,
      message: 'Preferences test completed',
      before,
      after,
      retrieved
    };
  } catch (error) {
    console.error('[Test] Preferences test failed:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
});

// Take screenshot and return base64
ipcMain.handle('take-screenshot', async () => {
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: screen.getPrimaryDisplay().size 
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    // Get the primary screen
    const primarySource = sources[0];
    const screenshot = primarySource.thumbnail;
    
    // Convert to PNG buffer
    const buffer = screenshot.toPNG();
    
    // Convert to base64 for API transmission
    const base64 = buffer.toString('base64');
    
    console.log('[Screenshot] Captured and converted to base64 (' + Math.round(base64.length / 1024) + 'KB)');
    
    return {
      base64,
      mimeType: 'image/png',
      size: base64.length
    };
  } catch (error) {
    console.error('[Screenshot] Error:', error);
    throw error;
  }
});
