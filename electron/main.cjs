const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  globalShortcut,
  Notification,
  shell,
  clipboard,
  desktopCapturer,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

// Simple dev check instead of electron-is-dev
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ===========================================
// RUNTIME SECURITY CHECKS
// ===========================================

function performSecurityChecks() {
  // Only enforce in packaged production (allow prod-like dev runs)
  if (process.env.NODE_ENV === 'production' && app.isPackaged) {
    // Prevent debugging in production
    if (process.env.NODE_OPTIONS?.includes('--inspect') || 
        process.env.NODE_OPTIONS?.includes('--debug')) {
      console.error('[SECURITY] Debug flags detected in production - exiting');
      app.exit(1);
    }
    
    // Validate environment
    if (!process.env.VITE_SUPABASE_URL) {
      console.error('[SECURITY] Missing required environment variables');
      app.exit(1);
    }
    
    // Check for suspicious processes
    const suspiciousProcesses = ['gdb', 'lldb', 'frida', 'xposed'];
    const { execSync } = require('child_process');
    try {
      const processes = execSync('ps aux', { encoding: 'utf8' });
      const foundSuspicious = suspiciousProcesses.some(proc => 
        processes.toLowerCase().includes(proc)
      );
      if (foundSuspicious && !isDev) {
        console.warn('[SECURITY] Suspicious debugging process detected');
      }
    } catch (error) {
      // Ignore process check errors
    }
  }
}

// Run security checks on startup
performSecurityChecks();
const LocalMemoryManager = require('./memory-manager-backend-bridge.cjs');
const IPCValidator = require('./ipc-validator.cjs');
const { createApplicationMenu } = require('./menu.cjs');
const { setupAutoUpdater, checkForUpdates } = require('./updater.cjs');
const { setupCrashReporter, captureError } = require('./crash-reporter.cjs');
const autonomousIPC = require('./autonomousIPC.cjs');
const { HandsOnDesktopClient } = require('./hands-on-desktop-client.cjs');
const { DevicePairing } = require('./devicePairing.cjs');
const telemetry = require('./telemetry.cjs');

let mainWindow;
let memoryVault;
const windows = new Map();
let tray = null;
let settingsWindow;
let ffmpegProcess;
let memoryManager;
let cardWindow;
let handsOnDesktopClient = null;

// Screen magnet (edge snap) state
let magnetTimer = null;
const MAGNET_DELAY_MS = 1800; // a few seconds after movement stops
let isMagnetizing = false;

function scheduleMagnet(win) {
  if (!win || win.isDestroyed()) return;
  if (magnetTimer) clearTimeout(magnetTimer);
  magnetTimer = setTimeout(() => snapWindowToEdge(win), MAGNET_DELAY_MS);
}

