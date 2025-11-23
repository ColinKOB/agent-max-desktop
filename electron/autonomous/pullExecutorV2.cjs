/**
 * Pull-based executor V2 for Phase 2 Local-First Migration
 * 
 * Extends Phase 1 executor with:
 * - SQLite state persistence
 * - Resume after desktop restart
 * - Offline execution capability
 * - Background sync to cloud
 * 
 * Desktop owns execution state, cloud is just for monitoring.
 */

const { PullExecutor } = require('./pullExecutor.cjs');
const { DesktopStateStore } = require('../storage/desktopStateStore.cjs');

class PullExecutorV2 extends PullExecutor {
    constructor(apiClient, stateStore = null, config = {}) {
        super(apiClient, config);
        
        // Initialize state store
        this.stateStore = stateStore || new DesktopStateStore();
        
        // Offline mode flag
        this.isOnline = true;
        
        // Sync worker interval
        this.syncIntervalMs = config.syncIntervalMs || 5000; // 5 seconds
        this.syncWorker = null;
        
        console.log(`[PullExecutorV2] Initialized with state persistence`);
    }

    /**
     * Execute a run with state persistence (Phase 2)
     */
    async executeRun(runId) {
        if (this.isRunning) {
            throw new Error('Executor already running');
        }

        this.isRunning = true;
        this.currentRunId = runId;

        console.log(`[PullExecutorV2] Starting run ${runId}`);

        try {
            // Check if run exists in local state
            let run = this.stateStore.getRun(runId);
            
            if (!run) {
                // Pull plan from cloud and persist
                await this.pullAndPersistPlan(runId);
                run = this.stateStore.getRun(runId);
            } else {
                console.log(`[PullExecutorV2] Resuming run from local state`);
            }

            // Start background sync worker
            this.startSyncWorker();

            // Execute from local state
            await this.executeFromLocalState(runId);

        } catch (error) {
            console.error(`[PullExecutorV2] Fatal error:`, error);
            
            // Update run status to failed
            try {
                this.stateStore.updateRun(runId, {
                    status: 'failed',
                    completed_at: Date.now()
                });
            } catch (e) {
                console.error(`[PullExecutorV2] Failed to update run status:`, e);
            }
            
            throw error;
        } finally {
            this.isRunning = false;
            this.currentRunId = null;
            this.stopSyncWorker();
        }
    }

    /**
     * Pull plan from cloud and persist to local state
     */
    async pullAndPersistPlan(runId) {
        console.log(`[PullExecutorV2] Pulling plan for run ${runId}`);

        try {
            // Fetch plan from cloud (using Phase 1 pull endpoint)
            const nextStep = await this.fetchNextStep(runId, -1);
            
            if (nextStep.status === 'not_found') {
                throw new Error(`Run not found: ${runId}`);
            }

            // For now, we need to fetch the full plan
            // In future, backend should return full plan in first pull
            // For now, we'll create a minimal plan structure
            const plan = {
                plan_id: runId,
                run_id: runId,
                steps: [],
                user_id: null,
                message: null
            };

            // Create run in local state
            this.stateStore.createRun(runId, plan);
            
            console.log(`[PullExecutorV2] Plan persisted to local state`);
            
        } catch (error) {
            console.error(`[PullExecutorV2] Error pulling plan:`, error);
            throw error;
        }
    }

    /**
     * Execute from local state (Phase 2 core logic)
     */
    async executeFromLocalState(runId) {
        console.log(`[PullExecutorV2] Executing from local state`);

        while (this.isRunning) {
            // Get next pending step from local state
            let step = this.stateStore.getNextPendingStep(runId);

            // If no pending steps locally, try to pull from cloud
            if (!step) {
                const run = this.stateStore.getRun(runId);
                const cloudStep = await this.fetchNextStep(runId, run.current_step_index);

                if (cloudStep.status === 'complete') {
                    console.log(`[PullExecutorV2] Run complete`);
                    this.stateStore.updateRun(runId, {
                        status: 'complete',
                        completed_at: Date.now()
                    });
                    break;
                }

                if (cloudStep.status === 'ready') {
                    // Save new step to local state
                    this.stateStore.saveStep(runId, cloudStep.step_index, cloudStep.step);
                    step = this.stateStore.getStep(cloudStep.step.step_id);
                } else {
                    // No more steps
                    break;
                }
            }

            if (!step) break;

            // Execute step locally
            console.log(`[PullExecutorV2] Executing step ${step.step_index}`);
            
            // Mark step as running
            this.stateStore.updateStepStatus(step.step_id, 'running', {
                started_at: Date.now()
            });

            // Execute with retry
            const stepConfig = {
                step: step.step ? JSON.parse(step.step_json) : step,
                step_index: step.step_index,
                max_retries: this.maxRetries,
                timeout_sec: this.timeoutMs / 1000
            };
            
            const result = await this.executeStepWithRetry(stepConfig);

            // Save result to local state
            const resultId = this.stateStore.saveStepResult(
                step.step_id,
                step.run_id,
                step.step_index,
                result
            );

            // Update step status
            this.stateStore.updateStepStatus(step.step_id, result.success ? 'done' : 'failed', {
                completed_at: Date.now()
            });

            // Update run progress
            if (result.success) {
                this.stateStore.updateRun(runId, {
                    current_step_index: step.step_index
                });
            }

            // Queue sync to cloud
            this.stateStore.queueSync(runId, 'report_result', {
                step_index: step.step_index,
                result_id: resultId,
                result: result
            }, 1); // High priority

            // If step failed, stop execution
            if (!result.success) {
                console.error(`[PullExecutorV2] Step failed, stopping execution`);
                this.stateStore.updateRun(runId, {
                    status: 'failed',
                    completed_at: Date.now()
                });
                break;
            }
        }
    }

