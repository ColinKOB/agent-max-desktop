/**
 * Pull-based executor for Phase 1 Local-First Migration
 * 
 * Desktop pulls next step from cloud instead of waiting for SSE push.
 * This enables desktop to survive SSE disconnections and control execution timing.
 * 
 * Feature flag: ENABLE_DESKTOP_PULL (default: enabled)
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// macOS AppleScript tools (Safari, Notes, Mail, Calendar, Finder, Reminders)
const { executeMacOSTool, isMacOSTool } = require('./macosAppleScript.cjs');

// Workspace manager for isolated AI browser
const { workspaceManager } = require('../workspace/workspaceManager.cjs');

// Analytics for tool failure tracking
let analytics = null;
try {
    analytics = require('../analytics/posthog-main.cjs');
} catch (e) {
    console.warn('[PullExecutor] Analytics not available:', e.message);
}

class PullExecutor {
    constructor(apiClient, config = {}) {
        this.apiClient = apiClient;
        this.maxRetries = config.maxRetries || 3;
        this.timeoutMs = config.timeoutMs || 90000; // 90 seconds
        this.pollIntervalMs = config.pollIntervalMs || 1000;
        this.isRunning = false;
        this.currentRunId = null;
        this.stepResults = []; // Track completed steps for context
        this.userContext = {}; // User-specific context (e.g., google_user_email)

        // Location cache (fetched from IP)
        this.cachedLocation = null;
        this.locationFetchedAt = null;

        // Fetch location on startup (async, non-blocking)
        this.fetchUserLocation().then(() => {
            // Update system context after location is fetched
            this.systemContext = this.getSystemContext();
        });

        // Initialize system context (may not have location yet)
        this.systemContext = this.getSystemContext();

        // Cancellation support - allows interrupting active operations
        this.abortController = null;
        this.activeChildProcesses = new Set(); // Track spawned processes for cleanup

        // Callback for ask_user - UI should set this to handle user questions
        this.onAskUser = null;
    }

    /**
     * Set the callback for handling ask_user questions.
     * The callback should return a Promise that resolves to the user's response string,
     * or null/undefined if the user cancels.
     */
    setAskUserHandler(handler) {
        this.onAskUser = handler;
    }

    /**
     * Check if execution has been cancelled and throw if so
     * Call this at strategic points during execution
     */
    checkCancellation() {
        if (!this.isRunning) {
            const error = new Error('Execution cancelled');
            error.code = 'CANCELLED';
            throw error;
        }
    }

    /**
     * Create a cancellable promise wrapper
     * Allows async operations to be interrupted when stop() is called
     */
    withCancellation(promise) {
        return new Promise((resolve, reject) => {
            // Check if already cancelled
            if (!this.isRunning) {
                const error = new Error('Execution cancelled');
                error.code = 'CANCELLED';
                reject(error);
                return;
            }

            // Set up abort handling
            const onAbort = () => {
                const error = new Error('Execution cancelled');
                error.code = 'CANCELLED';
                reject(error);
            };

            // Store cleanup callback
            this._cancelCallback = onAbort;

            promise
                .then(result => {
                    this._cancelCallback = null;
                    resolve(result);
                })
                .catch(err => {
                    this._cancelCallback = null;
                    reject(err);
                });
        });
    }
    
    /**
     * Set user context (called from renderer with user-specific data)
     */
    setUserContext(context) {
        this.userContext = { ...this.userContext, ...context };
        console.log('[PullExecutor] User context updated:', Object.keys(this.userContext));
    }
    
    /**
     * Get system context for arg generation
     */
    getSystemContext() {
        const os = require('os');
        const path = require('path');

        // Get timezone and locale info
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';

        // Try to infer country from locale (e.g., 'en-US' -> 'US')
        const localeParts = locale.split('-');
        const country = localeParts.length > 1 ? localeParts[1] : null;

        // Get current time for context
        const now = new Date();
        const localTime = now.toLocaleString(locale, {
            timeZone: timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        // Get cached location if available
        const locationData = this.cachedLocation || {};

        return {
            os: os.platform(),
            user: os.userInfo().username,
            home_dir: os.homedir(),
            desktop_path: path.join(os.homedir(), 'Desktop'),
            shell: process.env.SHELL || 'bash',
            // Location context
            timezone: timezone,
            locale: locale,
            country: locationData.country || country,
            city: locationData.city || null,
            region: locationData.region || null,
            local_time: localTime
        };
    }

    /**
     * Fetch user's location from IP (async, cached)
     * Uses free ip-api.com service (no API key needed, 45 requests/minute limit)
     */
    async fetchUserLocation() {
        // Return cached if fresh (cache for 1 hour)
        if (this.cachedLocation && this.locationFetchedAt &&
            (Date.now() - this.locationFetchedAt) < 3600000) {
            return this.cachedLocation;
        }

        try {
            const response = await new Promise((resolve, reject) => {
                const req = require('http').get('http://ip-api.com/json/?fields=status,country,regionName,city,timezone', (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                req.on('error', reject);
                req.setTimeout(5000, () => {
                    req.destroy();
                    reject(new Error('Location fetch timeout'));
                });
            });

            if (response.status === 'success') {
                this.cachedLocation = {
                    city: response.city,
                    region: response.regionName,
                    country: response.country,
                    timezone: response.timezone
                };
                this.locationFetchedAt = Date.now();
                console.log(`[PullExecutor] Location detected: ${response.city}, ${response.regionName}, ${response.country}`);
                return this.cachedLocation;
            }
        } catch (error) {
            console.log('[PullExecutor] Could not fetch location:', error.message);
        }

        return null;
    }

    /**
     * Execute a run using pull-based approach
     */
    async executeRun(runId) {
        if (this.isRunning) {
            throw new Error('Executor already running');
        }

        this.isRunning = true;
        this.currentRunId = runId;
        let lastCompletedStep = -1;

        console.log(`[PullExecutor] Starting run ${runId}`);

        try {
            while (this.isRunning) {
                // Pull next step from cloud
                const nextStep = await this.fetchNextStep(runId, lastCompletedStep);

                if (nextStep.status === 'complete') {
                    console.log(`[PullExecutor] Run complete: ${nextStep.final_status}`);
                    break;
                }

                if (nextStep.status === 'cancelled') {
                    console.log(`[PullExecutor] Run cancelled`);
                    break;
                }

                if (nextStep.status === 'not_found') {
                    console.error(`[PullExecutor] Run not found: ${runId}`);
                    break;
                }

                // Handle ask_user - AI is waiting for user response
                if (nextStep.status === 'waiting_for_user') {
                    // Check for batched questions format
                    const isBatched = nextStep.questions && Array.isArray(nextStep.questions) && nextStep.questions.length > 0;
                    if (isBatched) {
                        console.log(`[PullExecutor] AI asking user (batched): ${nextStep.questions.length} questions`);
                    } else {
                        console.log(`[PullExecutor] AI asking user: ${nextStep.question}`);
                    }

                    // Emit event for UI to show question and get response
                    if (this.onAskUser) {
                        try {
                            // Build payload - support both single and batched formats
                            const askUserPayload = {
                                context: nextStep.context,
                                runId: runId
                            };

                            if (isBatched) {
                                askUserPayload.questions = nextStep.questions;
                                askUserPayload.isBatched = true;
                            } else {
                                askUserPayload.question = nextStep.question;
                                askUserPayload.options = nextStep.options;
                                askUserPayload.isBatched = false;
                            }

                            const userResponse = await this.onAskUser(askUserPayload);

                            if (userResponse === null || userResponse === undefined) {
                                // User cancelled
                                console.log(`[PullExecutor] User cancelled, stopping run`);
                                break;
                            }

                            // Submit user response to backend
                            await this.submitUserResponse(runId, userResponse);
                            console.log(`[PullExecutor] User response submitted, continuing...`);

                            // Continue the loop - next fetchNextStep will get the next action
                            continue;
                        } catch (err) {
                            console.error(`[PullExecutor] Error handling ask_user:`, err);
                            break;
                        }
                    } else {
                        console.error(`[PullExecutor] No onAskUser handler registered`);
                        break;
                    }
                }

                if (nextStep.status === 'out_of_sync') {
                    console.warn(`[PullExecutor] Out of sync, resyncing...`);
                    console.warn(`  Expected last completed: ${nextStep.expected_last_completed}`);
                    console.warn(`  Received last completed: ${nextStep.received_last_completed}`);
                    lastCompletedStep = nextStep.expected_last_completed;
                    continue;
                }

                if (nextStep.status !== 'ready') {
                    console.error(`[PullExecutor] Unexpected status: ${nextStep.status}`);
                    await this.sleep(this.pollIntervalMs);
                    continue;
                }

                // Capture run context for analytics (first step only)
                if (lastCompletedStep < 0 && nextStep.run_context) {
                    this.userContext.userRequest = nextStep.run_context.user_request;
                    this.userContext.intent = nextStep.run_context.intent;
                }

                // Handle PARALLEL web agents
                if (nextStep.is_parallel_web_agents && nextStep.parallel_agents && nextStep.parallel_agents.length > 0) {
                    console.log(`[PullExecutor] 🔀 Executing ${nextStep.parallel_agents.length} parallel web agents`);

                    // Emit parallel agents status for UI
                    if (this.onParallelAgentsUpdate) {
                        this.onParallelAgentsUpdate({
                            runId,
                            agents: nextStep.parallel_agents_summary || nextStep.parallel_agents,
                            status: 'running'
                        });
                    }

                    // Execute all agent steps in parallel
                    const parallelResults = await this.executeParallelAgentSteps(runId, nextStep.parallel_agents);

                    // Report each agent's result
                    for (const agentResult of parallelResults) {
                        await this.reportParallelAgentResult(runId, nextStep.step_index, agentResult);
                    }

                    // Continue to next step (backend handles combining results)
                    continue;
                }

                // Execute step locally
                console.log(`[PullExecutor] Executing step ${nextStep.step_index + 1}/${nextStep.total_steps}`);
                const result = await this.executeStepWithRetry(nextStep);

                // Check if execution was cancelled
                if (result.cancelled || !this.isRunning) {
                    console.log(`[PullExecutor] Step execution cancelled, stopping run`);
                    break;
                }

                // Report result to cloud
                const reported = await this.reportStepResult(runId, nextStep.step_index, result);

                // Phase 3: Handle adaptive recovery
                if (reported.status === 'needs_recovery') {
                    console.warn(`[PullExecutor] Step failed, attempting adaptive recovery...`);
                    
                    // Fetch recovery step from backend
                    const recoveryStep = await this.fetchNextStep(runId, lastCompletedStep);
                    
                    if (recoveryStep.status === 'ready' && recoveryStep.adaptive_recovery) {
                        console.log(`[PullExecutor] Executing recovery step: ${recoveryStep.step.tool_name}`);
                        console.log(`[PullExecutor] Recovery description: ${recoveryStep.step.description}`);
                        
                        // Execute recovery step
                        const recoveryResult = await this.executeStepWithRetry(recoveryStep);
                        
                        // Report recovery result
                        const recoveryReported = await this.reportStepResult(runId, nextStep.step_index, recoveryResult);
                        
                        if (recoveryReported.status === 'accepted') {
                            console.log(`[PullExecutor] ✓ Recovery successful, continuing execution`);
                            lastCompletedStep = nextStep.step_index;
                        } else if (recoveryReported.status === 'failed') {
                            console.error(`[PullExecutor] ✗ Recovery failed, run terminated`);
                            break;
                        }
                    } else {
                        console.error(`[PullExecutor] No recovery step available, run terminated`);
                        break;
                    }
                } else if (reported.status === 'failed') {
                    console.error(`[PullExecutor] Step failed, run terminated`);
                    break;
                } else {
                    // Step succeeded normally
                    lastCompletedStep = nextStep.step_index;
                }
            }
        } catch (error) {
            // Check if this was a cancellation
            if (error.code === 'CANCELLED' || !this.isRunning) {
                console.log(`[PullExecutor] Run cancelled by user`);
                return; // Don't throw, just exit cleanly
            }
            console.error(`[PullExecutor] Fatal error:`, error);
            throw error;
        } finally {
            this.isRunning = false;
            this.currentRunId = null;
            // Clear any active child processes
            this.activeChildProcesses.clear();
            console.log(`[PullExecutor] Run completed, cleanup done`);
        }
    }

    /**
     * Fetch next step from cloud
     */
    async fetchNextStep(runId, lastCompletedStep) {
        const url = `${this.apiClient.baseUrl}/api/v2/runs/${runId}/next-step`;
        const params = lastCompletedStep >= 0 ? `?last_completed_step=${lastCompletedStep}` : '';

        try {
            const response = await fetch(url + params, {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiClient.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 501) {
                    throw new Error('Desktop pull API disabled on server');
                }
                throw new Error(`Failed to fetch next step: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[PullExecutor] Error fetching next step:`, error);
            throw error;
        }
    }

    /**
     * Generate args for a step using backend API (Adaptive Execution - Ping-Pong Pattern)
     */
    async generateStepArgs(runId, step, previousError = null) {
        const url = `${this.apiClient.baseUrl}/api/v2/runs/${runId}/steps/${step.step_id}/generate-args`;
        
        console.log(`[PullExecutor] 🤔 Generating args for step ${step.step_id}`);
        
        // Build request body with full context (system + user context)
        const fullContext = {
            ...this.systemContext,
            // Include google_user_email for Gmail/Calendar integration
            google_user_email: this.userContext?.google_user_email || global.executorUserContext?.google_user_email,
            // Include browser_mode for tool filtering (workspace_only, safari_only, both)
            browser_mode: this.userContext?.browser_mode || global.executorUserContext?.browser_mode || 'both'
        };
        console.log(`[PullExecutor] Context for arg gen - google_user_email: ${fullContext.google_user_email || 'NOT SET'}`);
        console.log(`[PullExecutor] Context for arg gen - browser_mode: ${fullContext.browser_mode}`);
        
        const requestBody = {
            step: {
                step_id: step.step_id,
                tool_name: step.tool_name || step.tool,
                intent: step.intent,
                description: step.description,
                goal: step.goal
            },
            context: fullContext,
            previous_steps: this.stepResults.map(r => ({
                step_id: r.step_id,
                description: r.description,
                result: {
                    success: r.success,
                    output: r.stdout || r.output,
                    filename: r.filename
                }
            })),
            error: previousError
        };
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiClient.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.error(`[PullExecutor] Arg generation failed: ${response.status}`);
                return null;
            }
            
            const result = await response.json();

            if (result.status === 'error') {
                console.error(`[PullExecutor] Arg generation error: ${result.error}`);
                return null;
            }

            // Handle unrecoverable errors - return special marker to stop retries
            if (result.status === 'unrecoverable' || result.unrecoverable) {
                console.error(`[PullExecutor] ⛔ UNRECOVERABLE error - stopping retries: ${result.error}`);
                return { __unrecoverable: true, error: result.error };
            }

            console.log(`[PullExecutor] ✓ Args generated successfully`);
            return result.args;
            
        } catch (error) {
            console.error(`[PullExecutor] Failed to generate args:`, error);
            return null;
        }
    }

    /**
     * Execute step with retry logic
     * Now supports cancellation during execution
     */
    async executeStepWithRetry(stepConfig) {
        const step = stepConfig.step;
        const maxRetries = stepConfig.max_retries || this.maxRetries;
        const timeoutSec = stepConfig.timeout_sec || (this.timeoutMs / 1000);

        // Track step results for placeholder resolution
        if (!this.stepResults) {
            this.stepResults = [];
        }

        let lastError = null;
        const startTime = Date.now();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // Check for cancellation before each attempt
            this.checkCancellation();

            try {
                console.log(`[PullExecutor] Attempt ${attempt}/${maxRetries}`);
                
                // ADAPTIVE EXECUTION: Generate args if not present or if retrying after error
                if (!step.args || (attempt > 1 && lastError)) {
                    console.log(`[PullExecutor] ${!step.args ? 'No args in plan' : 'Retrying with adaptive args'}`);
                    
                    const generatedArgs = await this.generateStepArgs(
                        this.currentRunId,
                        step,
                        lastError ? {
                            args: step.args,
                            message: lastError,
                            attempt: attempt - 1
                        } : null
                    );
                    
                    if (generatedArgs) {
                        // Check for unrecoverable error marker
                        if (generatedArgs.__unrecoverable) {
                            console.error(`[PullExecutor] ⛔ Unrecoverable error - failing immediately: ${generatedArgs.error}`);
                            return {
                                success: false,
                                error: generatedArgs.error,
                                unrecoverable: true,
                                attempts: attempt,
                                execution_time_ms: Date.now() - startTime
                            };
                        }
                        // Update step with generated args
                        step.args = generatedArgs;
                        console.log(`[PullExecutor] ✓ Using ${attempt > 1 ? 'adaptive' : 'generated'} args`);
                    } else if (!step.args) {
                        // Arg generation failed and no fallback args
                        console.error(`[PullExecutor] ✗ Arg generation failed, no fallback available`);
                        return {
                            success: false,
                            error: 'Failed to generate args and no fallback available',
                            attempts: attempt,
                            execution_time_ms: Date.now() - startTime
                        };
                    } else {
                        // Generation failed but step has args from previous attempt, use them
                        console.warn(`[PullExecutor] ⚠️  Arg generation failed, using previous args as fallback`);
                    }
                }
                
                // Resolve placeholders in fs.write content before execution
                let resolvedStep = step;
                if ((step.tool_name === 'fs.write' || step.tool === 'fs.write') && step.args && step.args.content) {
                    const resolvedContent = this.resolvePlaceholders(step.args.content, this.stepResults);
                    if (resolvedContent !== step.args.content) {
                        resolvedStep = {
                            ...step,
                            args: {
                                ...step.args,
                                content: resolvedContent
                            }
                        };
                    }
                }

                // BETA ANALYTICS: Capture tool execution start (beta testers only)
                if (analytics?.captureBetaToolExecution) {
                    analytics.captureBetaToolExecution({
                        run_id: this.currentRunId,
                        step_index: this.stepResults.length,
                        step_id: step.step_id,
                        tool_name: step.tool_name || step.tool,
                        tool_args: step.args,
                        tool_description: step.description,
                        attempt_number: attempt,
                        max_attempts: maxRetries,
                        user_request: this.userContext?.userRequest,
                        intent: this.userContext?.intent,
                    });
                }

                const result = await this.executeStep(resolvedStep, timeoutSec);

                if (result.success) {
                    const executionTime = Date.now() - startTime;
                    const finalResult = {
                        success: true,
                        stdout: result.stdout,
                        stderr: result.stderr,
                        exit_code: result.exit_code,
                        attempts: attempt,
                        execution_time_ms: executionTime,
                        // Store step context for future arg generation
                        step_id: step.step_id,
                        description: step.description,
                        filename: result.filename || (step.args && step.args.filename),
                        // Include screenshot if present (for vision analysis)
                        screenshot_b64: result.screenshot_b64 || null
                    };

                    if (result.screenshot_b64) {
                        console.log(`[PullExecutor] Screenshot captured, including in result (${result.screenshot_b64.length} chars)`);
                    }

                    // Track recovery if this succeeded after previous failures
                    if (attempt > 1 && analytics?.captureToolRecovery) {
                        analytics.captureToolRecovery({
                            runId: this.currentRunId,
                            toolName: step.tool_name || step.tool,
                            stepId: step.step_id,
                            attemptsBeforeSuccess: attempt,
                            recoveryMethod: 'retry_with_adaptive_args',
                        });
                    }

                    // BETA ANALYTICS: Capture successful tool result (beta testers only)
                    if (analytics?.captureBetaToolResult) {
                        analytics.captureBetaToolResult({
                            run_id: this.currentRunId,
                            step_id: step.step_id,
                            tool_name: step.tool_name || step.tool,
                            success: true,
                            exit_code: result.exit_code,
                            stdout: result.stdout,
                            stderr: result.stderr,
                            error_message: null,
                            execution_time_ms: executionTime,
                            attempt_number: attempt,
                            recovered: attempt > 1,
                            recovery_method: attempt > 1 ? 'retry_with_adaptive_args' : null,
                            has_screenshot: !!result.screenshot_b64,
                            screenshot_size_kb: result.screenshot_b64 ? Math.round(result.screenshot_b64.length / 1024) : null,
                        });
                    }

                    // Store result for future context
                    this.stepResults.push(finalResult);

                    return finalResult;
                }

                lastError = result.error || `Exit code ${result.exit_code}`;

                // Track tool failure for debugging (silent to user)
                if (analytics?.captureToolFailure) {
                    analytics.captureToolFailure({
                        runId: this.currentRunId,
                        toolName: step.tool_name || step.tool,
                        stepId: step.step_id,
                        stepNumber: this.stepResults.length + 1,
                        attemptNumber: attempt,
                        maxAttempts: maxRetries,
                        errorMessage: lastError,
                        stderr: result.stderr,
                        exitCode: result.exit_code,
                        args: step.args,
                        userRequest: this.userContext?.userRequest,
                        intent: this.userContext?.intent,
                        recovered: false, // Will be updated if recovery happens
                    });
                }

                // Check for unrecoverable errors that should stop retries immediately
                // Be VERY specific - only block errors that truly require user action
                // Most errors are recoverable (AI can try different approach)
                const unrecoverablePhrases = [
                    'google account not connected',
                    'please connect your google account',
                    'google email not found',  // Specific to missing Google setup
                    'oauth token expired',
                    'oauth token invalid',
                    'no oauth credentials',
                    'api key not configured',
                    'api key invalid',
                ];
                const errorLower = (lastError || '').toLowerCase();
                const isUnrecoverable = unrecoverablePhrases.some(phrase => errorLower.includes(phrase));

                if (isUnrecoverable) {
                    console.error(`[PullExecutor] ⛔ Unrecoverable error detected - stopping retries: ${lastError}`);
                    return {
                        success: false,
                        error: 'Google account not connected. Please connect your account in Settings > Google Services to use Calendar/Gmail features.',
                        unrecoverable: true,
                        attempts: attempt,
                        execution_time_ms: Date.now() - startTime
                    };
                }

                // For all other errors, continue retrying - AI will try a different approach
                console.log(`[PullExecutor] 🔄 Recoverable error - AI will try alternative approach`);

                // Exponential backoff before retry
                if (attempt < maxRetries) {
                    const backoffMs = 1000 * Math.pow(2, attempt - 1);
                    console.warn(`[PullExecutor] Step failed, retrying in ${backoffMs}ms...`);
                    await this.sleep(backoffMs);
                }

            } catch (error) {
                // Check if this was a cancellation - if so, propagate immediately
                if (error.code === 'CANCELLED' || !this.isRunning) {
                    console.log(`[PullExecutor] ✓ Step execution cancelled`);
                    return {
                        success: false,
                        error: 'Execution cancelled',
                        cancelled: true,
                        attempts: attempt,
                        execution_time_ms: Date.now() - startTime
                    };
                }

                lastError = error.message;
                console.error(`[PullExecutor] Attempt ${attempt} error:`, error);

                if (attempt < maxRetries) {
                    // Check for cancellation before sleep
                    if (!this.isRunning) {
                        return {
                            success: false,
                            error: 'Execution cancelled',
                            cancelled: true,
                            attempts: attempt,
                            execution_time_ms: Date.now() - startTime
                        };
                    }
                    const backoffMs = 1000 * Math.pow(2, attempt - 1);
                    await this.sleep(backoffMs);
                }
            }
        }

        const executionTime = Date.now() - startTime;

        // BETA ANALYTICS: Capture final failed tool result (beta testers only)
        if (analytics?.captureBetaToolResult) {
            analytics.captureBetaToolResult({
                run_id: this.currentRunId,
                step_id: step.step_id,
                tool_name: step.tool_name || step.tool,
                success: false,
                exit_code: -1,
                stdout: null,
                stderr: null,
                error_message: lastError,
                execution_time_ms: executionTime,
                attempt_number: maxRetries,
                recovered: false,
                recovery_method: null,
                has_screenshot: false,
                screenshot_size_kb: null,
            });
        }

        return {
            success: false,
            error: lastError,
            attempts: maxRetries,
            execution_time_ms: executionTime
        };
    }

    /**
     * Translate server paths to local desktop paths
     */
    translatePath(filePath) {
        if (!filePath || typeof filePath !== 'string') return filePath;
        
        const os = require('os');
        const path = require('path');
        
        // If path contains /home/appuser/Desktop, map to local Desktop
        if (filePath.includes('/home/appuser/Desktop')) {
            const basename = path.basename(filePath);
            const localDesktop = path.join(os.homedir(), 'Desktop');
            const translated = path.join(localDesktop, basename);
            console.log(`[PullExecutor] Path translation: ${filePath} -> ${translated}`);
            return translated;
        }
        
        return filePath;
    }

    /**
     * Resolve placeholders in content using previous step results
     */
    resolvePlaceholders(content, stepResults) {
        if (!content || typeof content !== 'string') return content;
        if (!stepResults || stepResults.length === 0) return content;
        
        // Pattern: <SOMETHING_PLACEHOLDER>
        const placeholderPattern = /<([A-Z_]+)_PLACEHOLDER>/g;
        
        let resolved = content;
        const matches = content.match(placeholderPattern);
        
        if (matches && matches.length > 0) {
            console.log(`[PullExecutor] Found ${matches.length} placeholder(s) to resolve`);
            
            // Use the most recent step result that has stdout
            const lastResult = stepResults.slice().reverse().find(r => r && r.stdout);
            
            if (lastResult && lastResult.stdout) {
                // Replace all placeholders with the last step's output
                resolved = content.replace(placeholderPattern, lastResult.stdout.trim());
                console.log(`[PullExecutor] Resolved placeholders using previous step output`);
            } else {
                console.warn(`[PullExecutor] No previous step output available to resolve placeholders`);
            }
        }
        
        return resolved;
    }

    /**
     * Execute a single step
     * Checks for cancellation before executing
     */
    async executeStep(step, timeoutSec) {
        // Check for cancellation before executing step
        this.checkCancellation();

        const tool = step.tool_name || step.tool;
        let args = step.args || {};

        console.log(`[PullExecutor] Executing: ${tool}`);

        // FIX: Handle case where args.filename contains a JSON string (AI formatting issue)
        // This happens when the AI returns {"filename": '{"path": "...", "content": "..."}'}
        if (args.filename && typeof args.filename === 'string') {
            const fn = args.filename.trim();
            if (fn.startsWith('{') || fn.includes('"path"') || fn.includes('"content"')) {
                console.log(`[PullExecutor] ⚠️ Detected JSON in args.filename - extracting...`);
                try {
                    const innerArgs = JSON.parse(fn);
                    if (innerArgs.path || innerArgs.file_path || innerArgs.content) {
                        console.log(`[PullExecutor] ✓ Extracted path: ${innerArgs.path || innerArgs.file_path}`);
                        args = { ...innerArgs };
                    }
                } catch (e) {
                    // Try manual extraction for truncated JSON
                    const pathMatch = fn.match(/"path"\s*:\s*"([^"]+)"/);
                    if (pathMatch) {
                        console.log(`[PullExecutor] ✓ Manually extracted path: ${pathMatch[1]}`);
                        // Extract content - everything after "content": "
                        const contentStartIdx = fn.indexOf('"content"');
                        if (contentStartIdx !== -1) {
                            const afterContent = fn.substring(contentStartIdx);
                            const contentMatch = afterContent.match(/"content"\s*:\s*"([\s\S]*)$/);
                            if (contentMatch) {
                                let content = contentMatch[1];
                                content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                args = { path: pathMatch[1], content: content };
                                console.log(`[PullExecutor] ✓ Extracted content (${content.length} chars)`);
                            } else {
                                args = { path: pathMatch[1] };
                            }
                        } else {
                            args = { path: pathMatch[1] };
                        }
                    }
                }
            }
        }

        // Apply path translation for file operations
        if (tool === 'fs.write' || tool === 'fs.read') {
            if (args.filename) {
                args = { ...args, filename: this.translatePath(args.filename) };
            }
            if (args.path) {
                args = { ...args, path: this.translatePath(args.path) };
            }
            if (args.file_path) {
                args = { ...args, file_path: this.translatePath(args.file_path) };
            }
        }

        // Handle different tool types
        // Updated to support new dot notation names with backwards compatibility

        // === SHELL TOOLS ===
        if (tool === 'shell.exec' || tool === 'shell.command' || tool === 'command' || tool === 'shell_exec') {
            return await this.executeShellCommand(args, timeoutSec, step);

        // === FILE TOOLS ===
        } else if (tool === 'fs.write') {
            return await this.executeFileWrite(args, step);
        } else if (tool === 'fs.read') {
            return await this.executeFileRead(args);

        // === WEB TOOLS ===
        } else if (tool === 'web.fetch' || tool === 'web_fetch') {
            const url = args.url || args.fetch_url;
            if (!url) {
                return { success: false, error: 'web.fetch requires a url parameter', exit_code: 1 };
            }
            return await this.fetchUrlContent(url);
        } else if (tool === 'browser' || tool === 'web_search') {
            // Legacy search tools - redirect to workspace.search
            return await this.executeBrowserSearch(args);
        } else if (tool === 'web.delegate' || tool === 'delegate_to_web_agent') {
            return await this.executeDelegateWebAgent(args);
        } else if (tool === 'web.delegate_parallel' || tool === 'delegate_to_web_agents') {
            return await this.executeDelegateWebAgents(args);

        // === CORE TOOLS ===
        } else if (tool === 'think') {
            return await this.executeThink(args);
        } else if (tool === 'user_input') {
            return await this.executeUserInput(args);
        } else if (tool === 'ask_user') {
            return await this.executeAskUser(args);

        // === SYSTEM TOOLS ===
        } else if (tool === 'system.start_process' || tool === 'start_background_process') {
            return await this.executeStartBackgroundProcess(args);
        } else if (tool === 'system.monitor_process' || tool === 'monitor_process') {
            return await this.executeMonitorProcess(args);
        } else if (tool === 'system.stop_process' || tool === 'stop_process') {
            return await this.executeStopProcess(args);
        } else if (tool === 'system.info' || tool === 'system_info') {
            return await this.executeSystemInfo(args);
        } else if (tool === 'system.notify' || tool === 'notify' || tool === 'notification') {
            return await this.executeNotification(args);

        // === DESKTOP TOOLS ===
        } else if (tool === 'desktop.screenshot' || tool === 'screenshot') {
            return await this.executeScreenshot(args);
        } else if (tool === 'desktop.mouse_click' || tool === 'mouse_click' || tool === 'mouse.click') {
            return await this.executeMouseClick(args);
        } else if (tool === 'desktop.mouse_move' || tool === 'mouse_move' || tool === 'mouse.move') {
            return await this.executeMouseMove(args);
        } else if (tool === 'desktop.type_text' || tool === 'type_text' || tool === 'type') {
            return await this.executeTypeText(args);
        } else if (tool === 'desktop.hotkey' || tool === 'hotkey' || tool === 'keyboard_shortcut') {
            return await this.executeHotkey(args);

        // === CLIPBOARD TOOLS ===
        } else if (tool === 'clipboard.read' || tool === 'clipboard_read') {
            return await this.executeClipboardRead(args);
        } else if (tool === 'clipboard.write' || tool === 'clipboard_write') {
            return await this.executeClipboardWrite(args);

        // === WINDOW TOOLS ===
        } else if (tool === 'window.list_apps' || tool === 'list_apps' || tool === 'running_apps') {
            return await this.executeListApps(args);
        } else if (tool === 'window.focus_app' || tool === 'focus_app' || tool === 'activate_app') {
            return await this.executeFocusApp(args);
        } else if (tool === 'window.get_active' || tool === 'get_active_window' || tool === 'active_window') {
            return await this.executeGetActiveWindow(args);
        } else if (tool === 'window.manage') {
            // New consolidated window management tool
            const action = args.action || 'arrange';
            if (action === 'resize') {
                return await this.executeWindowResize(args);
            } else {
                return await this.executeWindowArrange(args);
            }
        } else if (tool === 'window_resize' || tool === 'resize_window') {
            return await this.executeWindowResize(args);
        } else if (tool === 'window_arrange' || tool === 'arrange_windows') {
            return await this.executeWindowArrange(args);

        // === UI TOOLS ===
        } else if (tool === 'ui.show_options' || tool === 'show_options') {
            return await this.executeShowOptions(args);
        } else if (tool === 'ui.comparison_table' || tool === 'comparison_table') {
            return await this.executeComparisonTable(args);

        // === LEGACY TOOLS (removed but handle gracefully) ===
        } else if (tool === 'open_url') {
            // Deprecated - redirect to workspace.navigate
            return await this.executeWorkspaceTool('workspace.navigate', { url: args.url });
        } else if (tool === 'open_file') {
            // Deprecated - redirect to finder.open_file
            return await executeMacOSTool('finder.open_file', args);
        } else if (tool === 'dictate' || tool === 'speak' || tool === 'say') {
            // Deprecated but still handle
            return await this.executeDictate(args);
        } else if (tool === 'play_sound' || tool === 'audio_play') {
            // Deprecated but still handle
            return await this.executePlaySound(args);
        } else if (tool === 'file_watch' || tool === 'watch_directory') {
            // Deprecated but still handle
            return await this.executeFileWatch(args);

        // === GOOGLE TOOLS ===
        } else if (tool === 'google.command' || tool === 'google_command') {
            const action = args.action || 'google.gmail.list_messages';
            return await this.executeGoogleAction(action, args);
        } else if (tool.startsWith('google.')) {
            return await this.executeGoogleAction(tool, args);

        // === MACOS NATIVE TOOLS ===
        } else if (isMacOSTool(tool)) {
            // macOS AppleScript tools: safari.*, notes.*, mail.*, calendar.*, finder.*, reminders.*
            return await executeMacOSTool(tool, args);

        // === WORKSPACE TOOLS ===
        } else if (tool.startsWith('workspace.')) {
            return await this.executeWorkspaceTool(tool, args);

        // === SPREADSHEET TOOLS ===
        } else if (tool.startsWith('spreadsheet.')) {
            return await this.executeSpreadsheetTool(tool, args);

        } else {
            return {
                success: false,
                error: `Unsupported tool: ${tool}`,
                exit_code: -1
            };
        }
    }

    /**
     * Execute ask_user tool - prompts user with a question and waits for response
     * This pauses execution until the user responds
     *
     * Supports two formats:
     * 1. Single question: { question, context, options }
     * 2. Batched questions: { context, questions: [{id, question, options}, ...] }
     */
    async executeAskUser(args) {
        const { BrowserWindow, ipcMain } = require('electron');

        // Check for batched questions format (new)
        const isBatched = args.questions && Array.isArray(args.questions) && args.questions.length > 0;

        const context = args.context || '';
        const allowCustomResponse = args.allow_custom_response || false;

        if (isBatched) {
            console.log(`[PullExecutor] ask_user (batched): ${args.questions.length} questions (context: ${context})`);
        } else {
            console.log(`[PullExecutor] ask_user: "${args.question}" (context: ${context})`);
        }

        // Find the main window to show the dialog
        const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        if (!mainWindow) {
            return {
                success: false,
                error: 'No window available to show question',
                exit_code: 1
            };
        }

        // Build the payload - support both single and batched formats
        const payload = {
            context,
            allowCustomResponse,
            timestamp: Date.now()
        };

        if (isBatched) {
            // Batched questions format - send the full questions array
            payload.questions = args.questions;
            payload.isBatched = true;
        } else {
            // Single question format (legacy)
            payload.question = args.question || 'Please provide input';
            payload.options = args.options || [];
            payload.isBatched = false;
        }

        // Send to renderer using pull-executor:ask-user channel
        mainWindow.webContents.send('pull-executor:ask-user', payload);

        // Wait for response from renderer (with timeout)
        return new Promise((resolve) => {
            const timeoutMs = 300000; // 5 minute timeout
            let resolved = false;

            const handler = (event, response) => {
                if (resolved) return;
                resolved = true;
                ipcMain.removeHandler('pull-executor:respond-to-question');

                console.log(`[PullExecutor] ask_user response:`, response);

                if (response.cancelled) {
                    resolve({
                        success: false,
                        stdout: 'User cancelled the question',
                        stderr: '',
                        exit_code: 1,
                        user_cancelled: true
                    });
                } else if (response.editedContent) {
                    // User edited the content - send back with the edited text
                    resolve({
                        success: true,
                        stdout: `User edited the message. Updated content:\n${response.editedContent}`,
                        stderr: '',
                        exit_code: 0,
                        user_response: response.editedContent,
                        selected_option_id: 'user_edited',
                        user_edited: true,
                        edited_content: response.editedContent
                    });
                } else if (response.answers && typeof response.answers === 'object') {
                    // Batched answers format - response.answers is an object like {cuisine: "italian", vibe: "casual", area: "south"}
                    const answersJson = JSON.stringify(response.answers);
                    resolve({
                        success: true,
                        stdout: `User answers: ${answersJson}`,
                        stderr: '',
                        exit_code: 0,
                        user_response: answersJson,
                        answers: response.answers,  // Include the structured answers object
                        is_batched: true
                    });
                } else {
                    // Single answer format (legacy)
                    resolve({
                        success: true,
                        stdout: `User response: ${response.answer || response.selectedOption || 'No answer'}`,
                        stderr: '',
                        exit_code: 0,
                        user_response: response.answer || response.selectedOption,
                        selected_option_id: response.selectedOptionId
                    });
                }
            };

            // Register one-time handler on pull-executor channel
            ipcMain.handleOnce('pull-executor:respond-to-question', handler);

            // Timeout
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                ipcMain.removeHandler('pull-executor:respond-to-question');

                resolve({
                    success: false,
                    stdout: 'User did not respond in time',
                    stderr: 'Timeout waiting for user response',
                    exit_code: 1,
                    timeout: true
                });
            }, timeoutMs);
        });
    }

    /**
     * Execute workspace tools for isolated AI browser
     * Maps workspace.* tool names to workspaceManager methods
     *
     * AUTO-CREATION: If workspace isn't active and a tool other than create/destroy
     * is called, we automatically create the workspace first. This prevents failures
     * when the AI tries to use workspace tools without explicitly creating first.
     */
    async executeWorkspaceTool(tool, args) {
        console.log(`[PullExecutor] Executing workspace tool: ${tool}`, args);

        try {
            // Auto-create workspace if not active (except for create/destroy commands)
            const skipAutoCreate = ['workspace.create', 'workspace.destroy', 'workspace.status'];
            if (!skipAutoCreate.includes(tool) && !workspaceManager.getIsActive()) {
                console.log('[PullExecutor] Workspace not active, auto-creating...');
                const createResult = await workspaceManager.create(1200, 800);
                if (createResult.success) {
                    console.log(`[PullExecutor] ✓ Workspace auto-created (window ID: ${createResult.windowId})`);
                    // Small delay to ensure window is ready
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.error('[PullExecutor] Failed to auto-create workspace:', createResult.error);
                    return {
                        success: false,
                        stdout: '',
                        stderr: `Failed to auto-create workspace: ${createResult.error}`,
                        exit_code: 1
                    };
                }
            }

            let result;

            switch (tool) {
                case 'workspace.create':
                    const width = args.width || 1280;
                    const height = args.height || 800;
                    result = await workspaceManager.create(width, height);
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Workspace created (${width}x${height}), window ID: ${result.windowId}`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.navigate':
                    if (!args.url) {
                        return { success: false, error: 'URL required', exit_code: 1 };
                    }
                    // Pass _tabId for parallel execution (if present)
                    result = await workspaceManager.navigateTo(args.url, args._tabId);
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Navigated to: ${result.url}`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.search':
                    if (!args.query) {
                        return { success: false, error: 'Query required', exit_code: 1 };
                    }
                    // Pass _tabId for parallel execution (if present)
                    result = await workspaceManager.searchGoogle(args.query, args._tabId);
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Searched Google for: ${args.query}`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.get_text':
                    // Pass _tabId for parallel execution (if present)
                    result = await workspaceManager.getPageText(args._tabId);
                    if (result.success) {
                        // Truncate very long text
                        const text = result.text || '';
                        const truncated = text.length > 10000 ? text.slice(0, 10000) + '\n...[truncated]' : text;
                        return {
                            success: true,
                            stdout: truncated,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.click_element':
                    if (!args.selector) {
                        return { success: false, error: 'Selector required', exit_code: 1 };
                    }
                    result = await workspaceManager.clickElement(args.selector);
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Clicked element: ${args.selector}`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.type_into_element':
                    if (!args.selector || !args.text) {
                        return { success: false, error: 'Selector and text required', exit_code: 1 };
                    }
                    // Pass options for clearFirst and pressEnter
                    // Also auto-detect if text ends with \n and treat as pressEnter
                    const shouldPressEnter = args.pressEnter || args.text.endsWith('\n');
                    result = await workspaceManager.typeIntoElement(args.selector, args.text, {
                        clearFirst: args.clearFirst !== false, // Default true
                        pressEnter: shouldPressEnter
                    });
                    if (result.success) {
                        const enterMsg = shouldPressEnter ? ' and pressed Enter' : '';
                        return {
                            success: true,
                            stdout: `Typed into element: ${args.selector}${enterMsg}`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.destroy':
                    result = workspaceManager.destroy();
                    return {
                        success: true,
                        stdout: 'Workspace destroyed',
                        stderr: '',
                        exit_code: 0
                    };

                case 'workspace.get_selectors':
                    result = await workspaceManager.getSelectors(args.filter || 'all');
                    if (result.success) {
                        // Format output for the AI to read
                        const elements = result.elements;
                        let output = '';

                        if (elements.buttons && elements.buttons.length > 0) {
                            output += '## BUTTONS\n';
                            elements.buttons.slice(0, 20).forEach(btn => {
                                output += `- selector: "${btn.selector}" | text: "${btn.text}"\n`;
                            });
                            output += '\n';
                        }

                        if (elements.inputs && elements.inputs.length > 0) {
                            output += '## INPUTS\n';
                            elements.inputs.slice(0, 20).forEach(inp => {
                                const desc = inp.placeholder || inp.name || inp.type;
                                output += `- selector: "${inp.selector}" | ${desc}\n`;
                            });
                            output += '\n';
                        }

                        if (elements.links && elements.links.length > 0) {
                            output += '## LINKS\n';
                            elements.links.slice(0, 30).forEach(link => {
                                output += `- selector: "${link.selector}" | text: "${link.text}"\n`;
                            });
                        }

                        return {
                            success: true,
                            stdout: output || 'No interactive elements found',
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.inspect_element':
                    result = await workspaceManager.inspectElement({
                        text: args.text,
                        selector: args.selector,
                        x: args.x,
                        y: args.y
                    });
                    if (result.success) {
                        const el = result.element;
                        let output = `Found element:\n`;
                        output += `- Tag: ${el.tag}\n`;
                        if (el.id) output += `- ID: ${el.id}\n`;
                        if (el.classes) output += `- Classes: ${el.classes}\n`;
                        if (el.text) output += `- Text: "${el.text.slice(0, 50)}"\n`;
                        if (el.placeholder) output += `- Placeholder: "${el.placeholder}"\n`;
                        if (el.name) output += `- Name: ${el.name}\n`;
                        output += `\nBest selector: ${el.bestSelector}\n`;
                        if (el.alternativeSelectors && el.alternativeSelectors.length > 0) {
                            output += `Alternative selectors: ${el.alternativeSelectors.join(', ')}\n`;
                        }

                        return {
                            success: true,
                            stdout: output,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.click_by_text':
                    // Click element by visible text - more robust than CSS selectors
                    result = await workspaceManager.clickByText(args.text, {
                        exact: args.exact || false,
                        index: args.index || 0
                    });
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Clicked element with text "${args.text}"`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    // Return the actual error so we can debug
                    return {
                        success: false,
                        stdout: '',
                        stderr: result.error || 'click_by_text failed',
                        exit_code: 1,
                        recoverable: true
                    };

                case 'workspace.search_site':
                    // Navigate directly to search results - MUCH faster than typing
                    // Supports: amazon, google, target, walmart, ebay, youtube, bing, bestbuy, etsy
                    // Pass _tabId for parallel execution (if present)
                    result = await workspaceManager.searchSite(args.site, args.query, args._tabId);
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Navigated to ${args.site} search results for "${args.query}"`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    return {
                        success: false,
                        stdout: '',
                        stderr: result.error || 'search_site failed',
                        exit_code: 1,
                        recoverable: true
                    };

                case 'workspace.wait_for_element':
                    // Wait for element to appear - more reliable than fixed waits
                    result = await workspaceManager.waitForElement(args.selector, {
                        timeout: args.timeout || 10000,
                        interval: args.interval || 200
                    });
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Element "${args.selector}" found after ${result.elapsed}ms`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    return {
                        success: false,
                        stdout: '',
                        stderr: result.error || 'wait_for_element timeout',
                        exit_code: 1,
                        recoverable: true
                    };

                case 'workspace.wait_for_text':
                    // Wait for text to appear on page
                    result = await workspaceManager.waitForText(args.text, {
                        timeout: args.timeout || 10000,
                        interval: args.interval || 200
                    });
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Text "${args.text}" found after ${result.elapsed}ms`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    return {
                        success: false,
                        stdout: '',
                        stderr: result.error || 'wait_for_text timeout',
                        exit_code: 1,
                        recoverable: true
                    };

                case 'workspace.get_cart_count':
                    // Get shopping cart count
                    result = await workspaceManager.getCartCount();
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Cart count: ${result.count} items (${result.site})`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    return {
                        success: false,
                        stdout: '',
                        stderr: result.error || 'get_cart_count failed',
                        exit_code: 1,
                        recoverable: true
                    };

                case 'workspace.get_product_links':
                    // Get product links from search results
                    result = await workspaceManager.getProductLinks({
                        limit: args.limit || 10
                    });
                    if (result.success && result.products) {
                        // Create both human-readable and structured output
                        let output = `Found ${result.products.length} products:\n\n`;
                        result.products.forEach((p, i) => {
                            output += `${i + 1}. **${p.name}**\n`;
                            if (p.price) output += `   Price: ${p.price}\n`;
                            if (p.rating) output += `   Rating: ${p.rating}\n`;
                            if (p.href) output += `   URL: ${p.href}\n`;
                            output += '\n';
                        });
                        output += '\n---\nSTRUCTURED_DATA:\n';
                        output += JSON.stringify({
                            type: 'product_list',
                            count: result.products.length,
                            products: result.products.map(p => ({
                                name: p.name,
                                price: p.price,
                                rating: p.rating,
                                url: p.href,
                                image: p.image
                            }))
                        }, null, 2);
                        return {
                            success: true,
                            stdout: output,
                            stderr: '',
                            exit_code: 0,
                            products: result.products  // Include structured data
                        };
                    }
                    return {
                        success: false,
                        stdout: '',
                        stderr: result.error || 'get_product_links failed',
                        exit_code: 1,
                        recoverable: true
                    };

                case 'workspace.get_product_price':
                    // Extract price from current product detail page
                    // Works on Amazon, Best Buy, Walmart, Target, eBay, Newegg, and generic sites
                    result = await workspaceManager.getProductPrice();
                    if (result.success && result.price) {
                        return {
                            success: true,
                            stdout: JSON.stringify({
                                price: result.price,
                                rawPrice: result.rawPrice,
                                productName: result.productName,
                                currency: result.currency,
                                site: result.site,
                                url: result.url
                            }, null, 2),
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    return {
                        success: false,
                        stdout: JSON.stringify({
                            error: result.error || 'Could not extract price from page',
                            site: result.site,
                            url: result.url
                        }),
                        stderr: result.error || 'get_product_price failed',
                        exit_code: 1,
                        recoverable: true
                    };

                case 'workspace.scroll':
                    // Support both "direction" style and raw deltaY style
                    let deltaY = 0;
                    let deltaX = 0;
                    if (args.direction) {
                        // direction: "up" or "down", amount: pixels
                        const amount = args.amount || args.scroll_amount || 500;
                        deltaY = args.direction === 'down' ? -amount : amount;
                    } else if (args.page_fraction) {
                        // page_fraction: 0.0-1.0, scroll as fraction of page
                        deltaY = args.direction === 'up' ? 800 * args.page_fraction : -800 * args.page_fraction;
                    } else {
                        // Raw deltaX/deltaY
                        deltaX = args.deltaX || 0;
                        deltaY = args.deltaY || 0;
                    }
                    result = await workspaceManager.scroll(deltaX, deltaY, args.x, args.y);
                    if (result.success) {
                        const dir = deltaY < 0 ? 'down' : 'up';
                        return {
                            success: true,
                            stdout: `Scrolled ${dir} by ${Math.abs(deltaY)} pixels`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.wait':
                    // Wait for specified milliseconds (default 1000, max 10000)
                    const waitMs = Math.min(args.ms || args.milliseconds || 1000, 10000);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    return {
                        success: true,
                        stdout: `Waited ${waitMs}ms`,
                        stderr: '',
                        exit_code: 0
                    };

                case 'workspace.press_key':
                    // Press a key (useful for Escape, Tab, Enter, etc.)
                    const key = args.key || 'Escape';
                    const modifiers = args.modifiers || [];
                    result = await workspaceManager.pressKey(key, modifiers);
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Pressed key: ${key}`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.scroll_page':
                    // Alternative scroll tool using browser.scroll_page naming
                    // for compatibility with AI that uses this tool name
                    let scrollAmount = 500;
                    if (args.page_fraction) {
                        scrollAmount = Math.round(800 * args.page_fraction);
                    } else if (args.amount) {
                        scrollAmount = args.amount;
                    }
                    const scrollDir = args.direction === 'up' ? scrollAmount : -scrollAmount;
                    result = await workspaceManager.scroll(0, scrollDir);
                    if (result.success) {
                        return {
                            success: true,
                            stdout: `Scrolled ${args.direction || 'down'} by ${scrollAmount} pixels`,
                            stderr: '',
                            exit_code: 0
                        };
                    }
                    break;

                case 'workspace.screenshot':
                    // Capture a screenshot of the current page
                    // Returns base64-encoded PNG image for vision analysis
                    try {
                        const frame = await workspaceManager.captureFrame();
                        if (frame && frame.success && frame.data) {
                            return {
                                success: true,
                                stdout: JSON.stringify({
                                    type: 'screenshot',
                                    format: 'base64_png',
                                    data: frame.data,
                                    width: frame.width || 1280,
                                    height: frame.height || 800,
                                    message: 'Screenshot captured successfully. The image will be analyzed by vision AI.'
                                }),
                                stderr: '',
                                exit_code: 0
                            };
                        } else {
                            return {
                                success: false,
                                error: 'Failed to capture screenshot - workspace may not be active',
                                exit_code: 1
                            };
                        }
                    } catch (screenshotError) {
                        return {
                            success: false,
                            error: `Screenshot error: ${screenshotError.message}`,
                            exit_code: 1
                        };
                    }

                case 'workspace.extract_products':
                    // AI-powered product extraction - combines screenshot + text analysis
                    // More robust than get_product_links for unusual page layouts
                    try {
                        // Get both structured links and page text
                        const extractResult = await workspaceManager.getProductLinks({
                            limit: args.limit || 10
                        });
                        const textResult = await workspaceManager.getText();

                        let output = '';
                        if (extractResult.success && extractResult.products && extractResult.products.length > 0) {
                            output = `Found ${extractResult.products.length} products (structured extraction):\n\n`;
                            output += JSON.stringify({
                                type: 'extracted_products',
                                method: 'structured',
                                count: extractResult.products.length,
                                products: extractResult.products.map(p => ({
                                    name: p.name,
                                    price: p.price,
                                    rating: p.rating,
                                    url: p.href,
                                    image: p.image
                                }))
                            }, null, 2);
                        } else {
                            // Fallback to text-based hint for AI to parse
                            output = 'No structured products found. Page text for analysis:\n\n';
                            output += (textResult.text || textResult.output || '').slice(0, 3000);
                            output += '\n\n(Use workspace.screenshot for visual analysis if needed)';
                        }

                        return {
                            success: true,
                            stdout: output,
                            stderr: '',
                            exit_code: 0
                        };
                    } catch (extractError) {
                        return {
                            success: false,
                            error: `Product extraction error: ${extractError.message}`,
                            exit_code: 1
                        };
                    }

                case 'workspace.save_session':
                    // Save browser session (cookies, cart, tabs) for later
                    try {
                        const saveResult = await workspaceManager.saveSession(args.name || 'default');
                        if (saveResult.success) {
                            return {
                                success: true,
                                stdout: `Session '${saveResult.sessionName}' saved. ${saveResult.cookieCount} cookies, ${saveResult.tabCount} tabs preserved.`,
                                stderr: '',
                                exit_code: 0
                            };
                        }
                        return { success: false, error: saveResult.error, exit_code: 1 };
                    } catch (e) {
                        return { success: false, error: e.message, exit_code: 1 };
                    }

                case 'workspace.restore_session':
                    // Restore a previously saved session
                    try {
                        const restoreResult = await workspaceManager.restoreSession(args.name || 'default');
                        if (restoreResult.success) {
                            return {
                                success: true,
                                stdout: `Session '${restoreResult.sessionName}' restored. ${restoreResult.restoredCookies} cookies loaded. Originally saved: ${restoreResult.savedAt}`,
                                stderr: '',
                                exit_code: 0
                            };
                        }
                        return { success: false, error: restoreResult.error, exit_code: 1 };
                    } catch (e) {
                        return { success: false, error: e.message, exit_code: 1 };
                    }

                case 'workspace.list_sessions':
                    // List all saved sessions
                    try {
                        const listResult = await workspaceManager.listSessions();
                        if (listResult.sessions.length === 0) {
                            return {
                                success: true,
                                stdout: 'No saved sessions found.',
                                stderr: '',
                                exit_code: 0
                            };
                        }
                        let output = `Found ${listResult.sessions.length} saved sessions:\n\n`;
                        listResult.sessions.forEach((s, i) => {
                            output += `${i + 1}. "${s.name}" - saved ${s.savedAt} (${s.cookieCount} cookies, ${s.tabCount} tabs)\n`;
                        });
                        return {
                            success: true,
                            stdout: output,
                            stderr: '',
                            exit_code: 0
                        };
                    } catch (e) {
                        return { success: false, error: e.message, exit_code: 1 };
                    }

                default:
                    return {
                        success: false,
                        error: `Unknown workspace tool: ${tool}`,
                        exit_code: 1
                    };
            }

            // Handle failure case
            return {
                success: false,
                error: result?.error || 'Workspace operation failed',
                exit_code: 1
            };

        } catch (e) {
            console.error(`[PullExecutor] Workspace tool error:`, e);
            return {
                success: false,
                error: e.message,
                exit_code: 1
            };
        }
    }

    /**
     * Execute spreadsheet tools via HTTP API
     * Routes to the spreadsheet API server on port 3848
     */
    async executeSpreadsheetTool(tool, args) {
        const http = require('http');

        console.log(`[PullExecutor] Executing spreadsheet tool: ${tool}`);

        // Map tool names to API endpoints
        const toolToEndpoint = {
            'spreadsheet.create': '/spreadsheet/create',
            'spreadsheet.destroy': '/spreadsheet/destroy',
            'spreadsheet.open': '/spreadsheet/open',
            'spreadsheet.save': '/spreadsheet/save',
            'spreadsheet.read_cell': '/spreadsheet/read-cell',
            'spreadsheet.write_cell': '/spreadsheet/write-cell',
            'spreadsheet.read_range': '/spreadsheet/read-range',
            'spreadsheet.write_range': '/spreadsheet/write-range',
            'spreadsheet.set_formula': '/spreadsheet/set-formula',
            'spreadsheet.format_cells': '/spreadsheet/format-cells',
            'spreadsheet.analyze': '/spreadsheet/analyze',
            'spreadsheet.export': '/spreadsheet/export'
        };

        const endpoint = toolToEndpoint[tool];
        if (!endpoint) {
            return {
                success: false,
                error: `Unknown spreadsheet tool: ${tool}`,
                exit_code: 1
            };
        }

        try {
            const result = await new Promise((resolve, reject) => {
                const postData = JSON.stringify(args || {});

                const options = {
                    hostname: '127.0.0.1',
                    port: 3848,
                    path: endpoint,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };

                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve(json);
                        } catch (e) {
                            resolve({ success: false, error: 'Invalid JSON response' });
                        }
                    });
                });

                req.on('error', (e) => {
                    reject(e);
                });

                req.write(postData);
                req.end();
            });

            if (result.success) {
                return {
                    success: true,
                    stdout: result.message || result.value || JSON.stringify(result.data || result),
                    stderr: '',
                    exit_code: 0
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Spreadsheet operation failed',
                    exit_code: 1
                };
            }
        } catch (e) {
            console.error(`[PullExecutor] Spreadsheet tool error:`, e);
            return {
                success: false,
                error: `Spreadsheet API error: ${e.message}`,
                exit_code: 1
            };
        }
    }

    /**
     * Execute shell command with cancellation support
     * Uses spawn to allow tracking and killing child processes
     */
    async executeShellCommand(commandOrArgs, timeoutSec, step) {
        const os = require('os');
        const path = require('path');
        const { spawn } = require('child_process');

        // Check for cancellation before starting
        this.checkCancellation();

        try {
            // Handle both string command and args object
            let command, cwd, env;
            if (typeof commandOrArgs === 'string') {
                command = commandOrArgs;
            } else if (typeof commandOrArgs === 'object') {
                command = commandOrArgs.command || commandOrArgs.cmd;
                cwd = commandOrArgs.cwd;
                env = commandOrArgs.env;
            }

            // HEREDOC DETECTION: If command uses heredoc to create a file, redirect to fs.write
            // This is more reliable than shell heredoc with special characters
            if (command && this._isHeredocFileCreation(command)) {
                console.log(`[PullExecutor] ⚠️ Detected heredoc file creation - redirecting to fs.write for reliability`);
                const fsWriteArgs = this._parseHeredocToFileWrite(command);
                if (fsWriteArgs) {
                    console.log(`[PullExecutor] Extracted file: ${fsWriteArgs.file_path}`);
                    return await this.executeFileWrite(fsWriteArgs, step);
                }
                // If parsing failed, continue with original command
                console.log(`[PullExecutor] Could not parse heredoc, falling back to shell`);
            }

            // If no command but step description mentions Desktop path, provide it directly
            if (!command && step) {
                const description = (step.description || step.goal || '').toLowerCase();
                if (description.includes('desktop') && (description.includes('path') || description.includes('directory'))) {
                    const desktopPath = path.join(os.homedir(), 'Desktop');
                    console.log(`[PullExecutor] Auto-providing Desktop path: ${desktopPath}`);
                    return {
                        success: true,
                        stdout: desktopPath,
                        stderr: '',
                        exit_code: 0
                    };
                }
            }

            if (!command) {
                throw new Error('No command specified');
            }

            // BACKGROUND PROCESS DETECTION: If command ends with &, it's meant to run in background
            // Handle this specially to prevent hanging - spawn detached and return immediately
            const isBackgroundCommand = command.trim().endsWith('&');
            if (isBackgroundCommand) {
                console.log(`[PullExecutor] Detected background command, spawning detached process`);
                const cleanCommand = command.trim().slice(0, -1).trim(); // Remove trailing &

                const spawnOptions = {
                    shell: true,
                    cwd: cwd || undefined,
                    env: env ? { ...process.env, ...env } : process.env,
                    detached: true,
                    stdio: 'ignore'  // Don't wait for stdio
                };

                try {
                    const childProcess = spawn(cleanCommand, [], spawnOptions);
                    childProcess.unref();  // Allow parent to exit independently

                    // Give it a moment to start, then return success
                    await new Promise(r => setTimeout(r, 500));

                    return {
                        success: true,
                        stdout: `Background process started (PID: ${childProcess.pid || 'unknown'})`,
                        stderr: '',
                        exit_code: 0
                    };
                } catch (bgError) {
                    return {
                        success: false,
                        stdout: '',
                        stderr: bgError.message,
                        exit_code: 1,
                        error: `Failed to start background process: ${bgError.message}`
                    };
                }
            }

            // Use spawn with shell for better process control
            return await new Promise((resolve, reject) => {
                const spawnOptions = {
                    shell: true,
                    cwd: cwd || undefined,
                    env: env ? { ...process.env, ...env } : process.env
                };

                if (cwd) {
                    console.log(`[PullExecutor] Executing in directory: ${cwd}`);
                }
                if (env) {
                    console.log(`[PullExecutor] With environment variables: ${Object.keys(env).join(', ')}`);
                }

                const childProcess = spawn(command, [], spawnOptions);

                // Track this process so we can kill it on cancel
                this.activeChildProcesses.add(childProcess);

                let stdout = '';
                let stderr = '';
                let timedOut = false;

                // Timeout handler
                const timeoutId = setTimeout(() => {
                    timedOut = true;
                    console.log(`[PullExecutor] Command timed out after ${timeoutSec}s, killing process`);
                    childProcess.kill('SIGTERM');
                    setTimeout(() => {
                        if (!childProcess.killed) {
                            childProcess.kill('SIGKILL');
                        }
                    }, 2000);
                }, timeoutSec * 1000);

                childProcess.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });

                childProcess.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });

                childProcess.on('close', (code, signal) => {
                    clearTimeout(timeoutId);
                    this.activeChildProcesses.delete(childProcess);

                    if (timedOut) {
                        resolve({
                            success: false,
                            stdout,
                            stderr: stderr + '\n(Command timed out)',
                            exit_code: 124,
                            error: `Command timed out after ${timeoutSec}s`
                        });
                    } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                        // Process was killed (likely by stop())
                        resolve({
                            success: false,
                            stdout,
                            stderr,
                            exit_code: -1,
                            error: 'Command was cancelled'
                        });
                    } else {
                        // Exit code 1 from grep/find means "no matches found" - not an error
                        // Exit code 2 from grep means "no matches found" (some versions)
                        // Treat these as success with empty/no results
                        const isSearchCommand = /\b(grep|find|rg|ag|ack|fd|locate|mdfind)\b/.test(command);
                        const isNoMatchesExitCode = (code === 1 || code === 2);
                        const treatAsSuccess = (code === 0) || (isSearchCommand && isNoMatchesExitCode);

                        resolve({
                            success: treatAsSuccess,
                            stdout: treatAsSuccess && !stdout.trim() && isSearchCommand && isNoMatchesExitCode
                                ? '(no matches found)'
                                : stdout,
                            stderr,
                            exit_code: code || 0,
                            error: !treatAsSuccess ? `Exit code ${code}` : undefined
                        });
                    }
                });

                childProcess.on('error', (error) => {
                    clearTimeout(timeoutId);
                    this.activeChildProcesses.delete(childProcess);
                    resolve({
                        success: false,
                        stdout: '',
                        stderr: error.message,
                        exit_code: 1,
                        error: error.message
                    });
                });
            });
        } catch (error) {
            if (error.code === 'CANCELLED') {
                throw error; // Re-throw cancellation
            }
            return {
                success: false,
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                exit_code: error.code || 1,
                error: error.message
            };
        }
    }

    /**
     * Check if a shell command is trying to create a file using heredoc syntax
     * These often fail with special characters in the content
     */
    _isHeredocFileCreation(command) {
        if (!command || typeof command !== 'string') return false;

        // Common heredoc patterns for file creation:
        // cat << 'EOF' > file.txt
        // cat <<EOF > file.txt
        // cat <<-EOF > file.txt
        // tee file.txt << 'EOF'
        const heredocPatterns = [
            /cat\s+<<[-']?\s*['"]?(\w+)['"]?\s*>\s*(\S+)/,    // cat << EOF > file
            /cat\s+<<[-']?\s*['"]?(\w+)['"]?\s*>>\s*(\S+)/,   // cat << EOF >> file
            /tee\s+(\S+)\s*<<[-']?\s*['"]?(\w+)['"]?/,         // tee file << EOF
            /cat\s+>\s*(\S+)\s*<<[-']?\s*['"]?(\w+)['"]?/      // cat > file << EOF
        ];

        for (const pattern of heredocPatterns) {
            if (pattern.test(command)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Parse a heredoc file creation command into fs.write arguments
     * Returns { file_path, content } or null if parsing fails
     */
    _parseHeredocToFileWrite(command) {
        try {
            // Match: cat << 'EOF' > filename\ncontent\nEOF
            // or: cat <<EOF > filename\ncontent\nEOF
            // or: cat <<-'EOF' > filename\ncontent\nEOF

            // Extract the delimiter (EOF, END, etc.)
            const delimiterMatch = command.match(/<<[-']?\s*['"]?(\w+)['"]?/);
            if (!delimiterMatch) return null;

            const delimiter = delimiterMatch[1];

            // Extract the filename
            let filename = null;

            // Try: cat << EOF > filename
            const toFileMatch = command.match(/>\s*(\S+)/);
            if (toFileMatch) {
                filename = toFileMatch[1];
            }

            // Try: tee filename << EOF
            if (!filename) {
                const teeMatch = command.match(/tee\s+(\S+)\s*<</);
                if (teeMatch) {
                    filename = teeMatch[1];
                }
            }

            if (!filename) return null;

            // Extract content between the first occurrence of delimiter and the last
            // The content is everything after the first line (the cat command) until the closing delimiter
            const lines = command.split('\n');
            let contentStartIndex = -1;
            let contentEndIndex = -1;

            for (let i = 0; i < lines.length; i++) {
                // Find the line after the command line that starts the content
                if (contentStartIndex === -1 && i > 0) {
                    contentStartIndex = i;
                }
                // Find the closing delimiter
                if (lines[i].trim() === delimiter) {
                    contentEndIndex = i;
                    break;
                }
            }

            if (contentStartIndex === -1 || contentEndIndex === -1) {
                // Fallback: try to find content after the heredoc marker
                const heredocIndex = command.indexOf(delimiter);
                if (heredocIndex !== -1) {
                    // Find the next newline after the heredoc start
                    const afterHeredoc = command.indexOf('\n', heredocIndex);
                    if (afterHeredoc !== -1) {
                        // Find the closing delimiter
                        const closingIndex = command.lastIndexOf(delimiter);
                        if (closingIndex > afterHeredoc) {
                            const content = command.substring(afterHeredoc + 1, closingIndex).trim();
                            return {
                                file_path: filename,
                                content: content
                            };
                        }
                    }
                }
                return null;
            }

            const content = lines.slice(contentStartIndex, contentEndIndex).join('\n');

            return {
                file_path: filename,
                content: content
            };
        } catch (error) {
            console.error(`[PullExecutor] Error parsing heredoc command:`, error);
            return null;
        }
    }

    /**
     * Execute file read
     */
    async executeFileRead(args) {
        const fs = require('fs').promises;
        
        console.log(`[PullExecutor] fs.read called with args:`, JSON.stringify(args, null, 2));
        
        try {
            // Handle case where args might be stringified JSON
            let parsedArgs = args;
            if (typeof args === 'string') {
                try {
                    parsedArgs = JSON.parse(args);
                    console.log(`[PullExecutor] Parsed string args to:`, JSON.stringify(parsedArgs, null, 2));
                } catch (e) {
                    // Not JSON, treat as filename directly
                    parsedArgs = { filename: args };
                }
            }
            
            let filePath = parsedArgs?.filename || parsedArgs?.path || parsedArgs?.file_path || parsedArgs?.file;
            const encoding = parsedArgs?.encoding || 'utf8';
            const maxLines = parsedArgs?.max_lines || parsedArgs?.maxLines;
            
            // If no path provided, try to infer from previous step results
            if (!filePath && this.stepResults && this.stepResults.length > 0) {
                // Look for a recently created file
                const lastFileStep = this.stepResults.slice().reverse().find(r => r && r.filename);
                if (lastFileStep && lastFileStep.filename) {
                    filePath = lastFileStep.filename;
                    console.log(`[PullExecutor] Inferred file path from previous step: ${filePath}`);
                }
            }
            
            if (!filePath) {
                console.error('[PullExecutor] fs.read called with invalid args:', JSON.stringify(parsedArgs));
                console.error('[PullExecutor] Original args type:', typeof args);
                throw new Error(`No file path specified in args. AI must provide filename, path, or file_path. Received: ${JSON.stringify(parsedArgs)}`);
            }
            
            console.log(`[PullExecutor] Reading file: ${filePath}`);
            
            // Read file
            const content = await fs.readFile(filePath, encoding);
            
            // Limit lines if requested
            let finalContent = content;
            if (maxLines && typeof maxLines === 'number') {
                const lines = content.split('\n');
                finalContent = lines.slice(0, maxLines).join('\n');
                console.log(`[PullExecutor] Limited to ${maxLines} lines (total: ${lines.length})`);
            }
            
            console.log(`[PullExecutor] Read ${finalContent.length} characters`);
            
            return {
                success: true,
                stdout: finalContent,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            console.error('[PullExecutor] fs.read failed', {
                message: error.message,
                originalArgs: args,
                parsedArgs: typeof args === 'string' ? 'was string' : args,
                argsType: typeof args
            });
            return {
                success: false,
                error: error.message,
                stdout: '',
                stderr: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Execute file write (supports single file or multi-file projects)
     */
    async executeFileWrite(args, step) {
        const fs = require('fs').promises;
        const path = require('path');
        const os = require('os');

        try {
            // Handle case where args might be stringified JSON
            let parsedArgs = args;
            if (typeof args === 'string') {
                try {
                    parsedArgs = JSON.parse(args);
                    console.log(`[PullExecutor] Parsed string args to object`);
                } catch (e) {
                    // Not JSON, might be just a filename
                    parsedArgs = { filename: args };
                }
            }
            args = parsedArgs;

            // EXTRA FIX: If args.filename looks like JSON (starts with { or contains "path":), try parsing it
            // This handles double-stringified cases where the AI puts JSON into filename field
            if (args.filename && typeof args.filename === 'string') {
                const fn = args.filename.trim();
                const looksLikeJson = fn.startsWith('{') || fn.includes('"path"') || fn.includes('"content"');
                if (looksLikeJson) {
                    console.log(`[PullExecutor] ⚠️ Detected potential JSON in filename field, attempting parse...`);
                    try {
                        const innerArgs = JSON.parse(fn);
                        if (innerArgs.path || innerArgs.file_path || innerArgs.content) {
                            console.log(`[PullExecutor] ✓ Successfully extracted inner args from filename JSON`);
                            args = { ...args, ...innerArgs };
                            // Clear the malformed filename
                            delete args.filename;
                        }
                    } catch (e) {
                        // JSON might be truncated or malformed, try to extract path manually
                        console.log(`[PullExecutor] JSON parse failed, trying manual extraction: ${e.message}`);
                        const pathMatch = fn.match(/"path"\s*:\s*"([^"]+)"/);
                        const contentMatch = fn.match(/"content"\s*:\s*"([\s\S]*)$/);
                        if (pathMatch) {
                            console.log(`[PullExecutor] ✓ Manually extracted path: ${pathMatch[1]}`);
                            args.path = pathMatch[1];
                            // Try to get content - it may be truncated but we can try
                            if (contentMatch) {
                                // Unescape the content
                                let content = contentMatch[1];
                                // Remove trailing quote and closing brace if present
                                content = content.replace(/"\s*}\s*$/, '');
                                // Unescape common escape sequences
                                content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                args.content = content;
                                console.log(`[PullExecutor] ✓ Manually extracted content (${content.length} chars)`);
                            }
                            delete args.filename;
                        }
                    }
                }
            }

            // Check if this is a multi-file project (has "files" array)
            if (args.files && Array.isArray(args.files)) {
                console.log(`[PullExecutor] 📁 Multi-file project: ${args.files.length} files`);
                
                const results = [];
                for (const file of args.files) {
                    const filePath = this.translatePath(file.filename || file.path);
                    const content = file.content || '';
                    
                    if (!filePath) {
                        console.warn(`[PullExecutor] Skipping file with no path`);
                        continue;
                    }
                    
                    console.log(`[PullExecutor] Writing: ${filePath}`);
                    console.log(`[PullExecutor] Content preview: ${content.substring(0, 80)}...`);
                    
                    // Ensure directory exists
                    const dir = path.dirname(filePath);
                    await fs.mkdir(dir, { recursive: true });
                    
                    // Write file
                    await fs.writeFile(filePath, content, 'utf8');
                    results.push(filePath);
                }
                
                return {
                    success: true,
                    stdout: `Created ${results.length} files:\n${results.join('\n')}`,
                    stderr: '',
                    exit_code: 0,
                    files_created: results
                };
            }
            
            // Single file write (original behavior)
            const filePath = args.filename || args.path || args.file_path;
            const content = args.content || args.text || args.data || '';
            const shouldAppend = args.append === "true" || args.append === true;
            const encoding = args.encoding || 'utf8';

            // Validate required args
            if (!filePath) {
                throw new Error('No file path specified in args. AI must provide full absolute path (e.g., /Users/user/Desktop/file.txt)');
            }

            if (content === undefined || content === null) {
                throw new Error('No content specified in args. AI must provide content to write');
            }

            console.log(`[PullExecutor] Writing file: ${filePath}`);
            console.log(`[PullExecutor] Content: ${content.substring(0, 100)}...`);
            console.log(`[PullExecutor] Mode: ${shouldAppend ? 'append' : 'overwrite'}, Encoding: ${encoding}`);

            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });

            // Write or append file
            if (shouldAppend) {
                await fs.appendFile(filePath, content, encoding);
            } else {
                await fs.writeFile(filePath, content, encoding);
            }

            return {
                success: true,
                stdout: `File written: ${filePath}\nContent: ${content}`,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            console.error('[PullExecutor] fs.write failed', {
                message: error.message,
                args,
                stepDescription: step && step.description
            });
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    // NOTE: executeFileRead is defined earlier (line ~861) with proper validation
    // and support for filename, path, file_path, file keys.
    // Do NOT add a duplicate here - it would override the proper implementation.

    /**
     * Execute Google service action (Gmail, Calendar, YouTube)
     * Routes to backend API which handles OAuth
     */
    async executeGoogleAction(tool, args) {
        try {
            console.log(`[PullExecutor] Executing Google action: ${tool}`, args);
            console.log(`[PullExecutor] userContext:`, JSON.stringify(this.userContext || {}));
            console.log(`[PullExecutor] args.email:`, args.email, 'args.user_email:', args.user_email);
            
            // Get API URL from environment or default
            const apiUrl = process.env.AGENT_MAX_API_URL || 'https://agentmax-production.up.railway.app';
            
            // Map tool names to API endpoints (v2 routes)
            const endpointMap = {
                'google.gmail.list_messages': '/api/v2/google/messages',
                'google.gmail.search': '/api/v2/google/messages',
                'google.gmail.get_message': '/api/v2/google/message/{id}',
                'google.gmail.send': '/api/v2/google/send',
                'google.calendar.list_events': '/api/v2/google/calendar/events',
                'google.calendar.create_event': '/api/v2/google/calendar/events',
                'google.youtube.search': '/api/v2/google/youtube/search'
            };
            
            let endpoint = endpointMap[tool];
            if (!endpoint) {
                throw new Error(`Unknown Google tool: ${tool}`);
            }
            
            // Get user email from args, userContext, global context, or environment
            // Priority: args > userContext > global.executorUserContext > env
            const userEmail = args.user_email || args.email || 
                              this.userContext?.google_user_email || 
                              global.executorUserContext?.google_user_email ||
                              process.env.GOOGLE_USER_EMAIL;
            
            console.log(`[PullExecutor] Resolved userEmail: ${userEmail || 'NOT FOUND'}`);
            
            if (!userEmail) {
                console.error('[PullExecutor] Google email not found in any source');
                return {
                    success: false,
                    error: 'Google account not connected. Please connect your Google account in Settings > Google Services first.',
                    stdout: '',
                    stderr: 'Google account not connected',
                    exit_code: 1
                };
            }
            
            // Build request based on tool type
            let method = 'GET';
            let url = `${apiUrl}${endpoint}`;
            let body = null;
            
            if (tool === 'google.gmail.get_message') {
                url = url.replace('{id}', args.message_id || args.id);
                // Backend expects 'email' not 'user_email'
                url += `?email=${encodeURIComponent(userEmail)}`;
            } else if (tool === 'google.gmail.send') {
                method = 'POST';
                // Backend expects 'email' as query param, body params separately
                url += `?email=${encodeURIComponent(userEmail)}`;
                body = JSON.stringify({
                    to: args.to,
                    subject: args.subject,
                    body: args.body || args.message || args.content
                });
            } else if (tool === 'google.calendar.create_event') {
                method = 'POST';
                body = JSON.stringify({
                    user_email: userEmail,
                    summary: args.summary || args.title,
                    start_time: args.start_time || args.start,
                    end_time: args.end_time || args.end,
                    description: args.description
                });
            } else {
                // GET requests with query params
                // Note: Backend expects 'email' not 'user_email' for the query param
                const params = new URLSearchParams({ email: userEmail });
                if (args.query) params.append('q', args.query);
                if (args.q) params.append('q', args.q);
                if (args.max_results) params.append('max_results', args.max_results);
                if (args.time_min) params.append('time_min', args.time_min);
                if (args.time_max) params.append('time_max', args.time_max);
                url += `?${params.toString()}`;
            }
            
            console.log(`[PullExecutor] Google API request: ${method} ${url}`);
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.AGENT_MAX_API_KEY || ''
                },
                body
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google API error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            // Format output based on tool type
            // Note: Backend returns headers as msg.headers.From, msg.headers.Subject, etc.
            let output = '';
            if (tool === 'google.gmail.list_messages' || tool === 'google.gmail.search') {
                output = `Found ${data.messages?.length || 0} emails:\n\n`;
                (data.messages || []).forEach((msg, i) => {
                    // Headers can be in msg.headers.X or flattened to msg.X
                    const headers = msg.headers || {};
                    const from = headers.From || msg.from || 'Unknown';
                    const subject = headers.Subject || msg.subject || '(no subject)';
                    const date = headers.Date || msg.date || 'Unknown';
                    const snippet = msg.snippet || '';
                    
                    output += `${i + 1}. **From:** ${from}\n`;
                    output += `   **Subject:** ${subject}\n`;
                    output += `   **Date:** ${date}\n`;
                    if (snippet) {
                        output += `   **Preview:** ${snippet.substring(0, 100)}...\n`;
                    }
                    output += `   **ID:** ${msg.id}\n\n`;
                });
            } else if (tool === 'google.gmail.get_message') {
                // Headers can be in data.headers.X or flattened
                const headers = data.headers || {};
                const from = headers.From || data.from || 'Unknown';
                const to = headers.To || data.to || 'Unknown';
                const subject = headers.Subject || data.subject || '(no subject)';
                const date = headers.Date || data.date || 'Unknown';
                
                output = `Email Details:\n`;
                output += `**From:** ${from}\n`;
                output += `**To:** ${to}\n`;
                output += `**Subject:** ${subject}\n`;
                output += `**Date:** ${date}\n\n`;
                output += `**Body:**\n${data.body || data.snippet || '(no content)'}\n`;
            } else if (tool === 'google.gmail.send') {
                output = `Email sent successfully!\nMessage ID: ${data.id || 'unknown'}`;
            } else if (tool === 'google.calendar.list_events') {
                output = `Found ${data.events?.length || 0} calendar events:\n\n`;
                (data.events || []).forEach((event, i) => {
                    output += `${i + 1}. ${event.summary || '(no title)'}\n`;
                    output += `   Start: ${event.start || 'Unknown'}\n`;
                    output += `   End: ${event.end || 'Unknown'}\n\n`;
                });
            } else if (tool === 'google.calendar.create_event') {
                output = `Calendar event created!\nEvent ID: ${data.id || 'unknown'}`;
            } else if (tool === 'google.youtube.search') {
                output = `Found ${data.videos?.length || 0} videos:\n\n`;
                (data.videos || []).forEach((video, i) => {
                    output += `${i + 1}. ${video.title || '(no title)'}\n`;
                    output += `   Channel: ${video.channel || 'Unknown'}\n`;
                    output += `   URL: https://youtube.com/watch?v=${video.id}\n\n`;
                });
            } else {
                output = JSON.stringify(data, null, 2);
            }
            
            console.log(`[PullExecutor] Google action completed successfully`);
            
            return {
                success: true,
                stdout: output,
                stderr: '',
                exit_code: 0
            };
            
        } catch (error) {
            console.error(`[PullExecutor] Google action failed:`, error);
            return {
                success: false,
                error: error.message,
                stdout: '',
                stderr: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Execute browser search (web search + content extraction)
     *
     * Enhanced to support:
     * 1. Search queries - returns search results with snippets
     * 2. Direct URL fetch - fetches and extracts text content from a URL
     * 3. Search + fetch - searches then fetches top results for full content
     */
    async executeBrowserSearch(args) {
        try {
            const query = args.query || args.search || args.q;
            const url = args.url || args.fetch_url;
            const fetchContent = args.fetch_content !== false; // Default true for research tasks
            const maxResults = args.max_results || 3;

            // If a direct URL is provided, fetch its content
            if (url) {
                return await this.fetchUrlContent(url);
            }

            if (!query) {
                throw new Error('No search query or URL provided. Use {query: "search terms"} or {url: "https://..."}');
            }

            console.log(`[PullExecutor] Web search: "${query}" (fetch_content: ${fetchContent})`);

            // Use DuckDuckGo HTML search for better results
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            const html = await response.text();

            // Parse search results from HTML
            const results = this.parseDuckDuckGoResults(html, maxResults);

            if (results.length === 0) {
                // Fallback to instant answer API
                const instantUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
                const instantResponse = await fetch(instantUrl);
                const instantData = await instantResponse.json();

                if (instantData.AbstractText) {
                    return {
                        success: true,
                        stdout: `**Search Results for: ${query}**\n\n${instantData.AbstractText}\n\nSource: ${instantData.AbstractURL || 'DuckDuckGo'}`,
                        stderr: '',
                        exit_code: 0
                    };
                }

                return {
                    success: true,
                    stdout: `No results found for: ${query}`,
                    stderr: '',
                    exit_code: 0
                };
            }

            // Format search results
            let output = `**Search Results for: ${query}**\n\n`;

            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                output += `**${i + 1}. ${r.title}**\n`;
                output += `${r.snippet}\n`;
                output += `URL: ${r.url}\n\n`;
            }

            // If fetch_content is true, fetch full content from top results
            if (fetchContent && results.length > 0) {
                output += `\n---\n**Full Content from Top Results:**\n\n`;

                // Fetch content from top 2 results (to avoid overwhelming)
                const topResults = results.slice(0, 2);
                for (const r of topResults) {
                    try {
                        console.log(`[PullExecutor] Fetching content from: ${r.url}`);
                        const contentResult = await this.fetchUrlContent(r.url);

                        if (contentResult.success && contentResult.stdout) {
                            // Limit content per source to keep response manageable
                            const content = contentResult.stdout.substring(0, 4000);
                            output += `\n**From: ${r.title}**\n`;
                            output += `Source: ${r.url}\n\n`;
                            output += `${content}\n`;
                            output += `\n---\n`;
                        }
                    } catch (fetchError) {
                        console.log(`[PullExecutor] Failed to fetch ${r.url}: ${fetchError.message}`);
                    }
                }
            }

            return {
                success: true,
                stdout: output,
                stderr: '',
                exit_code: 0,
                search_results: results
            };
        } catch (error) {
            console.error(`[PullExecutor] Browser search error:`, error);
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Parse DuckDuckGo HTML search results
     */
    parseDuckDuckGoResults(html, maxResults = 5) {
        const results = [];

        // Match result blocks - DuckDuckGo uses result__a for links
        const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
        const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;

        let linkMatch;
        const links = [];
        const titles = [];

        while ((linkMatch = linkRegex.exec(html)) !== null && links.length < maxResults) {
            let url = linkMatch[1];
            // DuckDuckGo uses redirect URLs, extract the real URL
            if (url.includes('uddg=')) {
                const match = url.match(/uddg=([^&]*)/);
                if (match) {
                    url = decodeURIComponent(match[1]);
                }
            }
            if (url.startsWith('http')) {
                links.push(url);
                titles.push(linkMatch[2].replace(/<[^>]*>/g, '').trim());
            }
        }

        // Extract snippets
        const snippets = [];
        let snippetMatch;
        while ((snippetMatch = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
            snippets.push(snippetMatch[1].replace(/<[^>]*>/g, '').trim());
        }

        // Combine into results
        for (let i = 0; i < Math.min(links.length, maxResults); i++) {
            results.push({
                title: titles[i] || 'Untitled',
                url: links[i],
                snippet: snippets[i] || ''
            });
        }

        return results;
    }

    /**
     * Fetch and extract text content from a URL
     */
    async fetchUrlContent(url) {
        try {
            console.log(`[PullExecutor] Fetching URL content: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                },
                timeout: 15000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';

            // Handle JSON responses
            if (contentType.includes('application/json')) {
                const json = await response.json();
                return {
                    success: true,
                    stdout: JSON.stringify(json, null, 2),
                    stderr: '',
                    exit_code: 0
                };
            }

            // Handle HTML responses - extract text content
            const html = await response.text();
            const text = this.extractTextFromHtml(html);

            return {
                success: true,
                stdout: text,
                stderr: '',
                exit_code: 0,
                source_url: url
            };
        } catch (error) {
            console.error(`[PullExecutor] URL fetch error:`, error);
            return {
                success: false,
                stdout: '',
                stderr: `Failed to fetch ${url}: ${error.message}`,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Extract readable text from HTML
     * Removes scripts, styles, and extracts meaningful content
     */
    extractTextFromHtml(html) {
        // Remove script and style tags
        let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

        // Remove HTML comments
        text = text.replace(/<!--[\s\S]*?-->/g, '');

        // Remove navigation, header, footer, aside elements (usually not main content)
        text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
        text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
        text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
        text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

        // Convert common block elements to newlines
        text = text.replace(/<\/?(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n');

        // Remove remaining HTML tags
        text = text.replace(/<[^>]+>/g, ' ');

        // Decode HTML entities
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&quot;/g, '"');
        text = text.replace(/&#39;/g, "'");
        text = text.replace(/&[a-z]+;/gi, ' ');

        // Clean up whitespace
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/\n\s*\n/g, '\n\n');
        text = text.trim();

        // Limit length to avoid overwhelming the AI
        if (text.length > 8000) {
            text = text.substring(0, 8000) + '\n\n[Content truncated for length...]';
        }

        return text;
    }

    /**
     * Execute think tool (internal reasoning, no external action)
     */
    async executeThink(args) {
        try {
            const thought = args.thought || args.content || args.message || '';
            
            // Think tool just logs reasoning and succeeds
            console.log(`[PullExecutor] Think: ${thought}`);
            
            return {
                success: true,
                stdout: `Thought: ${thought}`,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Execute user_input tool (prompt user and wait for response)
     */
    async executeUserInput(args) {
        try {
            const prompt = args.prompt || args.question || args.message || 'Please provide input:';
            const defaultValue = args.default || '';
            
            console.log(`[PullExecutor] Requesting user input: ${prompt}`);
            
            // Create a promise that will be resolved when user responds
            const userResponse = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('User input timeout (60s)'));
                }, 60000); // 60 second timeout
                
                // Send request to renderer via IPC
                const { ipcMain } = require('electron');
                const requestId = `user_input_${Date.now()}`;
                
                // Listen for response
                const responseHandler = (event, data) => {
                    if (data.requestId === requestId) {
                        clearTimeout(timeoutId);
                        ipcMain.removeListener('user-input-response', responseHandler);
                        resolve(data.response);
                    }
                };
                
                ipcMain.on('user-input-response', responseHandler);
                
                // Send request to all windows
                const { BrowserWindow } = require('electron');
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(win => {
                    win.webContents.send('user-input-request', {
                        requestId,
                        prompt,
                        defaultValue
                    });
                });
            });
            
            console.log(`[PullExecutor] User responded: ${userResponse}`);
            
            return {
                success: true,
                stdout: userResponse,
                stderr: '',
                exit_code: 0,
                user_response: userResponse
            };
        } catch (error) {
            console.error(`[PullExecutor] User input error:`, error);
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Execute screenshot tool - capture user's screen
     */
    async executeScreenshot(args) {
        try {
            console.log('[PullExecutor] Taking screenshot of user screen');

            const { desktopCapturer, screen } = require('electron');
            const os = require('os');
            const path = require('path');
            const fs = require('fs').promises;

            // Get the primary display's actual dimensions
            // This gives us the LOGICAL dimensions (what AppleScript uses for click coordinates)
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: logicalWidth, height: logicalHeight } = primaryDisplay.size;
            const scaleFactor = primaryDisplay.scaleFactor;

            console.log(`[PullExecutor] Screen: ${logicalWidth}x${logicalHeight} (scale factor: ${scaleFactor}x)`);

            // CRITICAL FIX: Capture at LOGICAL screen size (not a fixed 1920x1080)
            // This ensures coordinates in the screenshot match AppleScript click coordinates
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: logicalWidth, height: logicalHeight }
            });

            if (!sources || sources.length === 0) {
                throw new Error('No screen sources available');
            }

            // Get the primary screen (first one)
            const primaryScreen = sources[0];
            const thumbnail = primaryScreen.thumbnail;

            // Convert to base64 PNG
            const screenshotB64 = thumbnail.toPNG().toString('base64');

            // Optionally save to temp file for debugging
            const tempPath = path.join(os.tmpdir(), `agent-max-screenshot-${Date.now()}.png`);
            await fs.writeFile(tempPath, thumbnail.toPNG());
            console.log(`[PullExecutor] Screenshot saved to: ${tempPath}`);

            // Store screen dimensions for coordinate validation
            this.lastScreenDimensions = {
                width: logicalWidth,
                height: logicalHeight,
                scaleFactor: scaleFactor,
                capturedAt: Date.now()
            };

            return {
                success: true,
                stdout: `Screenshot captured (${thumbnail.getSize().width}x${thumbnail.getSize().height}, logical: ${logicalWidth}x${logicalHeight})`,
                stderr: '',
                exit_code: 0,
                screenshot_b64: screenshotB64,
                screenshot_path: tempPath,
                dimensions: thumbnail.getSize(),
                logical_dimensions: { width: logicalWidth, height: logicalHeight },
                scale_factor: scaleFactor
            };
        } catch (error) {
            console.error('[PullExecutor] Screenshot error:', error);
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Start a background process (Phase 4)
     */
    async executeStartBackgroundProcess(args) {
        let { command, cwd, name, wait_for_ready } = args;
        const { spawn } = require('child_process');
        const crypto = require('crypto');
        
        // Handle command as array or string (backend may send either format)
        if (Array.isArray(command)) {
            command = command.join(' ');
        }
        
        // Validate command
        if (!command || typeof command !== 'string') {
            throw new Error(`Invalid command: ${JSON.stringify(command)}. Expected string or array.`);
        }
        
        console.log(`[PullExecutor] Starting background process: ${command}`);
        
        try {
            // Generate unique process ID
            const processId = `proc-${crypto.randomBytes(6).toString('hex')}`;
            
            // Spawn process
            const proc = spawn(command, [], {
                cwd: cwd || process.cwd(),
                shell: true,
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            // Store process reference
            if (!this.backgroundProcesses) {
                this.backgroundProcesses = new Map();
            }
            this.backgroundProcesses.set(processId, {
                process: proc,
                command,
                name: name || command,
                logs: [],
                startTime: Date.now()
            });
            
            // Capture logs
            let readyDetected = false;
            const logBuffer = [];
            
            proc.stdout.on('data', (data) => {
                const line = data.toString();
                logBuffer.push(line);
                const procData = this.backgroundProcesses.get(processId);
                if (procData) {
                    procData.logs.push(line);
                }
                console.log(`[Process ${processId}] ${line}`);
                
                // Check for ready signal
                if (wait_for_ready && !readyDetected && line.includes(wait_for_ready)) {
                    readyDetected = true;
                    console.log(`[PullExecutor] Process ready detected: ${wait_for_ready}`);
                }
            });
            
            proc.stderr.on('data', (data) => {
                const line = data.toString();
                logBuffer.push(line);
                const procData = this.backgroundProcesses.get(processId);
                if (procData) {
                    procData.logs.push(line);
                }
                console.error(`[Process ${processId}] ${line}`);
                
                // Check for ready signal in stderr too
                if (wait_for_ready && !readyDetected && line.includes(wait_for_ready)) {
                    readyDetected = true;
                    console.log(`[PullExecutor] Process ready detected (stderr): ${wait_for_ready}`);
                }
            });
            
            proc.on('exit', (code) => {
                console.log(`[PullExecutor] Process ${processId} exited with code ${code}`);
                const procData = this.backgroundProcesses.get(processId);
                if (procData) {
                    procData.exitCode = code;
                    procData.exitTime = Date.now();
                }
            });
            
            // Wait for ready signal if specified
            if (wait_for_ready) {
                const timeout = 30000; // 30 seconds
                const startWait = Date.now();
                
                while (!readyDetected && Date.now() - startWait < timeout) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Check if process died
                    if (proc.exitCode !== null) {
                        return {
                            success: false,
                            error: `Process exited with code ${proc.exitCode} before ready signal`,
                            stdout: logBuffer.join(''),
                            exit_code: proc.exitCode
                        };
                    }
                }
                
                if (!readyDetected) {
                    return {
                        success: false,
                        error: `Timeout waiting for ready signal: "${wait_for_ready}"`,
                        stdout: logBuffer.join(''),
                        exit_code: -1
                    };
                }
            } else {
                // Give process a moment to start
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            return {
                success: true,
                stdout: `Process started with ID: ${processId}\nPID: ${proc.pid}\n${logBuffer.join('')}`,
                process_id: processId,
                pid: proc.pid,
                exit_code: 0
            };
            
        } catch (error) {
            console.error(`[PullExecutor] Error starting background process:`, error);
            return {
                success: false,
                error: error.message,
                stdout: '',
                stderr: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Monitor a background process (Phase 4)
     */
    async executeMonitorProcess(args) {
        const { process_id, log_lines = 50 } = args;
        
        console.log(`[PullExecutor] Monitoring process: ${process_id}`);
        
        try {
            if (!this.backgroundProcesses || !this.backgroundProcesses.has(process_id)) {
                return {
                    success: false,
                    error: `Process not found: ${process_id}`,
                    exit_code: 1
                };
            }
            
            const procData = this.backgroundProcesses.get(process_id);
            const isRunning = procData.process.exitCode === null;
            const uptime = isRunning ? Date.now() - procData.startTime : procData.exitTime - procData.startTime;
            
            const recentLogs = procData.logs.slice(-log_lines).join('');
            
            const status = {
                process_id,
                name: procData.name,
                command: procData.command,
                pid: procData.process.pid,
                status: isRunning ? 'running' : 'stopped',
                exit_code: procData.process.exitCode,
                uptime_ms: uptime,
                uptime_seconds: Math.floor(uptime / 1000),
                log_line_count: procData.logs.length
            };
            
            return {
                success: true,
                stdout: `Process Status:\n${JSON.stringify(status, null, 2)}\n\nRecent Logs:\n${recentLogs}`,
                process_status: status,
                exit_code: 0
            };
            
        } catch (error) {
            console.error(`[PullExecutor] Error monitoring process:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Stop a background process (Phase 4)
     */
    async executeStopProcess(args) {
        const { process_id, force = false } = args;
        
        console.log(`[PullExecutor] Stopping process: ${process_id} (force: ${force})`);
        
        try {
            if (!this.backgroundProcesses || !this.backgroundProcesses.has(process_id)) {
                return {
                    success: false,
                    error: `Process not found: ${process_id}`,
                    exit_code: 1
                };
            }
            
            const procData = this.backgroundProcesses.get(process_id);
            const proc = procData.process;
            
            if (proc.exitCode !== null) {
                return {
                    success: true,
                    stdout: `Process already stopped with exit code ${proc.exitCode}`,
                    exit_code: 0
                };
            }
            
            // Try graceful shutdown first
            if (!force) {
                proc.kill('SIGTERM');
                
                // Wait up to 5 seconds for graceful shutdown
                const timeout = 5000;
                const startWait = Date.now();
                
                while (proc.exitCode === null && Date.now() - startWait < timeout) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                if (proc.exitCode !== null) {
                    this.backgroundProcesses.delete(process_id);
                    return {
                        success: true,
                        stdout: `Process stopped gracefully (exit code ${proc.exitCode})`,
                        exit_code: 0
                    };
                }
            }
            
            // Force kill if graceful failed or force=true
            proc.kill('SIGKILL');
            
            // Wait a moment for kill to take effect
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.backgroundProcesses.delete(process_id);
            
            return {
                success: true,
                stdout: `Process force killed`,
                exit_code: 0
            };
            
        } catch (error) {
            console.error(`[PullExecutor] Error stopping process:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Report step result to cloud
     */
    async reportStepResult(runId, stepIndex, result, action = {}) {
        // Use the new action-result endpoint for iterative execution
        const url = `${this.apiClient.baseUrl}/api/v2/runs/${runId}/action-result`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiClient.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    step_index: stepIndex,
                    action: action,
                    result: result
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to report result: ${response.status}`);
            }

            const reported = await response.json();
            console.log(`[PullExecutor] Result reported: ${reported.status}`);
            return reported;
        } catch (error) {
            console.error(`[PullExecutor] Error reporting result:`, error);
            // Don't throw - desktop continues even if cloud unavailable
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Submit user response to an ask_user question.
     * Called when the AI asked the user a question and the user responded.
     */
    async submitUserResponse(runId, response) {
        const url = `${this.apiClient.baseUrl}/api/v2/runs/${runId}/user-response`;

        try {
            const fetchResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiClient.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    response: response
                })
            });

            if (!fetchResponse.ok) {
                throw new Error(`Failed to submit user response: ${fetchResponse.status}`);
            }

            const result = await fetchResponse.json();
            console.log(`[PullExecutor] User response submitted: ${result.status}`);
            return result;
        } catch (error) {
            console.error(`[PullExecutor] Error submitting user response:`, error);
            throw error;
        }
    }

    // ============================================================
    // DESKTOP INTEGRATION TOOLS
    // These tools help the AI interact naturally with the user's computer
    // ============================================================

    /**
     * Read from system clipboard
     */
    async executeClipboardRead(args) {
        try {
            const { clipboard } = require('electron');
            const format = args.format || 'text';

            let content;
            if (format === 'html') {
                content = clipboard.readHTML();
            } else if (format === 'rtf') {
                content = clipboard.readRTF();
            } else if (format === 'image') {
                const image = clipboard.readImage();
                if (image.isEmpty()) {
                    return {
                        success: true,
                        stdout: 'Clipboard does not contain an image',
                        exit_code: 0
                    };
                }
                // Return image dimensions and base64
                const size = image.getSize();
                return {
                    success: true,
                    stdout: `Clipboard contains image: ${size.width}x${size.height}`,
                    image_b64: image.toPNG().toString('base64'),
                    dimensions: size,
                    exit_code: 0
                };
            } else {
                content = clipboard.readText();
            }

            console.log(`[PullExecutor] Clipboard read: ${content.length} chars`);

            return {
                success: true,
                stdout: content || '(clipboard is empty)',
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            console.error(`[PullExecutor] Clipboard read error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Write to system clipboard
     */
    async executeClipboardWrite(args) {
        try {
            const { clipboard } = require('electron');
            const text = args.text || args.content || '';
            const format = args.format || 'text';

            if (!text && format === 'text') {
                return {
                    success: false,
                    error: 'Must provide text to write to clipboard',
                    exit_code: 1
                };
            }

            if (format === 'html') {
                clipboard.writeHTML(text);
            } else {
                clipboard.writeText(text);
            }

            console.log(`[PullExecutor] Clipboard write: ${text.length} chars`);

            return {
                success: true,
                stdout: `Copied ${text.length} characters to clipboard`,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            console.error(`[PullExecutor] Clipboard write error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Click at screen coordinates
     * Uses AppleScript on macOS, could use robotjs/nut-js for cross-platform
     */
    async executeMouseClick(args) {
        try {
            let x = args.x;
            let y = args.y;
            const button = args.button || 'left'; // left, right, middle
            const clicks = args.clicks || 1; // 1 = single, 2 = double

            // Optional: source dimensions from which coordinates came (for scaling)
            const sourceWidth = args.source_width;
            const sourceHeight = args.source_height;

            if (x === undefined || y === undefined) {
                return {
                    success: false,
                    error: 'Must provide x and y coordinates',
                    exit_code: 1
                };
            }

            const os = require('os');
            if (os.platform() !== 'darwin') {
                return {
                    success: false,
                    error: `Mouse click not implemented for ${os.platform()}. Install robotjs for cross-platform support.`,
                    exit_code: 1
                };
            }

            // Get current screen dimensions for validation
            const { screen } = require('electron');
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth, height: screenHeight } = primaryDisplay.size;

            console.log(`[PullExecutor] Click requested at (${x}, ${y}), screen: ${screenWidth}x${screenHeight}`);

            // COORDINATE SCALING: If source dimensions provided and different from screen, scale
            if (sourceWidth && sourceHeight && (sourceWidth !== screenWidth || sourceHeight !== screenHeight)) {
                const scaleX = screenWidth / sourceWidth;
                const scaleY = screenHeight / sourceHeight;
                const originalX = x;
                const originalY = y;
                x = Math.round(x * scaleX);
                y = Math.round(y * scaleY);
                console.log(`[PullExecutor] Scaled coordinates: (${originalX}, ${originalY}) -> (${x}, ${y}) (scale: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)})`);
            }

            // SAFETY VALIDATION: Ensure coordinates are within screen bounds
            if (x < 0 || x >= screenWidth || y < 0 || y >= screenHeight) {
                console.error(`[PullExecutor] SAFETY BLOCK: Coordinates (${x}, ${y}) out of screen bounds (${screenWidth}x${screenHeight})`);
                return {
                    success: false,
                    error: `Coordinates (${x}, ${y}) are outside screen bounds (0-${screenWidth}, 0-${screenHeight}). Take a new screenshot to recalculate.`,
                    exit_code: 1,
                    safety_blocked: true
                };
            }

            // SAFETY: Warn if clicking in extreme corners (might be system areas)
            const cornerMargin = 5;
            if (x < cornerMargin || y < cornerMargin || x >= screenWidth - cornerMargin || y >= screenHeight - cornerMargin) {
                console.warn(`[PullExecutor] Warning: Clicking near screen edge at (${x}, ${y})`);
            }

            console.log(`[PullExecutor] Mouse click at (${x}, ${y}), button: ${button}, clicks: ${clicks}`);

            // macOS: Try cliclick first (more reliable), fallback to AppleScript
            // cliclick is a command-line tool for mouse clicks: brew install cliclick
            let clickSucceeded = false;
            let clickMethod = '';

            // Try cliclick first (recommended - more reliable)
            try {
                // cliclick syntax: c: = click, dc: = double-click, rc: = right-click
                let cmd = clicks === 2 ? 'dc' : 'c';
                if (button === 'right') cmd = 'rc';
                await execAsync(`cliclick ${cmd}:${x},${y}`);
                clickSucceeded = true;
                clickMethod = 'cliclick';
                console.log(`[PullExecutor] Click succeeded using cliclick`);
            } catch (cliclickError) {
                console.log(`[PullExecutor] cliclick not available, trying AppleScript...`);

                // Fallback to AppleScript
                try {
                    const clickCmd = clicks === 2 ? 'double click' : 'click';
                    const script = `
                        tell application "System Events"
                            ${clickCmd} at {${x}, ${y}}
                        end tell
                    `;
                    await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
                    clickSucceeded = true;
                    clickMethod = 'AppleScript';
                    console.log(`[PullExecutor] Click succeeded using AppleScript`);
                } catch (appleScriptError) {
                    // If both fail, throw error with helpful message
                    throw new Error(
                        `Click failed. Install cliclick (brew install cliclick) or grant accessibility permissions. ` +
                        `cliclick error: ${cliclickError.message}, AppleScript error: ${appleScriptError.message}`
                    );
                }
            }

            return {
                success: true,
                stdout: `Clicked at (${x}, ${y}) on ${screenWidth}x${screenHeight} screen using ${clickMethod}`,
                stderr: '',
                exit_code: 0,
                clicked_at: { x, y },
                screen_dimensions: { width: screenWidth, height: screenHeight },
                click_method: clickMethod
            };
        } catch (error) {
            console.error(`[PullExecutor] Mouse click error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Move mouse to screen coordinates (without clicking)
     */
    async executeMouseMove(args) {
        try {
            const x = args.x;
            const y = args.y;

            if (x === undefined || y === undefined) {
                return {
                    success: false,
                    error: 'Must provide x and y coordinates',
                    exit_code: 1
                };
            }

            console.log(`[PullExecutor] Mouse move to (${x}, ${y})`);

            const os = require('os');
            if (os.platform() === 'darwin') {
                // macOS: Use cliclick or Python with pyautogui
                // Fallback to AppleScript (limited)
                const script = `
                    do shell script "python3 -c \\"import pyautogui; pyautogui.moveTo(${x}, ${y})\\""
                `;

                try {
                    await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
                } catch (e) {
                    // Fallback message if pyautogui not installed
                    return {
                        success: true,
                        stdout: `Mouse move requested to (${x}, ${y}). Note: Install pyautogui for actual mouse movement.`,
                        exit_code: 0
                    };
                }

                return {
                    success: true,
                    stdout: `Moved mouse to (${x}, ${y})`,
                    exit_code: 0
                };
            } else {
                return {
                    success: false,
                    error: `Mouse move not implemented for ${os.platform()}`,
                    exit_code: 1
                };
            }
        } catch (error) {
            console.error(`[PullExecutor] Mouse move error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Get system information (CPU, memory, running apps)
     */
    async executeSystemInfo(args) {
        try {
            const os = require('os');
            const type = args.type || 'all'; // all, cpu, memory, apps, disk

            let info = {};

            if (type === 'all' || type === 'cpu') {
                info.cpu = {
                    model: os.cpus()[0]?.model || 'Unknown',
                    cores: os.cpus().length,
                    load: os.loadavg()
                };
            }

            if (type === 'all' || type === 'memory') {
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                info.memory = {
                    total_gb: (totalMem / 1024 / 1024 / 1024).toFixed(2),
                    free_gb: (freeMem / 1024 / 1024 / 1024).toFixed(2),
                    used_gb: ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2),
                    percent_used: ((1 - freeMem / totalMem) * 100).toFixed(1)
                };
            }

            if (type === 'all' || type === 'system') {
                info.system = {
                    platform: os.platform(),
                    release: os.release(),
                    hostname: os.hostname(),
                    uptime_hours: (os.uptime() / 3600).toFixed(1),
                    user: os.userInfo().username,
                    home: os.homedir()
                };
            }

            if (type === 'all' || type === 'apps') {
                // Get running applications (macOS)
                if (os.platform() === 'darwin') {
                    try {
                        const { stdout } = await execAsync('ps aux | head -20');
                        info.top_processes = stdout;
                    } catch (e) {
                        info.top_processes = 'Unable to fetch';
                    }
                }
            }

            const output = JSON.stringify(info, null, 2);
            console.log(`[PullExecutor] System info retrieved`);

            return {
                success: true,
                stdout: output,
                system_info: info,
                exit_code: 0
            };
        } catch (error) {
            console.error(`[PullExecutor] System info error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Show a desktop notification
     */
    async executeNotification(args) {
        try {
            const { Notification } = require('electron');
            const title = args.title || 'Agent Max';
            const body = args.body || args.message || '';
            const silent = args.silent || false;

            if (!body) {
                return {
                    success: false,
                    error: 'Must provide notification body/message',
                    exit_code: 1
                };
            }

            const notification = new Notification({
                title,
                body,
                silent
            });

            notification.show();
            console.log(`[PullExecutor] Notification shown: ${title}`);

            return {
                success: true,
                stdout: `Notification displayed: "${title}"`,
                exit_code: 0
            };
        } catch (error) {
            console.error(`[PullExecutor] Notification error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Open a URL in the default browser
     */
    async executeOpenUrl(args) {
        try {
            const { shell } = require('electron');
            const url = args.url;

            if (!url) {
                return {
                    success: false,
                    error: 'Must provide URL to open',
                    exit_code: 1
                };
            }

            await shell.openExternal(url);
            console.log(`[PullExecutor] Opened URL: ${url}`);

            return {
                success: true,
                stdout: `Opened ${url} in default browser`,
                exit_code: 0
            };
        } catch (error) {
            console.error(`[PullExecutor] Open URL error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Open a file with its default application
     */
    async executeOpenFile(args) {
        try {
            const { shell } = require('electron');
            const path = args.path || args.file;

            if (!path) {
                return {
                    success: false,
                    error: 'Must provide file path to open',
                    exit_code: 1
                };
            }

            await shell.openPath(path);
            console.log(`[PullExecutor] Opened file: ${path}`);

            return {
                success: true,
                stdout: `Opened ${path} with default application`,
                exit_code: 0
            };
        } catch (error) {
            console.error(`[PullExecutor] Open file error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * List running applications
     */
    async executeListApps(args) {
        try {
            const os = require('os');

            if (os.platform() === 'darwin') {
                // macOS: Get running apps via AppleScript
                const script = `
                    tell application "System Events"
                        set appList to name of every process whose background only is false
                        return appList
                    end tell
                `;

                const { stdout } = await execAsync(`osascript -e '${script}'`);
                const apps = stdout.trim().split(', ');

                let output = `Running Applications (${apps.length}):\n`;
                apps.forEach((app, i) => {
                    output += `  ${i + 1}. ${app}\n`;
                });

                return {
                    success: true,
                    stdout: output,
                    apps: apps,
                    exit_code: 0
                };
            } else {
                // Fallback to ps for other platforms
                const { stdout } = await execAsync('ps aux | grep -v grep | awk \'{print $11}\' | sort | uniq | head -30');
                return {
                    success: true,
                    stdout: `Running Processes:\n${stdout}`,
                    exit_code: 0
                };
            }
        } catch (error) {
            console.error(`[PullExecutor] List apps error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Focus/activate an application
     */
    async executeFocusApp(args) {
        try {
            const appName = args.app || args.app_name || args.name;

            if (!appName) {
                return {
                    success: false,
                    error: 'Must provide app name to focus',
                    exit_code: 1
                };
            }

            const os = require('os');

            if (os.platform() === 'darwin') {
                const script = `
                    tell application "${appName}"
                        activate
                    end tell
                `;

                await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

                return {
                    success: true,
                    stdout: `Focused application: ${appName}`,
                    exit_code: 0
                };
            } else {
                return {
                    success: false,
                    error: `Focus app not implemented for ${os.platform()}`,
                    exit_code: 1
                };
            }
        } catch (error) {
            console.error(`[PullExecutor] Focus app error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    // ============================================================
    // KEYBOARD & INPUT TOOLS
    // Allow the AI to type and use keyboard shortcuts
    // ============================================================

    /**
     * Type text into the currently focused application
     * Uses clipboard paste (pbcopy + Cmd+V) for reliability with any content
     */
    async executeTypeText(args) {
        try {
            const text = args.text || args.content || '';
            const pressEnter = args.press_enter || args.enter || false;

            if (!text) {
                return {
                    success: false,
                    error: 'Must provide text to type',
                    exit_code: 1
                };
            }

            console.log(`[PullExecutor] Typing ${text.length} characters via clipboard paste`);

            const os = require('os');
            if (os.platform() === 'darwin') {
                // Save current clipboard content
                let originalClipboard = '';
                try {
                    const { stdout } = await execAsync('pbpaste');
                    originalClipboard = stdout;
                } catch (e) {
                    // Clipboard might be empty or contain non-text data
                }

                // Copy text to clipboard using echo and pbcopy
                // Use spawn to handle the input properly
                const { spawn } = require('child_process');
                await new Promise((resolve, reject) => {
                    const pbcopy = spawn('pbcopy');
                    pbcopy.stdin.write(text);
                    pbcopy.stdin.end();
                    pbcopy.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`pbcopy failed with code ${code}`));
                    });
                    pbcopy.on('error', reject);
                });

                // Paste using Cmd+V
                let script = `
                    tell application "System Events"
                        keystroke "v" using command down
                    end tell
                `;

                if (pressEnter) {
                    script = `
                        tell application "System Events"
                            keystroke "v" using command down
                            delay 0.1
                            keystroke return
                        end tell
                    `;
                }

                await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

                // Restore original clipboard after a short delay
                setTimeout(async () => {
                    try {
                        const { spawn } = require('child_process');
                        const pbcopy = spawn('pbcopy');
                        pbcopy.stdin.write(originalClipboard);
                        pbcopy.stdin.end();
                    } catch (e) {
                        // Ignore restore errors
                    }
                }, 500);

                return {
                    success: true,
                    stdout: `Typed ${text.length} characters${pressEnter ? ' and pressed Enter' : ''}`,
                    exit_code: 0
                };
            } else {
                return {
                    success: false,
                    error: `Type text not implemented for ${os.platform()}. Install pyautogui.`,
                    exit_code: 1
                };
            }
        } catch (error) {
            console.error(`[PullExecutor] Type text error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Press a keyboard shortcut (hotkey)
     * e.g., Cmd+S, Cmd+C, Cmd+V, Cmd+Tab
     */
    async executeHotkey(args) {
        try {
            // Accept various formats: "cmd+s", ["cmd", "s"], {modifiers: ["cmd"], key: "s"}
            let modifiers = [];
            let key = '';

            if (args.keys && Array.isArray(args.keys)) {
                // Format: ["cmd", "shift", "s"]
                const parts = args.keys;
                key = parts[parts.length - 1].toLowerCase();
                modifiers = parts.slice(0, -1).map(m => m.toLowerCase());
            } else if (args.shortcut || args.hotkey) {
                // Format: "cmd+s" or "cmd+shift+s"
                const parts = (args.shortcut || args.hotkey).toLowerCase().split('+');
                key = parts[parts.length - 1];
                modifiers = parts.slice(0, -1);
            } else if (args.key) {
                // Format: {key: "s", modifiers: ["cmd"]}
                key = args.key.toLowerCase();
                modifiers = (args.modifiers || []).map(m => m.toLowerCase());
            } else {
                return {
                    success: false,
                    error: 'Must provide hotkey as: keys array, shortcut string (e.g., "cmd+s"), or {key, modifiers}',
                    exit_code: 1
                };
            }

            console.log(`[PullExecutor] Pressing hotkey: ${modifiers.join('+')}${modifiers.length ? '+' : ''}${key}`);

            const os = require('os');
            if (os.platform() === 'darwin') {
                // Map modifier names to AppleScript
                const modifierMap = {
                    'cmd': 'command down',
                    'command': 'command down',
                    'ctrl': 'control down',
                    'control': 'control down',
                    'alt': 'option down',
                    'option': 'option down',
                    'shift': 'shift down'
                };

                const modifierStr = modifiers
                    .map(m => modifierMap[m] || `${m} down`)
                    .join(', ');

                // Handle special keys
                const specialKeys = {
                    'return': 'return',
                    'enter': 'return',
                    'tab': 'tab',
                    'escape': 'escape',
                    'esc': 'escape',
                    'space': 'space',
                    'delete': 'delete',
                    'backspace': 'delete',
                    'up': 'up arrow',
                    'down': 'down arrow',
                    'left': 'left arrow',
                    'right': 'right arrow'
                };

                let script;
                if (specialKeys[key]) {
                    script = `
                        tell application "System Events"
                            key code ${this.getKeyCode(specialKeys[key])} using {${modifierStr}}
                        end tell
                    `;
                    // Fallback to keystroke for simpler handling
                    script = `
                        tell application "System Events"
                            keystroke "${key}" using {${modifierStr}}
                        end tell
                    `;
                } else {
                    script = `
                        tell application "System Events"
                            keystroke "${key}" using {${modifierStr}}
                        end tell
                    `;
                }

                await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

                return {
                    success: true,
                    stdout: `Pressed ${modifiers.join('+')}${modifiers.length ? '+' : ''}${key}`,
                    exit_code: 0
                };
            } else {
                return {
                    success: false,
                    error: `Hotkey not implemented for ${os.platform()}`,
                    exit_code: 1
                };
            }
        } catch (error) {
            console.error(`[PullExecutor] Hotkey error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    // ============================================================
    // WINDOW MANAGEMENT TOOLS
    // Arrange and control windows like a power user
    // ============================================================

    /**
     * Resize a specific window
     */
    async executeWindowResize(args) {
        try {
            const appName = args.app || args.app_name;
            const width = args.width;
            const height = args.height;
            const x = args.x;
            const y = args.y;

            if (!appName) {
                return {
                    success: false,
                    error: 'Must provide app name to resize',
                    exit_code: 1
                };
            }

            console.log(`[PullExecutor] Resizing ${appName} window`);

            const os = require('os');
            if (os.platform() === 'darwin') {
                let script = `tell application "System Events"\n`;
                script += `    tell process "${appName}"\n`;
                script += `        tell window 1\n`;

                if (x !== undefined && y !== undefined) {
                    script += `            set position to {${x}, ${y}}\n`;
                }
                if (width !== undefined && height !== undefined) {
                    script += `            set size to {${width}, ${height}}\n`;
                }

                script += `        end tell\n`;
                script += `    end tell\n`;
                script += `end tell`;

                await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

                return {
                    success: true,
                    stdout: `Resized ${appName} window`,
                    exit_code: 0
                };
            } else {
                return {
                    success: false,
                    error: `Window resize not implemented for ${os.platform()}`,
                    exit_code: 1
                };
            }
        } catch (error) {
            console.error(`[PullExecutor] Window resize error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Arrange windows in preset layouts
     * Presets: left_half, right_half, maximize, center, top_half, bottom_half
     */
    async executeWindowArrange(args) {
        try {
            const appName = args.app || args.app_name;
            const preset = args.preset || args.layout;

            if (!appName || !preset) {
                return {
                    success: false,
                    error: 'Must provide app name and preset (left_half, right_half, maximize, center)',
                    exit_code: 1
                };
            }

            console.log(`[PullExecutor] Arranging ${appName} window to ${preset}`);

            const os = require('os');
            if (os.platform() === 'darwin') {
                // Get screen dimensions
                const screenScript = `
                    tell application "Finder"
                        set screenBounds to bounds of window of desktop
                        return (item 3 of screenBounds) & "," & (item 4 of screenBounds)
                    end tell
                `;

                let screenW = 1920, screenH = 1080;
                try {
                    const { stdout } = await execAsync(`osascript -e '${screenScript}'`);
                    [screenW, screenH] = stdout.trim().split(',').map(Number);
                } catch (e) {
                    console.log('[PullExecutor] Using default screen size');
                }

                // Calculate preset positions
                let x, y, width, height;
                const menuBarHeight = 25;

                switch (preset) {
                    case 'left_half':
                        x = 0; y = menuBarHeight;
                        width = Math.floor(screenW / 2); height = screenH - menuBarHeight;
                        break;
                    case 'right_half':
                        x = Math.floor(screenW / 2); y = menuBarHeight;
                        width = Math.floor(screenW / 2); height = screenH - menuBarHeight;
                        break;
                    case 'maximize':
                    case 'full':
                        x = 0; y = menuBarHeight;
                        width = screenW; height = screenH - menuBarHeight;
                        break;
                    case 'center':
                        width = Math.floor(screenW * 0.6);
                        height = Math.floor(screenH * 0.7);
                        x = Math.floor((screenW - width) / 2);
                        y = Math.floor((screenH - height) / 2);
                        break;
                    case 'top_half':
                        x = 0; y = menuBarHeight;
                        width = screenW; height = Math.floor((screenH - menuBarHeight) / 2);
                        break;
                    case 'bottom_half':
                        height = Math.floor((screenH - menuBarHeight) / 2);
                        x = 0; y = menuBarHeight + height;
                        width = screenW;
                        break;
                    default:
                        return {
                            success: false,
                            error: `Unknown preset: ${preset}. Use: left_half, right_half, maximize, center, top_half, bottom_half`,
                            exit_code: 1
                        };
                }

                const script = `
                    tell application "System Events"
                        tell process "${appName}"
                            tell window 1
                                set position to {${x}, ${y}}
                                set size to {${width}, ${height}}
                            end tell
                        end tell
                    end tell
                `;

                await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

                return {
                    success: true,
                    stdout: `Arranged ${appName} to ${preset} (${width}x${height} at ${x},${y})`,
                    exit_code: 0
                };
            } else {
                return {
                    success: false,
                    error: `Window arrange not implemented for ${os.platform()}`,
                    exit_code: 1
                };
            }
        } catch (error) {
            console.error(`[PullExecutor] Window arrange error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Get the currently active window and application
     * This helps the AI understand what the user is working on
     */
    async executeGetActiveWindow(args) {
        try {
            console.log(`[PullExecutor] Getting active window info`);

            const os = require('os');
            if (os.platform() === 'darwin') {
                const script = `
                    tell application "System Events"
                        set frontApp to first process whose frontmost is true
                        set appName to name of frontApp
                        try
                            set winName to name of front window of frontApp
                        on error
                            set winName to "No window"
                        end try
                        return appName & "|" & winName
                    end tell
                `;

                const { stdout } = await execAsync(`osascript -e '${script}'`);
                const [appName, windowTitle] = stdout.trim().split('|');

                const result = {
                    app: appName,
                    window_title: windowTitle,
                    description: `User is in ${appName}${windowTitle !== 'No window' ? `: "${windowTitle}"` : ''}`
                };

                return {
                    success: true,
                    stdout: JSON.stringify(result, null, 2),
                    active_window: result,
                    exit_code: 0
                };
            } else {
                return {
                    success: false,
                    error: `Active window detection not implemented for ${os.platform()}`,
                    exit_code: 1
                };
            }
        } catch (error) {
            console.error(`[PullExecutor] Get active window error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    // ============================================================
    // AUDIO & SPEECH TOOLS
    // Allow the AI to speak and play sounds
    // ============================================================

    /**
     * Use text-to-speech to read text aloud
     * Useful for reading results to the user hands-free
     */
    async executeDictate(args) {
        try {
            const text = args.text || args.message || args.content || '';
            const voice = args.voice || 'Samantha'; // Default macOS voice
            const rate = args.rate || 200; // Words per minute

            if (!text) {
                return {
                    success: false,
                    error: 'Must provide text to speak',
                    exit_code: 1
                };
            }

            console.log(`[PullExecutor] Speaking: "${text.substring(0, 50)}..."`);

            const os = require('os');
            if (os.platform() === 'darwin') {
                // Escape quotes for shell
                const escaped = text.replace(/"/g, '\\"').replace(/'/g, "'\\''");

                // Use macOS 'say' command
                await execAsync(`say -v "${voice}" -r ${rate} "${escaped}"`);

                return {
                    success: true,
                    stdout: `Spoke ${text.length} characters`,
                    exit_code: 0
                };
            } else {
                // Try espeak on Linux
                try {
                    const escaped = text.replace(/"/g, '\\"');
                    await execAsync(`espeak "${escaped}"`);
                    return {
                        success: true,
                        stdout: `Spoke ${text.length} characters`,
                        exit_code: 0
                    };
                } catch (e) {
                    return {
                        success: false,
                        error: `Text-to-speech not available. Install espeak.`,
                        exit_code: 1
                    };
                }
            }
        } catch (error) {
            console.error(`[PullExecutor] Dictate error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Play a system sound or audio file
     * Useful for alerts when tasks complete
     */
    async executePlaySound(args) {
        try {
            const sound = args.sound || args.file || 'default';
            const volume = args.volume || 1.0; // 0.0 to 1.0

            console.log(`[PullExecutor] Playing sound: ${sound}`);

            const os = require('os');
            const path = require('path');

            if (os.platform() === 'darwin') {
                // macOS system sounds are in /System/Library/Sounds/
                const systemSounds = {
                    'default': 'Glass',
                    'success': 'Glass',
                    'error': 'Basso',
                    'warning': 'Sosumi',
                    'notification': 'Ping',
                    'complete': 'Hero',
                    'pop': 'Pop',
                    'purr': 'Purr',
                    'blow': 'Blow',
                    'bottle': 'Bottle',
                    'frog': 'Frog',
                    'funk': 'Funk',
                    'morse': 'Morse',
                    'submarine': 'Submarine',
                    'tink': 'Tink'
                };

                let soundFile;
                if (systemSounds[sound]) {
                    soundFile = `/System/Library/Sounds/${systemSounds[sound]}.aiff`;
                } else if (sound.startsWith('/')) {
                    soundFile = sound;
                } else {
                    soundFile = `/System/Library/Sounds/${sound}.aiff`;
                }

                await execAsync(`afplay "${soundFile}"`);

                return {
                    success: true,
                    stdout: `Played sound: ${sound}`,
                    exit_code: 0
                };
            } else {
                // Try paplay on Linux
                try {
                    await execAsync(`paplay /usr/share/sounds/freedesktop/stereo/complete.oga`);
                    return {
                        success: true,
                        stdout: `Played sound`,
                        exit_code: 0
                    };
                } catch (e) {
                    return {
                        success: false,
                        error: `Sound playback not available`,
                        exit_code: 1
                    };
                }
            }
        } catch (error) {
            console.error(`[PullExecutor] Play sound error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    // ============================================================
    // FILE MONITORING TOOLS
    // Watch for changes in the filesystem
    // ============================================================

    /**
     * Watch a directory for file changes
     * Returns when a change is detected or timeout occurs
     */
    async executeFileWatch(args) {
        try {
            const watchPath = args.path || args.directory;
            const timeout = args.timeout || 30000; // 30 seconds default
            const eventTypes = args.events || ['change', 'add', 'unlink'];

            if (!watchPath) {
                return {
                    success: false,
                    error: 'Must provide path to watch',
                    exit_code: 1
                };
            }

            console.log(`[PullExecutor] Watching ${watchPath} for changes (timeout: ${timeout}ms)`);

            const fs = require('fs');
            const path = require('path');

            // Check if path exists
            if (!fs.existsSync(watchPath)) {
                return {
                    success: false,
                    error: `Path does not exist: ${watchPath}`,
                    exit_code: 1
                };
            }

            return new Promise((resolve) => {
                const changes = [];
                let watcher;

                const cleanup = () => {
                    if (watcher) {
                        watcher.close();
                    }
                };

                const timeoutId = setTimeout(() => {
                    cleanup();
                    resolve({
                        success: true,
                        stdout: changes.length > 0
                            ? `Detected ${changes.length} change(s):\n${changes.join('\n')}`
                            : 'No changes detected within timeout',
                        changes: changes,
                        exit_code: 0
                    });
                }, timeout);

                // Use fs.watch for simplicity (could use chokidar for more features)
                watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
                    const change = `${eventType}: ${filename}`;
                    changes.push(change);
                    console.log(`[PullExecutor] File change: ${change}`);

                    // If we detect a change, return immediately (or accumulate)
                    if (args.return_on_first) {
                        clearTimeout(timeoutId);
                        cleanup();
                        resolve({
                            success: true,
                            stdout: `Detected change: ${change}`,
                            changes: [change],
                            exit_code: 0
                        });
                    }
                });

                watcher.on('error', (error) => {
                    clearTimeout(timeoutId);
                    cleanup();
                    resolve({
                        success: false,
                        error: error.message,
                        exit_code: 1
                    });
                });
            });
        } catch (error) {
            console.error(`[PullExecutor] File watch error:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Stop execution and cleanup background processes
     * This now actively interrupts running operations
     */
    stop() {
        console.log(`[PullExecutor] 🛑 Stopping execution IMMEDIATELY`);
        this.isRunning = false;

        // Trigger any pending cancellation callback
        if (this._cancelCallback) {
            console.log(`[PullExecutor] Triggering cancellation callback`);
            try {
                this._cancelCallback();
            } catch (e) {
                // Expected - the callback throws to interrupt
            }
            this._cancelCallback = null;
        }

        // Kill any active child processes spawned during execution
        if (this.activeChildProcesses && this.activeChildProcesses.size > 0) {
            console.log(`[PullExecutor] Killing ${this.activeChildProcesses.size} active child process(es)`);
            for (const childProc of this.activeChildProcesses) {
                try {
                    if (childProc && !childProc.killed) {
                        console.log(`[PullExecutor] Killing child process PID: ${childProc.pid}`);
                        childProc.kill('SIGTERM');
                        // Force kill after 2 seconds if still running
                        setTimeout(() => {
                            try {
                                if (!childProc.killed) {
                                    childProc.kill('SIGKILL');
                                }
                            } catch (e) { /* ignore */ }
                        }, 2000);
                    }
                } catch (error) {
                    console.error(`[PullExecutor] Error killing child process:`, error.message);
                }
            }
            this.activeChildProcesses.clear();
        }

        // Cleanup background processes (existing logic)
        if (this.backgroundProcesses && this.backgroundProcesses.size > 0) {
            console.log(`[PullExecutor] Cleaning up ${this.backgroundProcesses.size} background processes`);
            for (const [processId, procData] of this.backgroundProcesses.entries()) {
                try {
                    if (procData.process.exitCode === null) {
                        console.log(`[PullExecutor] Killing background process ${processId} (PID: ${procData.process.pid})`);
                        procData.process.kill('SIGTERM');
                    }
                } catch (error) {
                    console.error(`[PullExecutor] Error killing process ${processId}:`, error);
                }
            }
            this.backgroundProcesses.clear();
        }

        console.log(`[PullExecutor] ✓ Stop completed - all processes terminated`);
    }

    /**
     * Sleep helper that respects cancellation
     */
    sleep(ms) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                resolve();
            }, ms);

            // If we're cancelled during sleep, resolve immediately
            const checkInterval = setInterval(() => {
                if (!this.isRunning) {
                    clearTimeout(timeoutId);
                    clearInterval(checkInterval);
                    resolve(); // Resolve instead of reject for cleaner cancellation
                }
            }, 100);

            // Clean up interval when timeout completes
            setTimeout(() => {
                clearInterval(checkInterval);
            }, ms + 10);
        });
    }

    // =========================================================================
    // PARALLEL WEB AGENTS EXECUTION
    // =========================================================================

    /**
     * Execute multiple agent steps in parallel
     * Each agent gets its own browser TAB in the workspace
     */
    async executeParallelAgentSteps(runId, parallelAgents) {
        console.log(`[PullExecutor] 🔀 Starting ${parallelAgents.length} parallel agent steps`);

        // Get workspace manager
        const { workspaceManager } = require('../workspace/workspaceManager.cjs');

        // Ensure workspace is active
        if (!workspaceManager.getIsActive()) {
            console.log(`[PullExecutor] 🔀 Creating workspace for parallel agents`);
            await workspaceManager.create(1280, 800);
        }

        // Reuse existing tab map if available, otherwise create new one
        if (!this.parallelAgentTabs) {
            this.parallelAgentTabs = new Map();
        }
        const agentTabMap = this.parallelAgentTabs;

        // Only create tabs for agents that don't have one yet
        for (let i = 0; i < parallelAgents.length; i++) {
            const agent = parallelAgents[i];

            // If agent already has a tab assigned, reuse it
            if (agentTabMap.has(agent.agent_id)) {
                console.log(`[PullExecutor] 🔀 Agent '${agent.agent_id}' reusing tab ${agentTabMap.get(agent.agent_id)}`);
                continue;
            }

            if (i === 0 || agentTabMap.size === 0) {
                // First agent uses the current active tab
                agentTabMap.set(agent.agent_id, workspaceManager.activeTabId);
                console.log(`[PullExecutor] 🔀 Agent '${agent.agent_id}' using existing tab ${workspaceManager.activeTabId}`);
            } else {
                // Create new tab for subsequent agents
                const tabResult = await workspaceManager.createTab('about:blank');
                if (tabResult.success) {
                    agentTabMap.set(agent.agent_id, tabResult.tabId);
                    console.log(`[PullExecutor] 🔀 Agent '${agent.agent_id}' created new tab ${tabResult.tabId}`);
                } else {
                    console.error(`[PullExecutor] 🔀 Failed to create tab for agent '${agent.agent_id}'`);
                    agentTabMap.set(agent.agent_id, workspaceManager.activeTabId); // Fallback to active tab
                }
            }
        }

        // Execute all steps in parallel using Promise.all
        const promises = parallelAgents.map(async (agentStep) => {
            const agentId = agentStep.agent_id;
            const tabId = agentTabMap.get(agentId);
            const startTime = Date.now();

            try {
                // Skip workspace.create for parallel agents - workspace is already created above
                if (agentStep.tool_name === 'workspace.create') {
                    console.log(`[PullExecutor] [${agentId}] Skipping workspace.create (already created)`);
                    return {
                        agent_id: agentId,
                        tab_id: tabId,
                        action: {
                            tool_name: agentStep.tool_name,
                            args: agentStep.args,
                            status_summary: 'Workspace already active'
                        },
                        result: {
                            success: true,
                            output: 'Workspace already created for parallel agents',
                            execution_time_ms: Date.now() - startTime
                        }
                    };
                }

                console.log(`[PullExecutor] [${agentId}] Executing on tab ${tabId}: ${agentStep.tool_name}`);

                // Switch to this agent's tab before executing
                workspaceManager.switchTab(tabId);

                // Create step config for this agent with tab context
                const stepConfig = {
                    step: {
                        tool_name: agentStep.tool_name,
                        args: { ...agentStep.args, _tabId: tabId }, // Pass tab ID in args
                        step_id: agentStep.step_id,
                        description: agentStep.status_summary
                    },
                    timeout_sec: 60
                };

                // Execute the step on the specific tab
                const result = await this.executeStepWithRetry(stepConfig);

                return {
                    agent_id: agentId,
                    tab_id: tabId,
                    action: {
                        tool_name: agentStep.tool_name,
                        args: agentStep.args,
                        status_summary: agentStep.status_summary
                    },
                    result: {
                        ...result,
                        execution_time_ms: Date.now() - startTime
                    }
                };
            } catch (error) {
                console.error(`[PullExecutor] [${agentId}] Error:`, error);
                return {
                    agent_id: agentId,
                    tab_id: tabId,
                    action: {
                        tool_name: agentStep.tool_name,
                        args: agentStep.args,
                        status_summary: agentStep.status_summary
                    },
                    result: {
                        success: false,
                        error: error.message,
                        execution_time_ms: Date.now() - startTime
                    }
                };
            }
        });

        // Wait for all parallel executions to complete
        const results = await Promise.all(promises);
        console.log(`[PullExecutor] 🔀 All ${results.length} parallel steps completed`);

        return results;
    }

    /**
     * Report a parallel agent's result to the backend
     */
    async reportParallelAgentResult(runId, stepIndex, agentResult) {
        const url = `${this.apiClient.baseUrl}/api/v2/runs/${runId}/action-result`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiClient.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    step_index: stepIndex,
                    action: agentResult.action,
                    result: agentResult.result,
                    agent_id: agentResult.agent_id  // Identify which parallel agent
                })
            });

            if (!response.ok) {
                console.error(`[PullExecutor] Failed to report parallel agent result: ${response.status}`);
                return { status: 'error' };
            }

            const data = await response.json();
            console.log(`[PullExecutor] [${agentResult.agent_id}] Result reported: ${data.status}`);

            // Update UI if handler is registered
            if (this.onParallelAgentsUpdate && data.parallel_agents_summary) {
                this.onParallelAgentsUpdate({
                    runId,
                    agents: data.parallel_agents_summary,
                    status: data.is_parallel_web_agents ? 'running' : 'complete'
                });
            }

            return data;
        } catch (error) {
            console.error(`[PullExecutor] Error reporting parallel agent result:`, error);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Set callback for parallel agents UI updates
     */
    setParallelAgentsHandler(handler) {
        this.onParallelAgentsUpdate = handler;
    }
}

module.exports = { PullExecutor };