function snapWindowToEdge(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const wa = display.workArea; // respect taskbar/notch
    const margin = 16;

    const distLeft = Math.abs(bounds.x - wa.x);
    const distRight = Math.abs((wa.x + wa.width) - (bounds.x + bounds.width));
    const distTop = Math.abs(bounds.y - wa.y);
    const distBottom = Math.abs((wa.y + wa.height) - (bounds.y + bounds.height));

    // Snap independently on both axes to nearest screen edge
    const snapX = distLeft <= distRight
      ? wa.x + margin
      : wa.x + wa.width - bounds.width - margin;

    const snapY = distTop <= distBottom
      ? wa.y + margin
      : wa.y + wa.height - bounds.height - margin;

    // Avoid recursive move storms during magnetization
    isMagnetizing = true;
    win.setPosition(Math.round(snapX), Math.round(snapY));
    setTimeout(() => { isMagnetizing = false; }, 250);
  } catch (e) {
    console.error('[Electron] snapWindowToEdge failed:', e);
  }
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  // Initial size: fixed pill mode (80x80)
  const windowWidth = 80;
  const windowHeight = 80;
  const margin = 16;

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - margin,
    y: margin,
    minWidth: 80,
    minHeight: 80,
    maxWidth: 600,
    maxHeight: 900,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    // Native glass
    vibrancy: isMac ? 'fullscreen-ui' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    backgroundMaterial: isWin ? 'acrylic' : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Disable CORS to permit desktop app to call trusted backend from file://
      webSecurity: false,
      sandbox: true,
      // Disallow running insecure content in production
      allowRunningInsecureContent: false,
    },
    backgroundColor: '#00000000',
    show: false,
    title: 'Agent Max',
    hasShadow: false,  // Disabled - shadows on transparent windows cause compositor artifacts during resize
  });

  // Make window visible on all workspaces/desktops
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating', 1);

  // Make window draggable from top 20px
  mainWindow.setWindowButtonVisibility(false);

  // Debounced screen magnet after user stops moving the window
  mainWindow.on('move', () => {
    if (isMagnetizing) return; // ignore our own snap
    scheduleMagnet(mainWindow);
  });

  // Notify renderer when the user resizes the window (to avoid auto-resize fights)
  mainWindow.on('resize', () => {
    try {
      const b = mainWindow.getBounds();
      mainWindow.webContents.send('window:user-resized', { width: b.width, height: b.height, ts: Date.now() });
    } catch {}
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const wantDevtools = (
      process.env.NODE_ENV === 'development' ||
      process.env.AMX_DEVTOOLS === '1' ||
      process.env.OPEN_DEVTOOLS === '1' ||
      process.env.ELECTRON_OPEN_DEVTOOLS === '1'
    );
    if (wantDevtools) {
      try { mainWindow.webContents.openDevTools({ mode: 'detach' }); } catch {}
    }
  });

  // Add Content Security Policy (only for our app origins)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const url = details?.url || '';
    const isAppOrigin = url.startsWith('http://localhost:5173') || url.startsWith('file://');
    if (!isAppOrigin) {
      // Do not override CSP for external sites (e.g., Stripe Checkout)
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' http://localhost:5173 https://js.stripe.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
            "img-src 'self' data: https: blob:; " +
            "connect-src 'self' http://localhost:8000 http://localhost:5173 ws://localhost:5173 https://agentmax-production.up.railway.app https://agentmax.app https://api.agentmax.com https://accounts.google.com https://www.googleapis.com https://api.stripe.com https://js.stripe.com https://m.stripe.network https://*.supabase.co https://*.supabase.in https://huggingface.co https://*.huggingface.co https://cdn.jsdelivr.net https://cdn-lfs.huggingface.co https://*.hf.co https://*.xethub.hf.co https://cas-bridge.xethub.hf.co wss://agentmax-production.up.railway.app wss://agentmax.app wss://*.supabase.co wss://*.supabase.in; " +
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'; " +
            "frame-ancestors 'self'",
        ],
      },
    });
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173/');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function ensureCardWindow() {
  if (cardWindow && !cardWindow.isDestroyed()) {
    return cardWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const margin = 16;

  cardWindow = new BrowserWindow({
    width: 360,
    height: 520,
    x: screenWidth - 360 - margin,
    y: margin,
    minWidth: 360,
    minHeight: 520,
    maxWidth: 360,
    maxHeight: 520,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    show: false,
    backgroundColor: '#00000000',
    title: 'Agent Max – Card',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false,
      sandbox: true,
      allowRunningInsecureContent: false,
    },
  });

  cardWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  cardWindow.setAlwaysOnTop(true, 'floating', 1);
  cardWindow.setWindowButtonVisibility(false);

  // Apply magnet behavior to card window too
  cardWindow.on('move', () => {
    if (isMagnetizing) return;
    scheduleMagnet(cardWindow);
  });

  if (process.env.NODE_ENV === 'development') {
    cardWindow.loadURL('http://localhost:5173/#/card');
  } else {
    cardWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/card' });
  }

  // Auto-open devtools (detached) when enabled via env flags
  const wantDevtools = (
    process.env.NODE_ENV === 'development' ||
    process.env.AMX_DEVTOOLS === '1' ||
    process.env.OPEN_DEVTOOLS === '1' ||
    process.env.ELECTRON_OPEN_DEVTOOLS === '1'
  );
  if (wantDevtools) {
    try {
      cardWindow.webContents.once('did-finish-load', () => {
        try { cardWindow.webContents.openDevTools({ mode: 'detach' }); } catch {}
      });
    } catch {}
  }

  cardWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      showPillWindow();
    }
  });

  cardWindow.on('closed', () => {
    cardWindow = null;
  });

  return cardWindow;
}

