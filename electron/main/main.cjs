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

// Hands-on desktop device stream currently unsupported in production.
// Default to disabled unless explicitly enabled via env.
if (typeof process.env.HANDS_ON_DESKTOP_DEVICE_STREAM === 'undefined') {
  process.env.HANDS_ON_DESKTOP_DEVICE_STREAM = '1';
}

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
const LocalMemoryManager = require('../memory/memory-manager-backend-bridge.cjs');
const IPCValidator = require('../security/ipc-validator.cjs');
const { createApplicationMenu } = require('./menu.cjs');
const { setupAutoUpdater, checkForUpdates } = require('./updater.cjs');
const posthogAnalytics = require('../analytics/posthog-main.cjs');
const autonomousIPC = require('../autonomous/autonomousIPC.cjs');
const { HandsOnDesktopClient } = require('../integrations/hands-on-desktop-client.cjs');
const { DevicePairing } = require('./devicePairing.cjs');
const telemetry = require('../telemetry/telemetry.cjs');
const { executeMacOSTool, isMacOSTool, isMacOS } = require('../autonomous/macosAppleScript.cjs');
const workspaceApiServer = require('../autonomous/workspaceApiServer.cjs');
const spreadsheetApiServer = require('../spreadsheet/spreadsheetApiServer.cjs');
const notesApiServer = require('../notes/notesApiServer.cjs');
const testingApiServer = require('../testing/testingApiServer.cjs');

// Virtual Display Workspace (legacy - native Swift module)
// NOTE: The native CGVirtualDisplay approach is deprecated.
// We now use Electron BrowserWindow for the AI workspace (see workspaceManager.cjs)
let workspaceModule = null;
try {
  workspaceModule = require('../../native/macos/index.cjs');
  if (workspaceModule.isSupported()) {
    console.log('[Workspace] Legacy virtual display module loaded');
  } else {
    console.log('[Workspace] Legacy virtual display not supported (expected - using BrowserWindow instead)');
  }
} catch (err) {
  // This is expected - native module may not be built
  console.log('[Workspace] Using BrowserWindow-based workspace (native module not available)');
}

// NEW: BrowserWindow-based workspace manager
const { workspaceManager } = require('../workspace/workspaceManager.cjs');

// Spreadsheet manager (Excel-like spreadsheet window)
const { spreadsheetManager } = require('../spreadsheet/spreadsheetManager.cjs');

// Notes manager (AI-powered note-taking app)
const { notesManager } = require('../notes/notesManager.cjs');

// Phase 2: Pull-based executor
const { 
  initializeExecutorManager, 
  registerExecutorHandlers, 
  resumeActiveRunsOnStartup,
  cleanupOnQuit 
} = require('../autonomous/executorIPC.cjs');

// Resolve the built index.html once for all production windows.
// __dirname here is .../electron/main; our Vite build outputs to root-level /dist
// so we must go two directories up.
const DIST_INDEX_HTML = path.resolve(__dirname, '..', '..', 'dist', 'index.html');

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
      preload: path.join(__dirname, '../preload/preload.cjs'),
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

  // macOS: Clear visual artifacts when window focus/visibility changes
  if (process.platform === 'darwin') {
    mainWindow.on('focus', () => {
      setTimeout(() => {
        try { mainWindow.invalidateShadow(); } catch {}
      }, 100);
    });
    mainWindow.on('show', () => {
      setTimeout(() => {
        try { mainWindow.invalidateShadow(); } catch {}
      }, 100);
    });
  }

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

    // macOS: Periodically clear visual artifacts from transparent windows
    // This prevents the gray bar from accumulating over time
    if (process.platform === 'darwin') {
      setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            mainWindow.invalidateShadow();
          } catch {}
        }
      }, 5000); // Every 5 seconds
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
            "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' http://localhost:5173 https://js.stripe.com; " +
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
    mainWindow.loadFile(DIST_INDEX_HTML);
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
      preload: path.join(__dirname, '../preload/preload.cjs'),
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
    cardWindow.loadFile(DIST_INDEX_HTML, { hash: '/card' });
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

