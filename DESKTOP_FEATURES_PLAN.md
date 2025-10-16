# Desktop Features Implementation Plan

**Date:** October 16, 2025  
**Section:** MASTER_ROADMAP.md Section 2.5  
**Status:** Planning → Implementation

---

## 📋 **What's Remaining from Section 2**

Looking at MASTER_ROADMAP.md Section 2, here's what we've completed and what remains:

### ✅ **Completed (via Phases 1-3):**

**2.1 Chat Interface Polish (8/8)** ✅
- Modern message bubbles
- Markdown rendering with syntax highlighting
- Copy buttons (via message actions)
- Streaming animations
- Progressive loading states
- Error states with Stop/Continue
- Auto-scroll

**2.2 Memory Manager UI (2/7)** ✅ (Partial)
- In-conversation search (Cmd/Ctrl+F)
- Delete confirmations with undo

**2.3 Settings Panel (2/8)** ✅ (Partial)
- API configuration
- Keyboard shortcuts reference (?)

**2.4 Onboarding Flow (3/5)** ✅ (Partial)
- Welcome screen
- Identity wizard
- Input hints tutorial

### ⏳ **Remaining Work:**

**2.5 Desktop Features (0/6)** - This is the main gap!
- [ ] System tray integration
- [ ] Global hotkey (show/hide app)
- [ ] Native notifications
- [ ] Menu bar
- [ ] Auto-updater
- [ ] Crash reporter

---

## 🎯 **Priority Analysis**

### **Must Have (Core Desktop Experience):**
1. **System Tray Integration** - Quick access without dock clutter
2. **Global Hotkey** - Show/hide with keyboard (e.g., Cmd+Shift+M)
3. **Native Notifications** - Alert user when tasks complete

### **Should Have (Polish):**
4. **Menu Bar** - Standard File/Edit/View/Help menus

### **Nice to Have (Production):**
5. **Auto-updater** - Keep users on latest version
6. **Crash Reporter** - Debug issues in production

---

## 🏗️ **Implementation Plan**

### **1. System Tray Integration**

**What it does:** App icon in system tray/menu bar with right-click menu

**Technical Requirements:**
- Electron Tray API
- Icon assets (16x16, 32x32 for retina)
- Context menu
- Show/hide window on click
- Minimize to tray option

**Implementation:**
```javascript
// electron/main.js
const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');

let tray = null;
let mainWindow = null;

function createTray() {
  // Create tray icon
  const iconPath = path.join(__dirname, '../resources/tray-icon.png');
  tray = new Tray(iconPath);
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Agent Max',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'New Conversation',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('new-conversation');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Agent Max');
  
  // Click to show/hide
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

app.whenReady().then(() => {
  createTray();
  createWindow();
});
```

**Assets Needed:**
- `resources/tray-icon.png` (16x16)
- `resources/tray-icon@2x.png` (32x32)
- `resources/tray-icon-active.png` (colored when active)

**Testing:**
- [ ] Icon appears in system tray
- [ ] Right-click shows menu
- [ ] Click shows/hides window
- [ ] Window minimizes to tray (optional)
- [ ] Quit works properly

---

### **2. Global Hotkey**

**What it does:** Show/hide app with keyboard shortcut (e.g., Cmd+Shift+M)

**Technical Requirements:**
- Electron globalShortcut API
- Configurable shortcut (save in settings)
- Works when app is hidden/unfocused
- Platform-specific defaults

**Implementation:**
```javascript
// electron/main.js
const { app, globalShortcut, BrowserWindow } = require('electron');

function registerGlobalShortcuts() {
  // Default: Cmd+Shift+M (Mac) or Ctrl+Shift+M (Windows/Linux)
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+M' : 'Control+Shift+M';
  
  const registered = globalShortcut.register(shortcut, () => {
    if (mainWindow) {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  if (!registered) {
    console.error('Global shortcut registration failed');
  }
  
  console.log(`Global hotkey registered: ${shortcut}`);
}

app.whenReady().then(() => {
  registerGlobalShortcuts();
  createWindow();
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});
```

**Settings UI:**
```jsx
// Settings.jsx
<div className="setting-item">
  <label>Global Hotkey</label>
  <input
    type="text"
    value={globalHotkey}
    onKeyDown={captureHotkey}
    placeholder="Press keys..."
  />
  <p className="setting-help">
    Show/hide Agent Max from anywhere
  </p>
</div>
```

**Testing:**
- [ ] Hotkey shows window when hidden
- [ ] Hotkey hides window when visible
- [ ] Works across all workspaces/desktops
- [ ] Doesn't conflict with system shortcuts
- [ ] Can be changed in settings

---

### **3. Native Notifications**

**What it does:** System notifications when important events happen

**Technical Requirements:**
- Electron Notification API
- Permission handling
- Click to focus window
- Notification categories (info, success, error)

**Implementation:**
```javascript
// electron/main.js
const { Notification } = require('electron');

function showNotification(title, body, options = {}) {
  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, '../resources/icon.png'),
    silent: options.silent || false,
    urgency: options.urgency || 'normal' // low, normal, critical
  });
  
  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  notification.show();
}

// IPC handler
ipcMain.handle('show-notification', (event, { title, body, options }) => {
  showNotification(title, body, options);
});
```

