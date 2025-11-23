/**
 * IPC handlers for executor manager
 * Supports both Phase 1 and Phase 2 executors
 */

const { ipcMain } = require('electron');
const { ExecutorManager } = require('./executorManager.cjs');

let executorManager = null;

/**
 * Initialize executor manager
 */
function initializeExecutorManager(apiClient, config = {}) {
    if (executorManager) {
        console.log('[ExecutorIPC] Manager already initialized');
        return executorManager;
    }

    console.log('[ExecutorIPC] Initializing executor manager...');
    executorManager = new ExecutorManager(apiClient, config);
    
    return executorManager;
}

/**
 * Register IPC handlers for executor
 */
function registerExecutorHandlers(apiClient, config = {}) {
    // Initialize manager
    if (!executorManager) {
        initializeExecutorManager(apiClient, config);
    }

    // Start run
    ipcMain.handle('executor:start-run', async (event, runId) => {
        try {
            console.log(`[ExecutorIPC] Starting run: ${runId}`);
            
            // Start in background
            executorManager.startRun(runId).catch(error => {
                console.error(`[ExecutorIPC] Run execution error:`, error);
            });

            return {
                success: true,
                runId: runId
            };
        } catch (error) {
            console.error('[ExecutorIPC] Start error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Stop run
    ipcMain.handle('executor:stop-run', async (event, runId) => {
        try {
            executorManager.stopRun(runId);
            
            return {
                success: true,
                runId: runId
            };
        } catch (error) {
            console.error('[ExecutorIPC] Stop error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get run status
    ipcMain.handle('executor:get-status', async (event, runId) => {
        try {
            const status = executorManager.getRunStatus(runId);
            
            return {
                success: true,
                status: status
            };
        } catch (error) {
            console.error('[ExecutorIPC] Get status error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // List active runs
    ipcMain.handle('executor:list-active', async (event) => {
        try {
            const runs = executorManager.listActiveRuns();
            
            return {
                success: true,
                runs: runs
            };
        } catch (error) {
            console.error('[ExecutorIPC] List active error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get statistics
    ipcMain.handle('executor:get-stats', async (event) => {
        try {
            const stats = executorManager.getStats();
            
            return {
                success: true,
                stats: stats
            };
        } catch (error) {
            console.error('[ExecutorIPC] Get stats error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Set online status
    ipcMain.handle('executor:set-online', async (event, isOnline) => {
        try {
            executorManager.setOnlineStatus(isOnline);
            
            return {
                success: true,
                isOnline: isOnline
            };
        } catch (error) {
            console.error('[ExecutorIPC] Set online error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Cleanup old runs
    ipcMain.handle('executor:cleanup', async (event, olderThanDays = 7) => {
        try {
            const count = executorManager.cleanup(olderThanDays);
            
            return {
                success: true,
                cleaned: count
            };
        } catch (error) {
            console.error('[ExecutorIPC] Cleanup error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    console.log('[ExecutorIPC] Handlers registered');
}

/**
 * Resume active runs on app startup (Phase 2)
 */
async function resumeActiveRunsOnStartup() {
    if (!executorManager) {
        console.log('[ExecutorIPC] Manager not initialized, skipping resume');
        return;
    }

    console.log('[ExecutorIPC] Resuming active runs on startup...');
    
    try {
        await executorManager.resumeActiveRuns();
        console.log('[ExecutorIPC] Resume complete');
    } catch (error) {
        console.error('[ExecutorIPC] Resume error:', error);
    }
}

/**
 * Cleanup on app quit
 */
function cleanupOnQuit() {
    if (executorManager) {
        console.log('[ExecutorIPC] Cleaning up executor manager...');
        executorManager.close();
        executorManager = null;
    }
}

module.exports = {
    initializeExecutorManager,
    registerExecutorHandlers,
    resumeActiveRunsOnStartup,
    cleanupOnQuit
};
