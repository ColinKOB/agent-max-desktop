/**
 * Auto-Updater Configuration
 * Handles automatic app updates using electron-updater
 */

const { autoUpdater } = require('electron-updater');
const { dialog, app } = require('electron');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

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
  autoUpdater.autoDownload = false; // Ask user before downloading
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
    
    // Ask user if they want to download
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. Would you like to download it now?`,
      detail: 'The update will be installed when you quit the app.',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
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
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    }
    
    // Notify user that update is ready
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'The update will be installed when you quit Agent Max. You can also restart now to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        // Quit and install
        setImmediate(() => {
          app.removeAllListeners('window-all-closed');
          autoUpdater.quitAndInstall(false, true);
        });
      }
    });
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
  cleanup
};