**Frontend Usage:**
```javascript
// FloatBar.jsx or wherever
const notifyUser = async (title, message, options = {}) => {
  if (window.electron?.showNotification) {
    await window.electron.showNotification({ title, body: message, options });
  } else {
    // Fallback to browser notifications
    if (Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }
};

// Usage examples
notifyUser('Task Complete', 'Your file has been processed');
notifyUser('New Message', 'Agent Max has responded', { urgency: 'normal' });
notifyUser('Error', 'Connection lost', { urgency: 'critical' });
```

**When to Notify:**
- Task completion (long-running operations)
- AI response ready (when app is hidden)
- Errors that need attention
- Important updates

**Testing:**
- [ ] Notifications appear on all platforms
- [ ] Click opens app and focuses window
- [ ] Respects system Do Not Disturb
- [ ] Can be disabled in settings
- [ ] Shows proper icon

---

### **4. Menu Bar**

**What it does:** Standard application menu (File, Edit, View, Help)

**Technical Requirements:**
- Electron Menu API
- Platform-specific menus (macOS app menu)
- Keyboard shortcuts
- Dynamic menu items

**Implementation:**
```javascript
// electron/menu.js
const { Menu, shell } = require('electron');

function createMenu(mainWindow) {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => mainWindow.webContents.send('open-settings')
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Conversation',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('new-conversation')
        },
        {
          label: 'Save Conversation',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('save-conversation')
        },
        { type: 'separator' },
        {
          label: 'Export...',
          click: () => mainWindow.webContents.send('export-conversation')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find in Conversation',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('open-search')
        }
      ]
    },
    
    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Quick Switcher',
          accelerator: 'CmdOrCtrl+K',
          click: () => mainWindow.webContents.send('open-switcher')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    
    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'Shift+?',
          click: () => mainWindow.webContents.send('show-shortcuts')
        },
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://docs.agentmax.ai')
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/yourorg/agent-max/issues')
          }
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => mainWindow.webContents.send('check-updates')
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { createMenu };
```

**Testing:**
- [ ] All menu items work
- [ ] Keyboard shortcuts function
- [ ] Platform-specific menus correct
- [ ] IPC messages received in renderer

---

### **5. Auto-Updater**

**What it does:** Automatically check for and install updates

**Technical Requirements:**
- electron-updater package
- Update server/GitHub releases
- Download and install silently
- User notification

**Implementation:**
```javascript
// electron/updater.js
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

function setupAutoUpdater(mainWindow) {
  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify();
  
  // Check every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);
  
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart now?',
      buttons: ['Restart', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
  
  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
  });
}

module.exports = { setupAutoUpdater };
```

**Package.json:**
```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "yourorg",
        "repo": "agent-max-desktop"
      }
    ]
  }
}
```

**Testing:**
- [ ] Checks for updates on startup
- [ ] Downloads updates in background
- [ ] Notifies user when ready
- [ ] Installs on restart
- [ ] Handles errors gracefully

---

### **6. Crash Reporter**

**What it does:** Capture and report crashes for debugging

**Technical Requirements:**
- Electron crashReporter API
- Crash collection service (Sentry, BugSnag)
- User consent
- Privacy considerations

**Implementation:**
```javascript
// electron/main.js
const { crashReporter } = require('electron');

function setupCrashReporter() {
  crashReporter.start({
    productName: 'Agent Max',
    companyName: 'Your Company',
    submitURL: 'https://your-crash-server.com/crashes',
    uploadToServer: true,
    compress: true,
    extra: {
      version: app.getVersion(),
      platform: process.platform
    }
  });
}

app.whenReady().then(() => {
  setupCrashReporter();
  createWindow();
});
```

**Or with Sentry:**
```javascript
// electron/main.js
const Sentry = require('@sentry/electron');

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: process.env.NODE_ENV
});
```

**Testing:**
- [ ] Crashes are captured
- [ ] Reports sent to server
- [ ] User data protected
- [ ] Can be disabled in settings

---

## 📅 **Implementation Timeline**

### **Day 1: Core Desktop Features**
- ✅ System Tray (2-3 hours)
- ✅ Global Hotkey (1-2 hours)
- ✅ Native Notifications (1-2 hours)

### **Day 2: Polish & Production**
- ✅ Menu Bar (2-3 hours)
- ✅ Auto-Updater (2-3 hours)
- ✅ Crash Reporter (1 hour)

### **Day 3: Testing & Polish**
- Test all features on macOS/Windows/Linux
- Fix platform-specific issues
- Documentation

**Total Estimate:** 2-3 days

---

## 🎯 **Success Criteria**

### **Must Work:**
- [ ] System tray icon appears and works
- [ ] Global hotkey shows/hides app
- [ ] Notifications appear and click to focus
- [ ] Menu bar has all standard items
- [ ] Auto-updater checks and installs
- [ ] Crashes are captured

### **Cross-Platform:**
- [ ] Works on macOS (main target)
- [ ] Works on Windows
- [ ] Works on Linux (if supported)

### **User Experience:**
- [ ] Feels like a native app
- [ ] Keyboard shortcuts intuitive
- [ ] Updates seamless
- [ ] No blocking dialogs

---

## 📝 **Next Steps**

1. **Start with System Tray** (highest priority)
   - Create icon assets
   - Implement tray menu
   - Test show/hide behavior

2. **Then Global Hotkey**
   - Register shortcut
   - Test across workspaces
   - Add to settings

3. **Then Native Notifications**
   - Implement IPC
   - Add to key events
   - Test permissions

4. **Finally Menu Bar & Updater**
   - Standard menus
   - Update mechanism
   - Crash reporting

**Ready to start implementation?** Let me know and I'll begin with the System Tray!
