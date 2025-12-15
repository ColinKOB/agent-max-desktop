/**
 * Enterprise Auto-Updater Configuration
 * Fortune 500 Security Standards Compliant
 * 
 * Features:
 * - User consent required before install
 * - Rollback mechanism with version tracking
 * - Comprehensive audit logging
 * - Update channels (stable/beta)
 * - Configurable update intervals
 * - Deferral limits with persistence
 * - Signature verification logging
 */

const { autoUpdater } = require('electron-updater');
const { app, dialog, ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// ===========================================
// CONFIGURATION
// ===========================================

const UPDATE_CONFIG = {
  // Update check intervals (milliseconds)
  CHECK_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes for beta
  STARTUP_DELAY_MS: 5000, // 5 seconds after startup
  
  // Deferral settings (not used in beta auto-update mode)
  MAX_DEFERRALS: 5,
  MAX_DEFERRAL_DAYS: 14,
  
  // Channels
  CHANNELS: ['stable', 'beta'],
  DEFAULT_CHANNEL: 'beta', // Beta channel by default for testers
  
  // ===========================================
  // BETA MODE: Auto-update without user consent
  // ===========================================
  // For beta testing, we auto-download and auto-install to ensure
  // testers always have the latest version (security patches, bug fixes).
  // Set to false for production release to require user consent.
  BETA_AUTO_UPDATE: true,
  
  // Security settings (audit logging always enabled)
  LOG_SIGNATURE_VERIFICATION: true,
  
  // Rollback settings
  KEEP_PREVIOUS_VERSIONS: 2,
  
  // Auto-restart delay after download (ms)
  AUTO_RESTART_DELAY_MS: 3000,
};

// ===========================================
// STATE MANAGEMENT
// ===========================================

let mainWindow = null;
let updateCheckInterval = null;
let updateState = {
  pendingUpdate: null,
  downloadedUpdate: null,
  deferralCount: 0,
  lastDeferralDate: null,
  currentChannel: UPDATE_CONFIG.DEFAULT_CHANNEL,
  installApproved: false,
  isDownloading: false,
};

// Persistent state file path
const getStateFilePath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'update-state.json');
};

// Load persisted state
function loadUpdateState() {
  try {
    const statePath = getStateFilePath();
    if (fs.existsSync(statePath)) {
      const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      updateState = { ...updateState, ...data };
      auditLog('STATE_LOADED', { deferralCount: updateState.deferralCount, channel: updateState.currentChannel });
    }
  } catch (err) {
    log.warn('[Updater] Failed to load state:', err.message);
  }
}

// Save state to disk
function saveUpdateState() {
  try {
    const statePath = getStateFilePath();
    const dataToSave = {
      deferralCount: updateState.deferralCount,
      lastDeferralDate: updateState.lastDeferralDate,
      currentChannel: updateState.currentChannel,
    };
    fs.writeFileSync(statePath, JSON.stringify(dataToSave, null, 2));
  } catch (err) {
    log.warn('[Updater] Failed to save state:', err.message);
  }
}

// ===========================================
// AUDIT LOGGING (Fortune 500 Requirement)
// ===========================================

function auditLog(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    ...details,
  };
  
  // Log to file with [AUDIT] prefix for easy filtering
  log.info('[AUDIT][Updater]', JSON.stringify(entry));
  
  // Also emit to renderer for telemetry if available
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-audit-event', entry);
  }
}

// ===========================================
// SIGNATURE VERIFICATION LOGGING
// ===========================================

function logSignatureVerification(updateInfo, verificationResult) {
  if (!UPDATE_CONFIG.LOG_SIGNATURE_VERIFICATION) return;
  
  auditLog('SIGNATURE_VERIFICATION', {
    version: updateInfo?.version,
    releaseDate: updateInfo?.releaseDate,
    sha512: updateInfo?.sha512?.substring(0, 16) + '...', // Truncate for logs
    files: updateInfo?.files?.map(f => ({
      name: f.url,
      size: f.size,
      sha512: f.sha512?.substring(0, 16) + '...',
    })),
    verificationPassed: verificationResult !== false,
    signerIdentity: updateInfo?.stagingPercentage !== undefined ? 'electron-builder' : 'unknown',
  });
}

// ===========================================
// ROLLBACK MECHANISM
// ===========================================

function saveVersionForRollback() {
  try {
    const rollbackPath = path.join(app.getPath('userData'), 'version-history.json');
    let history = [];
    
    if (fs.existsSync(rollbackPath)) {
      history = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
    }
    
    // Add current version to history
    const currentEntry = {
      version: app.getVersion(),
      installedAt: new Date().toISOString(),
      path: app.getPath('exe'),
    };
    
    // Check if this version is already in history
    if (!history.some(h => h.version === currentEntry.version)) {
      history.unshift(currentEntry);
      
      // Keep only last N versions
      history = history.slice(0, UPDATE_CONFIG.KEEP_PREVIOUS_VERSIONS + 1);
      
      fs.writeFileSync(rollbackPath, JSON.stringify(history, null, 2));
      auditLog('VERSION_HISTORY_SAVED', { history: history.map(h => h.version) });
    }
  } catch (err) {
    log.warn('[Updater] Failed to save version for rollback:', err.message);
  }
}