function showCardWindow() {
  if (!mainWindow) {
    createWindow();
  }
  const activeCardWindow = ensureCardWindow();

  const pillBounds = mainWindow.getBounds();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const targetX = Math.min(Math.max(pillBounds.x + pillBounds.width - 360, 0), screenWidth - 360);
  const targetY = Math.min(Math.max(pillBounds.y, 0), screenHeight - 520);

  activeCardWindow.setPosition(targetX, targetY);
  activeCardWindow.show();
  activeCardWindow.focus();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

function showPillWindow() {
  if (!mainWindow) {
    createWindow();
  }

  if (cardWindow && !cardWindow.isDestroyed()) {
    const cardBounds = cardWindow.getBounds();
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const targetX = Math.min(Math.max(cardBounds.x + cardBounds.width - 80, 0), screenWidth - 80);
    const targetY = Math.min(Math.max(cardBounds.y, 0), screenHeight - 80);
    mainWindow.setPosition(targetX, targetY);

    cardWindow.hide();
  }

  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(() => {
  telemetry.initialize({ app, ipcMain });
  // Initialize crash reporter first (to catch any startup errors)
  setupCrashReporter();
  
  // Register autonomous IPC handlers
  autonomousIPC.register();
  
  // Initialize memory manager with API base and key
  const mmApiBase = process.env.AMX_API_URL || process.env.AGENTMAX_API_URL || (process.env.NODE_ENV === 'production' ? 'https://agentmax-production.up.railway.app' : 'http://localhost:8000');
  const mmApiKey = process.env.AMX_API_KEY || process.env.VITE_API_KEY || null;
  memoryManager = new LocalMemoryManager(mmApiBase, mmApiKey);
  console.log('✓ Memory manager initialized');
  console.log('  Storage location:', memoryManager.getMemoryLocation());

  createWindow();
  
  // Initialize desktop features
  createApplicationMenu(mainWindow);
  setupAutoUpdater(mainWindow);
  
  // Initialize Hands on Desktop client (connects to backend for remote execution)
  initializeHandsOnDesktop();
});

app.on('before-quit', () => {
  telemetry.captureEvent('app.lifecycle.before-quit', {
    openWindows: BrowserWindow.getAllWindows().length,
  });
  telemetry.flush();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, clicking dock icon opens Settings window
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
  } else {
    createSettingsWindow();
  }

  // Create main window if it doesn't exist
  if (!mainWindow) {
    createWindow();
  }
});

// Create Settings Window
function createSettingsWindow(route) {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    // If a specific route was requested, navigate existing window
    if (route) {
      if (process.env.NODE_ENV === 'development') {
        const target = route.startsWith('#') ? route : `#${route}`;
        settingsWindow.loadURL(`http://localhost:5173/${target}`);
      } else {
        const hash = route.startsWith('#') ? route.slice(1) : route;
        settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash });
      }
    }
    return;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    x: Math.floor((screenWidth - 900) / 2),
    y: Math.floor((screenHeight - 700) / 2),
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false,
      sandbox: true,
      backgroundThrottling: false,
    },
    backgroundColor: '#00000000',
    title: 'Agent Max Settings',
    show: false,
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    const wantDevtools = (
      process.env.NODE_ENV === 'development' ||
      process.env.AMX_DEVTOOLS === '1' ||
      process.env.OPEN_DEVTOOLS === '1' ||
      process.env.ELECTRON_OPEN_DEVTOOLS === '1'
    );
    if (wantDevtools) {
      try { settingsWindow.webContents.openDevTools({ mode: 'detach' }); } catch {}
    }
  });

  // Add Content Security Policy for settings window (only our app origins)
  settingsWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const url = details?.url || '';
    const isAppOrigin = url.startsWith('http://localhost:5173') || url.startsWith('file://');
    if (!isAppOrigin) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' http://localhost:5173 https://js.stripe.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
            "img-src 'self' data: https: blob:; " +
            "connect-src 'self' http://localhost:8000 http://localhost:5173 ws://localhost:5173 https://agentmax-production.up.railway.app https://agentmax.app https://api.agentmax.com https://accounts.google.com https://www.googleapis.com https://api.stripe.com https://js.stripe.com https://m.stripe.network https://*.supabase.co https://*.supabase.in https://huggingface.co https://*.huggingface.co https://cdn.jsdelivr.net https://cdn-lfs.huggingface.co https://*.hf.co https://*.xethub.hf.co https://cas-bridge.xethub.hf.co wss://agentmax-production.up.railway.app wss://agentmax.app wss://*.supabase.co wss://*.supabase.in; " +
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'; " +
            "frame-ancestors 'self'",
        ],
      },
    });
  });

  if (process.env.NODE_ENV === 'development') {
    const target = route && route.startsWith('#') ? route : '#/settings';
    settingsWindow.loadURL(`http://localhost:5173/${target}`);
  } else {
    const hash = route && route.startsWith('#') ? route.slice(1) : '/settings';
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash });
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('window:show-card', () => {
  showCardWindow();
  return { success: true };
});

