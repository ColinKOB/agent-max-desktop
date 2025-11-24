/**
 * Pull-based Autonomous Execution Service
 * 
 * Replaces SSE streaming with pull-based execution:
 * - Creates run via backend
 * - Executor pulls and executes locally
 * - UI polls for status updates
 */

import { logger } from './logger';
import apiConfigManager from '../config/apiConfig';

class PullAutonomousService {
    constructor() {
        this.activeRuns = new Map();
        this.pollIntervalMs = 1000; // Poll every second
        this.maxPollTime = 300000; // 5 minutes max
    }

    /**
     * Execute a message using pull-based approach
     */
    async execute(message, context = {}) {
        logger.info('[PullAutonomous] Starting execution', { message });

        try {
            // Step 1: Create run via backend
            const run = await this.createRun(message, context);
            logger.info('[PullAutonomous] Run created', { runId: run.run_id });

            // Step 2: Request desktop executor to start (via IPC)
            await window.executor.startRun(run.run_id);
            logger.info('[PullAutonomous] Executor started', { runId: run.run_id });

            // Step 3: Track run and poll for updates
            const runTracker = {
                runId: run.run_id,
                startTime: Date.now(),
                status: run.status || 'running',
                plan: run.plan || null,
                steps: run.plan?.steps || [],
                totalSteps: run.total_steps || 0,
                currentStep: null,
                events: [],
                goalSummary: run.plan?.goal_summary,
                definitionOfDone: run.plan?.definition_of_done
            };

            this.activeRuns.set(run.run_id, runTracker);

            // Return run tracker for UI to monitor
            return runTracker;

        } catch (error) {
            logger.error('[PullAutonomous] Execution failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Create a run via backend API
     */
    async createRun(message, context) {
        const config = apiConfigManager.getConfig();
        
        // Get system context from desktop (where files will actually be created)
        const systemContext = await window.executor.getSystemContext();
        
        const response = await fetch(`${config.baseURL}/api/v2/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': config.apiKey,
                'X-User-Id': context.userId || 'desktop_user'
            },
            body: JSON.stringify({
                message,
                context: {
                    ...context,
                    system: systemContext // Add desktop system context
                },
                mode: 'autonomous',
                execution_mode: 'pull' // Signal pull-based execution
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create run: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Poll for run status updates
     */
    async pollRunStatus(runId, onUpdate) {
        const tracker = this.activeRuns.get(runId);
        if (!tracker) {
            logger.warn('[PullAutonomous] Run not found', { runId });
            return;
        }

        const startTime = Date.now();
        
        const poll = async () => {
            // Check timeout
            if (Date.now() - startTime > this.maxPollTime) {
                logger.warn('[PullAutonomous] Poll timeout', { runId });
                tracker.status = 'timeout';
                onUpdate(tracker);
                return;
            }

            try {
                // Get status from executor (via IPC)
                const status = await window.executor.getStatus(runId);
                
                if (status) {
                    // Update tracker
                    tracker.status = status.status;
                    tracker.currentStep = status.currentStepIndex;
                    tracker.totalSteps = status.totalSteps;
                    
                    // Notify UI
                    onUpdate(tracker);

                    // Continue polling if still running
                    if (status.status === 'running' || status.status === 'executing') {
                        setTimeout(poll, this.pollIntervalMs);
                    } else {
                        // Run complete
                        logger.info('[PullAutonomous] Run complete', { 
                            runId, 
                            status: status.status 
                        });
                        this.activeRuns.delete(runId);
                    }
                } else {
                    // No status yet, keep polling
                    setTimeout(poll, this.pollIntervalMs);
                }

            } catch (error) {
                logger.error('[PullAutonomous] Poll error', { error: error.message });
                tracker.status = 'error';
                tracker.error = error.message;
                onUpdate(tracker);
            }
        };

        // Start polling
        poll();
    }

    /**
     * Get detailed run information
     */
    async getRunDetails(runId) {
        try {
            // Get from executor first (has most recent data)
            const executorStatus = await window.executor.getStatus(runId);
            
            if (executorStatus) {
                return executorStatus;
            }

            // Fall back to backend API
            const config = apiConfigManager.getConfig();
            const response = await fetch(
                `${config.baseURL}/api/v2/runs/${runId}`,
                {
                    headers: {
                        'X-API-Key': config.apiKey
                    }
                }
            );

            if (response.ok) {
                return await response.json();
            }

            return null;

        } catch (error) {
            logger.error('[PullAutonomous] Failed to get run details', { 
                runId, 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Get step details
     */
    async getStepDetails(runId, stepIndex) {
        try {
            const config = apiConfigManager.getConfig();
            const response = await fetch(
                `${config.baseURL}/api/v2/runs/${runId}/steps/${stepIndex}`,
                {
                    headers: {
                        'X-API-Key': config.apiKey
                    }
                }
            );

            if (response.ok) {
                return await response.json();
            }

            return null;

        } catch (error) {
            logger.error('[PullAutonomous] Failed to get step details', { 
                runId, 
                stepIndex,
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Stop a running execution
     */
    async stopRun(runId) {
        logger.info('[PullAutonomous] Stopping run', { runId });

        try {
            // Stop executor
            await window.executor.stopRun(runId);

            // Clean up tracker
            this.activeRuns.delete(runId);

            logger.info('[PullAutonomous] Run stopped', { runId });

        } catch (error) {
            logger.error('[PullAutonomous] Failed to stop run', { 
                runId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get all active runs
     */
    async getActiveRuns() {
        try {
            const result = await window.executor.listActive();
            return result.runs || [];
        } catch (error) {
            logger.error('[PullAutonomous] Failed to list active runs', { 
                error: error.message 
            });
            return [];
        }
    }

    /**
     * Get executor statistics
     */
    async getStats() {
        try {
            const result = await window.executor.getStats();
            return result.stats || {};
        } catch (error) {
            logger.error('[PullAutonomous] Failed to get stats', { 
                error: error.message 
            });
            return {};
        }
    }
}

// Singleton instance
const pullAutonomousService = new PullAutonomousService();

export { pullAutonomousService, PullAutonomousService };