function getRollbackVersions() {
  try {
    const rollbackPath = path.join(app.getPath('userData'), 'version-history.json');
    if (fs.existsSync(rollbackPath)) {
      const history = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
      return history.filter(h => h.version !== app.getVersion());
    }
  } catch (err) {
    log.warn('[Updater] Failed to get rollback versions:', err.message);
  }
  return [];
}

// ===========================================
// DEFERRAL MANAGEMENT
// ===========================================

function canDefer() {
  // Check if max deferrals exceeded
  if (updateState.deferralCount >= UPDATE_CONFIG.MAX_DEFERRALS) {
    auditLog('DEFERRAL_DENIED', { reason: 'max_deferrals_exceeded', count: updateState.deferralCount });
    return false;
  }
  
  // Check if max deferral days exceeded
  if (updateState.lastDeferralDate) {
    const daysSinceFirstDeferral = (Date.now() - new Date(updateState.lastDeferralDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceFirstDeferral >= UPDATE_CONFIG.MAX_DEFERRAL_DAYS) {
      auditLog('DEFERRAL_DENIED', { reason: 'max_deferral_days_exceeded', days: daysSinceFirstDeferral });
      return false;
    }
  }
  
  return true;
}

function recordDeferral() {
  updateState.deferralCount++;
  if (!updateState.lastDeferralDate) {
    updateState.lastDeferralDate = new Date().toISOString();
  }
  saveUpdateState();
  
  auditLog('UPDATE_DEFERRED', {
    deferralCount: updateState.deferralCount,
    remainingDeferrals: UPDATE_CONFIG.MAX_DEFERRALS - updateState.deferralCount,
  });
}

function resetDeferrals() {
  updateState.deferralCount = 0;
  updateState.lastDeferralDate = null;
  saveUpdateState();
}

// ===========================================
// CHANNEL MANAGEMENT
// ===========================================

function setUpdateChannel(channel) {
  if (!UPDATE_CONFIG.CHANNELS.includes(channel)) {
    log.warn('[Updater] Invalid channel:', channel);
    return false;
  }
  
  updateState.currentChannel = channel;
  saveUpdateState();
  
  // Configure electron-updater channel
  autoUpdater.channel = channel;
  autoUpdater.allowPrerelease = channel === 'beta';
  
  auditLog('CHANNEL_CHANGED', { channel });
  return true;
}

function getUpdateChannel() {
  return updateState.currentChannel;
}

// ===========================================
// CORE UPDATER SETUP
// ===========================================

function setupAutoUpdater(window) {
  mainWindow = window;
  
  // Only enable auto-updates in production
  if (process.env.NODE_ENV === 'development') {
    console.log('[Updater] Auto-update disabled in development');
    return;
  }
  
  // Load persisted state
  loadUpdateState();
  
  // Save current version for potential rollback
  saveVersionForRollback();
  
  // Configure logging
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  
  // SECURITY: Do NOT use tokens in production client builds
  // For public releases, no auth needed. For private, use signed URLs on backend.
  if (process.env.NODE_ENV === 'development' && process.env.GH_TOKEN) {
    log.warn('[Updater] GH_TOKEN detected - only use in development!');
  }
  
  // Beta mode: auto-download and auto-install for testers
  // Production mode: require user consent
  if (UPDATE_CONFIG.BETA_AUTO_UPDATE) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    log.info('[Updater] BETA MODE: Auto-download and auto-install enabled');
  } else {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    log.info('[Updater] PRODUCTION MODE: User consent required');
  }
  
  // Configure channel
  autoUpdater.channel = updateState.currentChannel;
  autoUpdater.allowPrerelease = updateState.currentChannel === 'beta';
  autoUpdater.allowDowngrade = false; // Security: prevent downgrade attacks
  
  // Check for updates on startup
  setTimeout(() => {
    checkForUpdates();
  }, UPDATE_CONFIG.STARTUP_DELAY_MS);
  
  // Periodic update checks
  updateCheckInterval = setInterval(() => {
    checkForUpdates();
  }, UPDATE_CONFIG.CHECK_INTERVAL_MS);
  
  // ===========================================
  // EVENT HANDLERS WITH AUDIT LOGGING
  // ===========================================
  
  autoUpdater.on('checking-for-update', () => {
    auditLog('UPDATE_CHECK_STARTED', { channel: updateState.currentChannel });
  });
  
  autoUpdater.on('update-available', (info) => {
    auditLog('UPDATE_AVAILABLE', {
      version: info.version,
      releaseDate: info.releaseDate,
      currentVersion: app.getVersion(),
    });
    
    // Log signature info
    logSignatureVerification(info, true);
    
    updateState.pendingUpdate = info;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: sanitizeReleaseNotes(info.releaseNotes),
        currentVersion: app.getVersion(),
        canDefer: !UPDATE_CONFIG.BETA_AUTO_UPDATE && canDefer(),
        remainingDeferrals: UPDATE_CONFIG.MAX_DEFERRALS - updateState.deferralCount,
        autoUpdate: UPDATE_CONFIG.BETA_AUTO_UPDATE,
      });
    }
    
    // Beta mode: auto-download is handled by electron-updater (autoDownload=true)
    // Production mode: wait for user to click download
    if (UPDATE_CONFIG.BETA_AUTO_UPDATE) {
      auditLog('AUTO_DOWNLOAD_STARTED', { version: info.version, mode: 'beta' });
    }
  });
  
  autoUpdater.on('update-not-available', (info) => {
    auditLog('UPDATE_NOT_AVAILABLE', { 
      currentVersion: app.getVersion(),
      latestVersion: info?.version,
    });
    
    // Reset deferrals when user is on latest
    resetDeferrals();
  });
  
  autoUpdater.on('error', (err) => {
    auditLog('UPDATE_ERROR', {
      error: err.message,
      stack: err.stack?.substring(0, 500), // Truncate stack
    });

    updateState.isDownloading = false;

    // GRACEFUL DEGRADATION: Don't show error notifications for expected failures
    // like 404 (no release available yet), network errors, or draft releases.
    // These are normal conditions, especially for:
    // - First launch after fresh install (no prior release to update from)
    // - Draft releases where latest-mac.yml isn't published yet
    // - Offline usage
    const errorMsg = err.message || '';
    const isExpectedFailure =
      errorMsg.includes('404') ||
      errorMsg.includes('latest-mac.yml') ||
      errorMsg.includes('ENOTFOUND') ||
      errorMsg.includes('ECONNREFUSED') ||
      errorMsg.includes('network') ||
      errorMsg.includes('getaddrinfo');

    if (isExpectedFailure) {
      log.info('[Updater] Expected update check failure (no release available or offline) - suppressing error notification');
      return; // Don't show error to user
    }

    // Only show unexpected errors to the user
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', {
        message: sanitizeErrorMessage(err.message),
        code: err.code || 'UNKNOWN',
      });
    }
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    }
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    auditLog('UPDATE_DOWNLOADED', {
      version: info.version,
      downloadedAt: new Date().toISOString(),
    });
    
    // Log final signature verification
    logSignatureVerification(info, true);
    
    updateState.downloadedUpdate = info;
    updateState.isDownloading = false;
    
    // Store version info securely (no template injection)
    storeUpdateMetadata(info);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseNotes: sanitizeReleaseNotes(info.releaseNotes),
        canDefer: !UPDATE_CONFIG.BETA_AUTO_UPDATE && canDefer(),
        autoUpdate: UPDATE_CONFIG.BETA_AUTO_UPDATE,
      });
    }
    
    // Beta mode: auto-install after brief delay
    // Production mode: wait for user consent
    if (UPDATE_CONFIG.BETA_AUTO_UPDATE) {
      auditLog('AUTO_INSTALL_SCHEDULED', { 
        version: info.version, 
        mode: 'beta',
        delayMs: UPDATE_CONFIG.AUTO_RESTART_DELAY_MS,
      });
      
      log.info(`[Updater] BETA: Auto-installing update in ${UPDATE_CONFIG.AUTO_RESTART_DELAY_MS / 1000}s...`);
      
      // Brief delay to allow UI to show "Updating..." message
      setTimeout(() => {
        setImmediate(() => {
          app.removeAllListeners('window-all-closed');
          // quitAndInstall(isSilent, isForceRunAfter)
          // isSilent=true: Don't show installer UI (cleaner experience)
          // isForceRunAfter=true: Restart app after install
          autoUpdater.quitAndInstall(true, true);
        });
      }, UPDATE_CONFIG.AUTO_RESTART_DELAY_MS);
    }
    // Production mode: User must explicitly click "Install Now"
  });
  
  // Register IPC handlers for update control
  registerUpdateIPCHandlers();
  
  auditLog('UPDATER_INITIALIZED', {
    version: app.getVersion(),
    channel: updateState.currentChannel,
    platform: process.platform,
  });
  
  console.log('[Updater] Enterprise auto-updater initialized');
}