ipcMain.handle('window:show-pill', () => {
  showPillWindow();
  return { success: true };
});

// Window resize for expand/collapse
ipcMain.handle(
  'resize-window',
  IPCValidator.createValidatedHandler(
    (event, { width, height }) => {
      if (mainWindow) {
        if (width < 80) width = 80;
        if (height < 80) height = 80;
        if (width > 360) width = 360;
        if (height > 700) height = 700;
        // HARD GUARD: keep pill square. If width is the pill width, force 80x80.
        if (width <= 80) {
          width = 80;
          height = 80;
        }
        // Disallow manual resize at all times
        mainWindow.setResizable(false);
        console.log(`[Electron] Resizing window to ${width}x${height}`);
        const beforeBounds = mainWindow.getBounds();
        console.log('[Electron] Before resize:', beforeBounds);

        // TEST 2: HIDE DURING RESIZE (currently disabled)
        // Uncomment these lines if hasShadow:false doesn't fix ghosting
        // const wasVisible = mainWindow.isVisible();
        // if (wasVisible) {
        //   mainWindow.setOpacity(0); // Hide window
        // }

        mainWindow.setSize(width, height, false); // false = no animation (instant)

        // After resizing, preserve corner anchoring and keep fully within work area
        try {
          const margin = 16;
          const anchorThreshold = 32; // how close counts as anchored to an edge
          const before = beforeBounds; // bounds captured before resize
          const display = screen.getDisplayMatching(before);
          const wa = display.workArea;

          const after = mainWindow.getBounds();

          const anchoredLeft = before.x <= wa.x + anchorThreshold;
          const anchoredRight = before.x + before.width >= wa.x + wa.width - anchorThreshold;
          const anchoredTop = before.y <= wa.y + anchorThreshold;
          const anchoredBottom = before.y + before.height >= wa.y + wa.height - anchorThreshold;

          let targetX = after.x;
          let targetY = after.y;

          if (anchoredLeft) targetX = wa.x + margin;
          else if (anchoredRight) targetX = wa.x + wa.width - after.width - margin;

          if (anchoredTop) targetY = wa.y + margin;
          else if (anchoredBottom) targetY = wa.y + wa.height - after.height - margin;

          // Final clamp to ensure we never go off-screen
          const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
          targetX = clamp(targetX, wa.x, wa.x + wa.width - after.width);
          targetY = clamp(targetY, wa.y, wa.y + wa.height - after.height);

          if (targetX !== after.x || targetY !== after.y) {
            isMagnetizing = true;
            mainWindow.setPosition(Math.round(targetX), Math.round(targetY));
            setTimeout(() => { isMagnetizing = false; }, 200);
          }
        } catch (e) {
          console.error('[Electron] Post-resize boundary clamp failed:', e);
        }

        // TEST 2: RESTORE VISIBILITY (currently disabled)
        // if (wasVisible) {
        //   setTimeout(() => {
        //     mainWindow.setOpacity(1); // Fade back in
        //   }, 16); // Wait one frame
        // }

        // Check actual size after resize
        setTimeout(() => {
          const afterBounds = mainWindow.getBounds();
          console.log('[Electron] After resize:', afterBounds);
          if (afterBounds.width !== width || afterBounds.height !== height) {
            console.error(
              `[Electron] RESIZE FAILED! Expected ${width}x${height}, got ${afterBounds.width}x${afterBounds.height}`
            );
          }
        }, 100);
      }
    },
    {
      width: { type: 'number', required: true, min: 50, max: 2000, integer: true },
      height: { type: 'number', required: true, min: 50, max: 2000, integer: true },
    }
  )
);

