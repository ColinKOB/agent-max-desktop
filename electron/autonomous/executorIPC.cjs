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
            // Guard: reject null/undefined runIds (direct responses don't create runs)
            if (!runId) {
                console.log(`[ExecutorIPC] Ignoring start-run with null runId (likely direct response)`);
                return {
                    success: false,
                    error: 'No run ID provided - this may be a direct response that does not require execution'
                };
            }
            
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
            console.log(`[ExecutorIPC] 🛑 Stop requested for run: ${runId}`);
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

    // Emergency stop ALL runs
    ipcMain.handle('executor:stop-all', async (event) => {
        try {
            console.log(`[ExecutorIPC] 🛑 EMERGENCY STOP ALL requested`);
            executorManager.stopAllRuns();

            return {
                success: true
            };
        } catch (error) {
            console.error('[ExecutorIPC] Stop all error:', error);
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

    // Get system context (for sending to backend)
    ipcMain.handle('executor:get-system-context', async (event) => {
        try {
            const os = require('os');
            const path = require('path');
            
            const homeDir = os.homedir();
            const desktopPath = path.join(homeDir, 'Desktop');
            const username = os.userInfo().username;
            const platform = os.platform(); // 'darwin', 'linux', 'win32'
            const shell = process.env.SHELL || '/bin/zsh';
            
            return {
                os: platform === 'darwin' ? 'macOS' : (platform === 'win32' ? 'Windows' : 'Linux'),
                user: username,
                home_dir: homeDir,
                desktop_path: desktopPath,
                shell: shell.split('/').pop(),
                platform: platform
            };
        } catch (error) {
            console.error('[ExecutorIPC] Get system context error:', error);
            return {
                os: 'unknown',
                user: 'user',
                home_dir: require('os').homedir(),
                desktop_path: require('path').join(require('os').homedir(), 'Desktop'),
                shell: 'zsh',
                platform: 'unknown'
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

    // Set user context (e.g., google_user_email for Gmail integration)
    ipcMain.handle('pull-executor:set-context', async (event, context) => {
        try {
            if (executorManager && executorManager.executor) {
                executorManager.executor.setUserContext(context);
            }
            // Store globally for future executor instances
            global.executorUserContext = { ...(global.executorUserContext || {}), ...context };
            console.log('[ExecutorIPC] User context set:', Object.keys(context));
            return { success: true };
        } catch (error) {
            console.error('[ExecutorIPC] Set context error:', error);
            return { success: false, error: error.message };
        }
    });

    // Setup parallel agents handler - sends agent status updates to renderer
    if (executorManager && executorManager.executor) {
        executorManager.executor.setParallelAgentsHandler(({ runId, agents, status }) => {
            console.log(`[ExecutorIPC] Parallel agents update: ${agents.length} agents, status=${status}`);

            // Send to all windows
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('executor:parallel-agents-update', {
                        runId,
                        agents,
                        status
                    });
                }
            });
        });
    }

    // Setup ask_user handler - sends question to renderer and waits for response
    let pendingAskUserResolve = null;

    // Register the ask_user handler on the executor
    // Supports both single question and batched questions formats
    if (executorManager) {
        executorManager.setAskUserHandler(async ({ question, questions, context, options, runId, isBatched }) => {
            return new Promise((resolve, reject) => {
                // Check if this is batched format
                const hasBatchedQuestions = questions && Array.isArray(questions) && questions.length > 0;

                if (hasBatchedQuestions) {
                    console.log(`[ExecutorIPC] ask_user (batched): ${questions.length} questions`);
                } else {
                    console.log(`[ExecutorIPC] ask_user: "${(question || '').substring(0, 50)}..."`);
                }

                // Store resolve function for when renderer responds
                pendingAskUserResolve = resolve;

                // Build payload - support both single and batched formats
                const payload = {
                    context,
                    runId,
                    timestamp: Date.now()
                };

                if (hasBatchedQuestions) {
                    payload.questions = questions;
                    payload.isBatched = true;
                } else {
                    payload.question = question;
                    payload.options = options;
                    payload.isBatched = false;
                }

                // Send to all windows
                const { BrowserWindow } = require('electron');
                const windows = BrowserWindow.getAllWindows();
                console.log(`[ExecutorIPC] Sending ask_user to ${windows.length} window(s), batched: ${hasBatchedQuestions}`);
                windows.forEach(win => {
                    if (!win.isDestroyed()) {
                        console.log(`[ExecutorIPC] Sending executor:ask-user event to window ${win.id}`);
                        win.webContents.send('executor:ask-user', payload);
                    }
                });

                // Timeout after 5 minutes (user may be away)
                setTimeout(() => {
                    if (pendingAskUserResolve === resolve) {
                        pendingAskUserResolve = null;
                        resolve(null); // Null means cancelled/timeout
                    }
                }, 5 * 60 * 1000);
            });
        });
    }

    // Handle user response from renderer
    ipcMain.handle('executor:respond-to-question', async (event, response) => {
        // Response can be a string or an object from the UI
        // Object format: { cancelled, answer, selectedOption, selectedOptionId, editedContent, answers }
        // For batched questions, answers is an object like { cuisine: "italian", vibe: "casual" }
        let responseText = null;

        if (response === null || response === undefined) {
            responseText = null;
        } else if (typeof response === 'string') {
            responseText = response;
        } else if (typeof response === 'object') {
            if (response.cancelled) {
                responseText = null;
            } else if (response.answers && typeof response.answers === 'object') {
                // Batched answers format - convert to JSON string for the backend
                responseText = JSON.stringify(response.answers);
                console.log(`[ExecutorIPC] Batched answers:`, response.answers);
            } else if (response.editedContent) {
                // User edited the content
                responseText = response.editedContent;
            } else if (response.answer) {
                // User provided a custom answer
                responseText = response.answer;
            } else if (response.selectedOption) {
                // User selected an option
                responseText = response.selectedOption;
            }
        }

        console.log(`[ExecutorIPC] User responded: "${responseText?.substring?.(0, 50) || 'cancelled'}..."`);

        if (pendingAskUserResolve) {
            pendingAskUserResolve(responseText);
            pendingAskUserResolve = null;
            return { success: true };
        } else {
            console.warn('[ExecutorIPC] No pending question to respond to');
            return { success: false, error: 'No pending question' };
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