app.whenReady().then(async () => {
  telemetry.initialize({ app, ipcMain });
  // Initialize PostHog analytics (to catch any startup errors)
  await posthogAnalytics.initialize();
  posthogAnalytics.setupLifecycleTracking();
  
  // Register autonomous IPC handlers
  autonomousIPC.register();
  
  // Initialize memory manager with API base and key
  const mmApiBase = resolveBackendUrl();
  const mmApiKey = process.env.AMX_API_KEY || process.env.VITE_API_KEY || null;
  memoryManager = new LocalMemoryManager(mmApiBase, mmApiKey);
  console.log('✓ Memory manager initialized');
  console.log('  Storage location:', memoryManager.getMemoryLocation());

  // Initialize executor manager (Phase 2)
  const apiClient = {
    baseUrl: mmApiBase,
    apiKey: mmApiKey
  };
  registerExecutorHandlers(apiClient, {
    usePhase2: true // Enable Phase 2 by default
  });
  console.log('✓ Executor manager initialized (Phase 2)');

  createWindow();

  // Initialize desktop features
  createApplicationMenu(mainWindow);
  setupAutoUpdater(mainWindow);

  // Start the workspace API server for Python backend communication
  // NOTE: Now uses BrowserWindow-based workspace (workspaceManager), not native module
  workspaceApiServer.startServer(mainWindow);
  console.log('✓ Workspace API server started on port 3847');

  // Start the spreadsheet API server for spreadsheet operations
  spreadsheetApiServer.startServer(mainWindow);
  console.log('✓ Spreadsheet API server started on port 3848');

  // Start the notes API server for note-taking operations
  notesApiServer.startNotesApiServer();
  notesManager.initStorage(app.getPath('userData'));
  console.log('✓ Notes API server started on port 3849');

  // Start the testing API server for programmatic UI interaction
  testingApiServer.setMainWindow(mainWindow);
  testingApiServer.start();
  console.log('✓ Testing API server started on port 3850');

  // NOTE: Hands on Desktop client DISABLED by default
  // This was causing unexpected background execution of commands without user requests.
  // The client polls the backend for "pending requests" and executes them automatically,
  // which led to actions happening even after a run appeared to be complete.
  //
  // If needed, it can be enabled via the 'hands-on-desktop:toggle' IPC handler.
  // initializeHandsOnDesktop();

  // NOTE: Auto-resume of active runs DISABLED
  // This was causing unexpected background execution - runs from previous sessions
  // would resume automatically without user consent. The stale runs in the state store
  // could be from hours or days ago.
  //
  // If run persistence is needed, it should be opt-in and clearly shown to the user.
  // setTimeout(() => {
  //   resumeActiveRunsOnStartup().catch(err => {
  //     console.error('Failed to resume active runs:', err);
  //   });
  // }, 2000);
});

app.on('before-quit', async () => {
  telemetry.captureEvent('app.lifecycle.before-quit', {
    openWindows: BrowserWindow.getAllWindows().length,
  });
  telemetry.flush();

  // Flush PostHog analytics
  await posthogAnalytics.shutdown();

  // Stop workspace API server
  workspaceApiServer.stopServer();

  // Stop spreadsheet API server
  spreadsheetApiServer.stopServer();

  // Stop notes API server
  notesApiServer.stopNotesApiServer();

  // Cleanup executor (Phase 2)
  cleanupOnQuit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // Guard: screen module can't be used before app is ready
  if (!app.isReady()) return;

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
      preload: path.join(__dirname, '../preload/preload.cjs'),
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
            "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' http://localhost:5173 https://js.stripe.com; " +
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
    settingsWindow.loadFile(DIST_INDEX_HTML, { hash });
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

        // macOS: Clear visual artifacts from transparent window resizing
        // This fixes the gray bar that appears at the bottom of the pill
        if (process.platform === 'darwin') {
          setTimeout(() => {
            try {
              mainWindow.invalidateShadow();
            } catch {}
          }, 50);
        }
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

// Open native file dialog (opens as its own window, not attached to card)
ipcMain.handle('open-file-dialog', async (_event, options = {}) => {
  const { dialog } = require('electron');
  const fs = require('fs');
  
  try {
    const result = await dialog.showOpenDialog({
      title: options.title || 'Select Files',
      properties: ['openFile', 'multiSelections'],
      filters: options.filters || [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] },
        { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'json', 'csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled || !result.filePaths.length) {
      return { success: true, files: [] };
    }
    
    // Read file contents and return as base64 for images, text for documents
    const files = await Promise.all(result.filePaths.map(async (filePath) => {
      const fileName = require('path').basename(filePath);
      const ext = require('path').extname(filePath).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
      
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const mimeType = isImage 
        ? `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`
        : 'application/octet-stream';
      
      return {
        name: fileName,
        path: filePath,
        type: isImage ? 'image' : 'file',
        size: buffer.length,
        data: isImage ? `data:${mimeType};base64,${base64}` : null,
        content: !isImage ? buffer.toString('utf-8') : null
      };
    }));
    
    return { success: true, files };
  } catch (error) {
    console.error('[FileDialog] Error:', error);
    return { success: false, error: error.message, files: [] };
  }
});

// Check for updates (manual trigger)
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await checkForUpdates();
    return { success: true, result };
  } catch (error) {
    posthogAnalytics.captureError(error, { context: 'manual-update-check' });
    return { success: false, error: error.message };
  }
});

