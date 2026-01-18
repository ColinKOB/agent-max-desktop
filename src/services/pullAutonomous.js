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
        this.pollTimeouts = new Map(); // Track poll timeouts for cancellation
        this.pollIntervalMs = 1000; // Poll every second
        this.maxPollTime = 300000; // 5 minutes max
        this.isStopped = false; // Flag to prevent new polls after stop
    }

    /**
     * Stop all polling and mark service as stopped
     */
    stopPolling() {
        logger.info('[PullAutonomous] Stopping all polling');
        this.isStopped = true;

        // Clear all active poll timeouts
        for (const [runId, timeoutId] of this.pollTimeouts) {
            clearTimeout(timeoutId);
            logger.info('[PullAutonomous] Cleared poll timeout for run:', runId);
        }
        this.pollTimeouts.clear();

        // Mark all active runs as cancelled
        for (const [runId, tracker] of this.activeRuns) {
            tracker.status = 'cancelled';
            logger.info('[PullAutonomous] Marked run as cancelled:', runId);
        }
        this.activeRuns.clear();
    }

    /**
     * Reset the stopped state (call when starting new execution)
     */
    resetStopState() {
        this.isStopped = false;
    }

    /**
     * Execute a message using pull-based approach
     * @param {string} message - User message
     * @param {object} context - User context (profile, facts, etc.)
     * @param {string|null} userImage - Optional user-provided image (base64 data URL from drag-drop)
     */
    async execute(message, context = {}, userImage = null) {
        logger.info('[PullAutonomous] Starting execution', { message, hasUserImage: !!userImage });

        try {
            // Step 1: Create run via backend
            const result = await this.createRun(message, context, userImage);
            
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
     * @param {string} message - User message
     * @param {object} context - User context
     * @param {string|null} userImage - Optional user-provided image (takes priority over auto-capture)
     */
    async createRun(message, context, userImage = null) {
        // Get system context from desktop (where files will actually be created)
        const systemContext = await window.executor.getSystemContext();

        // PRODUCTIVITY FEATURE: Capture screenshot for context on every auto-mode request
        // This gives Max visual context of what the user is looking at when they send a request
        // NOTE: User-provided images (drag-drop) take priority over auto-captured screenshots
        let initialScreenshot = null;

        if (userImage) {
            // User explicitly attached an image - use that instead of auto-capture
            // Strip data URL prefix if present for consistency
            initialScreenshot = userImage.startsWith('data:')
                ? userImage.split(',')[1]  // Extract just the base64 part
                : userImage;
            logger.info('[PullAutonomous] Using user-provided image', {
                sizeKB: Math.round(initialScreenshot.length / 1024)
            });
        } else {
            // No user image - capture screen automatically
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

        // Get browser mode preference for tool filtering
        let browserMode = 'both';
        try {
            browserMode = localStorage.getItem('pref_browser_mode') || 'both';
        } catch (e) {
            logger.warn('[PullAutonomous] Could not get browser_mode', e);
        }

        // ACTIVE TOOLS CONTEXT: Get status of currently open tools (spreadsheet, workspace, etc.)
        // This tells the AI what tools are currently active so it can understand context like "update this"
        let activeTools = {};
        try {
            // Check spreadsheet status
            if (window.spreadsheet?.getDetailedStatus) {
                const spreadsheetStatus = await window.spreadsheet.getDetailedStatus();
                if (spreadsheetStatus?.active) {
                    activeTools.spreadsheet = spreadsheetStatus;
                    logger.info('[PullAutonomous] Active spreadsheet detected', {
                        file: spreadsheetStatus.file?.name,
                        sheets: spreadsheetStatus.sheets?.length
                    });
                }
            }

            // Check workspace/browser status
            if (window.workspace?.getStatus) {
                const workspaceStatus = await window.workspace.getStatus();
                if (workspaceStatus?.active) {
                    activeTools.workspace = workspaceStatus;
                    logger.info('[PullAutonomous] Active workspace detected', {
                        url: workspaceStatus.currentUrl
                    });
                }
            }
        } catch (e) {
            logger.warn('[PullAutonomous] Could not get active tools status (non-fatal)', e?.message || e);
        }

        // Merge userId, screenshot, google_user_email, browser_mode, and active_tools into context
        const enrichedContext = {
            ...context,
            userId: userId || context?.userId,
            // Include initial screenshot for AI context (optional - may be null)
            initial_screenshot_b64: initialScreenshot,
            // Include google_user_email for Gmail/Calendar integration
            google_user_email: googleUserEmail || context?.google_user_email,
            // Include browser_mode for tool filtering (workspace_only, safari_only, both)
            browser_mode: browserMode,
            // Include active tools for context awareness (spreadsheet, workspace, etc.)
            active_tools: Object.keys(activeTools).length > 0 ? activeTools : null
        };
        logger.info('[PullAutonomous] Browser mode:', browserMode);
        if (Object.keys(activeTools).length > 0) {
            logger.info('[PullAutonomous] Active tools:', Object.keys(activeTools));
        }
        
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
        // Reset stop state when starting a new poll
        this.isStopped = false;

        const tracker = this.activeRuns.get(runId);
        if (!tracker) {
            logger.warn('[PullAutonomous] Run not found', { runId });
            return;
        }

        const startTime = Date.now();

        const poll = async () => {
            // Check if polling was stopped
            if (this.isStopped) {
                logger.info('[PullAutonomous] Polling stopped, exiting poll loop', { runId });
                this.pollTimeouts.delete(runId);
                return;
            }

            // Check timeout
            if (Date.now() - startTime > this.maxPollTime) {
                logger.warn('[PullAutonomous] Poll timeout', { runId });
                tracker.status = 'timeout';
                this.pollTimeouts.delete(runId);
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

                    // Continue polling if still running or waiting for user (and not stopped)
                    const shouldContinuePolling = !this.isStopped && (
                        status.status === 'running' ||
                        status.status === 'executing' ||
                        status.status === 'waiting_for_user'  // Keep polling while waiting for user input
                    );

                    if (shouldContinuePolling) {
                        console.log('[PullAutonomous] Still active, continuing poll...', { status: status.status });
                        const timeoutId = setTimeout(poll, this.pollIntervalMs);
                        this.pollTimeouts.set(runId, timeoutId);
                    } else {
                        // Run complete, failed, cancelled, or stopped
                        console.log('[PullAutonomous] Run finished with status:', status.status);
                        logger.info('[PullAutonomous] Run complete', {
                            runId,
                            status: status.status,
                            wasCancelled: status.status === 'cancelled'
                        });
                        this.pollTimeouts.delete(runId);
                        this.activeRuns.delete(runId);
                    }
                } else {
                    // No status yet, keep polling (if not stopped)
                    if (!this.isStopped) {
                        console.log('[PullAutonomous] No status, continuing poll...');
                        const timeoutId = setTimeout(poll, this.pollIntervalMs);
                        this.pollTimeouts.set(runId, timeoutId);
                    }
                }

            } catch (error) {
                logger.error('[PullAutonomous] Poll error', { error: error.message });
                tracker.status = 'error';
                tracker.error = error.message;
                this.pollTimeouts.delete(runId);
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