// Get window bounds (for boundary checking)
ipcMain.handle('get-bounds', () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return { x: 0, y: 0, width: 0, height: 0 };
});

// Set window bounds (for boundary correction)
ipcMain.handle(
  'set-bounds',
  IPCValidator.createValidatedHandler(
    (event, bounds) => {
      if (mainWindow) {
        mainWindow.setBounds(bounds);
      }
    },
    {
      x: { type: 'number', integer: true },
      y: { type: 'number', integer: true },
      width: { type: 'number', min: 50, max: 2000, integer: true },
      height: { type: 'number', min: 50, max: 2000, integer: true },
    }
  )
);

// Switch to FloatBar mode (after welcome screen)
ipcMain.handle('switch-to-floatbar', () => {
  if (mainWindow) {
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 80;
    const windowHeight = 80;
    const margin = 16;

    mainWindow.setSize(windowWidth, windowHeight);
    mainWindow.setPosition(screenWidth - windowWidth - margin, margin);
    mainWindow.setAlwaysOnTop(true, 'floating', 1);
    mainWindow.setMinimumSize(80, 80);
    mainWindow.setMaximumSize(360, 700);
    // Disallow manual resize for the floatbar window
    mainWindow.setResizable(false);
  }
});

// Get screen dimensions
ipcMain.handle('get-screen-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

// Execute terminal command (with security confirmation)
ipcMain.handle(
  'execute-command',
  IPCValidator.createValidatedHandler(
    async (event, { command }) => {
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
    },
    {
      command: { type: 'string', required: true, maxLength: 5000 },
    }
  )
);

// Copy to clipboard
ipcMain.handle(
  'copy-to-clipboard',
  IPCValidator.createValidatedHandler(
    (event, { text }) => {
      const { clipboard } = require('electron');
      clipboard.writeText(text);
      return { success: true };
    },
    { text: { type: 'string', required: true, maxLength: 100000 } }
  )
);

// Open URL in external browser
ipcMain.handle(
  'open-external',
  IPCValidator.createValidatedHandler(
    async (event, { url }) => {
      try {
        // Additional URL validation
        const validatedUrl = IPCValidator.validateURL(url, {
          required: true,
          allowedProtocols: ['http:', 'https:', 'mailto:'],
        });
        await shell.openExternal(validatedUrl);
        return { success: true };
      } catch (error) {
        console.error('[Electron] Failed to open external URL:', error);
        return { success: false, error: error.message };
      }
    },
    { url: { type: 'string', required: true } }
  )
);

// Open Settings Window
ipcMain.handle('open-settings', (_event, opts = {}) => {
  const route = typeof opts?.route === 'string' ? opts.route : undefined;
  createSettingsWindow(route);
  return { success: true };
});

// Open Test Window (for debugging memory features)
ipcMain.handle('open-test-window', () => {
  const { createTestWindow } = require('./test-window.cjs');
  createTestWindow();
  return { success: true };
});

// Check for updates (manual trigger)
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await checkForUpdates();
    return { success: true, result };
  } catch (error) {
    captureError(error, { context: 'manual-update-check' });
    return { success: false, error: error.message };
  }
});