// ===========================================
// UPDATE MANAGEMENT IPC HANDLERS
// Note: Enterprise update handlers (update:download, update:install, 
// update:defer, update:status, update:set-channel, update:get-channels)
// are registered by updater.cjs in setupAutoUpdater().
// Legacy handlers below are kept for backwards compatibility.
// ===========================================

// Legacy: download-update (use update:download instead)
ipcMain.handle('download-update', async () => {
  console.warn('[Updater] Legacy download-update called - use update:download for enterprise features');
  try {
    const { autoUpdater } = require('./updater.cjs');
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    posthogAnalytics.captureError(error, { context: 'download-update' });
    return { success: false, error: error.message };
  }
});

// Legacy: install-update (use update:install instead)
ipcMain.handle('install-update', async () => {
  console.warn('[Updater] Legacy install-update called - use update:install for enterprise features');
  try {
    const { autoUpdater } = require('./updater.cjs');
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (error) {
    posthogAnalytics.captureError(error, { context: 'install-update' });
    return { success: false, error: error.message };
  }
});

// Legacy: restart-for-update (use update:install instead)
ipcMain.handle('restart-for-update', async () => {
  console.warn('[Updater] Legacy restart-for-update called - use update:install for enterprise features');
  try {
    const { app } = require('electron');
    app.removeAllListeners('window-all-closed');
    const { autoUpdater } = require('./updater.cjs');
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (error) {
    posthogAnalytics.captureError(error, { context: 'restart-for-update' });
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
function resolveBackendUrl() {
  return process.env.AGENT_MAX_BACKEND_URL
    || process.env.AMX_API_URL
    || process.env.AGENTMAX_API_URL
    || 'https://agentmax-production.up.railway.app';
}

function initializeHandsOnDesktop() {
  // Determine backend URL (reuse memory manager base when available)
  const backendUrl = resolveBackendUrl();

  console.log('[HandsOnDesktop] Pairing device and initializing client...');
  try {
    const pairing = new DevicePairing(backendUrl);
    // TODO: get real user id from settings or memory profile
    const creds = pairing.getCredentials('desktop_user');
    // getCredentials returns a promise; handle async pairing
    Promise.resolve(creds).then((credentials) => {
      handsOnDesktopClient = new HandsOnDesktopClient(backendUrl, credentials, pairing, 'desktop_user');
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
// OPTIMIZED: Resize to 1280x720 and use JPEG for smaller payload (~100KB vs ~500KB)
ipcMain.handle('take-screenshot', async () => {
  try {
    // Capture at reduced resolution for faster transmission
    // 1280x720 is sufficient for AI vision analysis
    const targetSize = { width: 1280, height: 720 };
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: targetSize,
    });

    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }

    // Get the primary screen
    const primarySource = sources[0];
    const screenshot = primarySource.thumbnail;

    // Convert to JPEG for smaller file size (quality 80 is good balance)
    // JPEG is ~5-10x smaller than PNG for screenshots
    const buffer = screenshot.toJPEG(80);

    // Convert to base64 for API transmission
    const base64 = buffer.toString('base64');

    console.log(
      `[Screenshot] Captured ${targetSize.width}x${targetSize.height} JPEG (${Math.round(base64.length / 1024)}KB)`
    );

    return {
      base64,
      mimeType: 'image/jpeg',
      size: base64.length,
    };
  } catch (error) {
    console.error('[Screenshot] Error:', error);
    throw error;
  }
});

// ============================================
// MACOS APPLESCRIPT TOOL EXECUTION
// ============================================

// Execute a macOS AppleScript tool (Notes, Calendar, Safari, etc.)
ipcMain.handle('execute-macos-tool', async (_event, { tool, args }) => {
  console.log('[macOS] Executing tool:', tool, args);

  if (!isMacOS()) {
    return {
      success: false,
      error: 'macOS tools are only available on macOS',
      stdout: '',
      stderr: 'Not running on macOS'
    };
  }

  if (!isMacOSTool(tool)) {
    return {
      success: false,
      error: `Not a valid macOS tool: ${tool}`,
      stdout: '',
      stderr: `Unknown tool: ${tool}. Supported tools: safari.*, notes.*, mail.*, calendar.*, finder.*, reminders.*`
    };
  }

  try {
    const result = await executeMacOSTool(tool, args || {});
    console.log('[macOS] Tool result:', result);
    return result;
  } catch (error) {
    console.error('[macOS] Tool execution error:', error);
    return {
      success: false,
      error: error.message,
      stdout: '',
      stderr: error.message
    };
  }
});

// Check if a tool is a macOS tool (for renderer to check before calling)
ipcMain.handle('is-macos-tool', (_event, tool) => {
  return isMacOSTool(tool);
});

// Check if running on macOS
ipcMain.handle('is-macos', () => {
  return isMacOS();
});

// Store active request AbortController for cancellation
let activeRunAbortController = null;

// Abort any in-flight create-run request
ipcMain.handle('autonomous:abort-request', async () => {
  if (activeRunAbortController) {
    console.log('[Autonomous] 🛑 Aborting in-flight request');
    activeRunAbortController.abort();
    activeRunAbortController = null;
    return { aborted: true };
  }
  return { aborted: false, reason: 'No active request to abort' };
});

// Create autonomous run with retry logic (main process for network stability)
ipcMain.handle('autonomous:create-run', async (event, { message, context, systemContext }) => {
  const backendUrl = resolveBackendUrl();
  const apiKey = process.env.AMX_API_KEY || process.env.VITE_API_KEY || '';
  const maxRetries = 3;
  let lastError;

  // Create AbortController for this request
  activeRunAbortController = new AbortController();
  const { signal } = activeRunAbortController;

  console.log('[Autonomous] Creating run via main process (stable network)');
  console.log('[Autonomous] User ID from context:', context?.userId || 'NOT PROVIDED - using desktop_user');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Check if aborted before each attempt
    if (signal.aborted) {
      console.log('[Autonomous] Request was aborted before attempt', attempt);
      throw new Error('Request aborted by user');
    }

    try {
      console.log(`[Autonomous] Attempt ${attempt}/${maxRetries}`);

      const response = await fetch(`${backendUrl}/api/v2/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'X-User-Id': context?.userId || 'desktop_user'
        },
        body: JSON.stringify({
          message,
          context: {
            ...context,
            system: systemContext
          },
          mode: 'autonomous',
          execution_mode: 'pull',
          skip_intent_confirmation: true  // Skip "Let me clarify" for autonomous mode
        }),
        signal  // Pass AbortController signal to fetch
      });

      if (response.ok) {
        const result = await response.json();

        // Check if planning failed (backend returns success: false)
        if (result.success === false) {
          const errorMsg = result.error || 'Planning failed';
          console.error('[Autonomous] Planning failed:', errorMsg);
          throw new Error(errorMsg);
        }

        console.log(`[Autonomous] ✓ Run created successfully: ${result.run_id}`);
        activeRunAbortController = null; // Clear controller on success
        return result;
      }

      // HTTP error
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);

    } catch (error) {
      // Handle abort specifically
      if (error.name === 'AbortError' || signal.aborted) {
        console.log('[Autonomous] 🛑 Request aborted by user');
        activeRunAbortController = null;
        throw new Error('Request aborted by user');
      }

      lastError = error;
      const errorMsg = error.message || String(error);

      // Don't retry on 4xx errors (client errors - won't succeed on retry)
      if (errorMsg.includes('HTTP 4')) {
        console.error('[Autonomous] Client error, not retrying:', errorMsg);
        activeRunAbortController = null;
        throw error;
      }

      // Log and retry on network errors
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        console.warn(`[Autonomous] Attempt ${attempt} failed: ${errorMsg}`);
        console.log(`[Autonomous] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // All retries failed
  activeRunAbortController = null;
  console.error('[Autonomous] All retry attempts failed:', lastError.message);
  throw lastError;
});

// ===========================================
// WORKSPACE (BrowserWindow) IPC Handlers
// Uses Electron BrowserWindow for AI isolation
// ===========================================

// Check if workspace is supported (always true now - uses BrowserWindow)
ipcMain.handle('workspace:is-supported', () => {
  return true; // BrowserWindow-based workspace is always supported
});

// Create workspace (BrowserWindow)
ipcMain.handle('workspace:create', async (_event, { width = 1280, height = 800 } = {}) => {
  try {
    const result = await workspaceManager.create(width, height);
    console.log('[Workspace] Created browser workspace:', result);
    return result;
  } catch (err) {
    console.error('[Workspace] Failed to create:', err);
    return { success: false, error: err.message };
  }
});

// Destroy workspace
ipcMain.handle('workspace:destroy', async () => {
  try {
    const result = workspaceManager.destroy();
    console.log('[Workspace] Destroyed browser workspace');
    return result;
  } catch (err) {
    console.error('[Workspace] Failed to destroy:', err);
    return { success: false, error: err.message };
  }
});

// Check if workspace is active
ipcMain.handle('workspace:is-active', () => {
  return workspaceManager.getIsActive();
});

// Get workspace window ID
ipcMain.handle('workspace:get-window-id', () => {
  return workspaceManager.getWindowId();
});

// Capture workspace frame as base64 PNG
ipcMain.handle('workspace:capture-frame', async () => {
  try {
    return await workspaceManager.captureFrame();
  } catch (err) {
    console.error('[Workspace] Frame capture failed:', err);
    return null;
  }
});

// Get last cached frame
ipcMain.handle('workspace:get-frame', () => {
  return workspaceManager.getLastFrame();
});

// Navigate to URL
ipcMain.handle('workspace:navigate', async (_event, { url }) => {
  return await workspaceManager.navigateTo(url);
});

// Go back
ipcMain.handle('workspace:back', async () => {
  return await workspaceManager.goBack();
});

// Go forward
ipcMain.handle('workspace:forward', async () => {
  return await workspaceManager.goForward();
});

// Reload page
ipcMain.handle('workspace:reload', async () => {
  return await workspaceManager.reload();
});

// Search Google
ipcMain.handle('workspace:search', async (_event, { query }) => {
  return await workspaceManager.searchGoogle(query);
});

// Click at coordinates
ipcMain.handle('workspace:click', async (_event, { x, y, button, clickCount }) => {
  return await workspaceManager.clickAt(x, y, { button, clickCount });
});

// Double click
ipcMain.handle('workspace:double-click', async (_event, { x, y }) => {
  return await workspaceManager.doubleClick(x, y);
});

// Right click
ipcMain.handle('workspace:right-click', async (_event, { x, y }) => {
  return await workspaceManager.rightClick(x, y);
});

// Type text
ipcMain.handle('workspace:type', async (_event, { text }) => {
  return await workspaceManager.typeText(text);
});

// Press key
ipcMain.handle('workspace:press-key', async (_event, { key, modifiers }) => {
  return await workspaceManager.pressKey(key, modifiers || []);
});

// Scroll
ipcMain.handle('workspace:scroll', async (_event, { deltaX, deltaY, x, y }) => {
  return await workspaceManager.scroll(deltaX || 0, deltaY || 0, x, y);
});

// Click element by selector
ipcMain.handle('workspace:click-element', async (_event, { selector }) => {
  return await workspaceManager.clickElement(selector);
});

// Type into element by selector
ipcMain.handle('workspace:type-into-element', async (_event, { selector, text }) => {
  return await workspaceManager.typeIntoElement(selector, text);
});

// Find elements by selector
ipcMain.handle('workspace:find-elements', async (_event, { selector }) => {
  return await workspaceManager.findElements(selector);
});

// Get page text
ipcMain.handle('workspace:get-text', async () => {
  return await workspaceManager.getPageText();
});

// Get page HTML
ipcMain.handle('workspace:get-html', async () => {
  return await workspaceManager.getPageHtml();
});

// Get all links
ipcMain.handle('workspace:get-links', async () => {
  return await workspaceManager.getLinks();
});

// Get all buttons
ipcMain.handle('workspace:get-buttons', async () => {
  return await workspaceManager.getButtons();
});

// Get all input fields
ipcMain.handle('workspace:get-inputs', async () => {
  return await workspaceManager.getInputFields();
});

// Execute script in page context
ipcMain.handle('workspace:execute-script', async (_event, { script }) => {
  return await workspaceManager.executeScript(script);
});

// Get workspace status
ipcMain.handle('workspace:get-status', () => {
  return {
    supported: true,
    active: workspaceManager.getIsActive(),
    minimized: workspaceManager.getIsMinimized(),
    windowId: workspaceManager.getWindowId(),
    url: workspaceManager.getCurrentUrl(),
    title: workspaceManager.getPageTitle()
  };
});

// Minimize workspace (hide PiP but keep running)
ipcMain.handle('workspace:minimize', () => {
  return workspaceManager.minimize();
});

// Restore workspace from minimized state
ipcMain.handle('workspace:restore', () => {
  return workspaceManager.restore();
});

// Get activity log
ipcMain.handle('workspace:get-activity-log', (_event, options = {}) => {
  return {
    success: true,
    log: workspaceManager.getActivityLog(options)
  };
});

// Get sessions list
ipcMain.handle('workspace:get-sessions', () => {
  return {
    success: true,
    sessions: workspaceManager.getSessions()
  };
});

// Clear activity log
ipcMain.handle('workspace:clear-activity-log', () => {
  return workspaceManager.clearActivityLog();
});

// ===========================================
// Workspace Shell Tab IPC Handlers (for shell UI)
// ===========================================

// Create tab from shell UI
ipcMain.handle('workspace-shell-create-tab', async (_event, url) => {
  return workspaceManager.createTab(url || 'https://www.google.com');
});

// Close tab from shell UI
ipcMain.handle('workspace-shell-close-tab', async (_event, tabId) => {
  return workspaceManager.closeTab(tabId);
});

// Switch tab from shell UI
ipcMain.handle('workspace-shell-switch-tab', async (_event, tabId) => {
  return workspaceManager.switchTab(tabId);
});

// ===========================================
// Spreadsheet IPC Handlers
// ===========================================

// Check if spreadsheet is active
ipcMain.handle('spreadsheet:is-active', () => {
  return spreadsheetManager.getIsActive();
});

// Get spreadsheet status
ipcMain.handle('spreadsheet:get-status', () => {
  return spreadsheetManager.getStatus();
});

// Get detailed spreadsheet status (for AI context)
ipcMain.handle('spreadsheet:get-detailed-status', async () => {
  return spreadsheetManager.getDetailedStatus();
});

// Create spreadsheet window
ipcMain.handle('spreadsheet:create', async (_event, { width = 1280, height = 800 } = {}) => {
  try {
    const result = await spreadsheetManager.create(width, height);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Destroy spreadsheet window
ipcMain.handle('spreadsheet:destroy', async () => {
  try {
    const result = spreadsheetManager.destroy();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Minimize spreadsheet
ipcMain.handle('spreadsheet:minimize', () => {
  return spreadsheetManager.minimize();
});

// Restore spreadsheet
ipcMain.handle('spreadsheet:restore', () => {
  return spreadsheetManager.restore();
});

// Capture frame
ipcMain.handle('spreadsheet:capture-frame', async () => {
  try {
    return await spreadsheetManager.captureFrame();
  } catch (error) {
    return null;
  }
});

// Read cell
ipcMain.handle('spreadsheet:read-cell', async (_event, { sheet, cell }) => {
  return await spreadsheetManager.readCell(sheet, cell);
});

// Write cell
ipcMain.handle('spreadsheet:write-cell', async (_event, { sheet, cell, value }) => {
  return await spreadsheetManager.writeCell(sheet, cell, value);
});

// Read range
ipcMain.handle('spreadsheet:read-range', async (_event, { sheet, range }) => {
  return await spreadsheetManager.readRange(sheet, range);
});

// Write range
ipcMain.handle('spreadsheet:write-range', async (_event, { sheet, startCell, data }) => {
  return await spreadsheetManager.writeRange(sheet, startCell, data);
});

// Set formula
ipcMain.handle('spreadsheet:set-formula', async (_event, { sheet, cell, formula }) => {
  return await spreadsheetManager.setFormula(sheet, cell, formula);
});

// Get formula
ipcMain.handle('spreadsheet:get-formula', async (_event, { sheet, cell }) => {
  return await spreadsheetManager.getFormula(sheet, cell);
});

// Get sheets
ipcMain.handle('spreadsheet:get-sheets', async () => {
  return await spreadsheetManager.getSheetNames();
});

// Add sheet
ipcMain.handle('spreadsheet:add-sheet', async (_event, { name }) => {
  return await spreadsheetManager.addSheet(name);
});

// Delete sheet
ipcMain.handle('spreadsheet:delete-sheet', async (_event, { name }) => {
  return await spreadsheetManager.deleteSheet(name);
});

// Open file
ipcMain.handle('spreadsheet:open-file', async (_event, { path }) => {
  return await spreadsheetManager.openFile(path);
});

// Save file
ipcMain.handle('spreadsheet:save-file', async (_event, { path }) => {
  return await spreadsheetManager.saveFile(path);
});

// Export file
ipcMain.handle('spreadsheet:export', async (_event, { format, path }) => {
  return await spreadsheetManager.exportAs(format, path);
});

// ===========================================
// Notes IPC Handlers
// ===========================================

ipcMain.handle('notes:is-active', () => {
  return notesManager.isActive;
});

ipcMain.handle('notes:get-status', () => {
  return notesManager.getStatus();
});

ipcMain.handle('notes:get-detailed-status', () => {
  return notesManager.getDetailedStatus();
});

ipcMain.handle('notes:create', async () => {
  return await notesManager.create();
});

ipcMain.handle('notes:destroy', () => {
  return notesManager.destroy();
});

ipcMain.handle('notes:capture-frame', () => {
  return notesManager.getFrame();
});

// Note CRUD operations
ipcMain.handle('notes-create-note', (_event, { title, content, folderId, tags }) => {
  return notesManager.createNote(title, content, folderId, tags);
});

ipcMain.handle('notes-update-note', (_event, { noteId, updates }) => {
  return notesManager.updateNote(noteId, updates);
});

ipcMain.handle('notes-delete-note', (_event, { noteId }) => {
  return notesManager.deleteNote(noteId);
});

ipcMain.handle('notes-get-note', (_event, { noteId }) => {
  return notesManager.getNote(noteId);
});

ipcMain.handle('notes-get-notes', (_event, options) => {
  const notes = notesManager.getNotes(options || {});
  return { notes, folders: notesManager.folders, tags: notesManager.getAllTags() };
});

ipcMain.handle('notes-search', (_event, { query }) => {
  return notesManager.searchNotes(query);
});

// Folder operations
ipcMain.handle('notes-create-folder', (_event, { name, icon }) => {
  return notesManager.createFolder(name, icon);
});

ipcMain.handle('notes-delete-folder', (_event, { folderId }) => {
  return notesManager.deleteFolder(folderId);
});

// Linking and tags
ipcMain.handle('notes-link', (_event, { noteId1, noteId2 }) => {
  return notesManager.linkNotes(noteId1, noteId2);
});

ipcMain.handle('notes-get-tags', () => {
  return notesManager.getAllTags();
});

// Export/Import
ipcMain.handle('notes-export', (_event, { format, noteIds }) => {
  return notesManager.exportNotes(format, noteIds);
});

ipcMain.handle('notes-import', (_event, { data }) => {
  return notesManager.importNotes(data);
});

// Quick actions
ipcMain.handle('notes-quick-today', () => {
  const today = new Date().toISOString().split('T')[0];
  const todayTitle = `Daily Note - ${today}`;

  let note = notesManager.notes.find(n => n.title === todayTitle);
  if (!note) {
    note = notesManager.createNote(
      todayTitle,
      `# ${today}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Ideas\n\n`,
      'default',
      ['daily']
    );
  }

  notesManager.currentNoteId = note.id;
  notesManager.syncToWindow();
  return note;
});

ipcMain.handle('notes-quick-scratch', () => {
  return notesManager.createNote(
    `Scratch - ${new Date().toLocaleTimeString()}`,
    '',
    'default',
    ['scratch']
  );
});

ipcMain.handle('notes-set-current', (_event, { noteId }) => {
  notesManager.currentNoteId = noteId;
  notesManager.syncToWindow();
  return { success: true };
});

ipcMain.handle('notes-status', () => {
  return notesManager.getStatus();
});

ipcMain.handle('notes-detailed-status', () => {
  return notesManager.getDetailedStatus();
});