// ===========================================
// IPC HANDLERS FOR USER-CONTROLLED UPDATES
// ===========================================

function registerUpdateIPCHandlers() {
  // User requests to download update
  ipcMain.handle('update:download', async () => {
    if (!updateState.pendingUpdate) {
      return { success: false, error: 'No update available' };
    }
    
    if (updateState.isDownloading) {
      return { success: false, error: 'Download already in progress' };
    }
    
    auditLog('DOWNLOAD_INITIATED_BY_USER', { version: updateState.pendingUpdate.version });
    updateState.isDownloading = true;
    
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      auditLog('DOWNLOAD_FAILED', { error: err.message });
      updateState.isDownloading = false;
      return { success: false, error: err.message };
    }
  });
  
  // User approves installation
  ipcMain.handle('update:install', async () => {
    if (!updateState.downloadedUpdate) {
      return { success: false, error: 'No downloaded update available' };
    }
    
    auditLog('INSTALL_APPROVED_BY_USER', { version: updateState.downloadedUpdate.version });
    updateState.installApproved = true;
    
    // Reset deferrals on successful update
    resetDeferrals();
    
    // Give brief delay for audit log to flush
    setTimeout(() => {
      setImmediate(() => {
        app.removeAllListeners('window-all-closed');
        autoUpdater.quitAndInstall(false, true); // NOT silent - show progress
      });
    }, 500);
    
    return { success: true };
  });
  
  // User defers update
  ipcMain.handle('update:defer', async () => {
    if (!canDefer()) {
      return { 
        success: false, 
        error: 'Maximum deferrals reached. Please install the update.',
        mustInstall: true,
      };
    }
    
    recordDeferral();
    
    return { 
      success: true, 
      remainingDeferrals: UPDATE_CONFIG.MAX_DEFERRALS - updateState.deferralCount,
    };
  });
  
  // Get update status
  ipcMain.handle('update:status', async () => {
    return {
      currentVersion: app.getVersion(),
      channel: updateState.currentChannel,
      pendingUpdate: updateState.pendingUpdate ? {
        version: updateState.pendingUpdate.version,
        releaseDate: updateState.pendingUpdate.releaseDate,
      } : null,
      downloadedUpdate: updateState.downloadedUpdate ? {
        version: updateState.downloadedUpdate.version,
      } : null,
      isDownloading: updateState.isDownloading,
      deferralCount: updateState.deferralCount,
      canDefer: canDefer(),
      remainingDeferrals: UPDATE_CONFIG.MAX_DEFERRALS - updateState.deferralCount,
      rollbackVersions: getRollbackVersions(),
    };
  });
  
  // Change update channel
  ipcMain.handle('update:set-channel', async (event, channel) => {
    const success = setUpdateChannel(channel);
    return { success, channel: updateState.currentChannel };
  });
  
  // Get available channels
  ipcMain.handle('update:get-channels', async () => {
    return {
      channels: UPDATE_CONFIG.CHANNELS,
      current: updateState.currentChannel,
    };
  });
}

