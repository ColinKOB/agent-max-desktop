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
     * For iterative runs, we just create an empty run - the first action
     * will be fetched in executeFromLocalState to avoid wasting an LLM call.
     */
    async pullAndPersistPlan(runId) {
        console.log(`[PullExecutorV2] Creating run entry for ${runId}`);

        try {
            // Create a minimal run structure
            // For iterative execution, we don't fetch from cloud here
            // The first action will be fetched in executeFromLocalState
            const plan = {
                plan_id: runId,
                run_id: runId,
                steps: [],
                user_id: null,
                message: null
            };

            // Create run in local state
            this.stateStore.createRun(runId, plan);

            console.log(`[PullExecutorV2] Run entry created in local state`);

        } catch (error) {
            console.error(`[PullExecutorV2] Error creating run:`, error);
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
            console.log(`[PullExecutorV2] Next pending step from local state:`, step ? `step ${step.step_index}` : 'none');

            // If no pending steps locally, try to pull from cloud
            if (!step) {
                const run = this.stateStore.getRun(runId);
                // current_step_index points to NEXT step, so subtract 1 to get last completed
                const lastCompleted = run.current_step_index > 0 ? run.current_step_index - 1 : -1;
                console.log(`[PullExecutorV2] Fetching next step from cloud: last_completed=${lastCompleted}, current_step_index=${run.current_step_index}`);
                const cloudStep = await this.fetchNextStep(runId, lastCompleted);
                console.log(`[PullExecutorV2] Cloud step response:`, cloudStep ? cloudStep.status : 'null');

                if (cloudStep.status === 'complete') {
                    console.log(`[PullExecutorV2] Run complete`);
                    console.log(`[PullExecutorV2] Final response:`, cloudStep.final_response?.substring(0, 200));
                    this.stateStore.updateRun(runId, {
                        status: 'complete',
                        completed_at: Date.now(),
                        final_response: cloudStep.final_response || cloudStep.final_status
                    });
                    break;
                }

                if (cloudStep.status === 'ready') {
                    console.log(`[PullExecutorV2] Got new step from cloud: step ${cloudStep.step_index}`);
                    // Save new step to local state
                    this.stateStore.saveStep(runId, cloudStep.step_index, cloudStep.step);
                    step = this.stateStore.getStep(cloudStep.step.step_id);

                    // Update run with current status_summary for UI visibility
                    const statusSummary = cloudStep.status_summary || cloudStep.step?.description || `Executing step ${cloudStep.step_index + 1}`;
                    const updates = {
                        current_status_summary: statusSummary
                    };

                    // Save initial_message if present (first action only)
                    if (cloudStep.initial_message) {
                        updates.initial_message = cloudStep.initial_message;
                        console.log(`[PullExecutorV2] Captured initial_message: ${cloudStep.initial_message}`);
                    }

                    this.stateStore.updateRun(runId, updates);
                    console.log(`[PullExecutorV2] Updated status_summary: ${statusSummary}`);
                } else {
                    console.log(`[PullExecutorV2] Unexpected cloud step status: ${cloudStep.status}, stopping execution`);
                    // No more steps
                    break;
                }
            }

            if (!step) {
                console.log(`[PullExecutorV2] No step available, breaking loop`);
                break;
            }

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

            // Report result to backend IMMEDIATELY before fetching next step
            // This prevents out_of_sync errors in multi-step plans
            try {
                console.log(`[PullExecutorV2] Reporting step ${step.step_index} result to backend`);
                // Extract action info from step
                const stepData = step.step ? JSON.parse(step.step_json) : step;
                const action = {
                    tool_name: stepData.tool_name || stepData.tool,
                    args: stepData.args || {},
                    status_summary: stepData.description || stepData.goal || 'Step completed'
                };
                await this.reportStepResult(runId, step.step_index, result, action);
                
                // Mark result as synced
                if (resultId) {
                    this.stateStore.markResultSynced(resultId);
                }
                console.log(`[PullExecutorV2] Step ${step.step_index} result reported successfully`);
            } catch (error) {
                console.error(`[PullExecutorV2] Failed to report step result:`, error);
                // Queue for retry - include action for retry
                const stepData = step.step ? JSON.parse(step.step_json) : step;
                const action = {
                    tool_name: stepData.tool_name || stepData.tool,
                    args: stepData.args || {},
                    status_summary: stepData.description || stepData.goal || 'Step completed'
                };
                this.stateStore.queueSync(runId, 'report_result', {
                    step_index: step.step_index,
                    result_id: resultId,
                    result: result,
                    action: action
                }, 1);
            }

            // Update run progress
            if (result.success) {
                this.stateStore.updateRun(runId, {
                    current_step_index: step.step_index + 1  // Point to NEXT step
                });
            }

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
                await this.reportStepResult(sync.run_id, payload.step_index, payload.result, payload.action || {});
                
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
