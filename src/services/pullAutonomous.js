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
import useStore from '../store/useStore';

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
            const result = await this.createRun(message, context);
            
            // NEW: Check if this is a direct response (question/conversation/clarify)
            // These don't create runs - the AI answered directly
            // Note: 'code' and 'task' types DO create runs
            if (result.type && !['task', 'code'].includes(result.type)) {
                logger.info('[PullAutonomous] Direct response (no run needed)', { 
                    type: result.type 
                });
                
                // Return a "completed" tracker with the response
                return {
                    runId: null,
                    type: result.type,
                    response: result.response,
                    status: 'done',
                    startTime: Date.now(),
                    totalSteps: 0,
                    currentStep: 0,
                    events: [],
                    isDirectResponse: true  // Flag for UI to know this was answered directly
                };
            }
            
            // For tasks and code, proceed with normal execution
            const isCodeTask = result.type === 'code' || result.is_code_task;
            if (isCodeTask) {
                logger.info('[PullAutonomous] Code task detected - using expanded prompt', { 
                    runId: result.run_id,
                    intent: result.intent?.substring(0, 100)
                });
            }
            logger.info('[PullAutonomous] Run created', { runId: result.run_id });

            // NEW: Check if intent confirmation is required
            if (result.requires_confirmation && result.intent_confirmation) {
                logger.info('[PullAutonomous] Intent confirmation required', {
                    runId: result.run_id,
                    intent: result.intent_confirmation.detected_intent?.substring(0, 100)
                });

                // Return tracker with pending confirmation state
                const runTracker = {
                    runId: result.run_id,
                    startTime: Date.now(),
                    status: 'awaiting_confirmation',
                    requiresConfirmation: true,
                    intentConfirmation: result.intent_confirmation,
                    plan: result.plan || null,
                    steps: result.plan?.steps || [],
                    totalSteps: result.total_steps || 0,
                    currentStep: null,
                    events: [],
                    goalSummary: result.plan?.goal_summary,
                    definitionOfDone: result.definition_of_done,
                    intent: result.intent
                };

                this.activeRuns.set(result.run_id, runTracker);
                return runTracker;
            }

            // Step 2: Request desktop executor to start (via IPC)
            await window.executor.startRun(result.run_id);
            logger.info('[PullAutonomous] Executor started', { runId: result.run_id });

            // Step 3: Track run and poll for updates
            const runTracker = {
                runId: result.run_id,
                startTime: Date.now(),
                status: result.status || 'running',
                requiresConfirmation: false,
                plan: result.plan || null,
                steps: result.plan?.steps || [],
                totalSteps: result.total_steps || 0,
                currentStep: null,
                events: [],
                goalSummary: result.plan?.goal_summary,
                definitionOfDone: result.definition_of_done,
                intent: result.intent  // User-facing intent for iterative runs
            };

            this.activeRuns.set(result.run_id, runTracker);

            // Return run tracker for UI to monitor
            return runTracker;

        } catch (error) {
            logger.error('[PullAutonomous] Execution failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Create a run via backend API (using main process for network stability)
     */
    async createRun(message, context) {
        // Get system context from desktop (where files will actually be created)
        const systemContext = await window.executor.getSystemContext();
        
        // PRODUCTIVITY FEATURE: Capture screenshot for context on every auto-mode request
        // This gives Max visual context of what the user is looking at when they send a request
        let initialScreenshot = null;
        try {
            const screenshotStart = Date.now();
            const screenshotResult = await window.executor.captureScreen();
            if (screenshotResult?.base64) {
                initialScreenshot = screenshotResult.base64;
                const captureTime = Date.now() - screenshotStart;
                logger.info('[PullAutonomous] Screen captured for context', { 
                    sizeKB: Math.round(initialScreenshot.length / 1024),
                    captureTimeMs: captureTime
                });
            }
        } catch (e) {
            // Screenshot capture is optional - don't fail the request if it doesn't work
            logger.warn('[PullAutonomous] Could not capture screen (non-fatal)', e?.message || e);
        }
        
        // Include user_id for billing (token accrual)
        // Try multiple sources: localStorage, then global store
        let userId = null;
        try {
            userId = localStorage.getItem('user_id');
            
            // Fallback to store if localStorage doesn't have it
            if (!userId) {
                const currentUser = useStore.getState().currentUser;
                userId = currentUser?.id;
            }
        } catch (e) {
            logger.warn('[PullAutonomous] Could not get user_id', e);
        }
        
        // Get google_user_email for Gmail integration
        let googleUserEmail = null;
        try {
            googleUserEmail = localStorage.getItem('google_user_email');
        } catch (e) {
            logger.warn('[PullAutonomous] Could not get google_user_email', e);
        }
        
        // Merge userId, screenshot, and google_user_email into context
        const enrichedContext = {
            ...context,
            userId: userId || context?.userId,
            // Include initial screenshot for AI context (optional - may be null)
            initial_screenshot_b64: initialScreenshot,
            // Include google_user_email for Gmail/Calendar integration
            google_user_email: googleUserEmail || context?.google_user_email
        };
        
        // Use main process IPC for stable network calls with automatic retry
        // This avoids ERR_NETWORK_CHANGED errors from renderer process
        logger.info('[PullAutonomous] Creating run via main process (stable network)', { userId });
        
        try {
            const result = await window.executor.createRun(message, enrichedContext, systemContext);
            
            // Check if planning failed (backend returns success: false)
            if (result.success === false) {
                const errorMsg = result.error || 'Planning failed';
                logger.error('[PullAutonomous] Planning failed', { 
                    error: errorMsg, 
                    errorCode: result.error_code 
                });
                throw new Error(errorMsg);
            }

            logger.info('[PullAutonomous] ✓ Run created successfully', { runId: result.run_id });
            return result;
            
        } catch (error) {
            logger.error('[PullAutonomous] Failed to create run', { error: error.message });
            throw error;
        }
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
                const result = await window.executor.getStatus(runId);
                
                // Handle IPC response wrapper
                const status = result?.success ? result.status : result;
                
                console.log('[PullAutonomous] Poll result:', { result, status, hasStatus: !!status });
                
                if (status) {
                    // Update tracker
                    tracker.status = status.status;
                    tracker.currentStep = status.currentStepIndex;
                    tracker.totalSteps = status.totalSteps;
                    tracker.final_response = status.final_response;
                    tracker.final_summary = status.final_summary || status.final_response;
                    // Current action status for UI visibility
                    tracker.current_status_summary = status.current_status_summary;
                    // Initial AI message (first action acknowledgment)
                    if (status.initial_message) {
                        tracker.initial_message = status.initial_message;
                    }
                    
                    console.log('[PullAutonomous] Raw status from IPC:', JSON.stringify(status, null, 2));
                    console.log('[PullAutonomous] Updated tracker:', { 
                        status: tracker.status, 
                        currentStep: tracker.currentStep,
                        totalSteps: tracker.totalSteps,
                        hasFinalResponse: !!tracker.final_response,
                        finalResponsePreview: tracker.final_response?.substring(0, 100)
                    });
                    
                    // Notify UI
                    onUpdate(tracker);

                    // Continue polling if still running
                    if (status.status === 'running' || status.status === 'executing') {
                        console.log('[PullAutonomous] Still running, continuing poll...');
                        setTimeout(poll, this.pollIntervalMs);
                    } else {
                        // Run complete
                        console.log('[PullAutonomous] Run finished with status:', status.status);
                        logger.info('[PullAutonomous] Run complete', { 
                            runId, 
                            status: status.status 
                        });
                        this.activeRuns.delete(runId);
                    }
                } else {
                    // No status yet, keep polling
                    console.log('[PullAutonomous] No status, continuing poll...');
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

    /**
     * Confirm intent and start execution
     */
    async confirmIntent(runId) {
        logger.info('[PullAutonomous] Confirming intent', { runId });

        try {
            const config = apiConfigManager.getConfig();
            const response = await fetch(
                `${config.baseURL}/api/v2/runs/${runId}/confirm-intent`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': config.apiKey
                    },
                    body: JSON.stringify({ approved: true })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to confirm intent');
            }

            const result = await response.json();
            logger.info('[PullAutonomous] Intent confirmed', { runId, result });

            // Now start the executor
            const tracker = this.activeRuns.get(runId);
            if (tracker) {
                tracker.status = 'running';
                tracker.requiresConfirmation = false;
            }

            await window.executor.startRun(runId);
            logger.info('[PullAutonomous] Executor started after confirmation', { runId });

            return { success: true, runId };

        } catch (error) {
            logger.error('[PullAutonomous] Failed to confirm intent', {
                runId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Reject intent - user wants to refine their request
     */
    async rejectIntent(runId, reason = 'user') {
        logger.info('[PullAutonomous] Rejecting intent', { runId, reason });

        try {
            const config = apiConfigManager.getConfig();
            const response = await fetch(
                `${config.baseURL}/api/v2/runs/${runId}/confirm-intent`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': config.apiKey
                    },
                    body: JSON.stringify({ approved: false })
                }
            );

            // Clean up tracker
            this.activeRuns.delete(runId);

            logger.info('[PullAutonomous] Intent rejected', { runId, reason });
            return { success: true, runId, reason };

        } catch (error) {
            logger.error('[PullAutonomous] Failed to reject intent', {
                runId,
                error: error.message
            });
            // Still clean up locally even if API call fails
            this.activeRuns.delete(runId);
            return { success: true, runId, reason };
        }
    }

    /**
     * Cancel an active retry session
     */
    async cancelRetry(runId, stepIndex) {
        logger.info('[PullAutonomous] Cancelling retry', { runId, stepIndex });

        try {
            const config = apiConfigManager.getConfig();
            const response = await fetch(
                `${config.baseURL}/api/v2/runs/${runId}/steps/${stepIndex}/cancel-retry`,
                {
                    method: 'POST',
                    headers: {
                        'X-API-Key': config.apiKey
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to cancel retry');
            }

            const result = await response.json();
            logger.info('[PullAutonomous] Retry cancelled', { runId, stepIndex, result });
            return result;

        } catch (error) {
            logger.error('[PullAutonomous] Failed to cancel retry', {
                runId,
                stepIndex,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get active retry sessions for a run
     */
    async getActiveRetries(runId) {
        try {
            const config = apiConfigManager.getConfig();
            const response = await fetch(
                `${config.baseURL}/api/v2/runs/${runId}/retries`,
                {
                    headers: {
                        'X-API-Key': config.apiKey
                    }
                }
            );

            if (response.ok) {
                return await response.json();
            }

            return { active_retries: 0, sessions: [] };

        } catch (error) {
            logger.error('[PullAutonomous] Failed to get retries', {
                runId,
                error: error.message
            });
            return { active_retries: 0, sessions: [] };
        }
    }
}

// Singleton instance
const pullAutonomousService = new PullAutonomousService();

export { pullAutonomousService, PullAutonomousService };
