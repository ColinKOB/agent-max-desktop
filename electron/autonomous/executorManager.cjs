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
     * Stop a run
     */
    stopRun(runId) {
        console.log(`[ExecutorManager] Stopping run: ${runId}`);
        
        if (this.executor.currentRunId === runId) {
            this.executor.stop();
        }
        
        if (this.activeRuns.has(runId)) {
            this.activeRuns.get(runId).status = 'stopped';
        }
    }

    /**
     * Get run status
     */
    getRunStatus(runId) {
        if (this.activeRuns.has(runId)) {
            return this.activeRuns.get(runId);
        }
        
        // Check state store (Phase 2)
        if (this.stateStore) {
            const run = this.stateStore.getRun(runId);
            if (run) {
                return {
                    runId: run.run_id,
                    status: run.status,
                    currentStepIndex: run.current_step_index,
                    totalSteps: run.total_steps,
                    final_response: run.final_response,  // Include final response for completed runs
                    final_summary: run.final_response    // Alias for UI compatibility
                };
            }
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
