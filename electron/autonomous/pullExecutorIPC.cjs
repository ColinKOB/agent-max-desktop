/**
 * IPC handlers for pull-based executor
 * Phase 1: Local-First Migration
 */

const { ipcMain } = require('electron');
const { PullExecutor } = require('./pullExecutor.cjs');

let pullExecutor = null;

/**
 * Register IPC handlers for pull-based execution
 */
function registerPullExecutorHandlers(apiClient) {
    // Start pull-based execution
    ipcMain.handle('pull-executor:start', async (event, runId) => {
        try {
            if (pullExecutor && pullExecutor.isRunning) {
                return {
                    success: false,
                    error: 'Executor already running'
                };
            }

            pullExecutor = new PullExecutor(apiClient);
            
            // Execute in background
            pullExecutor.executeRun(runId).catch(error => {
                console.error('[PullExecutorIPC] Execution error:', error);
            });

            return {
                success: true,
                runId: runId
            };
        } catch (error) {
            console.error('[PullExecutorIPC] Start error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Stop pull-based execution
    ipcMain.handle('pull-executor:stop', async (event) => {
        try {
            if (pullExecutor) {
                pullExecutor.stop();
                pullExecutor = null;
            }

            return {
                success: true
            };
        } catch (error) {
            console.error('[PullExecutorIPC] Stop error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get executor status
    ipcMain.handle('pull-executor:status', async (event) => {
        return {
            isRunning: pullExecutor ? pullExecutor.isRunning : false,
            currentRunId: pullExecutor ? pullExecutor.currentRunId : null
        };
    });

    console.log('[PullExecutorIPC] Handlers registered');
}

module.exports = { registerPullExecutorHandlers };
