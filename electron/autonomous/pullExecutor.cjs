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

class PullExecutor {
    constructor(apiClient, config = {}) {
        this.apiClient = apiClient;
        this.maxRetries = config.maxRetries || 3;
        this.timeoutMs = config.timeoutMs || 90000; // 90 seconds
        this.pollIntervalMs = config.pollIntervalMs || 1000;
        this.isRunning = false;
        this.currentRunId = null;
        this.stepResults = []; // Track completed steps for context
        this.systemContext = this.getSystemContext(); // Cache system context
        this.userContext = {}; // User-specific context (e.g., google_user_email)

        // Cancellation support - allows interrupting active operations
        this.abortController = null;
        this.activeChildProcesses = new Set(); // Track spawned processes for cleanup
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
        
        return {
            os: os.platform(),
            user: os.userInfo().username,
            home_dir: os.homedir(),
            desktop_path: path.join(os.homedir(), 'Desktop'),
            shell: process.env.SHELL || 'bash',
            // Location context
            timezone: timezone,
            locale: locale,
            country: country,
            local_time: localTime
        };
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
                    'Authorization': `Bearer ${this.apiClient.token}`,
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
            google_user_email: this.userContext?.google_user_email || global.executorUserContext?.google_user_email
        };
        console.log(`[PullExecutor] Context for arg gen - google_user_email: ${fullContext.google_user_email || 'NOT SET'}`);
        
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
                    'Authorization': `Bearer ${this.apiClient.token}`,
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
                    
                    // Store result for future context
                    this.stepResults.push(finalResult);
                    
                    return finalResult;
                }

                lastError = result.error || `Exit code ${result.exit_code}`;

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
        if (tool === 'shell.command' || tool === 'command' || tool === 'shell_exec') {
            return await this.executeShellCommand(args, timeoutSec, step);
        } else if (tool === 'fs.write') {
            return await this.executeFileWrite(args, step);
        } else if (tool === 'fs.read') {
            return await this.executeFileRead(args);
        } else if (tool === 'browser' || tool === 'web_search') {
            return await this.executeBrowserSearch(args);
        } else if (tool === 'web_fetch') {
            // Direct URL fetch tool
            const url = args.url || args.fetch_url;
            if (!url) {
                return {
                    success: false,
                    error: 'web_fetch requires a url parameter',
                    exit_code: 1
                };
            }
            return await this.fetchUrlContent(url);
        } else if (tool === 'think') {
            return await this.executeThink(args);
        } else if (tool === 'user_input') {
            return await this.executeUserInput(args);
        } else if (tool === 'start_background_process') {
            return await this.executeStartBackgroundProcess(args);
        } else if (tool === 'monitor_process') {
            return await this.executeMonitorProcess(args);
        } else if (tool === 'stop_process') {
            return await this.executeStopProcess(args);
        } else if (tool === 'screenshot') {
            return await this.executeScreenshot(args);
        } else if (tool === 'clipboard_read' || tool === 'clipboard.read') {
            return await this.executeClipboardRead(args);
        } else if (tool === 'clipboard_write' || tool === 'clipboard.write') {
            return await this.executeClipboardWrite(args);
        } else if (tool === 'mouse_click' || tool === 'mouse.click') {
            return await this.executeMouseClick(args);
        } else if (tool === 'mouse_move' || tool === 'mouse.move') {
            return await this.executeMouseMove(args);
        } else if (tool === 'system_info' || tool === 'system.info') {
            return await this.executeSystemInfo(args);
        } else if (tool === 'notify' || tool === 'notification') {
            return await this.executeNotification(args);
        } else if (tool === 'open_url') {
            return await this.executeOpenUrl(args);
        } else if (tool === 'open_file') {
            return await this.executeOpenFile(args);
        } else if (tool === 'list_apps' || tool === 'running_apps') {
            return await this.executeListApps(args);
        } else if (tool === 'focus_app' || tool === 'activate_app') {
            return await this.executeFocusApp(args);
        } else if (tool === 'type_text' || tool === 'type') {
            return await this.executeTypeText(args);
        } else if (tool === 'hotkey' || tool === 'keyboard_shortcut') {
            return await this.executeHotkey(args);
        } else if (tool === 'window_resize' || tool === 'resize_window') {
            return await this.executeWindowResize(args);
        } else if (tool === 'window_arrange' || tool === 'arrange_windows') {
            return await this.executeWindowArrange(args);
        } else if (tool === 'get_active_window' || tool === 'active_window') {
            return await this.executeGetActiveWindow(args);
        } else if (tool === 'dictate' || tool === 'speak' || tool === 'say') {
            return await this.executeDictate(args);
        } else if (tool === 'play_sound' || tool === 'audio_play') {
            return await this.executePlaySound(args);
        } else if (tool === 'file_watch' || tool === 'watch_directory') {
            return await this.executeFileWatch(args);
        } else if (tool === 'google_command') {
            // google_command is a wrapper - extract the action from args
            const action = args.action || 'google.gmail.list_messages';
            return await this.executeGoogleAction(action, args);
        } else if (tool.startsWith('google.')) {
            return await this.executeGoogleAction(tool, args);
        } else {
            return {
                success: false,
                error: `Unsupported tool: ${tool}`,
                exit_code: -1
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
                        resolve({
                            success: code === 0,
                            stdout,
                            stderr,
                            exit_code: code || 0,
                            error: code !== 0 ? `Exit code ${code}` : undefined
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

    /**
     * Execute file read
     */
    async executeFileRead(args) {
        const fs = require('fs').promises;

        try {
            const filePath = args.path || args.file_path;
            const content = await fs.readFile(filePath, 'utf8');

            return {
                success: true,
                stdout: content,
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
                body = JSON.stringify({
                    user_email: userEmail,
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
                    'Authorization': `Bearer ${this.apiClient.token}`,
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
     * This is like having a second person type for you
     */
    async executeTypeText(args) {
        try {
            const text = args.text || args.content || '';
            const delay = args.delay || args.delay_ms || 50; // ms between keystrokes
            const pressEnter = args.press_enter || args.enter || false;

            if (!text) {
                return {
                    success: false,
                    error: 'Must provide text to type',
                    exit_code: 1
                };
            }

            console.log(`[PullExecutor] Typing ${text.length} characters into focused app`);

            const os = require('os');
            if (os.platform() === 'darwin') {
                // Escape special characters for AppleScript
                const escaped = text
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n');

                let script = `
                    tell application "System Events"
                        keystroke "${escaped}"
                    end tell
                `;

                if (pressEnter) {
                    script = `
                        tell application "System Events"
                            keystroke "${escaped}"
                            keystroke return
                        end tell
                    `;
                }

                await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

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
}

module.exports = { PullExecutor };
