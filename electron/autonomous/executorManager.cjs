/**
 * Executor Manager - Manages Phase 1 and Phase 2 executors
 * 
 * Handles:
 * - Executor initialization
 * - Run execution
 * - Resume on startup
 * - State management
 * - Online/offline detection
 */

const { PullExecutor } = require('./pullExecutor.cjs');
const { PullExecutorV2 } = require('./pullExecutorV2.cjs');
const { DesktopStateStore } = require('../storage/desktopStateStore.cjs');
const { NetworkMonitor } = require('../utils/networkMonitor.cjs');

class ExecutorManager {
    constructor(apiClient, config = {}) {
        this.apiClient = apiClient;
        this.config = config;
        
        // Feature flag for Phase 2
        this.usePhase2 = config.usePhase2 !== false; // Default: enabled
        
        // Initialize state store (Phase 2)
        this.stateStore = this.usePhase2 ? new DesktopStateStore() : null;
        
        // Initialize executor
        this.executor = this.usePhase2
            ? new PullExecutorV2(apiClient, this.stateStore, config)
            : new PullExecutor(apiClient, config);
        
        // Track active runs
        this.activeRuns = new Map();
        
        // Initialize network monitor (Phase 2)
        if (this.usePhase2) {
            this.networkMonitor = new NetworkMonitor({
                checkUrl: `${apiClient.baseUrl}/health`,
                checkIntervalMs: config.networkCheckIntervalMs || 10000
            });
            
            // Listen for network status changes
            this.networkMonitor.on('status-changed', (status) => {
                console.log(`[ExecutorManager] Network status: ${status.isOnline ? 'online' : 'offline'}`);
                this.executor.setOnlineStatus(status.isOnline);
            });
            
            // Start monitoring
            this.networkMonitor.start();
        }
        
        // Online status
        this.isOnline = true;
        
        console.log(`[ExecutorManager] Initialized with Phase ${this.usePhase2 ? '2' : '1'} executor`);
    }

    /**
     * Start a run
     */
    async startRun(runId) {
        if (this.activeRuns.has(runId)) {
            throw new Error(`Run ${runId} is already active`);
        }

        console.log(`[ExecutorManager] Starting run: ${runId}`);
        
        // Apply stored user context (e.g., google_user_email)
        if (global.executorUserContext && this.executor.setUserContext) {
            this.executor.setUserContext(global.executorUserContext);
            console.log(`[ExecutorManager] Applied user context:`, Object.keys(global.executorUserContext));
        }
        
        // Mark as active
        this.activeRuns.set(runId, {
            runId,
            startedAt: Date.now(),
            status: 'running'
        });

        try {
            // Execute run
            await this.executor.executeRun(runId);
            
            // Mark as complete
            this.activeRuns.get(runId).status = 'complete';
            this.activeRuns.get(runId).completedAt = Date.now();
            
            console.log(`[ExecutorManager] Run complete: ${runId}`);
            
        } catch (error) {
            console.error(`[ExecutorManager] Run failed: ${runId}`, error);
            
            // Mark as failed
            if (this.activeRuns.has(runId)) {
                this.activeRuns.get(runId).status = 'failed';
                this.activeRuns.get(runId).error = error.message;
            }
            
            throw error;
        } finally {
            // Clean up after delay
            setTimeout(() => {
                this.activeRuns.delete(runId);
            }, 60000); // Keep for 1 minute
        }
    }

    /**
     * Stop a run - now immediately terminates execution
     */
    stopRun(runId) {
        console.log(`[ExecutorManager] 🛑 STOP requested for run: ${runId}`);

        // Always call stop on executor - it will terminate any active execution
        if (this.executor) {
            if (this.executor.currentRunId === runId) {
                console.log(`[ExecutorManager] Stopping active executor (current run matches)`);
                this.executor.stop();
            } else if (this.executor.isRunning) {
                // Even if run IDs don't match, stop if something is running
                console.log(`[ExecutorManager] Stopping executor (different run but still running)`);
                this.executor.stop();
            } else {
                console.log(`[ExecutorManager] Executor not running, just updating status`);
            }
        }

        if (this.activeRuns.has(runId)) {
            this.activeRuns.get(runId).status = 'stopped';
            console.log(`[ExecutorManager] ✓ Run ${runId} marked as stopped`);
        }
    }