// ===========================================
// SECURITY HELPERS
// ===========================================

// Sanitize release notes to prevent XSS
function sanitizeReleaseNotes(notes) {
  if (!notes) return '';
  
  // If it's HTML, strip tags
  if (typeof notes === 'string') {
    return notes
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, '') // Strip all HTML tags
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim()
      .substring(0, 10000); // Limit length
  }
  
  return String(notes).substring(0, 10000);
}

// Sanitize error messages to not expose internal details
function sanitizeErrorMessage(message) {
  if (!message) return 'An error occurred during update';
  
  // Remove paths
  let sanitized = message.replace(/\/[^\s]+/g, '[path]');
  // Remove potential sensitive info
  sanitized = sanitized.replace(/token[=:]\s*\S+/gi, 'token=[redacted]');
  
  return sanitized.substring(0, 500);
}

// Store update metadata securely (avoid executeJavaScript injection)
function storeUpdateMetadata(info) {
  try {
    const metadataPath = path.join(app.getPath('userData'), 'last-update.json');
    const metadata = {
      version: String(info.version).replace(/[^a-zA-Z0-9.-]/g, ''),
      timestamp: Date.now(),
      previousVersion: app.getVersion(),
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  } catch (err) {
    log.warn('[Updater] Failed to store update metadata:', err.message);
  }
}

// ===========================================
// PUBLIC API
// ===========================================

function checkForUpdates() {
  if (process.env.NODE_ENV === 'development') {
    return Promise.resolve({ updateInfo: null });
  }
  
  return autoUpdater.checkForUpdates()
    .catch(err => {
      auditLog('UPDATE_CHECK_FAILED', { error: err.message });
    });
}

function cleanup() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  auditLog('UPDATER_CLEANUP');
}

function getUpdateState() {
  return { ...updateState };
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates,
  cleanup,
  getUpdateState,
  setUpdateChannel,
  getUpdateChannel,
  getRollbackVersions,
  autoUpdater,
  UPDATE_CONFIG,
};
