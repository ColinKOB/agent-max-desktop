/**
 * Auto-Updater Configuration
 * Handles automatic app updates using electron-updater
 */

const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// For private GitHub repos, set the token from environment variable
// This allows downloading updates without making the repo public
// Set GH_TOKEN or GITHUB_TOKEN in your build environment
const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (ghToken) {
  autoUpdater.requestHeaders = {
    'Authorization': `token ${ghToken}`
  };
}

let mainWindow = null;
let updateCheckInterval = null;

function setupAutoUpdater(window) {
  mainWindow = window;
  
  // Only enable auto-updates in production
  if (process.env.NODE_ENV === 'development') {
    console.log('[Updater] Auto-update disabled in development');
    return;
  }
  
  // Configure update settings
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Check for updates on startup (after 5 seconds)
  setTimeout(() => {
    checkForUpdates();
  }, 5000);
  
  // Check for updates every 4 hours
  updateCheckInterval = setInterval(() => {
    checkForUpdates();
  }, 4 * 60 * 60 * 1000);
  
  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates...');
  });
  
  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    }

    // Non-optional: immediately start download
    try {
      autoUpdater.downloadUpdate();
    } catch (e) {
      log.error('[Updater] Failed to start download automatically', e);
    }
  });
  
  autoUpdater.on('update-not-available', (info) => {
    log.info('[Updater] Update not available:', info.version);
  });
  
  autoUpdater.on('error', (err) => {
    log.error('[Updater] Error:', err);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', {
        message: err.message
      });
    }
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Downloaded ${Math.round(progressObj.percent)}%`;
    log.info('[Updater]', message);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    }
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Update downloaded:', info.version);
    
    // Store flag so the app shows "just updated" notification after restart
    try {
      const { session } = require('electron');
      // Use executeJavaScript to set localStorage before quit
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
          localStorage.setItem('app_just_updated', JSON.stringify({
            version: '${info.version}',
            timestamp: ${Date.now()}
          }));
        `).catch(() => {});
      }
    } catch (e) {
      log.warn('[Updater] Failed to set just-updated flag:', e);
    }
    
    // Auto-install silently after a brief delay (give time for flag to be set)
    log.info('[Updater] Auto-installing update in 2 seconds...');
    setTimeout(() => {
      setImmediate(() => {
        app.removeAllListeners('window-all-closed');
        // quitAndInstall(isSilent, isForceRunAfter)
        // isSilent=true: Don't show installer UI
        // isForceRunAfter=true: Restart app after install
        autoUpdater.quitAndInstall(true, true);
      });
    }, 2000);
  });
  
  console.log('[Updater] Auto-updater initialized');
}

function checkForUpdates() {
  if (process.env.NODE_ENV === 'development') {
    return Promise.resolve({ updateInfo: null });
  }
  
  return autoUpdater.checkForUpdates()
    .catch(err => {
      log.error('[Updater] Check failed:', err);
    });
}

function cleanup() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates,
  cleanup,
  autoUpdater  // Export the autoUpdater instance for IPC handlers
};