    /**
     * Stop ALL runs - emergency stop
     * Used when user clicks stop button without a specific run ID
     */
    stopAllRuns() {
        console.log(`[ExecutorManager] 🛑 EMERGENCY STOP - stopping ALL runs`);

        // Stop the executor immediately
        if (this.executor) {
            this.executor.stop();
            console.log(`[ExecutorManager] ✓ Executor stopped`);
        }

        // Mark all active runs as stopped
        for (const [runId, run] of this.activeRuns.entries()) {
            run.status = 'stopped';
            console.log(`[ExecutorManager] ✓ Run ${runId} marked as stopped`);
        }

        console.log(`[ExecutorManager] ✓ All runs stopped`);
    }

    /**
     * Get run status
     */
    getRunStatus(runId) {
        // Get in-memory status first
        const activeRun = this.activeRuns.get(runId);
        
        // Always check state store for complete data (especially final_response)
        if (this.stateStore) {
            const storeRun = this.stateStore.getRun(runId);
            if (storeRun) {
                // Merge activeRun timing with store data (store has final_response)
                return {
                    runId: storeRun.run_id,
                    status: storeRun.status,
                    currentStepIndex: storeRun.current_step_index,
                    totalSteps: storeRun.total_steps,
                    final_response: storeRun.final_response,
                    final_summary: storeRun.final_response,
                    // Current action status for UI visibility
                    current_status_summary: storeRun.current_status_summary,
                    // Include timing from activeRun if available
                    startedAt: activeRun?.startedAt,
                    completedAt: storeRun.completed_at
                };
            }
        }
        
        // Fallback to activeRun only if not in store
        if (activeRun) {
            return activeRun;
        }
        
        return null;
    }

    /**
     * List active runs
     */
    listActiveRuns() {
        const runs = Array.from(this.activeRuns.values());
        
        // Add runs from state store (Phase 2)
        if (this.stateStore) {
            const stateRuns = this.stateStore.listActiveRuns();
            for (const run of stateRuns) {
                if (!this.activeRuns.has(run.run_id)) {
                    runs.push({
                        runId: run.run_id,
                        status: run.status,
                        currentStepIndex: run.current_step_index,
                        totalSteps: run.total_steps
                    });
                }
            }
        }
        
        return runs;
    }

    /**
     * Resume active runs on startup (Phase 2 only)
     */
    async resumeActiveRuns() {
        if (!this.usePhase2) {
            console.log(`[ExecutorManager] Resume not available in Phase 1`);
            return;
        }

        console.log(`[ExecutorManager] Checking for runs to resume...`);
        
        try {
            await this.executor.resumeActiveRuns();
        } catch (error) {
            console.error(`[ExecutorManager] Error resuming runs:`, error);
        }
    }

    /**
     * Set online/offline status
     */
    setOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        
        if (this.usePhase2) {
            this.executor.setOnlineStatus(isOnline);
        }
        
        console.log(`[ExecutorManager] Network status: ${isOnline ? 'online' : 'offline'}`);
    }

    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            phase: this.usePhase2 ? 2 : 1,
            activeRuns: this.activeRuns.size,
            isOnline: this.isOnline
        };
        
        if (this.usePhase2 && this.executor.getStats) {
            stats.stateStore = this.executor.getStats();
        }
        
        return stats;
    }

    /**
     * Cleanup old runs
     */
    cleanup(olderThanDays = 7) {
        if (this.usePhase2 && this.executor.cleanup) {
            return this.executor.cleanup(olderThanDays);
        }
        return 0;
    }

    /**
     * Close and cleanup
     */
    close() {
        console.log(`[ExecutorManager] Closing...`);
        
        // Stop network monitor
        if (this.networkMonitor) {
            this.networkMonitor.stop();
        }
        
        if (this.executor.close) {
            this.executor.close();
        }
        
        this.activeRuns.clear();
    }
}

module.exports = { ExecutorManager };