    /**
     * Start background sync worker
     */
    startSyncWorker() {
        if (this.syncWorker) return;

        console.log(`[PullExecutorV2] Starting sync worker`);
        
        this.syncWorker = setInterval(async () => {
            await this.processSyncQueue();
        }, this.syncIntervalMs);
    }

    /**
     * Stop background sync worker
     */
    stopSyncWorker() {
        if (this.syncWorker) {
            clearInterval(this.syncWorker);
            this.syncWorker = null;
            console.log(`[PullExecutorV2] Sync worker stopped`);
        }
    }

    /**
     * Process sync queue
     */
    async processSyncQueue() {
        if (!this.isOnline) {
            return; // Skip if offline
        }

        const pendingSyncs = this.stateStore.getPendingSyncs(5);
        
        if (pendingSyncs.length === 0) {
            return;
        }

        console.log(`[PullExecutorV2] Processing ${pendingSyncs.length} pending syncs`);

        for (const sync of pendingSyncs) {
            try {
                await this.processSync(sync);
                this.stateStore.markSyncCompleted(sync.queue_id);
                console.log(`[PullExecutorV2] Sync completed: ${sync.action} for run ${sync.run_id}`);
            } catch (error) {
                console.error(`[PullExecutorV2] Sync failed:`, error);
                this.stateStore.markSyncFailed(sync.queue_id, error.message, 10000); // Retry in 10s
            }
        }
    }

    /**
     * Process a single sync item
     */
    async processSync(sync) {
        const { action, payload } = sync;

        switch (action) {
            case 'report_result':
                await this.reportStepResult(sync.run_id, payload.step_index, payload.result);
                
                // Mark result as synced
                if (payload.result_id) {
                    this.stateStore.markResultSynced(payload.result_id);
                }
                break;

            case 'update_status':
                // Future: sync run status updates
                break;

            case 'complete_run':
                // Future: sync run completion
                break;

            default:
                console.warn(`[PullExecutorV2] Unknown sync action: ${action}`);
        }
    }

    /**
     * Resume active runs on startup
     */
    async resumeActiveRuns() {
        const activeRuns = this.stateStore.listActiveRuns();
        
        if (activeRuns.length === 0) {
            console.log(`[PullExecutorV2] No active runs to resume`);
            return;
        }

        console.log(`[PullExecutorV2] Resuming ${activeRuns.length} active runs`);

        for (const run of activeRuns) {
            try {
                console.log(`[PullExecutorV2] Resuming run: ${run.run_id}`);
                await this.executeRun(run.run_id);
            } catch (error) {
                console.error(`[PullExecutorV2] Failed to resume run ${run.run_id}:`, error);
            }
        }
    }

    /**
     * Set online/offline status
     */
    setOnlineStatus(isOnline) {
        const wasOnline = this.isOnline;
        this.isOnline = isOnline;
        
        console.log(`[PullExecutorV2] Network status: ${isOnline ? 'online' : 'offline'}`);

        // If just came online, process sync queue immediately
        if (!wasOnline && isOnline) {
            console.log(`[PullExecutorV2] Back online, processing sync queue`);
            this.processSyncQueue().catch(error => {
                console.error(`[PullExecutorV2] Error processing sync queue:`, error);
            });
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return this.stateStore.getStats();
    }

    /**
     * Cleanup old runs
     */
    cleanup(olderThanDays = 7) {
        return this.stateStore.cleanup(olderThanDays);
    }

    /**
     * Close and cleanup
     */
    close() {
        this.stopSyncWorker();
        if (this.stateStore) {
            this.stateStore.close();
        }
    }
}

module.exports = { PullExecutorV2 };