// Update management handlers
ipcMain.handle('download-update', async () => {
  try {
    const { autoUpdater } = require('./updater.cjs');
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    captureError(error, { context: 'download-update' });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', async () => {
  try {
    const { autoUpdater } = require('./updater.cjs');
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (error) {
    captureError(error, { context: 'install-update' });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restart-for-update', async () => {
  try {
    const { app } = require('electron');
    app.removeAllListeners('window-all-closed');
    const { autoUpdater } = require('./updater.cjs');
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (error) {
    captureError(error, { context: 'restart-for-update' });
    return { success: false, error: error.message };
  }
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
ipcMain.handle(
  'memory:update-profile',
  IPCValidator.createValidatedHandler(
    (event, updates) => {
      return ensureMemoryManager().updateProfile(updates);
    },
    {
      name: { type: 'string', maxLength: 100 },
      preferences: { type: 'object' },
      facts: { type: 'object' },
      interaction_count: { type: 'number', integer: true, min: 0 },
    }
  )
);

// Set user name
ipcMain.handle(
  'memory:set-name',
  IPCValidator.createValidatedHandler(
    (event, { name }) => {
      return ensureMemoryManager().setUserName(name);
    },
    { name: { type: 'string', required: true, maxLength: 100, minLength: 1 } }
  )
);

// Increment interaction count
ipcMain.handle('memory:increment-interaction', () => {
  return ensureMemoryManager().incrementInteraction();
});

// Get all facts
ipcMain.handle('memory:get-facts', () => {
  return ensureMemoryManager().getFacts();
});

// Set a fact
ipcMain.handle(
  'memory:set-fact',
  IPCValidator.createValidatedHandler(
    (event, { category, key, value }) => {
      return ensureMemoryManager().setFact(category, key, value);
    },
    {
      category: { type: 'string', required: true, maxLength: 50 },
      key: { type: 'string', required: true, maxLength: 50 },
      value: { type: 'string', required: true, maxLength: 1000 },
    }
  )
);

// Delete a fact
ipcMain.handle('memory:delete-fact', (event, { category, key }) => {
  return ensureMemoryManager().deleteFact(category, key);
});

// Start new conversation session
ipcMain.handle('memory:start-session', (event, sessionId) => {
  return ensureMemoryManager().startSession(sessionId);
});

// Add message to conversation
ipcMain.handle(
  'memory:add-message',
  IPCValidator.createValidatedHandler(
    (event, { role, content, sessionId }) => {
      // Additional role validation
      if (!['user', 'assistant', 'system'].includes(role)) {
        throw new Error('Invalid role. Must be user, assistant, or system');
      }
      return ensureMemoryManager().addMessage(role, content, sessionId);
    },
    {
      role: { type: 'string', required: true },
      content: { type: 'string', required: true, maxLength: 50000 },
      sessionId: { type: 'string', maxLength: 100 },
    }
  )
);

// Get recent messages
ipcMain.handle('memory:get-recent-messages', (event, { count, sessionId }) => {
  return ensureMemoryManager().getRecentMessages(count, sessionId);
});

// Get all conversation sessions (for history)
ipcMain.handle('memory:get-all-sessions', () => {
  return ensureMemoryManager().getAllSessions();
});

// Get session by ID
ipcMain.handle('memory:get-session-by-id', (event, sessionId) => {
  return ensureMemoryManager().getSessionById(sessionId);
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
ipcMain.handle(
  'memory:set-preference',
  IPCValidator.createValidatedHandler(
    (event, { key, value, type }) => {
      return ensureMemoryManager().setPreference(key, value, type);
    },
    {
      key: { type: 'string', required: true, maxLength: 100 },
      value: { type: 'string', required: true, maxLength: 5000 },
      type: { type: 'string', maxLength: 50 },
    }
  )
);

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
ipcMain.handle(
  'memory:import',
  IPCValidator.createValidatedHandler(
    (event, { data }) => {
      // Validate import data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid import data');
      }
      return ensureMemoryManager().importMemories(data);
    },
    { data: { type: 'object', required: true } }
  )
);

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
      retrieved,
    };
  } catch (error) {
    console.error('[Test] Preferences test failed:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
});

// Initialize Hands on Desktop client
function initializeHandsOnDesktop() {
  // Determine backend URL (reuse memory manager base when available)
  const backendUrl = process.env.AGENT_MAX_BACKEND_URL || process.env.AMX_API_URL || process.env.AGENTMAX_API_URL || (process.env.NODE_ENV === 'production' ? 'https://agentmax-production.up.railway.app' : 'http://localhost:8000');

  console.log('[HandsOnDesktop] Pairing device and initializing client...');
  try {
    const pairing = new DevicePairing(backendUrl);
    // TODO: get real user id from settings or memory profile
    const creds = pairing.getCredentials('desktop_user');
    // getCredentials returns a promise; handle async pairing
    Promise.resolve(creds).then((credentials) => {
      handsOnDesktopClient = new HandsOnDesktopClient(backendUrl, credentials.device_token, credentials.device_secret);
      handsOnDesktopClient.onConnected = () => {
        console.log('[HandsOnDesktop] Connected to backend');
      };
      handsOnDesktopClient.onDisconnected = (error) => {
        console.log('[HandsOnDesktop] Disconnected from backend:', error?.message);
      };
      handsOnDesktopClient.connect();
    }).catch((e) => {
      console.error('[HandsOnDesktop] Failed to pair or initialize:', e);
    });
  } catch (e) {
    console.error('[HandsOnDesktop] Initialization error:', e);
  }
}

// IPC handler to get Hands on Desktop status
ipcMain.handle('hands-on-desktop:status', async () => {
  if (!handsOnDesktopClient) {
    return { enabled: false, connected: false };
  }
  return {
    enabled: true,
    ...handsOnDesktopClient.getStatus()
  };
});

// IPC handler to start/stop Hands on Desktop client
ipcMain.handle('hands-on-desktop:toggle', async (event, enabled) => {
  if (enabled && !handsOnDesktopClient) {
    initializeHandsOnDesktop();
  } else if (!enabled && handsOnDesktopClient) {
    handsOnDesktopClient.disconnect();
    handsOnDesktopClient = null;
  }
  return { success: true };
});

// Execute a tool_request from renderer (SSE handler)
ipcMain.handle('hands-on-desktop:execute-request', async (_event, request) => {
  try {
    if (!handsOnDesktopClient) {
      initializeHandsOnDesktop();
    }
    // Wait a tick for init
    await new Promise((r) => setTimeout(r, 50));
    if (!handsOnDesktopClient) throw new Error('HandsOnDesktop not initialized');
    // Directly call handler to execute and submit result
    await handsOnDesktopClient.handleToolRequest(request);
    return { success: true };
  } catch (error) {
    console.error('[HandsOnDesktop] execute-request failed:', error);
    return { success: false, error: error.message };
  }
});

// Take screenshot and return base64
ipcMain.handle('take-screenshot', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: screen.getPrimaryDisplay().size,
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

    console.log(
      `[Screenshot] Captured and converted to base64 (${Math.round(base64.length / 1024)}KB)`
    );

    return {
      base64,
      mimeType: 'image/png',
      size: base64.length,
    };
  } catch (error) {
    console.error('[Screenshot] Error:', error);
    throw error;
  }
});
